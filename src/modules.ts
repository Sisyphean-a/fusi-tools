import * as vscode from 'vscode';
import { FeatureModule, FeatureActivationResult } from './types/feature';
import { isFeatureEnabled } from './utils/config';
import { Logger } from './logger';

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
 * 创建失败的激活结果
 */
function failure(error: Error): FeatureActivationResult {
  return { success: false, error };
}

/**
 * Scratchpad 模块
 */
export const scratchpadModule: FeatureModule = {
  name: 'scratchpad',
  lazyLoad: false,

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
  lazyLoad: true,

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
  lazyLoad: false,

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
  lazyLoad: true,

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
  lazyLoad: true,

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
  lazyLoad: true,

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
  lazyLoad: true,

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
