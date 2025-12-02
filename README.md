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

## 设置项

| 设置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `fusi-tools.scratchpad.enabled` | boolean | `true` | 启用或禁用 Scratchpad 功能 |

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
