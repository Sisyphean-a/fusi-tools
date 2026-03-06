import * as https from "https";
import { URL } from "url";
import { LanguageDetector } from "./utils/languageDetector";
import { TextProcessor } from "./utils/textProcessor";
import { LRUCache } from "./utils/lruCache";

const DEFAULT_CACHE_SIZE = 200;
const HTTPS_PORT = 443;
const REQUEST_TIMEOUT_MS = 10000;
const TRANSLATE_API_BASE_URL = "https://fanyi.sisyphean.top/single";
const CHINESE_TARGET_LANGUAGE = "zh_CN";

type TranslationApiResponse = {
  translation?: string;
  info?: {
    detectedSource?: string;
    original?: string;
  };
};

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class TranslatorService {
  private languageDetector: LanguageDetector;
  private cache: LRUCache<string, TranslationResult>;

  constructor(cacheSize: number = DEFAULT_CACHE_SIZE) {
    this.languageDetector = new LanguageDetector();
    this.cache = new LRUCache(cacheSize);
  }

  async translate(text: string): Promise<TranslationResult> {
    const cacheKey = text.toLowerCase().trim();
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const detectedLanguage = this.languageDetector.detectLanguage(text);
    const targetLanguage = detectedLanguage === "zh" ? "en" : "zh";
    if (detectedLanguage === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: detectedLanguage,
        targetLanguage,
      };
    }

    try {
      const textToTranslate = this.prepareTextForTranslation(text, detectedLanguage);
      const apiResult = await this.requestTranslation(
        textToTranslate,
        detectedLanguage,
        targetLanguage
      );
      const result: TranslationResult = {
        originalText: text,
        translatedText: apiResult.translatedText,
        sourceLanguage: apiResult.sourceLanguage,
        targetLanguage,
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Translation API error:", error);
      throw new Error("翻译服务暂时不可用");
    }
  }

  private prepareTextForTranslation(text: string, sourceLanguage: string): string {
    if (sourceLanguage !== "en") {
      return text;
    }

    return TextProcessor.prepareCompoundWordForTranslation(text);
  }

  private async requestTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<{ translatedText: string; sourceLanguage: string }> {
    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLanguage,
      tl: this.mapTargetLanguage(targetLanguage),
      dt: "t",
      q: text,
    });
    const url = `${TRANSLATE_API_BASE_URL}?${params.toString()}`;
    const response = await this.makeHttpRequest(url);
    return this.parseTranslationResponse(response, sourceLanguage);
  }

  private mapTargetLanguage(targetLanguage: string): string {
    if (targetLanguage === "zh") {
      return CHINESE_TARGET_LANGUAGE;
    }

    return targetLanguage;
  }

  private parseTranslationResponse(
    response: string,
    fallbackSourceLanguage: string
  ): { translatedText: string; sourceLanguage: string } {
    const data = JSON.parse(response) as TranslationApiResponse;
    if (!data.translation) {
      throw new Error("Invalid response format");
    }

    return {
      translatedText: data.translation,
      sourceLanguage: data.info?.detectedSource ?? fallbackSourceLanguage,
    };
  }

  private makeHttpRequest(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || HTTPS_PORT,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
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

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}
