import * as vscode from 'vscode';
import * as path from 'path';
import { WorktreeInfo, listWorktrees, getRepoRoot } from './worktreeService';
import { Logger } from '../../logger';

type TreeItemData = WorktreeItem | ActionItem;

interface WorktreeItem {
    type: 'worktree';
    info: WorktreeInfo;
}

interface ActionItem {
    type: 'action';
    action: 'openIntegratedTerminal' | 'openExternalTerminal' | 'pull' | 'push' | 'revealInExplorer' | 'openInVsCode';
    label: string;
    worktreePath: string;
}

/**
 * Git Worktree TreeView Provider
 */
export class WorktreeProvider implements vscode.TreeDataProvider<TreeItemData> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItemData | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private repoRoot: string | null = null;
    private worktrees: WorktreeInfo[] = [];

    /**
     * 刷新视图
     */
    async refresh(): Promise<void> {
        await this.loadWorktrees();
        this._onDidChangeTreeData.fire();
    }

    /**
     * 加载 worktrees (懒加载)
     */
    private async loadWorktrees(): Promise<void> {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            this.worktrees = [];
            this.repoRoot = null;
            return;
        }

        try {
            this.repoRoot = await getRepoRoot(folders[0].uri.fsPath);
            if (!this.repoRoot) {
                this.worktrees = [];
                return;
            }

            this.worktrees = await listWorktrees(this.repoRoot);
            Logger.info(`Loaded ${this.worktrees.length} worktrees`);
        } catch (error) {
            Logger.error(`Failed to load worktrees: ${error}`);
            this.worktrees = [];
        }
    }

    /**
     * 获取树节点
     */
    getTreeItem(element: TreeItemData): vscode.TreeItem {
        if (element.type === 'worktree') {
            return this.createWorktreeItem(element);
        } else {
            return this.createActionItem(element);
        }
    }

    /**
     * 获取子节点
     */
    async getChildren(element?: TreeItemData): Promise<TreeItemData[]> {
        if (!element) {
            // 根节点: 返回所有 worktrees
            // 懒加载: 只有在展开时才加载
            if (this.worktrees.length === 0) {
                await this.loadWorktrees();
            }

            if (this.worktrees.length === 0) {
                return [];
            }

            return this.worktrees.map(info => ({ type: 'worktree' as const, info }));
        }

        if (element.type === 'worktree') {
            // Worktree 节点: 返回操作列表
            return this.createActionItems(element.info.path);
        }

        return [];
    }

    /**
     * 创建 Worktree 节点
     */
    private createWorktreeItem(item: WorktreeItem): vscode.TreeItem {
        const { info } = item;
        const treeItem = new vscode.TreeItem(
            info.branch,
            vscode.TreeItemCollapsibleState.Collapsed
        );

        treeItem.description = path.basename(info.path);
        treeItem.tooltip = new vscode.MarkdownString(
            `**分支:** ${info.branch}\n\n**路径:** \`${info.path}\`\n\n**提交:** \`${info.commit.substring(0, 7)}\``
        );
        treeItem.iconPath = new vscode.ThemeIcon('git-branch');
        treeItem.contextValue = 'worktree';

        return treeItem;
    }

    /**
     * 创建操作项列表
     */
    private createActionItems(worktreePath: string): ActionItem[] {
        return [
            { type: 'action', action: 'openIntegratedTerminal', label: '在内置终端中打开', worktreePath },
            { type: 'action', action: 'openExternalTerminal', label: '在外部终端中打开', worktreePath },
            { type: 'action', action: 'pull', label: 'Pull', worktreePath },
            { type: 'action', action: 'push', label: 'Push', worktreePath },
            { type: 'action', action: 'revealInExplorer', label: '在文件夹中打开', worktreePath },
            { type: 'action', action: 'openInVsCode', label: '在当前编辑器中打开', worktreePath }
        ];
    }

    /**
     * 创建操作节点
     */
    private createActionItem(item: ActionItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.None);

        // 设置图标
        const iconMap: Record<ActionItem['action'], string> = {
            openIntegratedTerminal: 'terminal',
            openExternalTerminal: 'terminal-bash',
            pull: 'cloud-download',
            push: 'cloud-upload',
            revealInExplorer: 'folder-opened',
            openInVsCode: 'window'
        };
        treeItem.iconPath = new vscode.ThemeIcon(iconMap[item.action]);

        // 设置命令
        treeItem.command = {
            command: `fusi-tools.gitWorktree.${item.action}`,
            title: item.label,
            arguments: [item.worktreePath]
        };

        treeItem.contextValue = 'action';

        return treeItem;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
