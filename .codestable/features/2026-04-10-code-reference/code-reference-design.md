---
doc_type: feature-design
feature: 2026-04-10-code-reference
status: approved
summary: 在编辑器中复制适合 AI 使用的代码地址
tags: [resource-manager, editor, clipboard]
---

# Resource Manager 代码地址复制设计

**Goal:** 在编辑器选中代码后，通过右键菜单复制适合 AI 使用的代码地址，格式为 `@相对路径:起始行-结束行`。

**Scope:** 仅扩展 Resource Manager 的编辑器命令、菜单与文案，不改变现有资源管理器右键命令的行为。

**Design:**
- 新增命令 `fusi-tools.copyCodeReference`，从当前活动编辑器读取文档 URI 和选区。
- 复用现有 `@相对路径` 语义，输出统一格式：
  - 单行：`@src/foo.ts:100`
  - 多行：`@src/foo.ts:100-210`
- 行号使用 1-based，范围为“实际选中文本覆盖的行”：
  - 结束位置在下一行第 0 列时，不把该行计入范围。
- 仅在编辑器有选区时暴露右键菜单；命令执行时若无活动编辑器、无选区或文件不在工作区内，显式提示失败，不做静默降级。
- 为避免 `commands.ts` 继续膨胀，新增独立 helper 负责相对路径规范化与代码地址格式化。

**Testing:**
- 新增 `src/test/resourceManager/codeReference.test.ts`。
- 覆盖单行、多行、尾部落在下一行首列、路径分隔符规范化等核心格式化行为。
- 命令挂载正确性通过编译、清单生成与人工验证保证。
