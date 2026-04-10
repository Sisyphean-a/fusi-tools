import * as vscode from 'vscode';
import { FeatureModule, FeatureActivationResult } from './types/feature';
import { isFeatureEnabled } from './utils/config';

// 导入各功能模块
import { ScratchpadViewProvider } from './features/scratchpad/ScratchpadViewProvider';
import * as aiCommit from './features/aiCommit';
import * as smartTranslate from './features/smartTranslate';
import * as projectFavorites from './features/projectFavorites';
import * as resourceManager from './features/resourceManager';
import * as gitIgnoreManager from './features/gitIgnoreManager';
import * as gitWorktree from './features/gitWorktree';

/**
 * 创建成功的激活结果
 */
function success(disabled = false): FeatureActivationResult {
  return { success: true, disabled };
}

/**
 * Scratchpad 模块
 */
export const scratchpadModule: FeatureModule = {
  name: 'scratchpad',
  activationStrategy: 'startup',

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('scratchpad')) {
      return success(true);
    }

    const scratchpadProvider = new ScratchpadViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        ScratchpadViewProvider.viewType,
        scratchpadProvider
      )
    );

    return success();
  }
};

/**
 * AI Commit 模块
 */
export const aiCommitModule: FeatureModule = {
  name: 'aiCommit',
  activationStrategy: 'command',
  commandTriggers: [
    'fusi-tools.previewSmartDiff',
    'fusi-tools.generateSmart',
    'fusi-tools.generateDirect',
    'fusi-tools.applyCommit',
    'fusi-tools.viewAiPrompt'
  ],
  viewTriggers: ['fusi-tools.aiCommitView'],

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('aiCommit')) {
      return success(true);
    }

    aiCommit.activate(context);
    return success();
  }
};

/**
 * Smart Translate 模块
 */
export const smartTranslateModule: FeatureModule = {
  name: 'smartTranslate',
  activationStrategy: 'startup',

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('smartTranslate')) {
      return success(true);
    }

    smartTranslate.activate(context);
    return success();
  },

  deactivate(): void {
    smartTranslate.deactivate();
  }
};

/**
 * Project Favorites 模块
 */
export const projectFavoritesModule: FeatureModule = {
  name: 'projectFavorites',
  activationStrategy: 'command',
  commandTriggers: [
    'fusi-tools.projectFavorites.addFile',
    'fusi-tools.projectFavorites.moveToCategory',
    'fusi-tools.projectFavorites.addCategory',
    'fusi-tools.projectFavorites.removeFile',
    'fusi-tools.projectFavorites.removeCategory',
    'fusi-tools.projectFavorites.renameCategory',
    'fusi-tools.projectFavorites.renameFile',
    'fusi-tools.projectFavorites.refresh'
  ],
  viewTriggers: ['fusi-tools.projectFavorites.view'],

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('projectFavorites')) {
      return success(true);
    }

    projectFavorites.activate(context);
    return success();
  }
};

/**
 * Resource Manager 模块
 */
export const resourceManagerModule: FeatureModule = {
  name: 'resourceManager',
  activationStrategy: 'command',
  commandTriggers: [
    'fusi-tools.copyName',
    'fusi-tools.copyRelativeName',
    'fusi-tools.copyCodeReference',
    'fusi-tools.generateTree',
    'fusi-tools.copyFile',
    'fusi-tools.customCopy'
  ],

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('resourceManager')) {
      return success(true);
    }

    resourceManager.activate(context);
    return success();
  }
};

/**
 * Git Ignore Manager 模块
 */
export const gitIgnoreManagerModule: FeatureModule = {
  name: 'gitIgnoreManager',
  activationStrategy: 'command',
  commandTriggers: [
    'fusi-tools.gitIgnoreManager.ignoreAssumeUnchanged',
    'fusi-tools.gitIgnoreManager.ignoreSkipWorktree',
    'fusi-tools.gitIgnoreManager.showIgnored',
    'fusi-tools.gitIgnoreManager.unignore',
    'fusi-tools.gitIgnoreManager.refresh'
  ],
  viewTriggers: ['fusi-tools.gitIgnoreManager.view'],

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('gitIgnoreManager')) {
      return success(true);
    }

    gitIgnoreManager.activate(context);
    return success();
  }
};

/**
 * Git Worktree 模块
 */
export const gitWorktreeModule: FeatureModule = {
  name: 'gitWorktree',
  activationStrategy: 'command',
  commandTriggers: [
    'fusi-tools.gitWorktree.refresh',
    'fusi-tools.gitWorktree.openIntegratedTerminal',
    'fusi-tools.gitWorktree.openExternalTerminal',
    'fusi-tools.gitWorktree.pull',
    'fusi-tools.gitWorktree.push',
    'fusi-tools.gitWorktree.revealInExplorer',
    'fusi-tools.gitWorktree.openInVsCode',
    'fusi-tools.gitWorktree.createWorktree',
    'fusi-tools.gitWorktree.deleteWorktree'
  ],
  viewTriggers: ['fusi-tools.gitWorktree.view'],

  activate(context: vscode.ExtensionContext): FeatureActivationResult {
    if (!isFeatureEnabled('gitWorktree')) {
      return success(true);
    }

    gitWorktree.activate(context);
    return success();
  }
};

/**
 * 获取所有功能模块
 */
export function getAllModules(): FeatureModule[] {
  return [
    scratchpadModule,
    aiCommitModule,
    smartTranslateModule,
    projectFavoritesModule,
    resourceManagerModule,
    gitIgnoreManagerModule,
    gitWorktreeModule,
  ];
}
