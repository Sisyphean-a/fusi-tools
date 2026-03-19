import * as vscode from 'vscode';
import * as path from 'path';
import { WorktreeInfo, listWorktrees } from './worktreeService';
import { getGitRepositories } from '../git/shared/repositoryResolver';
import { Logger } from '../../logger';

type TreeItemData = RepoItem | WorktreeItem | ActionItem;

interface RepoItem {
    type: 'repo';
    repoRoot: string;
    repoName: string;
}

interface WorktreeItem {
    type: 'worktree';
    repoRoot: string;
    info: WorktreeInfo;
}

interface ActionItem {
    type: 'action';
    action: 'openIntegratedTerminal' | 'openExternalTerminal' | 'pull' | 'push' | 'revealInExplorer' | 'openInVsCode' | 'deleteWorktree';
    label: string;
    repoRoot: string;
    worktreePath: string;
}

/**
 * Git Worktree TreeView Provider
 */
export class WorktreeProvider implements vscode.TreeDataProvider<TreeItemData> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItemData | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private groupedWorktrees: Array<{ repoRoot: string; repoName: string; worktrees: WorktreeInfo[] }> = [];

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
        const repositories = getGitRepositories();
        if (repositories.length === 0) {
            this.groupedWorktrees = [];
            return;
        }

        try {
            const groups = await Promise.all(
                repositories.map(async (repository) => {
                    const repoRoot = repository.rootUri.fsPath;
                    const worktrees = await listWorktrees(repoRoot);
                    return {
                        repoRoot,
                        repoName: path.basename(repoRoot),
                        worktrees,
                    };
                })
            );
            this.groupedWorktrees = groups;
            const totalCount = groups.reduce((sum, group) => sum + group.worktrees.length, 0);
            Logger.info(`Loaded ${totalCount} worktrees from ${groups.length} repositories`);
        } catch (error) {
            Logger.error(`Failed to load worktrees: ${error}`);
            this.groupedWorktrees = [];
        }
    }

    /**
     * 获取树节点
     */
    getTreeItem(element: TreeItemData): vscode.TreeItem {
        if (element.type === 'repo') {
            return this.createRepoItem(element);
        }
        if (element.type === 'worktree') {
            return this.createWorktreeItem(element);
        }
        return this.createActionItem(element);
    }

    /**
     * 获取子节点
     */
    async getChildren(element?: TreeItemData): Promise<TreeItemData[]> {
        if (!element) {
            if (this.groupedWorktrees.length === 0) {
                await this.loadWorktrees();
            }

            if (this.groupedWorktrees.length === 0) {
                return [];
            }

            return this.groupedWorktrees.map(group => ({
                type: 'repo' as const,
                repoRoot: group.repoRoot,
                repoName: group.repoName,
            }));
        }

        if (element.type === 'repo') {
            const group = this.groupedWorktrees.find(item => item.repoRoot === element.repoRoot);
            if (!group) {
                return [];
            }
            return group.worktrees.map(info => ({
                type: 'worktree' as const,
                repoRoot: group.repoRoot,
                info,
            }));
        }

        if (element.type === 'worktree') {
            return this.createActionItems(element.repoRoot, element.info.path);
        }

        return [];
    }

    /**
     * 创建仓库节点
     */
    private createRepoItem(item: RepoItem): vscode.TreeItem {
        const group = this.groupedWorktrees.find(g => g.repoRoot === item.repoRoot);
        const worktreeCount = group?.worktrees.length || 0;
        const treeItem = new vscode.TreeItem(
            item.repoName,
            worktreeCount > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
        );
        treeItem.description = `${worktreeCount} 个 Worktree`;
        treeItem.tooltip = new vscode.MarkdownString(`**仓库路径:** \`${item.repoRoot}\``);
        treeItem.iconPath = new vscode.ThemeIcon('repo');
        treeItem.contextValue = 'repository';
        return treeItem;
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
            `**仓库:** \`${item.repoRoot}\`\n\n**分支:** ${info.branch}\n\n**路径:** \`${info.path}\`\n\n**提交:** \`${info.commit.substring(0, 7)}\``
        );
        treeItem.iconPath = new vscode.ThemeIcon('git-branch');
        treeItem.contextValue = 'worktree';

        return treeItem;
    }

    /**
     * 创建操作项列表
     */
    private createActionItems(repoRoot: string, worktreePath: string): ActionItem[] {
        return [
            { type: 'action', action: 'openIntegratedTerminal', label: '在内置终端中打开', repoRoot, worktreePath },
            { type: 'action', action: 'openExternalTerminal', label: '在外部终端中打开', repoRoot, worktreePath },
            { type: 'action', action: 'pull', label: 'Pull', repoRoot, worktreePath },
            { type: 'action', action: 'push', label: 'Push', repoRoot, worktreePath },
            { type: 'action', action: 'revealInExplorer', label: '在文件夹中打开', repoRoot, worktreePath },
            { type: 'action', action: 'openInVsCode', label: '在当前编辑器中打开', repoRoot, worktreePath },
            { type: 'action', action: 'deleteWorktree', label: '删除 Worktree', repoRoot, worktreePath }
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
            openInVsCode: 'window',
            deleteWorktree: 'trash'
        };
        treeItem.iconPath = new vscode.ThemeIcon(iconMap[item.action]);

        // 设置命令
        treeItem.command = {
            command: `fusi-tools.gitWorktree.${item.action}`,
            title: item.label,
            arguments: item.action === 'deleteWorktree'
                ? [item.repoRoot, item.worktreePath]
                : [item.worktreePath]
        };

        treeItem.contextValue = 'action';

        return treeItem;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
