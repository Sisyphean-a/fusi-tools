import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface GitError {
    command: string;
    code: number;
    stderr: string;
}

export interface IgnoredFileInfo {
    relPath: string;
    type: 'assume' | 'skip';
}

/**
 * 获取指定目录的 Git 仓库根目录
 */
export async function getRepoRoot(folderPath: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync('git rev-parse --show-toplevel', {
            cwd: folderPath,
            encoding: 'utf8'
        });
        return stdout.trim().replace(/\//g, path.sep);
    } catch (error) {
        return null;
    }
}

/**
 * 列出仓库中所有被忽略的文件
 * 解析 git ls-files -v 输出：
 * - 'h' 开头表示 assume-unchanged
 * - 'S' 开头表示 skip-worktree
 */
export async function listIgnoredFiles(repoRoot: string): Promise<IgnoredFileInfo[]> {
    try {
        const { stdout } = await execAsync('git ls-files -v', {
            cwd: repoRoot,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        const lines = stdout.split('\n').filter(line => line.trim());
        const ignored: IgnoredFileInfo[] = [];

        for (const line of lines) {
            const flag = line[0];
            const filePath = line.slice(2).trim();

            if (flag === 'h') {
                ignored.push({ relPath: filePath, type: 'assume' });
            } else if (flag === 'S') {
                ignored.push({ relPath: filePath, type: 'skip' });
            }
        }

        return ignored;
    } catch (error: any) {
        throw createGitError('git ls-files -v', error);
    }
}

/**
 * 设置文件为 assume-unchanged
 */
export async function setAssumeUnchanged(repoRoot: string, filePath: string): Promise<void> {
    try {
        await execAsync(`git update-index --assume-unchanged "${filePath}"`, {
            cwd: repoRoot,
            encoding: 'utf8'
        });
    } catch (error: any) {
        throw createGitError(`git update-index --assume-unchanged "${filePath}"`, error);
    }
}

/**
 * 设置文件为 skip-worktree
 */
export async function setSkipWorktree(repoRoot: string, filePath: string): Promise<void> {
    try {
        await execAsync(`git update-index --skip-worktree "${filePath}"`, {
            cwd: repoRoot,
            encoding: 'utf8'
        });
    } catch (error: any) {
        throw createGitError(`git update-index --skip-worktree "${filePath}"`, error);
    }
}

/**
 * 清除文件的 assume-unchanged 标记
 */
export async function clearAssumeUnchanged(repoRoot: string, filePath: string): Promise<void> {
    try {
        await execAsync(`git update-index --no-assume-unchanged "${filePath}"`, {
            cwd: repoRoot,
            encoding: 'utf8'
        });
    } catch (error: any) {
        throw createGitError(`git update-index --no-assume-unchanged "${filePath}"`, error);
    }
}

/**
 * 清除文件的 skip-worktree 标记
 */
export async function clearSkipWorktree(repoRoot: string, filePath: string): Promise<void> {
    try {
        await execAsync(`git update-index --no-skip-worktree "${filePath}"`, {
            cwd: repoRoot,
            encoding: 'utf8'
        });
    } catch (error: any) {
        throw createGitError(`git update-index --no-skip-worktree "${filePath}"`, error);
    }
}

/**
 * 检查文件是否在 Git 仓库中被跟踪
 */
export async function isFileTracked(repoRoot: string, filePath: string): Promise<boolean> {
    try {
        await execAsync(`git ls-files --error-unmatch "${filePath}"`, {
            cwd: repoRoot,
            encoding: 'utf8'
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取所有工作区中的 Git 仓库根目录
 */
export async function getAllRepoRoots(): Promise<string[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return [];
    }

    const roots: string[] = [];
    const seen = new Set<string>();

    const rootPromises = folders.map(folder => getRepoRoot(folder.uri.fsPath));
    const results = await Promise.all(rootPromises);

    for (const root of results) {
        if (root && !seen.has(root)) {
            roots.push(root);
            seen.add(root);
        }
    }

    return roots;
}

/**
 * 创建统一的 Git 错误对象
 */
function createGitError(command: string, error: any): GitError {
    return {
        command,
        code: error.code || -1,
        stderr: error.stderr || error.message || '未知错误'
    };
}
