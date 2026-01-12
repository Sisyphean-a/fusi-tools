import * as https from "https";
import { URL } from "url";
import { LanguageDetector } from "./utils/languageDetector";
import { TextProcessor } from "./utils/textProcessor";
import { LRUCache } from "./utils/lruCache";

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class TranslatorService {
  private languageDetector: LanguageDetector;
  private cache: LRUCache<string, TranslationResult>;

  constructor(cacheSize: number = 200) {
    this.languageDetector = new LanguageDetector();
    this.cache = new LRUCache(cacheSize);
  }

  async translate(text: string): Promise<TranslationResult> {
    // 检查缓存
    const cacheKey = text.toLowerCase().trim();
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // 检测语言
    const sourceLanguage = this.languageDetector.detectLanguage(text);
    const targetLanguage = sourceLanguage === "zh" ? "en" : "zh";

    // 如果检测到的语言和目标语言相同，直接返回
    if (sourceLanguage === targetLanguage) {
      const result: TranslationResult = {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
      };
      return result;
    }

    try {
      // 预处理复合词（如驼峰命名、下划线命名等）
      let textToTranslate = text;
      if (sourceLanguage === "en") {
        textToTranslate = TextProcessor.prepareCompoundWordForTranslation(text);
      }

      // 调用翻译API
      const translatedText = await this.callGoogleTranslateAPI(
        textToTranslate,
        sourceLanguage,
        targetLanguage
      );

      const result: TranslationResult = {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
      };

      // 缓存结果（LRU 缓存会自动管理大小）
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Translation API error:", error);
      throw new Error("翻译服务暂时不可用");
    }
  }

  private async callGoogleTranslateAPI(
    text: string,
    from: string,
    to: string
  ): Promise<string> {
    const baseUrl = "https://translate.googleapis.com/translate_a/single";

    const params = new URLSearchParams({
      client: "gtx",
      sl: from,
      tl: to,
      dt: "t",
      ie: "UTF-8",
      oe: "UTF-8",
      dj: "1",
      q: text,
    });

    const url = `${baseUrl}?${params.toString()}`;

    try {
      const response = await this.makeHttpRequest(url);
      const data = JSON.parse(response);

      if (data && data.sentences && data.sentences.length > 0) {
        return data.sentences.map((s: any) => s.trans).join("");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Google Translate API error:", error);
      throw error; // 直接抛出错误，不再使用兜底方案
    }
  }

  private makeHttpRequest(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
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
