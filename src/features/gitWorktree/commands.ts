import * as vscode from 'vscode';
import { pullWorktree, pushWorktree } from './worktreeService';
import { Logger } from '../../logger';

/**
 * 在内置终端中打开 worktree
 */
export async function openIntegratedTerminal(worktreePath: string): Promise<void> {
    const terminal = vscode.window.createTerminal({
        name: `Worktree: ${worktreePath}`,
        cwd: worktreePath
    });
    terminal.show();
}

/**
 * 在外部终端中打开 worktree
 */
export async function openExternalTerminal(worktreePath: string): Promise<void> {
    const uri = vscode.Uri.file(worktreePath);
    await vscode.commands.executeCommand('openInTerminal', uri);
}

/**
 * 在指定 worktree 中执行 Pull
 */
export async function pull(worktreePath: string): Promise<void> {
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `正在 Pull: ${worktreePath}`,
                cancellable: false
            },
            async () => {
                const result = await pullWorktree(worktreePath);
                Logger.info(`Pull result: ${result}`);
                vscode.window.showInformationMessage(`Pull 成功: ${worktreePath}`);
            }
        );
    } catch (error) {
        Logger.error(`Pull failed: ${error}`);
        vscode.window.showErrorMessage(`Pull 失败: ${error}`);
    }
}

/**
 * 在指定 worktree 中执行 Push
 */
export async function push(worktreePath: string): Promise<void> {
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `正在 Push: ${worktreePath}`,
                cancellable: false
            },
            async () => {
                const result = await pushWorktree(worktreePath);
                Logger.info(`Push result: ${result}`);
                vscode.window.showInformationMessage(`Push 成功: ${worktreePath}`);
            }
        );
    } catch (error) {
        Logger.error(`Push failed: ${error}`);
        vscode.window.showErrorMessage(`Push 失败: ${error}`);
    }
}

/**
 * 在资源管理器中打开 worktree
 */
export async function revealInExplorer(worktreePath: string): Promise<void> {
    const uri = vscode.Uri.file(worktreePath);
    await vscode.commands.executeCommand('revealFileInOS', uri);
}

/**
 * 在当前 VS Code 窗口中打开 worktree
 */
export async function openInVsCode(worktreePath: string): Promise<void> {
    const uri = vscode.Uri.file(worktreePath);
    await vscode.commands.executeCommand('vscode.openFolder', uri, false);
}
