import type { ClientRequest } from "http";
import * as https from "https";
import { URL } from "url";
import * as Effect from "effect/Effect";
import { LanguageDetector } from "./utils/languageDetector";
import { TextProcessor } from "./utils/textProcessor";
import { LRUCache } from "./utils/lruCache";

const DEFAULT_CACHE_SIZE = 200;
const HTTPS_PORT = 443;
const REQUEST_TIMEOUT_MS = 10000;
const GOOGLE_API_URL = "https://translate.googleapis.com/translate_a/single";
const MICROSOFT_API_URL = "https://edge.microsoft.com/translate/translatetext";

// 所有翻译源同时请求，Effect.raceAll 会忽略失败，直到第一个成功结果返回。
const TRANSLATION_PROVIDERS = ["google", "deeplx", "microsoft"] as const;

type InternalLanguageCode = "zh" | "en";

export type TranslationProvider = (typeof TRANSLATION_PROVIDERS)[number];

type GoogleApiResponse = {
  sentences?: Array<{ trans?: string }>;
  src?: string;
};

type DeepLXApiResponse = {
  code?: number;
  data?: string;
  message?: string;
  source_lang?: string;
};

type MicrosoftApiResponse = Array<{
  translations?: Array<{
    text?: string;
    to?: string;
  }>;
}>;

export interface TranslatorSettings {
  deeplxEndpoint: string;
  deeplxApiKey: string;
}

export interface HttpRequestOptions {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class TranslatorService {
  private readonly languageDetector: LanguageDetector;
  private readonly cache: LRUCache<string, TranslationResult>;
  private readonly settings: TranslatorSettings;

  constructor(
    settings: Partial<TranslatorSettings> = {},
    cacheSize: number = DEFAULT_CACHE_SIZE
  ) {
    this.languageDetector = new LanguageDetector();
    this.cache = new LRUCache(cacheSize);
    this.settings = {
      deeplxApiKey: "",
      deeplxEndpoint: "",
      ...settings,
    };
  }

