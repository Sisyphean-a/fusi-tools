import * as assert from "assert";
import {
  HttpRequestOptions,
  TranslatorService,
  TranslatorSettings,
} from "../../features/smartTranslate/translator";

type RequestRecorder = {
  requestedRequest: () => HttpRequestOptions;
  service: TranslatorService;
};

function createServiceWithResponse(
  response: string,
  settings?: Partial<TranslatorSettings>
): RequestRecorder {
  const service = new TranslatorService({
    provider: "sisyphean",
    deeplxApiKey: "",
    deeplxEndpoint: "",
    ...settings,
  });
  let capturedRequest: HttpRequestOptions = {
    body: undefined,
    headers: {},
    method: "GET",
    url: "",
  };

  (
    service as unknown as {
      makeHttpRequest: (request: HttpRequestOptions) => Promise<string>;
    }
  ).makeHttpRequest = async (
    request: HttpRequestOptions
  ) => {
    capturedRequest = request;
    return response;
  };

  return {
    requestedRequest: () => capturedRequest,
    service,
  };
}

suite("SmartTranslate TranslatorService", () => {
  test("Sisyphean provider 应请求 /single 并解析 translation 字段", async () => {
    const recorder = createServiceWithResponse(
      JSON.stringify({
        translation: "the sky is blue",
        info: { detectedSource: "zh-CN", original: "天空是蓝色的" },
      })
    );

    const result = await recorder.service.translate("天空是蓝色的");

    assert.strictEqual(result.translatedText, "the sky is blue");
    assert.strictEqual(result.targetLanguage, "en");
    assert.strictEqual(result.sourceLanguage, "zh");
    assert.strictEqual(recorder.requestedRequest().method, "GET");
    assert.ok(recorder.requestedRequest().url.includes("https://fanyi.sisyphean.top/single"));
    assert.ok(recorder.requestedRequest().url.includes("client=gtx"));
    assert.ok(recorder.requestedRequest().url.includes("sl=zh"));
    assert.ok(recorder.requestedRequest().url.includes("tl=en"));
    assert.ok(recorder.requestedRequest().url.includes("dt=t"));
    assert.ok(recorder.requestedRequest().url.includes("q=%E5%A4%A9%E7%A9%BA"));
  });

  test("Google provider 应请求 translate.googleapis.com 并解析 sentences", async () => {
    const recorder = createServiceWithResponse(
      JSON.stringify({
        sentences: [{ trans: "天空是" }, { trans: "蓝色的" }],
        src: "en",
      }),
      { provider: "google" }
    );

    const result = await recorder.service.translate("theSkyIsBlue");

    assert.strictEqual(result.translatedText, "天空是蓝色的");
    assert.strictEqual(result.sourceLanguage, "en");
    assert.strictEqual(result.targetLanguage, "zh");
    assert.strictEqual(recorder.requestedRequest().method, "GET");
    assert.ok(
      recorder.requestedRequest().url.includes(
        "https://translate.googleapis.com/translate_a/single"
      )
    );
    assert.ok(recorder.requestedRequest().url.includes("sl=auto"));
    assert.ok(recorder.requestedRequest().url.includes("tl=zh-CN"));
    assert.ok(recorder.requestedRequest().url.includes("dt=t"));
    assert.ok(recorder.requestedRequest().url.includes("dj=1"));
    assert.ok(recorder.requestedRequest().url.includes("ie=UTF-8"));
    assert.ok(recorder.requestedRequest().url.includes("q=the+sky+is+blue"));
  });

  test("DeepLX provider 应发送 POST 请求并携带授权头", async () => {
    const recorder = createServiceWithResponse(
      JSON.stringify({
        code: 200,
        data: "天空是蓝色的",
        source_lang: "EN",
        target_lang: "ZH",
      }),
      {
        deeplxApiKey: "test-key",
        deeplxEndpoint: "https://api.deeplx.org/v2/translate",
        provider: "deeplx",
      }
    );

    const result = await recorder.service.translate("theSkyIsBlue");

    assert.strictEqual(result.translatedText, "天空是蓝色的");
    assert.strictEqual(result.sourceLanguage, "en");
    assert.strictEqual(result.targetLanguage, "zh");
    assert.strictEqual(recorder.requestedRequest().method, "POST");
    assert.strictEqual(
      recorder.requestedRequest().url,
      "https://api.deeplx.org/v2/translate"
    );
    assert.deepStrictEqual(recorder.requestedRequest().headers, {
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    assert.strictEqual(
      recorder.requestedRequest().body,
      JSON.stringify({
        source_lang: "EN",
        target_lang: "ZH",
        text: "the sky is blue",
      })
    );
  });

  test("DeepLX provider 缺少 endpoint 时应显式报错", async () => {
    const recorder = createServiceWithResponse("{}", {
      deeplxApiKey: "test-key",
      deeplxEndpoint: "",
      provider: "deeplx",
    });

    await assert.rejects(
      () => recorder.service.translate("hello"),
      /DeepLX 请求地址未配置/
    );
  });
});
