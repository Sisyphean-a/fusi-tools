import * as vscode from 'vscode';
import { ScratchpadViewProvider } from './features/scratchpad/ScratchpadViewProvider';
import * as aiCommit from './features/aiCommit';

/**
 * 扩展激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('Fusi Tools is now active!');

	// 注册 Scratchpad 视图提供者
	registerScratchpad(context);

    // 激活 AI Commit 助手
    aiCommit.activate(context);

	// Hello World 命令（示例）
	const disposable = vscode.commands.registerCommand('fusi-tools.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Fusi Tools!');
	});

	context.subscriptions.push(disposable);
}

/**
 * 注册 Scratchpad 功能
 */
function registerScratchpad(context: vscode.ExtensionContext): void {
	const config = vscode.workspace.getConfiguration('fusi-tools');
	const scratchpadEnabled = config.get<boolean>('scratchpad.enabled', true);

	if (scratchpadEnabled) {
		const scratchpadProvider = new ScratchpadViewProvider(context.extensionUri);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(
				ScratchpadViewProvider.viewType,
				scratchpadProvider
			)
		);
	}
}

/**
 * 扩展停用时调用
 */
export function deactivate() {}
