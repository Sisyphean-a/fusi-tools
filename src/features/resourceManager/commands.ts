import * as vscode from "vscode";
import * as path from "path";
import { TreeGenerator } from "./treeGenerator";
import { Logger } from "../../logger";

export class ResourceCommands {
  /**
   * 复制文件名到剪贴板
   * @param uri 选中的资源 URI
   */
  public static async copyName(uri: vscode.Uri) {
    if (!uri) {
      return;
    }

    const fileName = path.basename(uri.fsPath);
    await vscode.env.clipboard.writeText(fileName);
    Logger.info(`已复制文件名到剪贴板: ${fileName}`);
  }

  /**
   * 复制带 @ 的相对路径到剪贴板
   * @param uri 选中的资源 URI
   */
  public static async copyRelativeName(uri: vscode.Uri) {
    if (!uri) {
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      // 如果不在工作区内，回退到普通复制文件名
      return this.copyName(uri);
    }

    // 获取相对路径
    let relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    // Normalize path separators to forward slashes for consistency
    relativePath = relativePath.split(path.sep).join("/");

    const textToCopy = ` @${relativePath}`;
    await vscode.env.clipboard.writeText(textToCopy);
    Logger.info(`已复制相对路径到剪贴板: ${textToCopy}`);
  }

  /**
   * 生成目录结构树
   * @param uri 选中的资源 URI
   */
  public static async generateTree(uri: vscode.Uri) {
    if (!uri) {
      return;
    }

    // 检查是否为文件夹
    try {
      const stats = await vscode.workspace.fs.stat(uri);
      if (
        (stats.type & vscode.FileType.Directory) !==
        vscode.FileType.Directory
      ) {
        vscode.window.showWarningMessage("生成目录结构树命令仅适用于文件夹。");
        return;
      }
    } catch (e) {
      Logger.error(`Failed to stat file: ${uri.fsPath}`, e);
      return;
    }

    // 选项配置
    const depthOptions = [
      { label: "1 层", description: "仅子目录/文件", value: 1 },
      {
        label: "2 层",
        description: "子目录及其内容",
        value: 2,
      },
      { label: "3 层", description: "三层深度", value: 3 },
      { label: "所有层级", description: "递归完整目录树", value: -1 },
    ];

    const selected = await vscode.window.showQuickPick(depthOptions, {
      placeHolder: "选择生成目录树的层级深度",
    });

    if (!selected) {
      return;
    }

    try {
      let relativePath = "";
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (workspaceFolder) {
        relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
        relativePath = relativePath.split(path.sep).join("/");
      } else {
        relativePath = path.basename(uri.fsPath);
      }

      const treeOutput = await TreeGenerator.generate(uri.fsPath, {
        maxDepth: selected.value,
      });

      const finalOutput = `${relativePath}\n${treeOutput}`;

      await vscode.env.clipboard.writeText(finalOutput);
      vscode.window.showInformationMessage("目录结构树已复制到剪贴板！");
      Logger.info(`已生成目录树：${uri.fsPath}，深度：${selected.value}`);
    } catch (error) {
      Logger.error("生成目录树失败", error);
      vscode.window.showErrorMessage("生成目录树失败。");
    }
  }
}
