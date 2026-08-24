# Fusi Tools

即插即用的 VS Code 效率工具箱。

## 功能列表

### 📝 Scratchpad（随手记）

底部面板的临时文本区域，用于快速记录零散笔记。

- 位于 VS Code 底部面板（与终端、输出、调试控制台并列）
- 全宽度文本输入区域
- 内容仅保存在内存中，重新加载窗口后清空
- 自动适配明暗主题
- 实时统计：总字符数 / 总行数
- 选中统计：选中文本时显示选中部分的字符数和行数

### 🤖 AI Commit Assistant（AI 提交助手）

基于 DeepSeek 模型的智能提交信息生成工具，集成在 SCM 视图中。

- **预处理管线**：先查看 AI 对暂存变更的分析摘要（"查看预处理"），确认后再生成提交信息（"预处理后生成"），也可跳过预览直接生成（"直接生成"）
- **默认模型**：`deepseek-v4-flash`（非思考模式），兼容 `deepseek-chat` / `deepseek-reasoner` 旧别名
- **透明调试**："View AI Prompt" 可查看实际发送给 AI 的完整 Prompt
- **一键应用**：生成后直接在 SCM 视图中点击"应用提交信息"填充到 Git 输入框

### 🌐 Smart Translate（智能翻译）

选中即译的开发辅助工具，特别优化了变量命名和代码注释场景。

- **自动识别**：选中代码或注释，自动进行英汉互译
- **变量命名建议**：选中中文描述，生成驼峰 / 下划线风格的变量名
- **多翻译源并行竞速**：Google、Microsoft 同时请求；DeepLX 在配置地址和 API Key 后加入竞速，采用第一个成功结果，全部失败才提示失败
- **状态栏显示**：翻译结果悬浮在状态栏展示，不打断心流
- **开关控制**：可通过命令面板（`启用/禁用 智能翻译`）随时切换

### 📂 Resource Manager（资源管理增强）

增强 VS Code 资源管理器的右键菜单，提供便捷的文件路径复制和目录结构生成。

- **Copy Name**：快速复制文件名
- **@Copy Name**：复制相对于项目根目录的路径（带 `@` 前缀）
- **Copy File**：复制文件完整内容到剪贴板
- **自定义复制**：基于模板的复制（如生成"请先阅读 @path/to/file，了解项目结构"），模板可在设置中自定义
- **复制代码地址**：在编辑器中选中代码后，右键复制 `@相对路径:起止行` 格式的位置引用
- **Generate Tree**：为当前文件夹生成 ASCII 目录树结构，方便撰写文档

### ⭐ Project Favorites（项目常用文件）

项目级收藏夹，在复杂项目中快速定位核心文件。

- **独立视图**：侧边栏独立的"常用文件"视图容器
- **分组管理**：自定义分类文件夹，按模块整理核心文件
- **文件别名**：为收藏文件设置别名，不修改物理文件名
- **支持文件夹收藏**：收藏整个文件夹，也可收藏已删除文件的"幽灵条目"
- **快速访问**：右键菜单一键添加 / 移除选中文件

### 🛡️ Git Ignore Manager（Git 忽略规则管理）

管理 Git 的 `assume-unchanged` 和 `skip-worktree` 标记，用于忽略本地文件变动（如配置文件）而不提交到远程。

- **双模式**：`assume-unchanged` 和 `skip-worktree` 两种忽略模式
- **可视化管理**：SCM 视图中独立的"忽略文件（Git）"列表
- **快速操作**：右键菜单一键忽略 / 取消忽略；SCM 变更列表中直接忽略文件
- **自动刷新**：视图获得焦点时自动刷新列表状态（可通过 `refreshOnFocus` 控制）

### 🌿 Git Worktree Helper（工作树助手）

VS Code 内置的 Git Worktree 管理工具，支持并行多分支开发。

- **列表视图**：SCM 视图中展示当前仓库所有 Worktree
- **创建 / 删除**：直接在视图中新建或删除 Worktree
- **便捷操作**：Pull、Push、在内置终端打开、在外部终端打开、在文件夹中打开、在编辑器内打开

## 设置项

### 通用设置

| 设置项                 | 类型   | 默认值 | 描述                                                         |
| ---------------------- | ------ | ------ | ------------------------------------------------------------ |
| `fusi-tools.logLevel`  | string | `info` | 日志输出级别：`debug` / `info` / `warn` / `error` / `none`   |

### AI Commit

| 设置项                            | 类型    | 默认值                       | 描述                                   |
| --------------------------------- | ------- | ---------------------------- | -------------------------------------- |
| `fusi-tools.aiCommit.enabled`     | boolean | `true`                       | 启用 / 禁用 AI 提交助手                |
| `fusi-tools.aiCommit.apiKey`      | string  | `""`                         | AI 服务的 API Key                      |
| `fusi-tools.aiCommit.baseUrl`     | string  | `https://api.deepseek.com`   | AI 服务 Base URL                       |
| `fusi-tools.aiCommit.model`       | string  | `deepseek-v4-flash`          | AI 模型名称                            |
| `fusi-tools.aiCommit.prompt`      | string  | `""`                         | 自定义系统提示词（覆盖默认设置）        |