  async translate(text: string): Promise<TranslationResult> {
    const cacheKey = this.createCacheKey(text);
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const detectedLanguage = this.detectLanguage(text);
    const targetLanguage = detectedLanguage === "zh" ? "en" : "zh";
    const textToTranslate = this.prepareTextForTranslation(text, detectedLanguage);
    const requests = TRANSLATION_PROVIDERS.map((provider) =>
      Effect.tryPromise({
        try: () =>
          this.requestTranslation(
            provider,
            textToTranslate,
            detectedLanguage,
            targetLanguage
          ),
        catch: (error) =>
          error instanceof Error ? error : new Error(String(error)),
      })
    );

    const apiResult = await Effect.runPromise(Effect.raceAll(requests));
    const result: TranslationResult = {
      originalText: text,
      sourceLanguage: apiResult.sourceLanguage,
      targetLanguage,
      translatedText: apiResult.translatedText,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private createCacheKey(text: string): string {
    return text.toLowerCase().trim();
  }

  private detectLanguage(text: string): InternalLanguageCode {
    return this.languageDetector.detectLanguage(text) === "zh" ? "zh" : "en";
  }

  private prepareTextForTranslation(
    text: string,
    sourceLanguage: InternalLanguageCode
  ): string {
    if (sourceLanguage !== "en") {
      return text;
    }

    return TextProcessor.prepareCompoundWordForTranslation(text);
  }

  private async requestTranslation(
    provider: TranslationProvider,
    text: string,
    sourceLanguage: InternalLanguageCode,
    targetLanguage: InternalLanguageCode
  ): Promise<{ translatedText: string; sourceLanguage: string }> {
    const request = this.buildRequest(
      provider,
      text,
      sourceLanguage,
      targetLanguage
    );
    const response = await this.makeHttpRequest(request);
    return this.parseResponse(
      provider,
      response,
      sourceLanguage
    );
  }

  private buildRequest(
    provider: TranslationProvider,
    text: string,
    sourceLanguage: InternalLanguageCode,
    targetLanguage: InternalLanguageCode
  ): HttpRequestOptions {
    switch (provider) {
      case "google":
        return this.buildGoogleRequest(text, targetLanguage);
      case "deeplx":
        return this.buildDeepLXRequest(text, sourceLanguage, targetLanguage);
      case "microsoft":
        return this.buildMicrosoftRequest(text, sourceLanguage, targetLanguage);
    }
  }

  private buildGoogleRequest(
    text: string,
    targetLanguage: InternalLanguageCode
  ): HttpRequestOptions {
    const params = new URLSearchParams({
      client: "gtx",
      dj: "1",
      dt: "t",
      ie: "UTF-8",
      q: text,
      sl: "auto",
      tl: this.mapGoogleTargetLanguage(targetLanguage),
    });

    return {
      method: "GET",
      url: `${GOOGLE_API_URL}?${params.toString()}`,
    };
  }

  private buildDeepLXRequest(
    text: string,
    sourceLanguage: InternalLanguageCode,
    targetLanguage: InternalLanguageCode
  ): HttpRequestOptions {
    const endpoint = this.getRequiredDeepLXValue(
      this.settings.deeplxEndpoint,
      "DeepLX 请求地址未配置"
    );
    const apiKey = this.getRequiredDeepLXValue(
      this.settings.deeplxApiKey,
      "DeepLX API Key 未配置"
    );

    return {
      body: JSON.stringify({
        source_lang: this.mapDeepLXLanguage(sourceLanguage),
        target_lang: this.mapDeepLXLanguage(targetLanguage),
        text,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      url: endpoint,
    };
  }

  private buildMicrosoftRequest(
    text: string,
    sourceLanguage: InternalLanguageCode,
    targetLanguage: InternalLanguageCode
  ): HttpRequestOptions {
    const params = new URLSearchParams({
      from: this.mapMicrosoftLanguage(sourceLanguage),
      to: this.mapMicrosoftLanguage(targetLanguage),
      isEnterpriseClient: "false",
    });

    return {
      body: JSON.stringify([text]),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      url: `${MICROSOFT_API_URL}?${params.toString()}`,
    };
  }

  private getRequiredDeepLXValue(value: string, message: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      throw new Error(message);
    }

    return trimmedValue;
  }

  private mapGoogleTargetLanguage(
    targetLanguage: InternalLanguageCode
  ): string {
    return targetLanguage === "zh" ? "zh-CN" : targetLanguage;
  }

  private mapDeepLXLanguage(language: InternalLanguageCode): string {
    return language === "zh" ? "ZH" : "EN";
  }

  private mapMicrosoftLanguage(language: InternalLanguageCode): string {
    return language === "zh" ? "zh-Hans" : "en";
  }

  private parseResponse(
    provider: TranslationProvider,
    response: string,
    fallbackSourceLanguage: InternalLanguageCode
  ): { translatedText: string; sourceLanguage: string } {
    switch (provider) {
      case "google":
        return this.parseGoogleResponse(response, fallbackSourceLanguage);
      case "deeplx":
        return this.parseDeepLXResponse(response, fallbackSourceLanguage);
      case "microsoft":
        return this.parseMicrosoftResponse(response, fallbackSourceLanguage);
    }
  }

  private parseGoogleResponse(
    response: string,
    fallbackSourceLanguage: InternalLanguageCode
  ): { translatedText: string; sourceLanguage: string } {
    const data = JSON.parse(response) as GoogleApiResponse;
    const translatedText =
      data.sentences?.map((sentence) => sentence.trans ?? "").join("") ?? "";
    if (!translatedText) {
      throw new Error("Google 翻译返回格式无效");
    }

    return {
      sourceLanguage: this.normalizeLanguageCode(
        data.src,
        fallbackSourceLanguage
      ),
      translatedText,
    };
  }

  private parseDeepLXResponse(
    response: string,
    fallbackSourceLanguage: InternalLanguageCode
  ): { translatedText: string; sourceLanguage: string } {
    const data = JSON.parse(response) as DeepLXApiResponse;
    if (!data.data) {
      throw new Error(data.message || "DeepLX 翻译返回格式无效");
    }

    return {
      sourceLanguage: this.normalizeLanguageCode(
        data.source_lang,
        fallbackSourceLanguage
      ),
      translatedText: data.data,
    };
  }

  private parseMicrosoftResponse(
    response: string,
    fallbackSourceLanguage: InternalLanguageCode
  ): { translatedText: string; sourceLanguage: string } {
    const data = JSON.parse(response) as MicrosoftApiResponse;
    const translatedText = data
      .flatMap((item) => item.translations ?? [])
      .map((translation) => translation.text ?? "")
      .join("");
    if (!translatedText) {
      throw new Error("Microsoft 翻译返回格式无效");
    }

    return {
      sourceLanguage: fallbackSourceLanguage,
      translatedText,
    };
  }

  private normalizeLanguageCode(
    value: string | undefined,
    fallback: InternalLanguageCode
  ): InternalLanguageCode {
    if (!value) {
      return fallback;
    }

    const normalizedValue = value.toLowerCase();
    if (normalizedValue.startsWith("zh")) {
      return "zh";
    }

    if (normalizedValue.startsWith("en")) {
      return "en";
    }

    return fallback;
  }

  private makeHttpRequest(request: HttpRequestOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(request.url);
      const headers = this.buildRequestHeaders(request);
      const options = {
        headers,
        hostname: parsedUrl.hostname,
        method: request.method,
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || HTTPS_PORT,
        timeout: REQUEST_TIMEOUT_MS,
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(data);
            return;
          }

          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        });
      });

      req.on("error", (error) => reject(error));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      this.writeRequestBody(req, request.body);
      req.end();
    });
  }

  private buildRequestHeaders(
    request: HttpRequestOptions
  ): Record<string, string> {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ...request.headers,
    };

    if (!request.body) {
      return headers;
    }

    return {
      ...headers,
      "Content-Length": Buffer.byteLength(request.body).toString(),
    };
  }

  private writeRequestBody(
    req: ClientRequest,
    body: string | undefined
  ): void {
    if (body) {
      req.write(body);
    }
  }
}
