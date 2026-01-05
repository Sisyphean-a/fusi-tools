export class LanguageDetector {
  detectLanguage(text: string): string {
    if (!text || text.trim().length === 0) {
      return "en";
    }

    const cleanText = text.trim();

    // 检测中文字符
    if (this.containsChinese(cleanText)) {
      return "zh";
    }

    // 检测英文字符
    if (this.containsEnglish(cleanText)) {
      return "en";
    }

    // 默认返回英文
    return "en";
  }

  private containsChinese(text: string): boolean {
    // 匹配中文字符（包括中文标点符号）
    const chineseRegex =
      /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff]/;
    return chineseRegex.test(text);
  }

  private containsEnglish(text: string): boolean {
    // 匹配英文字母
    const englishRegex = /[a-zA-Z]/;
    return englishRegex.test(text);
  }

  isValidText(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const cleanText = text.trim();

    // 检查文本长度
    if (cleanText.length > 500) {
      return false;
    }

    // 检查是否包含有效字符
    return this.containsChinese(cleanText) || this.containsEnglish(cleanText);
  }

  getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
      zh: "中文",
      en: "English",
      auto: "自动检测",
    };

    return languageNames[code] || code;
  }
}
