import * as vscode from 'vscode';
import { FeatureModule, FeatureActivationResult } from './types/feature';
import { Logger } from './logger';

/**
 * 功能模块加载器
 * 负责安全地加载和管理所有功能模块
 */
export class FeatureLoader {
  private modules: Map<string, FeatureModule> = new Map();
  private activatedModules: Set<string> = new Set();
  private activationResults: Map<string, FeatureActivationResult> = new Map();

  /**
   * 注册功能模块
   * @param module 功能模块实例
   */
  register(module: FeatureModule): void {
    if (this.modules.has(module.name)) {
      Logger.warn(`模块 ${module.name} 已注册，将被覆盖`);
    }
    this.modules.set(module.name, module);
  }

  /**
   * 批量注册功能模块
   * @param modules 功能模块实例数组
   */
  registerAll(modules: FeatureModule[]): void {
    for (const module of modules) {
      this.register(module);
    }
  }

  /**
   * 安全激活单个模块
   * @param module 功能模块
   * @param context VS Code 扩展上下文
   * @returns 激活结果
   */
  private async safeActivate(
    module: FeatureModule,
    context: vscode.ExtensionContext
  ): Promise<FeatureActivationResult> {
    try {
      Logger.debug(`正在激活模块: ${module.name}...`);
      const result = await module.activate(context);

      if (result.success) {
        this.activatedModules.add(module.name);
        if (result.disabled) {
          Logger.info(`模块 ${module.name} 已被配置禁用`);
        } else {
          Logger.info(`模块 ${module.name} 激活成功`);
        }
      } else {
        Logger.error(`模块 ${module.name} 激活失败`, result.error);
        this.showModuleError(module.name, result.error);
      }

      this.activationResults.set(module.name, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      Logger.error(`模块 ${module.name} 激活时发生异常`, err);
      this.showModuleError(module.name, err);

      const result: FeatureActivationResult = { success: false, error: err };
      this.activationResults.set(module.name, result);
      return result;
    }
  }

  /**
   * 激活所有已注册的模块
   * @param context VS Code 扩展上下文
   * @returns 所有模块的激活结果
   */
  async activateAll(context: vscode.ExtensionContext): Promise<Map<string, FeatureActivationResult>> {
    const startTime = Date.now();
    Logger.info(`开始激活 ${this.modules.size} 个功能模块...`);

    for (const [name, module] of this.modules) {
      await this.safeActivate(module, context);
    }

    // 汇总报告
    const successful = Array.from(this.activationResults.entries())
      .filter(([_, r]) => r.success && !r.disabled)
      .map(([name]) => name);

    const disabled = Array.from(this.activationResults.entries())
      .filter(([_, r]) => r.success && r.disabled)
      .map(([name]) => name);

    const failed = Array.from(this.activationResults.entries())
      .filter(([_, r]) => !r.success)
      .map(([name]) => name);

    const elapsed = Date.now() - startTime;
    Logger.info(
      `模块激活完成 (${elapsed}ms): ` +
      `成功 ${successful.length}, 禁用 ${disabled.length}, 失败 ${failed.length}`
    );

    if (failed.length > 0) {
      Logger.warn(`以下模块激活失败: ${failed.join(', ')}`);
    }

    return this.activationResults;
  }

  /**
   * 停用所有模块
   */
  async deactivateAll(): Promise<void> {
    Logger.info('正在停用所有功能模块...');

    for (const name of this.activatedModules) {
      const module = this.modules.get(name);
      if (module?.deactivate) {
        try {
          await module.deactivate();
          Logger.debug(`模块 ${name} 已停用`);
        } catch (error) {
          Logger.error(`模块 ${name} 停用时发生错误`, error);
        }
      }
    }

    this.activatedModules.clear();
    Logger.info('所有功能模块已停用');
  }

  /**
   * 获取模块激活结果
   * @param name 模块名称
   * @returns 激活结果，如果模块未注册则返回 undefined
   */
  getActivationResult(name: string): FeatureActivationResult | undefined {
    return this.activationResults.get(name);
  }

  /**
   * 检查模块是否已激活
   * @param name 模块名称
   * @returns 是否已激活
   */
  isActivated(name: string): boolean {
    return this.activatedModules.has(name);
  }

  /**
   * 获取所有已注册的模块名称
   * @returns 模块名称数组
   */
  getRegisteredModules(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * 获取所有已激活的模块名称
   * @returns 模块名称数组
   */
  getActivatedModules(): string[] {
    return Array.from(this.activatedModules);
  }

  /**
   * 显示模块错误提示
   * @param moduleName 模块名称
   * @param error 错误对象
   */
  private showModuleError(moduleName: string, error?: Error): void {
    const message = error?.message || '未知错误';
    vscode.window.showWarningMessage(
      `Fusi Tools: 模块 "${moduleName}" 加载失败 - ${message}`,
      '查看日志'
    ).then(selection => {
      if (selection === '查看日志') {
        Logger.show();
      }
    });
  }
}

/**
 * 全局功能加载器实例
 */
export const featureLoader = new FeatureLoader();
