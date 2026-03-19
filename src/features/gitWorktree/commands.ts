import * as vscode from 'vscode';
import * as path from 'path';
import { getGitRepositories } from '../git/shared/repositoryResolver';
import {
    createWorktree,
    pullWorktree,
    pushWorktree,
    removeWorktree,
} from './worktreeService';
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

function sanitizeBranchName(branchName: string): string {
    return branchName.replace(/[\\/:*?"<>|]/g, '-');
}

function parseRepoRoot(input?: unknown): string | undefined {
    if (!input) {
        return undefined;
    }
    if (typeof input === 'string') {
        return input;
    }
    if (typeof input === 'object' && 'repoRoot' in input) {
        const repoRoot = (input as { repoRoot?: unknown }).repoRoot;
        if (typeof repoRoot === 'string') {
            return repoRoot;
        }
    }
    return undefined;
}

function parseDeleteTarget(
    repoOrItem: unknown,
    worktreePathArg?: string
): { repoRoot: string; worktreePath: string } | null {
    const repoRoot = parseRepoRoot(repoOrItem);
    if (repoRoot && worktreePathArg) {
        return { repoRoot, worktreePath: worktreePathArg };
    }

    if (typeof repoOrItem === 'object' && repoOrItem) {
        if ('info' in repoOrItem) {
            const info = (repoOrItem as { info?: { path?: unknown } }).info;
            if (repoRoot && info && typeof info.path === 'string') {
                return { repoRoot, worktreePath: info.path };
            }
        }
        if ('worktreePath' in repoOrItem) {
            const worktreePath = (repoOrItem as { worktreePath?: unknown }).worktreePath;
            if (repoRoot && typeof worktreePath === 'string') {
                return { repoRoot, worktreePath };
            }
        }
    }

    return null;
}

async function pickRepoRoot(repoRoot?: string): Promise<string | null> {
    if (repoRoot) {
        return repoRoot;
    }

    const repositories = getGitRepositories();
    if (repositories.length === 0) {
        vscode.window.showErrorMessage('当前工作区未检测到 Git 仓库');
        return null;
    }

    if (repositories.length === 1) {
        return repositories[0].rootUri.fsPath;
    }

    const pick = await vscode.window.showQuickPick(
        repositories.map((repo) => ({
            label: path.basename(repo.rootUri.fsPath),
            description: repo.rootUri.fsPath,
            repoRoot: repo.rootUri.fsPath,
        })),
        { title: '请选择要创建 Worktree 的仓库' }
    );

    return pick?.repoRoot || null;
}

export async function createNewWorktree(repoRootOrItem?: unknown): Promise<void> {
    const targetRepoRoot = await pickRepoRoot(parseRepoRoot(repoRootOrItem));
    if (!targetRepoRoot) {
        return;
    }

    const branchName = await vscode.window.showInputBox({
        title: '新建 Worktree',
        prompt: '请输入分支名',
        ignoreFocusOut: true,
        validateInput: (value) => value.trim() ? null : '分支名不能为空',
    });
    if (!branchName) {
        return;
    }

    const mode = await vscode.window.showQuickPick(
        [
            { label: '创建新分支', value: true },
            { label: '使用已有分支', value: false },
        ],
        { title: '请选择创建方式' }
    );
    if (!mode) {
        return;
    }

    const defaultPath = path.join(
        path.dirname(targetRepoRoot),
        `${path.basename(targetRepoRoot)}-${sanitizeBranchName(branchName)}`
    );
    const worktreePath = await vscode.window.showInputBox({
        title: '新建 Worktree',
        prompt: '请输入 Worktree 路径',
        value: defaultPath,
        ignoreFocusOut: true,
        validateInput: (value) => value.trim() ? null : '路径不能为空',
    });
    if (!worktreePath) {
        return;
    }

    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: '正在创建 Worktree...', cancellable: false },
            async () => createWorktree(targetRepoRoot, {
                worktreePath: worktreePath.trim(),
                branchName: branchName.trim(),
                createBranch: mode.value,
            })
        );
        vscode.window.showInformationMessage(`Worktree 创建成功: ${worktreePath}`);
    } catch (error) {
        Logger.error(`Create worktree failed: ${error}`);
        vscode.window.showErrorMessage(`创建 Worktree 失败: ${error}`);
    }
}

export async function deleteWorktree(repoOrItem: unknown, worktreePathArg?: string): Promise<void> {
    const target = parseDeleteTarget(repoOrItem, worktreePathArg);
    if (!target) {
        vscode.window.showErrorMessage('删除 Worktree 失败: 未解析到目标 Worktree');
        return;
    }

    const { repoRoot, worktreePath } = target;

    const action = await vscode.window.showWarningMessage(
        `删除 Worktree: ${worktreePath}`,
        { modal: true },
        '普通删除',
        '强制删除'
    );
    if (!action) {
        return;
    }

    const force = action === '强制删除';

    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: '正在删除 Worktree...', cancellable: false },
            async () => removeWorktree(repoRoot, { worktreePath, force })
        );
        vscode.window.showInformationMessage(`Worktree 删除成功: ${worktreePath}`);
    } catch (error) {
        Logger.error(`Remove worktree failed: ${error}`);
        vscode.window.showErrorMessage(`删除 Worktree 失败: ${error}`);
    }
}
