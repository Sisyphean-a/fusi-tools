import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

/**
 * Git Worktree 信息
 */
export interface WorktreeInfo {
    path: string;
    branch: string;
    commit: string;
}

/**
 * 获取当前仓库的所有 worktrees
 */
export async function listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    try {
        const { stdout } = await execAsync('git worktree list --porcelain', {
            cwd: repoRoot,
            encoding: 'utf8'
        });

        return parseWorktreeList(stdout);
    } catch (error: any) {
        throw new Error(`Failed to list worktrees: ${error.message}`);
    }
}

/**
 * 解析 git worktree list --porcelain 输出
 * 格式:
 * worktree /path/to/worktree
 * HEAD commit_hash
 * branch refs/heads/branch_name
 */
function parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    let currentWorktree: Partial<WorktreeInfo> = {};

    for (const line of lines) {
        if (line.startsWith('worktree ')) {
            // 保存上一个 worktree
            if (currentWorktree.path) {
                worktrees.push(currentWorktree as WorktreeInfo);
            }
            currentWorktree = { path: line.substring(9).trim() };
        } else if (line.startsWith('HEAD ')) {
            currentWorktree.commit = line.substring(5).trim();
        } else if (line.startsWith('branch ')) {
            const branchRef = line.substring(7).trim();
            currentWorktree.branch = branchRef.replace('refs/heads/', '');
        } else if (line.startsWith('detached')) {
            currentWorktree.branch = `(detached)`;
        }
    }

    // 保存最后一个 worktree
    if (currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
    }

    return worktrees;
}

/**
 * 在指定 worktree 中执行 git pull
 */
export async function pullWorktree(worktreePath: string): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync('git pull', {
            cwd: worktreePath,
            encoding: 'utf8'
        });
        return stdout || stderr;
    } catch (error: any) {
        throw new Error(`Pull failed: ${error.message}`);
    }
}

/**
 * 在指定 worktree 中执行 git push
 */
export async function pushWorktree(worktreePath: string): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync('git push', {
            cwd: worktreePath,
            encoding: 'utf8'
        });
        return stdout || stderr;
    } catch (error: any) {
        throw new Error(`Push failed: ${error.message}`);
    }
}

/**
 * 获取仓库根目录
 */
export async function getRepoRoot(folderPath: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync('git rev-parse --show-toplevel', {
            cwd: folderPath,
            encoding: 'utf8'
        });
        return stdout.trim();
    } catch {
        return null;
    }
}
