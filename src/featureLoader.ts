import * as vscode from "vscode";
import { FeatureActivationResult, FeatureModule } from "./types/feature";
import { Logger } from "./logger";

const PERF_PREFIX = "[perf]";

function failureResult(error: Error): FeatureActivationResult {
  return { success: false, error };
}

function successResult(disabled = false): FeatureActivationResult {
  return { success: true, disabled };
}

export class FeatureLoader {
  private modules = new Map<string, FeatureModule>();
  private activatedModules = new Set<string>();
  private activationResults = new Map<string, FeatureActivationResult>();
  private initializingModules = new Map<string, Promise<FeatureActivationResult>>();

  register(module: FeatureModule): void {
    if (this.modules.has(module.name)) {
      Logger.warn(`模块 ${module.name} 已注册，将被覆盖`);
    }
    this.modules.set(module.name, module);
  }

  registerAll(modules: FeatureModule[]): void {
    for (const module of modules) {
      this.register(module);
    }
  }

  async activateAll(
    context: vscode.ExtensionContext
  ): Promise<Map<string, FeatureActivationResult>> {
    return this.activateStartupModules(context);
  }

  async activateStartupModules(
    context: vscode.ExtensionContext
  ): Promise<Map<string, FeatureActivationResult>> {
    const modules = Array.from(this.modules.values()).filter((module) => {
      return (module.activationStrategy ?? "startup") === "startup";
    });

    Logger.info(
      `${PERF_PREFIX}[activate] 启动阶段激活 ${modules.length} 个模块`
    );
    await this.activateModulesParallel(modules, context);
    return this.activationResults;
  }

  registerLazyEntrypoints(context: vscode.ExtensionContext): void {
    for (const module of this.modules.values()) {
      const strategy = module.activationStrategy ?? "startup";
      if (strategy === "startup") {
        continue;
      }
      if ((module.commandTriggers?.length ?? 0) > 0) {
        this.registerCommandTriggers(module, context);
      }
      if ((module.viewTriggers?.length ?? 0) > 0) {
        this.registerViewTriggers(module, context);
      }
    }
  }

  async deactivateAll(): Promise<void> {
    Logger.info("正在停用所有功能模块...");

    for (const name of this.activatedModules) {
      const module = this.modules.get(name);
      if (!module?.deactivate) {
        continue;
      }
      try {
        await module.deactivate();
        Logger.debug(`模块 ${name} 已停用`);
      } catch (error) {
        Logger.error(`模块 ${name} 停用时发生错误`, error);
      }
    }

    this.activatedModules.clear();
    Logger.info("所有功能模块已停用");
  }

  getActivationResult(name: string): FeatureActivationResult | undefined {
    return this.activationResults.get(name);
  }

  isActivated(name: string): boolean {
    return this.activatedModules.has(name);
  }

  getRegisteredModules(): string[] {
    return Array.from(this.modules.keys());
  }

  getActivatedModules(): string[] {
    return Array.from(this.activatedModules);
  }

  private async activateModulesParallel(
    modules: FeatureModule[],
    context: vscode.ExtensionContext
  ): Promise<void> {
    const startTime = Date.now();
    const jobs = modules.map((module) => this.ensureModuleActivated(module.name, context));

    await Promise.allSettled(jobs);

    const successful = Array.from(this.activationResults.entries())
      .filter(([_, result]) => result.success && !result.disabled)
      .map(([name]) => name);
    const disabled = Array.from(this.activationResults.entries())
      .filter(([_, result]) => result.success && result.disabled)
      .map(([name]) => name);
    const failed = Array.from(this.activationResults.entries())
      .filter(([_, result]) => !result.success)
      .map(([name]) => name);

    const elapsed = Date.now() - startTime;
    Logger.info(
      `${PERF_PREFIX}[activate] 模块激活完成 (${elapsed}ms): 成功 ${successful.length}, 禁用 ${disabled.length}, 失败 ${failed.length}`
    );
    if (failed.length > 0) {
      Logger.warn(`以下模块激活失败: ${failed.join(", ")}`);
    }
  }

