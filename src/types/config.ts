/**
 * 日志级别类型
 */
export type LogLevelType = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * 状态栏位置类型
 */
export type StatusBarPosition = 'left' | 'right';

/**
 * Git 忽略类型
 */
export type GitIgnoreType = 'assume' | 'skip';

/**
 * 自定义复制模板
 */
export interface CopyTemplate {
  /** 模板显示名称 */
  name: string;
  /** 模板文本，使用 {path} 作为文件路径占位符 */
  template: string;
}

/**
 * Fusi Tools 完整配置类型
 * 与 feature.json 中的配置项一一对应
 */
export interface FusiToolsConfig {
  // ========== 通用设置 ==========
  /** 日志输出级别 */
  logLevel: LogLevelType;

  // ========== Scratchpad ==========
  /** 启用/禁用随手记功能 */
  'scratchpad.enabled': boolean;

  // ========== AI Commit ==========
  /** 启用/禁用 AI 提交助手 */
  'aiCommit.enabled': boolean;
  /** AI 服务的 API Key */
  'aiCommit.apiKey': string;
  /** AI 服务的基础地址 */
  'aiCommit.baseUrl': string;
  /** AI 模型名称 */
  'aiCommit.model': string;
  /** 自定义系统提示词 */
  'aiCommit.prompt': string;

  // ========== Smart Translate ==========
  /** 启用/禁用智能翻译 */
  'smartTranslate.enabled': boolean;
  /** 翻译结果显示时长（毫秒） */
  'smartTranslate.displayDuration': number;
  /** 翻译状态栏位置 */
  'smartTranslate.statusBarPosition': StatusBarPosition;

  // ========== Resource Manager ==========
  /** 启用/禁用资源管理器增强 */
  'resourceManager.enabled': boolean;
  /** 自定义复制模板列表 */
  'resourceManager.customCopyTemplates': CopyTemplate[];

  // ========== Project Favorites ==========
  /** 启用/禁用项目常用文件 */
  'projectFavorites.enabled': boolean;

  // ========== Git Ignore Manager ==========
  /** 启用/禁用 Git 忽略管理 */
  'gitIgnoreManager.enabled': boolean;
  /** 视图获得焦点时自动刷新 */
  'gitIgnoreManager.refreshOnFocus': boolean;
  /** 新增忽略时的默认类型 */
  'gitIgnoreManager.defaultIgnoreType': GitIgnoreType;
  /** 在提示信息中显示 Git 命令 */
  'gitIgnoreManager.showCommandHints': boolean;

  // ========== Git Worktree ==========
  /** 启用/禁用 Git 工作树管理 */
  'gitWorktree.enabled': boolean;
}

/**
 * 配置键名类型
 */
export type FusiToolsConfigKey = keyof FusiToolsConfig;

/**
 * 功能启用配置键名
 */
export type FeatureEnabledKey = Extract<FusiToolsConfigKey, `${string}.enabled`>;
