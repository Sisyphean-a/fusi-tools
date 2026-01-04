import * as vscode from 'vscode';

export class GitService {
    private get gitApi() {
        const extension = vscode.extensions.getExtension('vscode.git');
        return extension?.exports?.getAPI(1);
    }

    private get repository() {
        const api = this.gitApi;
        if (!api || api.repositories.length === 0) {
            return undefined;
        }
        // In a real scenario, might want to pick the repo based on active editor
        // For now, simplicity: pick the first one
        return api.repositories[0];
    }

    /**
     * 获取暂存区的 Diff。
     */
    async getStagedDiff(): Promise<string | null> {
        const repo = this.repository;
        if (!repo) {
            return null;
        }

        // 通过库对象运行 git diff --cached
        // API 暴露了 .diff(cached?: boolean)
        // 如果类型不完美，我们可能会遇到错误
        try {
            const diff = await repo.diff(true);
            return diff || null;
        } catch (error) {
            console.error('获取 diff 失败:', error);
            return null;
        }
    }

    /**
     * 将提交信息设置到 SCM 输入框。
     */
    setCommitMessage(message: string) {
        const repo = this.repository;
        if (repo) {
            repo.inputBox.value = message;
        }
    }
}