### Smart Translate

| 设置项                                         | 类型    | 默认值       | 描述                                     |
| ---------------------------------------------- | ------- | ------------ | ---------------------------------------- |
| `fusi-tools.smartTranslate.enabled`            | boolean | `true`       | 启用 / 禁用智能翻译                      |
| `fusi-tools.smartTranslate.displayDuration`    | number  | `5000`       | 翻译结果显示时长（毫秒）                 |
| 智能翻译接口                                      | —       | —            | Google、Microsoft、DeepLX（已配置时）并行请求，采用第一个成功结果 |
| `fusi-tools.smartTranslate.deeplx.endpoint`    | string  | `""`         | DeepLX 请求地址（配置后参与并行请求）      |
| `fusi-tools.smartTranslate.deeplx.apiKey`      | string  | `""`         | DeepLX API Key（配置后参与并行请求）        |
| `fusi-tools.smartTranslate.statusBarPosition`  | string  | `right`      | 翻译状态栏位置：`left` / `right`          |

### Resource Manager

| 设置项                                          | 类型    | 默认值     | 描述                                     |
| ----------------------------------------------- | ------- | ---------- | ---------------------------------------- |
| `fusi-tools.resourceManager.enabled`            | boolean | `true`     | 启用 / 禁用 Resource Manager（需重启）     |
| `fusi-tools.resourceManager.customCopyTemplates` | array   | 见下方说明 | 自定义复制模板列表                       |

`customCopyTemplates` 默认值：

```json
[
  {
    "name": "阅读文档",
    "template": "请先阅读 {path}，了解项目的功能和结构"
  }
]
```

使用 `{path}` 作为文件路径占位符（自动添加 `@` 前缀）。

### Project Favorites

| 设置项                                    | 类型    | 默认值 | 描述                         |
| ----------------------------------------- | ------- | ------ | ---------------------------- |
| `fusi-tools.projectFavorites.enabled`     | boolean | `true` | 启用 / 禁用项目常用文件       |

### Scratchpad

| 设置项                              | 类型    | 默认值 | 描述                     |
| ----------------------------------- | ------- | ------ | ------------------------ |
| `fusi-tools.scratchpad.enabled`     | boolean | `true` | 启用 / 禁用随手记         |

### Git Ignore Manager

| 设置项                                            | 类型    | 默认值     | 描述                                    |
| ------------------------------------------------- | ------- | ---------- | --------------------------------------- |
| `fusi-tools.gitIgnoreManager.enabled`             | boolean | `true`     | 启用 / 禁用 Git 忽略管理（需重启）       |
| `fusi-tools.gitIgnoreManager.refreshOnFocus`      | boolean | `true`     | 视图获得焦点时自动刷新忽略列表           |
| `fusi-tools.gitIgnoreManager.defaultIgnoreType`   | string  | `assume`   | 默认忽略类型：`assume` / `skip`          |
| `fusi-tools.gitIgnoreManager.showCommandHints`    | boolean | `true`     | 在提示信息中显示 Git 命令               |

### Git Worktree

| 设置项                               | 类型    | 默认值 | 描述                             |
| ------------------------------------ | ------- | ------ | -------------------------------- |
| `fusi-tools.gitWorktree.enabled`     | boolean | `true` | 启用 / 禁用 Git Worktree（需重启） |

## 使用方法

1. 安装扩展后，各功能模块自动激活（startup 模块）或按需激活（command 模块）
2. **Scratchpad**：点击底部面板的"随手记"标签页即可使用
3. **AI Commit**：打开 SCM 视图（`Ctrl+Shift+G`），在"AI 提交助手"面板中操作
4. **Smart Translate**：选中文本后自动翻译（可在命令面板中开关）
5. **Resource Manager**：在文件资源管理器或编辑器标签页右键，使用 Fusi Tools 菜单项
6. **Project Favorites**：在侧边栏"常用文件"视图中管理收藏
7. **Git Ignore Manager**：在 SCM 视图的"忽略文件（Git）"面板中管理
8. **Git Worktree**：在 SCM 视图的"工作树 (Worktrees)"面板中管理
9. 各功能均可通过 `fusi-tools.<feature>.enabled` 配置项单独开关

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式（开发）
npm run watch

# 打包
vsce package
```

> **注意**：本项目采用模块化配置架构。`package.json` 由 `scripts/generate-manifest.js` 自动生成。
>
> - 修改配置请编辑 `src/features/*/feature.json`
> - `npm run watch` 和 `vsce package` 会自动触发配置生成
> - 手动生成：`npm run generate:manifest`

## 许可证

MIT
