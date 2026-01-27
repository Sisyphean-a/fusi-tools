import * as vscode from "vscode";
import { Logger } from "./logger";
import { featureLoader } from "./featureLoader";
import { getAllModules } from "./modules";

/**
 * 扩展激活时调用
 */
export async function activate(context: vscode.ExtensionContext) {
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

  // 激活所有模块（带错误处理）
  await featureLoader.activateAll(context);

  Logger.info("Fusi Tools activation completed.");
}

/**
 * 扩展停用时调用
 */
export async function deactivate() {
  await featureLoader.deactivateAll();
}
