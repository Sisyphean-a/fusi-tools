import * as assert from "assert";
import {
  buildChatRequestBody,
  resolveAiCommitModel,
} from "../../features/aiCommit/modelResolver";

suite("AI Commit model resolution", () => {
  test("默认模型应解析为 v4 flash 非思考模式", () => {
    const resolved = resolveAiCommitModel(undefined, false);
    const requestBody = buildChatRequestBody(resolved, "system", "diff");

    assert.strictEqual(resolved.apiModel, "deepseek-v4-flash");
    assert.strictEqual(resolved.displayLabel, "deepseek-v4-flash (non-thinking)");
    assert.deepStrictEqual(requestBody.thinking, { type: "disabled" });
  });

  test("deepseek-chat 应兼容映射为 v4 flash 非思考模式", () => {
    const resolved = resolveAiCommitModel("deepseek-chat", true);

    assert.strictEqual(resolved.apiModel, "deepseek-v4-flash");
    assert.strictEqual(resolved.displayLabel, "deepseek-v4-flash (non-thinking)");
    assert.strictEqual(resolved.thinkingMode, "disabled");
  });

  test("deepseek-reasoner 应兼容映射为 v4 flash 思考模式", () => {
    const resolved = resolveAiCommitModel("deepseek-reasoner", true);
    const requestBody = buildChatRequestBody(resolved, "system", "diff");

    assert.strictEqual(resolved.apiModel, "deepseek-v4-flash");
    assert.strictEqual(resolved.displayLabel, "deepseek-v4-flash (thinking)");
    assert.deepStrictEqual(requestBody.thinking, { type: "enabled" });
  });

  test("显式指定 v4 pro 时不应强制改写思考模式", () => {
    const resolved = resolveAiCommitModel("deepseek-v4-pro", true);
    const requestBody = buildChatRequestBody(resolved, "system", "diff");

    assert.strictEqual(resolved.apiModel, "deepseek-v4-pro");
    assert.strictEqual(resolved.displayLabel, "deepseek-v4-pro");
    assert.strictEqual(requestBody.thinking, undefined);
  });
});
