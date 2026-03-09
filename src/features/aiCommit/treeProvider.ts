import * as vscode from "vscode";
import { CommitOption } from "./ai";
import { SmartChange } from "./git";

// 1. 提交选项 (生成的 Commit Message)
export class CommitItem extends vscode.TreeItem {
  constructor(public readonly option: CommitOption) {
    super(option.type, vscode.TreeItemCollapsibleState.None);
    this.description = option.description; // e.g., "Short summary"
    this.tooltip = option.message;
    this.iconPath = new vscode.ThemeIcon("git-commit");

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
    super(
      change.relativePath.split("/").pop() || change.relativePath,
      vscode.TreeItemCollapsibleState.None
    );

    this.description = change.status === "完整" ? "" : `[${change.status}]`;

    // Tooltip 显示统计信息
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**文件：** \`${change.relativePath}\`\n\n`);
    md.appendMarkdown(`**状态：** ${change.status}\n\n`);
    md.appendMarkdown(`--- \n\n`);
    md.appendMarkdown(`**修改统计：**\n\n`);
    md.appendMarkdown(`- 新增行数：\`${change.additions}\`\n`);
    md.appendMarkdown(`- 删除行数：\`${change.deletions}\`\n`);
    md.appendMarkdown(`- 字符数：\`${change.chars}\`\n`);
    md.appendMarkdown(`- 估算 Token：\`${change.tokens}\`\n`);

    md.isTrusted = true;
    this.tooltip = md;
    this.resourceUri = vscode.Uri.file(change.relativePath);

    this.contextValue = "preProcessFile";
  }
}

// 3. 预处理分组 (折叠容器)
export class PreProcessGroupItem extends vscode.TreeItem {
  constructor(
    public count: number,
    public stats?: { additions: number; deletions: number; net: number }
  ) {
    super("暂存文件预处理结果", vscode.TreeItemCollapsibleState.Expanded);
    this.updateDescription();
    this.updateTooltip();
    this.iconPath = new vscode.ThemeIcon("file-submodule");
    this.contextValue = "preProcessGroup";
  }

  private updateDescription() {
    if (this.stats) {
      // 简洁格式: (3 文件) +123 -45 =+78
      const netSign = this.stats.net >= 0 ? "+" : "";
      this.description = `(${this.count} 文件) +${this.stats.additions} -${this.stats.deletions} =${netSign}${this.stats.net}`;
    } else {
      this.description = `(${this.count} 文件)`;
    }
  }

  private updateTooltip() {
    if (this.stats) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**文件数量：** ${this.count}\n\n`);
      md.appendMarkdown(`**代码变更统计：**\n\n`);
      md.appendMarkdown(`- 🟢 新增行数：\`+${this.stats.additions}\`\n`);
      md.appendMarkdown(`- 🔴 删除行数：\`-${this.stats.deletions}\`\n`);
      const netSign = this.stats.net >= 0 ? "+" : "";
      md.appendMarkdown(`- 📊 净新增：\`${netSign}${this.stats.net}\`\n`);
      md.isTrusted = true;
      this.tooltip = md;
    } else {
      this.tooltip = "点击查看 AI 预处理后的文件状态列表";
    }
  }

  updateStats(stats: { additions: number; deletions: number; net: number }) {
    this.stats = stats;
    this.updateDescription();
    this.updateTooltip();
  }
}

// 4. AI 建议分组 (折叠容器) - 新增
export class CommitGroupItem extends vscode.TreeItem {
  constructor(public count: number) {
    super("AI 提交建议", vscode.TreeItemCollapsibleState.Expanded);
    this.description = `(${count} 条建议)`;
    this.tooltip = "AI 生成的 Commit Message 建议";
    this.iconPath = new vscode.ThemeIcon("sparkle");
    this.contextValue = "commitGroup";
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

  // 数据源
  private commitOptions: CommitOption[] = [];
  private changes: SmartChange[] = [];

  // 固定节点
  private commitGroup: CommitGroupItem;
  private preProcessGroup: PreProcessGroupItem;

  constructor() {
    this.commitGroup = new CommitGroupItem(0);
    this.preProcessGroup = new PreProcessGroupItem(0, undefined);
  }

  /**
   * 更新生成结果
   */
  refresh(options: CommitOption[]): void {
    this.commitOptions = options;
    this.commitGroup.description = `(${options.length} 条建议)`;
    this._onDidChangeTreeData.fire(undefined); // 刷新整个树
  }

  /**
   * 更新预处理结果 (文件列表)
   */
  updatePreProcess(changes: SmartChange[]): void {
    this.changes = changes;

    // 计算总体统计
    const stats = changes.reduce(
      (acc, change) => ({
        additions: acc.additions + (change.additions || 0),
        deletions: acc.deletions + (change.deletions || 0),
      }),
      { additions: 0, deletions: 0 }
    );
    const net = stats.additions - stats.deletions;

    this.preProcessGroup.updateStats({ ...stats, net });

    // 清空旧的生成结果，因为这是新的开始
    this.commitOptions = [];
    this.commitGroup.description = `(0 条建议)`;

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * 显示加载状态 (清空当前，显示Loading)
   * 实际上现在结构变了，Loading 怎么显示？
   * 可以把 Loading 显示在 suggestions 下面，或者清空 suggestions
   */
  showLoading(): void {
    this.commitOptions = [];
    this.changes = [];
    this.commitGroup.description = `(0)`;
    this.preProcessGroup = new PreProcessGroupItem(0, undefined);
    this.preProcessGroup.description = `(分析中...)`;

    // 这里其实可以做一个特殊的 Loading Item 放在 group 里，但简单起见先清空
    this._onDidChangeTreeData.fire(undefined);
  }

  clear(): void {
    this.commitOptions = [];
    this.changes = [];
    this.commitGroup.description = `(0)`;
    this.preProcessGroup = new PreProcessGroupItem(0, undefined);
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: vscode.TreeItem
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    // 根节点：永远返回两个分组
    if (!element) {
      return [this.commitGroup, this.preProcessGroup];
    }

    // AI 建议分组的内容
    if (element === this.commitGroup) {
      if (this.commitOptions.length === 0) {
        // 可选：返回一个“暂无建议”节点
        return [
          new vscode.TreeItem("暂无建议", vscode.TreeItemCollapsibleState.None),
        ];
      }
      return this.commitOptions.map((opt) => new CommitItem(opt));
    }

    // 预处理分组的内容
    if (element === this.preProcessGroup) {
      if (this.changes.length === 0) {
        // 可选：返回一个“暂无文件”节点
        return [
          new vscode.TreeItem(
            "暂无预处理结果",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
      return this.changes.map((c) => new PreProcessFileItem(c));
    }

    return [];
  }
}
