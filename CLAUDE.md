# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Fusi Tools 是一个轻量级的 VS Code 扩展工具集合，包含多个独立功能模块：Scratchpad（便签本）、AI Commit Assistant（AI 提交助手）、Smart Translate（智能翻译）、Resource Manager（资源管理增强）、Project Favorites（项目常用文件）、Git Ignore Manager（Git 忽略规则管理）和 Git Worktree Helper（工作树助手）。

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化并自动编译）
npm run watch

# 编译（生成 manifest 并编译 TypeScript）
npm run compile

# 打包扩展（生产模式）
npm run package
# 或使用 vsce
vsce package

# 代码检查
npm run lint

# 运行测试
npm run test

# 手动生成 package.json（通常不需要手动执行）
npm run generate:manifest
```

## 核心架构

### 模块化配置系统

**重要：** 本项目采用模块化配置架构。`package.json` 是自动生成的文件，**不要直接编辑**。

- **配置源文件**：
  - `package.base.json` - 基础配置（元数据、脚本、依赖等）
  - `src/features/*/feature.json` - 各功能模块的配置（commands、views、menus、configuration 等）

- **生成机制**：
  - `scripts/generate-manifest.js` 负责合并所有配置生成最终的 `package.json`
  - 合并顺序：`core` 功能优先，其他功能按字母顺序
  - `npm run watch` 和 `vsce package` 会自动触发配置生成

- **修改配置的正确方式**：
  1. 编辑 `package.base.json`（修改基础信息）
  2. 编辑 `src/features/*/feature.json`（修改功能相关配置）
  3. 运行 `npm run generate:manifest` 或 `npm run compile`

### 功能模块结构

每个功能模块位于 `src/features/<feature-name>/` 目录下，包含：

- `feature.json` - 模块的 VS Code 配置（contributes 部分）
- `index.ts` - 模块入口，导出 `activate()` 函数
- 其他 `.ts` 文件 - 模块的具体实现

**激活流程**：
1. `src/extension.ts` 是扩展的主入口
2. 在 `activate()` 函数中依次调用各功能模块的 `activate()` 函数
3. 每个功能模块负责注册自己的命令、视图、事件监听器等

### 日志系统

- 使用 `src/logger.ts` 提供的统一日志系统
- 日志级别可通过配置 `fusi-tools.logLevel` 动态调整（debug/info/warn/error/none）
- 在代码中使用：`Logger.info()`, `Logger.warn()`, `Logger.error()`, `Logger.debug()`

### 构建系统

- 使用 Webpack 打包，配置文件：`webpack.config.js`
- TypeScript 配置：`tsconfig.json`
- 输出目录：`dist/extension.js`
- 启用了文件系统缓存和增量编译以提升构建速度

## 添加新功能模块

1. 在 `src/features/` 下创建新目录（如 `newFeature/`）
2. 创建 `feature.json` 定义 VS Code 配置
3. 创建 `index.ts` 并导出 `activate(context: vscode.ExtensionContext)` 函数
4. 在 `src/extension.ts` 中导入并调用新模块的 `activate()` 函数
5. 运行 `npm run generate:manifest` 生成新的 `package.json`

## 注意事项

- 扩展依赖 `vscode.git` 扩展（Git 相关功能需要）
- 激活事件：`onStartupFinished`（扩展在 VS Code 启动完成后激活）
- 功能模块可通过配置项 `fusi-tools.<feature>.enabled` 启用/禁用
- Scratchpad 使用 Webview 实现，内容仅保存在内存中
- AI Commit 功能默认使用 DeepSeek API，需要配置 API Key
