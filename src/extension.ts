import * as vscode from "vscode";
import { Logger } from "./logger";
import { featureLoader } from "./featureLoader";
import { getAllModules } from "./modules";

/**
 * 扩展激活时调用
 */
export async function activate(context: vscode.ExtensionContext) {
  const activationStarted = Date.now();
  // 从配置中加载日志级别
  Logger.loadLogLevelFromConfig();

  Logger.info("Fusi Tools is activating...");

  // 监听配置变化，动态更新日志级别
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("fusi-tools.logLevel")) {
        Logger.loadLogLevelFromConfig();
        Logger.info("日志级别已更新");
      }
    })
  );

  // 注册所有功能模块
  featureLoader.registerAll(getAllModules());

  // 先注册懒触发入口，再激活启动模块
  featureLoader.registerLazyEntrypoints(context);
  await featureLoader.activateStartupModules(context);

  Logger.info(`[perf][activate] 扩展激活总耗时 ${Date.now() - activationStarted}ms`);
  Logger.info("Fusi Tools activation completed.");
}

/**
 * 扩展停用时调用
 */
export async function deactivate() {
  await featureLoader.deactivateAll();
}
