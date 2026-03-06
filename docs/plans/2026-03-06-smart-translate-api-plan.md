# Smart Translate API Switch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把智能翻译改为调用新的 `/single` GET 接口，并保持原有中文/非中文的翻译方向规则。

**Architecture:** 仅修改翻译服务层，维持上层选择监听、状态栏展示、命名建议逻辑不变。通过新增翻译服务单测，先验证新接口的 URL 参数和响应解析，再做最小实现。

**Tech Stack:** TypeScript, Mocha, VS Code extension test setup

---

### Task 1: 为翻译服务补充失败测试

**Files:**
- Create: `src/test/smartTranslate/translator.test.ts`
- Test: `src/test/smartTranslate/translator.test.ts`

**Step 1: Write the failing test**
- 验证中文输入会请求 `tl=en`
- 验证英文输入会请求 `tl=zh_CN`
- 验证响应从 `translation` 字段解析译文
- 验证 `info.detectedSource` 会回填到结果中

**Step 2: Run test to verify it fails**
- Run: `npx tsc -p . --outDir out`
- Expected: 测试编译通过，但新测试因当前实现 URL/解析不匹配而失败（随后运行测试或静态断言可见）

### Task 2: 最小化修改翻译服务

**Files:**
- Modify: `src/features/smartTranslate/translator.ts`
- Test: `src/test/smartTranslate/translator.test.ts`

**Step 1: Write minimal implementation**
- 提取新接口地址常量
- 映射目标语言到接口值
- 按新 JSON 结构解析 `translation`
- 保持错误显式抛出，不加兜底

**Step 2: Run test to verify it passes**
- Run: `npm run compile-tests`
- Expected: 编译通过
- Run: `npm run lint -- src/features/smartTranslate/translator.ts src/test/smartTranslate/translator.test.ts`
- Expected: 相关文件无 lint 错误

### Task 3: 做一次收尾验证

**Files:**
- Modify: `src/features/smartTranslate/translator.ts`
- Test: `src/test/smartTranslate/translator.test.ts`

**Step 1: Verify focused checks**
- Run: `npm run compile-tests`
- Run: `npm run lint`

**Step 2: Confirm behavior surface**
- 确认未改动 `src/features/smartTranslate/index.ts` 的调用方式
- 确认命名建议仍依赖 `sourceLanguage === "zh"`
