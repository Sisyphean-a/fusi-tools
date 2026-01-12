import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreStateManager, IgnoredFile } from './ignoreState';
import * as gitService from './gitService';
import * as config from './configuration';
import { Logger } from '../../logger';

/**
 * 命令处理器类
 */
export class CommandHandlers {
    constructor(
        private stateManager: IgnoreStateManager,
        private treeView: vscode.TreeView<any>
    ) {}

    /**
     * 使用 assume-unchanged 忽略文件
     */
    async ignoreAssumeUnchanged(resourceState?: any): Promise<void> {
        await this.ignoreFile('assume', resourceState);
    }

    /**
     * 使用 skip-worktree 忽略文件
     */
    async ignoreSkipWorktree(resourceState?: any): Promise<void> {
        await this.ignoreFile('skip', resourceState);
    }

    /**
     * 通用忽略文件方法
     */
    private async ignoreFile(type: 'assume' | 'skip', resourceState?: any): Promise<void> {
        try {
            let filePath: string;

            // 如果是从 SCM 资源状态调用（右键菜单）
            if (resourceState && resourceState.resourceUri) {
                filePath = resourceState.resourceUri.fsPath;
                Logger.info(`Git Ignore Manager: File from SCM resource: ${filePath}`);
            } else {
                // 否则打开文件选择对话框
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    openLabel: '选择要忽略的文件'
                });

                if (!fileUris || fileUris.length === 0) {
                    return;
                }

                filePath = fileUris[0].fsPath;
            }

            // 获取文件所在的 Git 仓库
            const repoRoot = await gitService.getRepoRoot(path.dirname(filePath));
            if (!repoRoot) {
                vscode.window.showErrorMessage('当前文件不在 Git 仓库中');
                Logger.error(`Git Ignore Manager: File ${filePath} is not in a Git repository`);
                return;
            }

            // 检查文件是否被 Git 跟踪
            const relPath = path.relative(repoRoot, filePath);
            const isTracked = await gitService.isFileTracked(repoRoot, relPath);
            if (!isTracked) {
                vscode.window.showWarningMessage('文件未被 Git 跟踪，请先使用 git add 添加文件');
                Logger.info(`Git Ignore Manager: Warning - File ${relPath} is not tracked by Git`);
                return;
            }

            // 执行忽略操作
            if (type === 'assume') {
                await gitService.setAssumeUnchanged(repoRoot, relPath);
                Logger.info(`Git Ignore Manager: Set assume-unchanged: ${relPath}`);
            } else {
                await gitService.setSkipWorktree(repoRoot, relPath);
                Logger.info(`Git Ignore Manager: Set skip-worktree: ${relPath}`);
            }

            // 刷新状态
            await this.stateManager.reloadRepo(repoRoot);

