# Copy Code Reference Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为编辑器选区新增“复制代码地址”命令，输出 `@相对路径:起止行`，方便 AI 快速定位代码区域。

**Architecture:** 将“路径与行号格式化”拆到 `resourceManager` 独立 helper，命令层只负责读取活动编辑器、选区和剪贴板。菜单与激活清单同时在 `feature.json`、模块触发器和 README 中补齐。

**Tech Stack:** TypeScript, Mocha, VS Code Extension API, webpack

---

### Task 1: 先写代码地址格式化失败测试

**Files:**
- Create: `src/test/resourceManager/codeReference.test.ts`
- Test: `src/test/resourceManager/codeReference.test.ts`

- [ ] **Step 1: Write the failing test**

为以下行为补测试：
- 单行选区输出 `@path:line`
- 多行选区输出 `@path:start-end`
- 结束于下一行第 0 列时，结束行回退到上一行
- Windows 路径分隔符统一转为 `/`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile-tests`
Expected: 新测试因 helper 尚不存在而失败。

### Task 2: 用最小实现让测试通过

**Files:**
- Create: `src/features/resourceManager/codeReference.ts`
- Modify: `src/features/resourceManager/commands.ts`

- [ ] **Step 1: Write minimal implementation**

新增 helper：
- 计算工作区相对路径
- 计算选区对应的 1-based 起止行
- 生成 `@相对路径:起止行` 文本

新增命令实现：
- 从活动编辑器读取文档和选区
- 无活动编辑器、无选区、非工作区文件时显式提示
- 成功时复制到剪贴板并提示

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run compile-tests`
Expected: 编译通过。

### Task 3: 接入菜单、清单和说明文档

**Files:**
- Modify: `src/features/resourceManager/index.ts`
- Modify: `src/features/resourceManager/feature.json`
- Modify: `src/modules.ts`
- Modify: `README.md`

- [ ] **Step 1: Register command and menu**

添加：
- activation event
- commands contribution
- `editor/context` 菜单项，仅在有选区时显示
- 模块 `commandTriggers`

- [ ] **Step 2: Refresh generated manifest and verify**

Run: `npm run generate:manifest`
Run: `npm run lint`
Run: `npm test`
Run: `npm run package`
Expected: 命令、测试、打包均通过。
