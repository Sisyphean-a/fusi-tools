import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreStateManager, IgnoredFile } from './ignoreState';
import * as gitService from './gitService';
import * as config from './configuration';
import { Logger } from '../../logger';

type TreeItemData = GroupItem | FileItem;

interface GroupItem {
    type: 'group';
    label: string;
    ignoreType: 'assume' | 'skip';
}

interface FileItem {
    type: 'file';
    file: IgnoredFile;
}

/**
 * TreeView 数据提供者
 */
export class IgnoreViewProvider implements vscode.TreeDataProvider<TreeItemData> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItemData | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private stateManager: IgnoreStateManager
    ) {
        // 监听状态变化
        stateManager.onDidChange(() => {
            this.refresh();
        });
    }

    /**
     * 刷新视图
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * 获取树节点
     */
    getTreeItem(element: TreeItemData): vscode.TreeItem {
        if (element.type === 'group') {
            return this.createGroupItem(element);
        } else {
            return this.createFileItem(element);
        }
    }

    /**
     * 获取子节点
     */
    getChildren(element?: TreeItemData): vscode.ProviderResult<TreeItemData[]> {
        if (!element) {
            // 根节点：返回两个分组
            return [
                { type: 'group', label: 'Assume-Unchanged', ignoreType: 'assume' },
                { type: 'group', label: 'Skip-Worktree', ignoreType: 'skip' }
            ];
        }

        if (element.type === 'group') {
            // 分组节点：返回该类型的所有文件
            const files = this.stateManager.getByType(element.ignoreType);
            return files.map(file => ({ type: 'file' as const, file }));
        }

        return [];
    }

    /**
     * 创建分组节点
     */
    private createGroupItem(item: GroupItem): vscode.TreeItem {
        const files = this.stateManager.getByType(item.ignoreType);
        const treeItem = new vscode.TreeItem(
            item.label,
            files.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
        );
        
        treeItem.description = `${files.length} 个文件`;
        treeItem.contextValue = 'group';
        
        return treeItem;
    }

    /**
     * 创建文件节点
     */
    private createFileItem(item: FileItem): vscode.TreeItem {
        const file = item.file;
        const fileName = path.basename(file.relPath);
        const dirPath = path.dirname(file.relPath);
        
        const treeItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.None);
        
        // 显示相对路径作为描述
        treeItem.description = dirPath === '.' ? '' : dirPath;
        
        // 使用圆点图标
        treeItem.iconPath = new vscode.ThemeIcon(
            'circle-outline',
            new vscode.ThemeColor('descriptionForeground')
        );
        
        // 设置上下文值，用于右键菜单
        treeItem.contextValue = `ignoredFile-${file.type}`;
        
        // 设置工具提示
        treeItem.tooltip = this.createTooltip(file);
        
        // 点击时打开文件
        const fullPath = path.join(file.repoRoot, file.relPath);
        treeItem.command = {
            command: 'vscode.open',
            title: '打开文件',
            arguments: [vscode.Uri.file(fullPath)]
        };
        
        return treeItem;
    }

    /**
     * 创建文件提示信息
     */
    private createTooltip(file: IgnoredFile): vscode.MarkdownString {
        const fullPath = path.join(file.repoRoot, file.relPath);
        const typeLabel = file.type === 'assume' ? 'Assume-Unchanged' : 'Skip-Worktree';
        
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**路径:** \`${fullPath}\`\n\n`);
        tooltip.appendMarkdown(`**类型:** ${typeLabel}\n\n`);
        tooltip.appendMarkdown(`**仓库:** \`${file.repoRoot}\`\n\n`);
        
        if (config.getShowCommandHints()) {
            const command = file.type === 'assume'
                ? `git update-index --assume-unchanged "${file.relPath}"`
                : `git update-index --skip-worktree "${file.relPath}"`;
            tooltip.appendMarkdown(`**命令:** \`${command}\`\n`);
        }
        
        tooltip.isTrusted = true;
        return tooltip;
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * 注册 TreeView
 */
export function registerTreeView(
    context: vscode.ExtensionContext,
    provider: IgnoreViewProvider,
    stateManager: IgnoreStateManager
): vscode.TreeView<TreeItemData> {
    const treeView = vscode.window.createTreeView('fusi-tools.gitIgnoreManager.view', {
        treeDataProvider: provider,
        showCollapseAll: false
    });

    // 监听视图可见性变化
    context.subscriptions.push(
        treeView.onDidChangeVisibility(async e => {
            if (e.visible && config.getRefreshOnFocus()) {
                try {
                    const repos = await gitService.getAllRepoRoots();
                    await stateManager.loadAll(repos);
                } catch (error) {
                    Logger.error(`Git Ignore Manager auto-refresh failed: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(treeView);
    return treeView;
}
