import * as vscode from 'vscode';
import { WorktreeProvider } from './worktreeProvider';
import * as commands from './commands';
import { Logger } from '../../logger';

/**
 * 激活 Git Worktree 管理功能
 */
export function activate(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('fusi-tools.gitWorktree');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
        Logger.info('Git Worktree Manager is disabled');
        return;
    }

    Logger.info('Activating Git Worktree Manager');

    // 创建 Provider
    const provider = new WorktreeProvider();

    // 注册 TreeView
    const treeView = vscode.window.createTreeView('fusi-tools.gitWorktree.view', {
        treeDataProvider: provider,
        showCollapseAll: true
    });

    // 注册刷新命令
    context.subscriptions.push(
        vscode.commands.registerCommand('fusi-tools.gitWorktree.refresh', async () => {
            await provider.refresh();
        })
    );

    // 注册操作命令
    context.subscriptions.push(
        vscode.commands.registerCommand('fusi-tools.gitWorktree.openIntegratedTerminal', commands.openIntegratedTerminal),
        vscode.commands.registerCommand('fusi-tools.gitWorktree.openExternalTerminal', commands.openExternalTerminal),
        vscode.commands.registerCommand('fusi-tools.gitWorktree.pull', commands.pull),
        vscode.commands.registerCommand('fusi-tools.gitWorktree.push', commands.push),
        vscode.commands.registerCommand('fusi-tools.gitWorktree.revealInExplorer', commands.revealInExplorer),
        vscode.commands.registerCommand('fusi-tools.gitWorktree.openInVsCode', commands.openInVsCode)
    );

    context.subscriptions.push(treeView, provider);

    Logger.info('Git Worktree Manager activated');
}
