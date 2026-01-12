import * as vscode from 'vscode';
import * as gitService from './gitService';

export interface IgnoredFile {
    repoRoot: string;
    relPath: string;
    type: 'assume' | 'skip';
    timestamp: number;
}

/**
 * 状态管理器 - 管理所有仓库的忽略文件列表
 */
export class IgnoreStateManager {
    private files: IgnoredFile[] = [];
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    /**
     * 获取当前所有忽略的文件
     */
    getAll(): IgnoredFile[] {
        return [...this.files];
    }

    /**
     * 获取指定类型的忽略文件
     */
    getByType(type: 'assume' | 'skip'): IgnoredFile[] {
        return this.files.filter(f => f.type === type);
    }

    /**
     * 获取指定仓库的忽略文件
     */
    getByRepo(repoRoot: string): IgnoredFile[] {
        return this.files.filter(f => f.repoRoot === repoRoot);
    }

    /**
     * 从所有仓库加载忽略文件列表
     */
    async loadAll(repos: string[]): Promise<void> {
        const allFiles: IgnoredFile[] = [];
        const timestamp = Date.now();

        for (const repoRoot of repos) {
            try {
                const ignoredFiles = await gitService.listIgnoredFiles(repoRoot);
                for (const file of ignoredFiles) {
                    allFiles.push({
                        repoRoot,
                        relPath: file.relPath,
                        type: file.type,
                        timestamp
                    });
                }
            } catch (error) {
                console.error(`加载仓库 ${repoRoot} 的忽略列表失败:`, error);
            }
        }

        this.files = allFiles;
        this._onDidChange.fire();
    }

    /**
     * 重新加载指定仓库的忽略列表
     */
    async reloadRepo(repoRoot: string): Promise<void> {
        try {
            const ignoredFiles = await gitService.listIgnoredFiles(repoRoot);
            const timestamp = Date.now();

            // 移除该仓库的旧数据
            this.files = this.files.filter(f => f.repoRoot !== repoRoot);

            // 添加新数据
            for (const file of ignoredFiles) {
                this.files.push({
                    repoRoot,
                    relPath: file.relPath,
                    type: file.type,
                    timestamp
                });
            }

            this._onDidChange.fire();
        } catch (error) {
            console.error(`重新加载仓库 ${repoRoot} 失败:`, error);
            throw error;
        }
    }

    /**
     * 添加单个忽略文件
     */
    add(file: IgnoredFile): void {
        // 检查是否已存在
        const exists = this.files.some(
            f => f.repoRoot === file.repoRoot && f.relPath === file.relPath
        );

        if (!exists) {
            this.files.push(file);
            this._onDidChange.fire();
        }
    }

    /**
     * 移除单个忽略文件
     */
    remove(repoRoot: string, relPath: string): void {
        const originalLength = this.files.length;
        this.files = this.files.filter(
            f => !(f.repoRoot === repoRoot && f.relPath === relPath)
        );

        if (this.files.length !== originalLength) {
            this._onDidChange.fire();
        }
    }

    /**
     * 清空所有状态
     */
    clear(): void {
        this.files = [];
        this._onDidChange.fire();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this._onDidChange.dispose();
    }
}
