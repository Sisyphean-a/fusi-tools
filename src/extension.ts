import * as vscode from "vscode";
import { ScratchpadViewProvider } from "./features/scratchpad/ScratchpadViewProvider";
import * as aiCommit from "./features/aiCommit";
import * as smartTranslate from "./features/smartTranslate";
import * as projectFavorites from "./features/projectFavorites";
import * as resourceManager from "./features/resourceManager";
import * as gitIgnoreManager from "./features/gitIgnoreManager";
import * as gitWorktree from "./features/gitWorktree";
import { Logger } from "./logger";

/**
 * 扩展激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
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

  // 注册 Scratchpad 视图提供者
  registerScratchpad(context);

  // 激活 AI Commit 助手
  aiCommit.activate(context);

  // 激活 智能翻译功能
  smartTranslate.activate(context);

  // 激活 项目常用文件 (Favorites)
  projectFavorites.activate(context);

  // 激活 资源管理器增强 (Resource Manager)
  resourceManager.activate(context);

  // 激活 Git Ignore Manager
  gitIgnoreManager.activate(context);

  // 激活 Git Worktree 管理
  gitWorktree.activate(context);

  // Hello World 命令（示例）
  const disposable = vscode.commands.registerCommand(
    "fusi-tools.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from Fusi Tools!");
      Logger.info("Hello World command executed");
    }
  );

  context.subscriptions.push(disposable);
  Logger.info("Fusi Tools activation completed.");
}

/**
 * 注册 Scratchpad 功能
 */
function registerScratchpad(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration("fusi-tools");
  const scratchpadEnabled = config.get<boolean>("scratchpad.enabled", true);

  if (scratchpadEnabled) {
    const scratchpadProvider = new ScratchpadViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        ScratchpadViewProvider.viewType,
        scratchpadProvider
      )
    );
  }
}

/**
 * 扩展停用时调用
 */
export function deactivate() {}