  private registerCommandTriggers(
    module: FeatureModule,
    context: vscode.ExtensionContext
  ): void {
    const triggers = module.commandTriggers ?? [];
    for (const commandId of triggers) {
      let disposable: vscode.Disposable | undefined;
      disposable = vscode.commands.registerCommand(commandId, async (...args: unknown[]) => {
        const result = await this.ensureModuleActivated(module.name, context);
        if (!result.success) {
          this.showModuleError(module.name, result.error);
          return;
        }
        if (result.disabled) {
          vscode.window.showInformationMessage(`功能 "${module.name}" 已被禁用`);
          return;
        }
        disposable?.dispose();
        await vscode.commands.executeCommand(commandId, ...args);
      });
      context.subscriptions.push(disposable);
    }
  }

  private registerViewTriggers(
    module: FeatureModule,
    context: vscode.ExtensionContext
  ): void {
    const triggers = module.viewTriggers ?? [];
    for (const viewId of triggers) {
      let disposable: vscode.Disposable | undefined;
      disposable = vscode.window.registerTreeDataProvider(viewId, {
        getTreeItem: (element: vscode.TreeItem) => element,
        getChildren: async () => {
          const result = await this.ensureModuleActivated(module.name, context);
          if (!result.success) {
            return [new vscode.TreeItem(`模块 ${module.name} 加载失败`)];
          }
          disposable?.dispose();
          return [];
        },
      });
      context.subscriptions.push(disposable);
    }
  }

  private async ensureModuleActivated(
    moduleName: string,
    context: vscode.ExtensionContext
  ): Promise<FeatureActivationResult> {
    const existing = this.activationResults.get(moduleName);
    if (existing?.success) {
      return existing;
    }

    const pending = this.initializingModules.get(moduleName);
    if (pending) {
      return pending;
    }

    const module = this.modules.get(moduleName);
    if (!module) {
      const error = new Error(`模块 ${moduleName} 未注册`);
      const result = failureResult(error);
      this.activationResults.set(moduleName, result);
      return result;
    }

    const task = this.safeActivate(module, context).finally(() => {
      this.initializingModules.delete(moduleName);
    });
    this.initializingModules.set(moduleName, task);
    return task;
  }

  private async safeActivate(
    module: FeatureModule,
    context: vscode.ExtensionContext
  ): Promise<FeatureActivationResult> {
    try {
      const started = Date.now();
      Logger.debug(`正在激活模块: ${module.name}...`);
      const result = await module.activate(context);
      const elapsed = Date.now() - started;
      Logger.info(`${PERF_PREFIX}[module:${module.name}] 激活耗时 ${elapsed}ms`);

      if (!result.success) {
        Logger.error(`模块 ${module.name} 激活失败`, result.error);
        this.showModuleError(module.name, result.error);
      } else if (result.disabled) {
        Logger.info(`模块 ${module.name} 已被配置禁用`);
        this.activatedModules.add(module.name);
      } else {
        Logger.info(`模块 ${module.name} 激活成功`);
        this.activatedModules.add(module.name);
      }

      this.activationResults.set(module.name, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      Logger.error(`模块 ${module.name} 激活时发生异常`, err);
      this.showModuleError(module.name, err);

      const result = failureResult(err);
      this.activationResults.set(module.name, result);
      return result;
    }
  }

  private showModuleError(moduleName: string, error?: Error): void {
    const message = error?.message || "未知错误";
    vscode.window
      .showWarningMessage(
        `Fusi Tools: 模块 "${moduleName}" 加载失败 - ${message}`,
        "查看日志"
      )
      .then((selection) => {
        if (selection === "查看日志") {
          Logger.show();
        }
      });
  }
}

export const featureLoader = new FeatureLoader();

export { successResult as createSuccessResult, failureResult as createFailureResult };
