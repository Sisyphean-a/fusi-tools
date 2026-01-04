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
- **多风格生成**：同时生成 Emoji (极简)、Conventional (规范)、Detailed (详细) 三种风格的提交信息。
- **混合模型策略**：结合 DeepSeek V3 (快速响应) 和 DeepSeek R1 (深度推理) 的优势。
- **Git 集成**：直接集成在源代码管理 (SCM) 视图中，一键生成并应用。
- **智能分析**：自动分析暂存区 (Staged) 的代码变更。

## 设置项

| 设置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `fusi-tools.scratchpad.enabled` | boolean | `true` | 启用或禁用 Scratchpad 功能 |
| `fusi-tools.aiCommit.apiKey` | string | `""` | AI 服务的 API Key (如 DeepSeek API) |
| `fusi-tools.aiCommit.baseUrl` | string | `https://api.deepseek.com` | AI 服务的基础地址 |
| `fusi-tools.aiCommit.model` | string | `deepseek-chat` | 快速响应模型 (用于生成简短描述) |
| `fusi-tools.aiCommit.reasonerModel` | string | `deepseek-reasoner` | 深度推理模型 (用于生成详细分析) |

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
```

## 许可证

MIT
