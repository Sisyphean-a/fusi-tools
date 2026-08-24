import * as assert from "assert";
import {
  HttpRequestOptions,
  TranslationProvider,
  TranslatorService,
} from "../../features/smartTranslate/translator";

type RequestRecorder = {
  requests: HttpRequestOptions[];
  service: TranslatorService;
};

function providerOf(request: HttpRequestOptions): TranslationProvider {
  if (request.url.includes("translate.googleapis.com")) {
    return "google";
  }
  if (request.url.includes("edge.microsoft.com")) {
    return "microsoft";
  }
  return "deeplx";
}

function createService(
  responseFor: (provider: TranslationProvider) => Promise<string> | string
): RequestRecorder {
  const service = new TranslatorService({
    deeplxApiKey: "test-key",
    deeplxEndpoint: "https://api.deeplx.org/v2/translate",
  });
  const requests: HttpRequestOptions[] = [];

  (
    service as unknown as {
      makeHttpRequest: (request: HttpRequestOptions) => Promise<string>;
    }
  ).makeHttpRequest = async (request: HttpRequestOptions) => {
    requests.push(request);
    return responseFor(providerOf(request));
  };

  return { requests, service };
}

const successResponses: Record<TranslationProvider, string> = {
  google: JSON.stringify({
    sentences: [{ trans: "天空是" }, { trans: "蓝色的" }],
    src: "en",
  }),
  deeplx: JSON.stringify({
    code: 200,
    data: "天空是蓝色的",
    source_lang: "EN",
  }),
  microsoft: JSON.stringify([
    {
      translations: [
        { text: "天空是蓝色的", to: "zh-Hans" },
      ],
    },
  ]),
};

suite("SmartTranslate TranslatorService", () => {
  test("应并行调用所有翻译接口，并采用第一个成功结果", async () => {
    const recorder = createService(async (provider) => {
      await new Promise((resolve) =>
        setTimeout(resolve, provider === "microsoft" ? 10 : 80)
      );
      return successResponses[provider];
    });

    const result = await recorder.service.translate("theSkyIsBlue");

    assert.strictEqual(result.translatedText, "天空是蓝色的");
    assert.deepStrictEqual(
      recorder.requests.map(providerOf).sort(),
      ["deeplx", "google", "microsoft"]
    );
  });

  test("Microsoft 接口应发送指定格式的 POST 请求", async () => {
    const recorder = createService((provider) => {
      if (provider === "microsoft") {
        return successResponses.microsoft;
      }
      return Promise.reject(new Error(`${provider} unavailable`));
    });

    await recorder.service.translate("Hello");

    const request = recorder.requests.find(
      (item) => providerOf(item) === "microsoft"
    );
    assert.ok(request);
    assert.strictEqual(request.method, "POST");
    assert.ok(request.url.includes("from=en"));
    assert.ok(request.url.includes("to=zh-Hans"));
    assert.deepStrictEqual(request.headers, {
      "Content-Type": "application/json",
    });
    assert.strictEqual(request.body, JSON.stringify(["hello"]));
  });

  test("DeepLX 未配置时不应阻止其他接口成功", async () => {
    const service = new TranslatorService();
    const requests: HttpRequestOptions[] = [];
    (
      service as unknown as {
        makeHttpRequest: (request: HttpRequestOptions) => Promise<string>;
      }
    ).makeHttpRequest = async (request) => {
      requests.push(request);
      if (providerOf(request) === "google") {
        return successResponses.google;
      }
      return Promise.reject(new Error("provider unavailable"));
    };

    const result = await service.translate("theSkyIsBlue");

    assert.strictEqual(result.translatedText, "天空是蓝色的");
    assert.strictEqual(requests.length, 2);
  });

  test("全部接口失败时才应返回失败", async () => {
    const recorder = createService(() =>
      Promise.reject(new Error("provider unavailable"))
    );

    await assert.rejects(
      () => recorder.service.translate("hello"),
      /provider unavailable/
    );
    assert.strictEqual(recorder.requests.length, 3);
  });
});
