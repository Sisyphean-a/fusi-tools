import * as vscode from "vscode";
import { ScratchpadViewProvider } from "./features/scratchpad/ScratchpadViewProvider";
import * as aiCommit from "./features/aiCommit";
import * as smartTranslate from "./features/smartTranslate";
import * as projectFavorites from "./features/projectFavorites";
import * as resourceManager from "./features/resourceManager";
import { Logger } from "./logger";

/**
 * 扩展激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
  Logger.info("Fusi Tools is activating...");

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
