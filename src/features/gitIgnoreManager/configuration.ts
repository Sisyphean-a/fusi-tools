import * as vscode from 'vscode';

const CONFIG_SECTION = 'fusi-tools.gitIgnoreManager';

/**
 * 获取配置：视图获得焦点时是否自动刷新
 */
export function getRefreshOnFocus(): boolean {
    return vscode.workspace.getConfiguration(CONFIG_SECTION).get('refreshOnFocus', true);
}

/**
 * 获取配置：默认忽略类型
 */
export function getDefaultIgnoreType(): 'assume' | 'skip' {
    const value = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>('defaultIgnoreType', 'assume');
    return value === 'skip' ? 'skip' : 'assume';
}

/**
 * 获取配置：是否显示命令提示
 */
export function getShowCommandHints(): boolean {
    return vscode.workspace.getConfiguration(CONFIG_SECTION).get('showCommandHints', true);
}

/**
 * 监听配置变化
 */
export function onConfigurationChanged(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(CONFIG_SECTION)) {
            callback(e);
        }
    });
}
