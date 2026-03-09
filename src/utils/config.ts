import * as vscode from 'vscode';
import { FusiToolsConfig, FusiToolsConfigKey, FeatureName } from '../types';

/**
 * 配置命名空间
 */
const CONFIG_NAMESPACE = 'fusi-tools';

/**
 * 类型安全的配置获取器（带默认值）
 * @param key 配置键名
 * @param defaultValue 默认值
 * @returns 配置值
 */
export function getConfigWithDefault<K extends FusiToolsConfigKey>(
  key: K,
  defaultValue: FusiToolsConfig[K]
): FusiToolsConfig[K] {
  const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  return config.get(key, defaultValue);
}

/**
 * 检查功能是否启用
 * @param feature 功能名称
 * @returns 是否启用
 */
export function isFeatureEnabled(feature: FeatureName): boolean {
  const key = `${feature}.enabled` as FusiToolsConfigKey;
  return getConfigWithDefault(key, true) as boolean;
}
