import * as assert from "assert";
import {
  formatCodeReference,
  getSelectionLineRange,
  toRelativeWorkspacePath,
} from "../../features/resourceManager/codeReference";

suite("ResourceManager code reference", () => {
  test("单行选区应输出单个行号", () => {
    const range = getSelectionLineRange({
      start: { line: 99 },
      end: { line: 99, character: 8 },
      isSingleLine: true,
    });

    assert.deepStrictEqual(range, { startLine: 100, endLine: 100 });
    assert.strictEqual(
      formatCodeReference("src/features/resourceManager/commands.ts", range),
      "@src/features/resourceManager/commands.ts:100"
    );
  });

  test("多行选区应输出起止行范围", () => {
    const range = getSelectionLineRange({
      start: { line: 99 },
      end: { line: 209, character: 12 },
      isSingleLine: false,
    });

    assert.deepStrictEqual(range, { startLine: 100, endLine: 210 });
    assert.strictEqual(
      formatCodeReference("src/features/resourceManager/commands.ts", range),
      "@src/features/resourceManager/commands.ts:100-210"
    );
  });

  test("选区结束于下一行首列时不应把该行计入范围", () => {
    const range = getSelectionLineRange({
      start: { line: 99 },
      end: { line: 210, character: 0 },
      isSingleLine: false,
    });

    assert.deepStrictEqual(range, { startLine: 100, endLine: 210 });
  });

  test("工作区相对路径应统一为正斜杠", () => {
    assert.strictEqual(
      toRelativeWorkspacePath(
        "F:\\Github\\fusi-tools",
        "F:\\Github\\fusi-tools\\src\\features\\resourceManager\\commands.ts"
      ),
      "src/features/resourceManager/commands.ts"
    );
  });
});
