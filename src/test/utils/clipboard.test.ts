import * as assert from "assert";
import {
  clipboardRuntime,
  copyTextToClipboard,
} from "../../utils/clipboard";

suite("Clipboard utils", () => {
  test("默认复制文本后不应弹出信息提示", async () => {
    const copiedTexts: string[] = [];
    const infoMessages: string[] = [];
    const originalWriteText = clipboardRuntime.writeText;
    const originalShowInfo = clipboardRuntime.showInformationMessage;

    clipboardRuntime.writeText = async (value: string) => {
      copiedTexts.push(value);
    };
    clipboardRuntime.showInformationMessage = async (message: string) => {
      infoMessages.push(message);
      return undefined;
    };

    try {
      await copyTextToClipboard("fooBar");

      assert.deepStrictEqual(copiedTexts, ["fooBar"]);
      assert.deepStrictEqual(infoMessages, []);
    } finally {
      clipboardRuntime.writeText = originalWriteText;
      clipboardRuntime.showInformationMessage = originalShowInfo;
    }
  });

  test("显式传入成功提示时才应弹出信息提示", async () => {
    const copiedTexts: string[] = [];
    const infoMessages: string[] = [];
    const originalWriteText = clipboardRuntime.writeText;
    const originalShowInfo = clipboardRuntime.showInformationMessage;

    clipboardRuntime.writeText = async (value: string) => {
      copiedTexts.push(value);
    };
    clipboardRuntime.showInformationMessage = async (message: string) => {
      infoMessages.push(message);
      return undefined;
    };

    try {
      await copyTextToClipboard("fooBar", "已复制");

      assert.deepStrictEqual(copiedTexts, ["fooBar"]);
      assert.deepStrictEqual(infoMessages, ["已复制"]);
    } finally {
      clipboardRuntime.writeText = originalWriteText;
      clipboardRuntime.showInformationMessage = originalShowInfo;
    }
  });
});
