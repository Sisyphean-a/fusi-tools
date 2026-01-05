import * as vscode from "vscode";
import { CommitOption } from "./ai";
import { SmartChange } from "./git";

// 1. 提交选项 (生成的 Commit Message)
export class CommitItem extends vscode.TreeItem {
  constructor(public readonly option: CommitOption) {
    super(option.type, vscode.TreeItemCollapsibleState.None);
    this.description = option.description; // e.g., "Short summary"
    this.tooltip = option.message;

    // When clicked, trigger the apply command with the message
    this.command = {
      command: "fusi-tools.applyCommit",
      title: "Apply",
      arguments: [option.message],
    };

    this.contextValue = "commitItem";
  }
}

// 2. 预处理文件项 (叶子节点)
export class PreProcessFileItem extends vscode.TreeItem {
  constructor(change: SmartChange) {
    // 使用文件名作为 Label
    // 使用状态作为 description
    // e.g. "utils.ts" [TRUNCATED]
    super(
      change.relativePath.split("/").pop() || change.relativePath,
      vscode.TreeItemCollapsibleState.None
    );

    this.description = change.status === "FULL" ? "" : `[${change.status}]`;
    // Tooltip 显示完整路径和一些解释
    this.tooltip = new vscode.MarkdownString(
      `**${change.relativePath}**\n\nStatus: ${change.status}`
    );
    this.resourceUri = vscode.Uri.file(change.relativePath); // 可选：显示文件图标

    // 如果是 FULL 或 TRUNCATED，点击可能可以查看 Diff? 暂时不绑定命令
    this.contextValue = "preProcessFile";
  }
}

// 3. 预处理分组 (折叠容器)
export class PreProcessGroupItem extends vscode.TreeItem {
  constructor(public readonly changes: SmartChange[]) {
    super("暂存文件预处理结果", vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `(${changes.length} 文件)`;
    this.tooltip = "点击查看 AI 预处理后的文件状态列表";
    this.contextValue = "preProcessGroup";
  }
}

export class AiCommitViewProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private commitItems: CommitItem[] = [];
  private preProcessGroup: PreProcessGroupItem | undefined;

  /**
   * 更新生成结果
   */
  refresh(options: CommitOption[]): void {
    this.commitItems = options.map((opt) => new CommitItem(opt));
    this._onDidChangeTreeData.fire();
  }

  /**
   * 更新预处理结果 (文件列表)
   */
  updatePreProcess(changes: SmartChange[]): void {
    this.preProcessGroup = new PreProcessGroupItem(changes);
    // 默认展开
    this.preProcessGroup.collapsibleState =
      vscode.TreeItemCollapsibleState.Expanded;
    // 清空旧的生成结果，因为这是新的开始
    this.commitItems = [];
    this._onDidChangeTreeData.fire();
  }

  /**
   * 显示加载状态
   */
  showLoading(message: string = "正在分析暂存文件..."): void {
    this.commitItems = [];
    this.preProcessGroup = undefined;
    // 用临时 Item 显示加载状态
    const loadingItem = new vscode.TreeItem(
      message,
      vscode.TreeItemCollapsibleState.None
    );
    loadingItem.iconPath = new vscode.ThemeIcon("loading~spin");
    loadingItem.contextValue = "loading";
    (this.commitItems as any) = [loadingItem];
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.commitItems = [];
    this.preProcessGroup = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: vscode.TreeItem
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    // 根节点
    if (!element) {
      const children: vscode.TreeItem[] = [];

      // 1. 如果有预处理结果，显示分组
      if (this.preProcessGroup) {
        children.push(this.preProcessGroup);
      }

      // 2. 如果有生成的提交选项，追加在后面
      if (this.commitItems.length > 0) {
        children.push(...this.commitItems);
      }

      return children;
    }

    // 预处理分组的子节点
    if (element instanceof PreProcessGroupItem) {
      return element.changes.map((c) => new PreProcessFileItem(c));
    }

    return [];
  }
}
