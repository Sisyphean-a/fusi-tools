import * as assert from "assert";
import { TranslatorService } from "../../features/smartTranslate/translator";

type RequestRecorder = {
  requestedUrl: () => string;
  service: TranslatorService;
};

function createServiceWithResponse(response: string): RequestRecorder {
  const service = new TranslatorService();
  let capturedUrl = "";

  (service as unknown as { makeHttpRequest: (url: string) => Promise<string> }).makeHttpRequest = async (
    url: string
  ) => {
    capturedUrl = url;
    return response;
  };

  return {
    requestedUrl: () => capturedUrl,
    service,
  };
}

suite("SmartTranslate TranslatorService", () => {
  test("中文内容应翻译成英文并解析 translation 字段", async () => {
    const recorder = createServiceWithResponse(
      JSON.stringify({
        translation: "the sky is blue",
        info: { detectedSource: "zh-CN", original: "天空是蓝色的" },
      })
    );

    const result = await recorder.service.translate("天空是蓝色的");

    assert.strictEqual(result.translatedText, "the sky is blue");
    assert.strictEqual(result.targetLanguage, "en");
    assert.strictEqual(result.sourceLanguage, "zh-CN");
    assert.ok(recorder.requestedUrl().includes("client=gtx"));
    assert.ok(recorder.requestedUrl().includes("sl=zh"));
    assert.ok(recorder.requestedUrl().includes("tl=en"));
    assert.ok(recorder.requestedUrl().includes("dt=t"));
    assert.ok(recorder.requestedUrl().includes("q=%E5%A4%A9%E7%A9%BA"));
  });

  test("英文内容应翻译成中文并把目标语言映射为 zh_CN", async () => {
    const recorder = createServiceWithResponse(
      JSON.stringify({
        translation: "天空是蓝色的",
        info: { detectedSource: "en", original: "the sky is blue" },
      })
    );

    const result = await recorder.service.translate("theSkyIsBlue");

    assert.strictEqual(result.translatedText, "天空是蓝色的");
    assert.strictEqual(result.sourceLanguage, "en");
    assert.strictEqual(result.targetLanguage, "zh");
    assert.ok(recorder.requestedUrl().includes("sl=en"));
    assert.ok(recorder.requestedUrl().includes("tl=zh_CN"));
    assert.ok(recorder.requestedUrl().includes("q=the+sky+is+blue"));
  });
});
