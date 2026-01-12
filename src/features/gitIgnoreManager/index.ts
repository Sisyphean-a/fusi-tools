import * as vscode from 'vscode';
import { IgnoreStateManager } from './ignoreState';
import { IgnoreViewProvider, registerTreeView } from './ignoreViewProvider';
import { CommandHandlers, registerCommands } from './commandHandlers';
import * as gitService from './gitService';
import * as config from './configuration';
import { Logger } from '../../logger';

/**
 * 激活 Git Ignore Manager 功能
 */
export function activate(context: vscode.ExtensionContext): void {
  const gitIgnoreEnabled = vscode.workspace
    .getConfiguration('fusi-tools')
    .get<boolean>('gitIgnoreManager.enabled', true);

  if (!gitIgnoreEnabled) {
    Logger.info('Git Ignore Manager is disabled');
    return;
  }

  Logger.info('Activating Git Ignore Manager...');

  // 初始化状态管理器
  const stateManager = new IgnoreStateManager();
  context.subscriptions.push(stateManager);

  // 创建 TreeView 提供者
  const viewProvider = new IgnoreViewProvider(stateManager);
  context.subscriptions.push(viewProvider);

  // 注册 TreeView
  const treeView = registerTreeView(context, viewProvider, stateManager);

  // 创建命令处理器
  const commandHandlers = new CommandHandlers(stateManager, treeView);

  // 注册所有命令
  registerCommands(context, commandHandlers);

  // 监听配置变化
  context.subscriptions.push(
    config.onConfigurationChanged(() => {
      Logger.info('Git Ignore Manager configuration updated');
    })
  );

  // 初始加载忽略列表
  initializeIgnoreList(stateManager);

  Logger.info('Git Ignore Manager activated');
}

/**
 * 初始化忽略文件列表
 */
async function initializeIgnoreList(stateManager: IgnoreStateManager): Promise<void> {
  try {
    const repos = await gitService.getAllRepoRoots();
    if (repos.length > 0) {
      Logger.info(`Git Ignore Manager: Found ${repos.length} Git repositories`);
      await stateManager.loadAll(repos);
      Logger.info('Git Ignore Manager initialized');
    } else {
      Logger.info('Git Ignore Manager: No Git repositories found');
    }
  } catch (error) {
    Logger.error(`Git Ignore Manager initialization error: ${error}`);
  }
}
