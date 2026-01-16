import * as vscode from "vscode";
import { ResourceCommands } from "./commands";
import { Logger } from "../../logger";

/**
 * 激活 Resource Manager 功能
 */
export function activate(context: vscode.ExtensionContext) {
  Logger.info("Activating Resource Manager...");

  const config = vscode.workspace.getConfiguration("fusi-tools");
  const enabled = config.get<boolean>("resourceManager.enabled", true);

  if (!enabled) {
    Logger.info("Resource Manager is disabled by configuration.");
    return;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.copyName",
      (uri: vscode.Uri) => {
        ResourceCommands.copyName(uri);
      }
    ),
    vscode.commands.registerCommand(
      "fusi-tools.copyRelativeName",
      (uri: vscode.Uri) => {
        ResourceCommands.copyRelativeName(uri);
      }
    ),
    vscode.commands.registerCommand(
      "fusi-tools.generateTree",
      (uri: vscode.Uri) => {
        ResourceCommands.generateTree(uri);
      }
    ),
    vscode.commands.registerCommand(
      "fusi-tools.copyFile",
      (uri: vscode.Uri) => {
        ResourceCommands.copyFile(uri);
      }
    )
  );

  Logger.info("Resource Manager activated.");
}
