import * as vscode from 'vscode';
import { GitService } from './git';
import { AiService } from './ai';
import { AiCommitViewProvider, CommitItem } from './treeProvider';

export function activate(context: vscode.ExtensionContext) {
    const gitService = new GitService();
    const aiService = new AiService();
    const provider = new AiCommitViewProvider();

    // 1. 注册 TreeDataProvider
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('fusi-tools.aiCommitView', provider)
    );

    // 2. 注册生成命令
    context.subscriptions.push(
        vscode.commands.registerCommand('fusi-tools.generateCommit', async () => {
            // 在 SCM 视图或通知中显示进度
            // 使用通知 (Notification) 可以获得更好的可见性，避免 SCM 视图过窄
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AI 提交助手：正在生成提交信息...',
                cancellable: false
            }, async () => {
                try {
                    // 检查暂存区 diff
                    const diff = await gitService.getStagedDiff();
                    if (!diff) {
                        vscode.window.showWarningMessage('未发现暂存更改，请先暂存文件。');
                        return;
                    }

                    // 清空之前的记录
                    provider.clear();

                    // 调用混合策略 AI 服务
                    // 回调函数会被多次调用，随着数据生成逐步更新
                    await aiService.generateHybrid(diff, (options) => {
                        provider.refresh(options);
                    });
                    
                    // 聚焦到视图
                    vscode.commands.executeCommand('fusi-tools.aiCommitView.focus');
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`生成失败: ${error.message}`);
                }
            });
        })
    );

    // 3. 注册应用命令
    context.subscriptions.push(
        vscode.commands.registerCommand('fusi-tools.applyCommit', (arg: string | CommitItem) => {
            let message = '';
            
            if (typeof arg === 'string') {
                // 点击 TreeItem 触发（传入参数为字符串）
                message = arg;
            } else if (arg instanceof CommitItem) {
                // 右键菜单触发
                message = arg.option.message;
            } else {
                 // 兜底或错误处理
                 console.error('applyCommit 参数无效', arg);
                 return;
            }

            if (message) {
                gitService.setCommitMessage(message);
                // 可选：聚焦输入框？Git 扩展没有公开聚焦 API
                // 通常只设置值就够了。
            }
        })
    );
}
