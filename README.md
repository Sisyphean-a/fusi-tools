# Fusi Tools

一个轻量级的 VS Code 工具扩展集合。

## 功能列表

### 📝 Scratchpad (便签本)

一个位于底部面板的临时文本输入区域，用于快速记录临时笔记。

**特点：**

- 位置：VS Code 底部面板（与终端、输出、调试控制台并列）
- 全宽度、全高度的文本输入区域
- 内容仅保存在内存中，不会写入磁盘
- 重新加载窗口或重启 VS Code 后内容会清空
- 自动适配 VS Code 的明暗主题

### 🤖 AI Commit Assistant (AI 提交助手)

基于 DeepSeek 模型的智能提交信息生成工具，支持混合策略生成。

**特点：**

- **多风格生成**：同时生成 Emoji (极简)、Conventional (规范)、Smart (深度思考) 三种风格的提交信息。
- **混合模型策略**：结合 DeepSeek V3 (快速响应) 和 DeepSeek R1 (深度推理) 的优势。
- **Git 集成**：直接集成在源代码管理 (SCM) 视图中，一键生成并应用。
- **智能分析**：自动分析暂存区 (Staged) 的代码变更。

### 🌐 Smart Translate (智能翻译)

即选即译的开发辅助工具，特别优化了变量命名和代码注释的翻译场景。

**特点：**

- **自动识别**：选中代码或注释，自动进行英汉互译。
- **变量命名建议**：选中中文描述，可生成符合驼峰/下划线规范的变量名建议。
- **状态栏显示**：翻译结果直接悬浮显示或在状态栏展示，不打断心流。

### 📂 Resource Manager (资源管理增强)

增强了 VS Code 本地资源管理器的功能，提供便捷的文件路径复制和目录结构生成工具。

**特点：**

- **Copy Name**：快速复制文件名。
- **@Copy Name**：复制相对于项目根目录的路径 (带 @ 前缀)。
- **Generate Tree**：为当前文件夹生成 ASCII 格式的目录树结构，方便文档编写。

### ⭐ Project Favorites (项目常用文件)

项目级别的收藏夹，让你在复杂项目中快速定位核心文件。

**特点：**

- **独立视图**：在侧边栏提供独立的 "常用文件" 视图。
- **分组管理**：支持自定义分类文件夹，整理不同模块的核心文件。
- **文件别名**：可以为收藏的文件设置别名，无需修改物理文件名。
- **快速访问**：右键菜单一键添加/移除选中文件。

## 设置项

| 设置项                                        | 类型    | 默认值  | 描述                                |
| --------------------------------------------- | ------- | ------- | ----------------------------------- |
| **AI Commit**                                 |         |         |                                     |
| `fusi-tools.aiCommit.enabled`                 | boolean | `true`  | 启用/禁用 AI 提交助手               |
| `fusi-tools.aiCommit.apiKey`                  | string  | `""`    | AI 服务的 API Key                   |
| `fusi-tools.aiCommit.baseUrl`                 | string  | `...`   | AI 服务 Base URL                    |
| `fusi-tools.aiCommit.model`                   | string  | `...`   | AI 模型名称                         |
| `fusi-tools.aiCommit.prompt`                  | string  | `""`    | 自定义系统提示词                    |
| **Resource Manager**                          |         |         |                                     |
| `fusi-tools.resourceManager.enabled`          | boolean | `true`  | 启用/禁用 Resource Manager (需重启) |
| **Smart Translate**                           |         |         |                                     |
| `fusi-tools.smartTranslate.enabled`           | boolean | `true`  | 启用/禁用 智能翻译                  |
| `fusi-tools.smartTranslate.displayDuration`   | number  | `5000`  | 翻译显示时长(ms)                    |
| `fusi-tools.smartTranslate.statusBarPosition` | string  | `right` | 状态栏位置 (left/right)             |
| **Project Favorites**                         |         |         |                                     |
| `fusi-tools.projectFavorites.enabled`         | boolean | `true`  | 启用/禁用 常用文件功能              |
| **Scratchpad**                                |         |         |                                     |
| `fusi-tools.scratchpad.enabled`               | boolean | `true`  | 启用/禁用 Scratchpad                |

## 使用方法

1. 安装扩展后，Scratchpad 会自动出现在底部面板区域
2. 点击底部面板的 "Scratchpad" 标签页即可开始使用
3. 如需禁用此功能，可在设置中将 `fusi-tools.scratchpad.enabled` 设为 `false`

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 打包
vsce package
```

## 许可证

MIT
