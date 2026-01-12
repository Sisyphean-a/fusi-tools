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

  // 延迟初始化标志
  let isInitialized = false;
  let stateManager: IgnoreStateManager | undefined;
  let viewProvider: IgnoreViewProvider | undefined;
  let treeView: vscode.TreeView<any> | undefined;
  let commandHandlers: CommandHandlers | undefined;

  /**
   * 延迟初始化函数
   */
  const lazyInitialize = async () => {
    if (isInitialized) {
      return;
    }

    Logger.info('Git Ignore Manager: 开始延迟初始化...');
    isInitialized = true;

    // 初始化状态管理器
    stateManager = new IgnoreStateManager();
    context.subscriptions.push(stateManager);

    // 创建 TreeView 提供者
    viewProvider = new IgnoreViewProvider(stateManager);
    context.subscriptions.push(viewProvider);

    // 注册 TreeView
    treeView = registerTreeView(context, viewProvider, stateManager);

    // 创建命令处理器
    commandHandlers = new CommandHandlers(stateManager, treeView);

    // 注册所有命令
    registerCommands(context, commandHandlers);

    // 监听配置变化
    context.subscriptions.push(
      config.onConfigurationChanged(() => {
        Logger.info('Git Ignore Manager configuration updated');
      })
    );

    // 初始加载忽略列表
    await initializeIgnoreList(stateManager);

    Logger.info('Git Ignore Manager: 延迟初始化完成');
  };

  // 监听视图可见性变化，首次可见时才初始化
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('fusi-tools.gitIgnoreManager.view', {
      getTreeItem: (element: any) => element,
      getChildren: async () => {
        // 首次访问时触发初始化
        if (!isInitialized) {
          await lazyInitialize();
        }
        return viewProvider?.getChildren() || [];
      }
    })
  );

  // 为命令注册占位符，实际执行时才初始化
  const commandsToRegister = [
    'fusi-tools.gitIgnoreManager.ignoreAssumeUnchanged',
    'fusi-tools.gitIgnoreManager.ignoreSkipWorktree',
    'fusi-tools.gitIgnoreManager.showIgnored',
    'fusi-tools.gitIgnoreManager.unignore',
    'fusi-tools.gitIgnoreManager.refresh'
  ];

  for (const commandId of commandsToRegister) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async (...args: any[]) => {
        // 确保已初始化
        if (!isInitialized) {
          await lazyInitialize();
        }
        // 执行实际命令
        return vscode.commands.executeCommand(`${commandId}.internal`, ...args);
      })
    );
  }

  Logger.info('Git Ignore Manager: 已注册（延迟加载模式）');
}

/**
 * 初始化忽略文件列表
 */
async function initializeIgnoreList(stateManager: IgnoreStateManager): Promise<void> {
  try {
    const repos = await gitService.getAllRepoRoots();
    if (repos.length > 0) {
      Logger.debug(`Git Ignore Manager: Found ${repos.length} Git repositories`);
      await stateManager.loadAll(repos);
      Logger.debug('Git Ignore Manager: 忽略列表已加载');
    } else {
      Logger.debug('Git Ignore Manager: No Git repositories found');
    }
  } catch (error) {
    Logger.error(`Git Ignore Manager initialization error: ${error}`);
  }
}
