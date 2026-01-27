import * as vscode from 'vscode';

/**
 * 功能模块激活结果
 */
export interface FeatureActivationResult {
  /** 模块是否成功激活 */
  success: boolean;
  /** 模块是否被配置禁用 */
  disabled?: boolean;
  /** 错误信息（如果失败） */
  error?: Error;
}

/**
 * 功能模块接口
 * 所有功能模块必须实现此接口
 */
export interface FeatureModule {
  /** 模块名称（用于日志和错误提示） */
  readonly name: string;

  /**
   * 是否支持延迟加载
   * 如果为 true，模块将在首次使用时才真正初始化
   */
  readonly lazyLoad?: boolean;

  /**
   * 激活功能模块
   * @param context VS Code 扩展上下文
   * @returns 激活结果
   */
  activate(context: vscode.ExtensionContext): Promise<FeatureActivationResult> | FeatureActivationResult;

  /**
   * 停用功能模块（可选）
   * 用于清理资源
   */
  deactivate?(): Promise<void> | void;
}

/**
 * 功能模块名称类型
 */
export type FeatureName =
  | 'scratchpad'
  | 'aiCommit'
  | 'smartTranslate'
  | 'resourceManager'
  | 'projectFavorites'
  | 'gitIgnoreManager'
  | 'gitWorktree';

/**
 * 功能模块配置键名
 */
export type FeatureEnabledConfigKey = `${FeatureName}.enabled`;