            const typeLabel = type === 'assume' ? 'Assume-Unchanged' : 'Skip-Worktree';
            vscode.window.showInformationMessage(`已使用 ${typeLabel} 忽略文件: ${path.basename(filePath)}`);

        } catch (error: any) {
            const message = error.stderr || error.message || '未知错误';
            vscode.window.showErrorMessage(`操作失败: ${message}`);
            Logger.error(`Git Ignore Manager: Operation failed: ${message}`);
            if (error.command) {
                Logger.error(`Git Ignore Manager: Command: ${error.command}`);
            }
        }
    }

    /**
     * 显示忽略文件列表（刷新并聚焦视图）
     */
    async showIgnored(): Promise<void> {
        try {
            Logger.info('Git Ignore Manager: Refreshing ignored files list...');
            const repos = await gitService.getAllRepoRoots();
            
            if (repos.length === 0) {
                vscode.window.showInformationMessage('当前工作区中没有 Git 仓库');
                Logger.info('Git Ignore Manager: No Git repositories found');
                return;
            }

            await this.stateManager.loadAll(repos);
            
            const totalFiles = this.stateManager.getAll().length;
            Logger.info(`Git Ignore Manager: Refresh complete, found ${totalFiles} ignored files`);
            
            // 聚焦到视图
            await vscode.commands.executeCommand('fusi-tools.gitIgnoreManager.view.focus');

        } catch (error: any) {
            const message = error.message || '未知错误';
            vscode.window.showErrorMessage(`刷新失败: ${message}`);
            Logger.error(`Git Ignore Manager: Refresh error: ${message}`);
        }
    }

    /**
     * 解除选中文件的忽略状态
     */
    async unignore(item?: any): Promise<void> {
        try {
            // 如果没有传入 item，尝试从 TreeView 选中项获取
            if (!item) {
                const selection = this.treeView.selection;
                if (!selection || selection.length === 0) {
                    vscode.window.showWarningMessage('请先选择要解除忽略的文件');
                    return;
                }
                item = selection[0];
            }

            // 检查是否是文件项
            if (!item || item.type !== 'file') {
                vscode.window.showWarningMessage('请选择一个文件');
                return;
            }

            const file: IgnoredFile = item.file;
            const { repoRoot, relPath, type } = file;

            // 确认操作
            const fileName = path.basename(relPath);
            const typeLabel = type === 'assume' ? 'Assume-Unchanged' : 'Skip-Worktree';
            const confirm = await vscode.window.showWarningMessage(
                `确定要解除文件 "${fileName}" 的 ${typeLabel} 状态吗？`,
                { modal: false },
                '确定'
            );

            if (confirm !== '确定') {
                return;
            }

            // 执行解除操作
            if (type === 'assume') {
                await gitService.clearAssumeUnchanged(repoRoot, relPath);
                Logger.info(`Git Ignore Manager: Cleared assume-unchanged: ${relPath}`);
            } else {
                await gitService.clearSkipWorktree(repoRoot, relPath);
                Logger.info(`Git Ignore Manager: Cleared skip-worktree: ${relPath}`);
            }

            // 刷新状态
            await this.stateManager.reloadRepo(repoRoot);

            vscode.window.showInformationMessage(`已解除忽略: ${fileName}`);

        } catch (error: any) {
            const message = error.stderr || error.message || '未知错误';
            vscode.window.showErrorMessage(`解除忽略失败: ${message}`);
            Logger.error(`Git Ignore Manager: Unignore error: ${message}`);
            if (error.command) {
                Logger.error(`Git Ignore Manager: Command: ${error.command}`);
            }
        }
    }

    /**
     * 刷新忽略文件列表
     */
    async refresh(): Promise<void> {
        try {
            Logger.info('Git Ignore Manager: Manual refresh...');
            const repos = await gitService.getAllRepoRoots();
            
            if (repos.length === 0) {
                vscode.window.showInformationMessage('当前工作区中没有 Git 仓库');
                Logger.info('Git Ignore Manager: No Git repositories found');
                return;
            }

            await this.stateManager.loadAll(repos);
            
            const totalFiles = this.stateManager.getAll().length;
            const assumeCount = this.stateManager.getByType('assume').length;
            const skipCount = this.stateManager.getByType('skip').length;
            
            Logger.info(
                `Git Ignore Manager: Refresh complete: ${totalFiles} files (Assume: ${assumeCount}, Skip: ${skipCount})`
            );
            
            if (config.getShowCommandHints()) {
                vscode.window.showInformationMessage(
                    `已刷新，共 ${totalFiles} 个忽略文件`
                );
            }

        } catch (error: any) {
            const message = error.message || '未知错误';
            vscode.window.showErrorMessage(`刷新失败: ${message}`);
            Logger.error(`Git Ignore Manager: Refresh error: ${message}`);
        }
    }
}

/**
 * 注册所有命令
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    handlers: CommandHandlers
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'fusi-tools.gitIgnoreManager.ignoreAssumeUnchanged',
            (resourceState) => handlers.ignoreAssumeUnchanged(resourceState)
        ),
        vscode.commands.registerCommand(
            'fusi-tools.gitIgnoreManager.ignoreSkipWorktree',
            (resourceState) => handlers.ignoreSkipWorktree(resourceState)
        ),
        vscode.commands.registerCommand(
            'fusi-tools.gitIgnoreManager.showIgnored',
            () => handlers.showIgnored()
        ),
        vscode.commands.registerCommand(
            'fusi-tools.gitIgnoreManager.unignore',
            (item) => handlers.unignore(item)
        ),
        vscode.commands.registerCommand(
            'fusi-tools.gitIgnoreManager.refresh',
            () => handlers.refresh()
        )
    );
}
