import { TextProcessor } from "./utils/textProcessor";

export interface NamingOption {
  format: string;
  example: string;
  description: string;
  icon: string;
}

export class NameGenerator {
  generateNamingOptions(englishText: string): NamingOption[] {
    if (!englishText || englishText.trim().length === 0) {
      return [];
    }

    const cleanText = TextProcessor.prepareForNaming(englishText);
    const words = TextProcessor.splitCompoundWord(cleanText);

    if (words.length === 0) {
      return [];
    }

    const options: NamingOption[] = [
      {
        format: "camelCase",
        example: this.toCamelCase(words),
        description: "驼峰命名法 - 常用于变量名、方法名",
        icon: "$(symbol-method)",
      },
      {
        format: "PascalCase",
        example: this.toPascalCase(words),
        description: "帕斯卡命名法 - 常用于类名、接口名",
        icon: "$(symbol-class)",
      },
      {
        format: "snake_case",
        example: this.toSnakeCase(words),
        description: "下划线命名法 - 常用于Python变量名",
        icon: "$(symbol-variable)",
      },
      {
        format: "CONSTANT_CASE",
        example: this.toConstantCase(words),
        description: "常量命名法 - 常用于常量定义",
        icon: "$(symbol-constant)",
      },
      {
        format: "kebab-case",
        example: this.toKebabCase(words),
        description: "短横线命名法 - 常用于CSS类名、文件名",
        icon: "$(symbol-string)",
      },
    ];

    // 过滤掉空的或无效的选项
    return options.filter(
      (option) =>
        option.example &&
        option.example.length > 0 &&
        !TextProcessor.isProgrammingKeyword(option.example)
    );
  }

  private toCamelCase(words: string[]): string {
    if (words.length === 0) {
      return "";
    }

    const result = words
      .map((word, index) => {
        const cleanWord = this.cleanWord(word);
        if (index === 0) {
          return cleanWord.toLowerCase();
        }
        return this.capitalizeFirst(cleanWord);
      })
      .join("");

    return this.validateIdentifier(result);
  }

  private toPascalCase(words: string[]): string {
    if (words.length === 0) {
      return "";
    }

    const result = words
      .map((word) => {
        const cleanWord = this.cleanWord(word);
        return this.capitalizeFirst(cleanWord);
      })
      .join("");

    return this.validateIdentifier(result);
  }

  private toSnakeCase(words: string[]): string {
    if (words.length === 0) {
      return "";
    }

    const result = words
      .map((word) => {
        const cleanWord = this.cleanWord(word);
        return cleanWord.toLowerCase();
      })
      .join("_");

    return this.validateIdentifier(result);
  }

  private toConstantCase(words: string[]): string {
    if (words.length === 0) {
      return "";
    }

    const result = words
      .map((word) => {
        const cleanWord = this.cleanWord(word);
        return cleanWord.toUpperCase();
      })
      .join("_");

    return this.validateIdentifier(result);
  }

  private toKebabCase(words: string[]): string {
    if (words.length === 0) {
      return "";
    }

    const result = words
      .map((word) => {
        const cleanWord = this.cleanWord(word);
        return cleanWord.toLowerCase();
      })
      .join("-");

    return result;
  }

  private cleanWord(word: string): string {
    if (!word) {
      return "";
    }

    // 移除非字母数字字符，保留基本的英文字母
    return word.replace(/[^a-zA-Z0-9]/g, "").trim();
  }

  private capitalizeFirst(word: string): string {
    if (!word || word.length === 0) {
      return "";
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  private validateIdentifier(identifier: string): string {
    if (!identifier || identifier.length === 0) {
      return "";
    }

    // 确保标识符以字母开头
    if (!/^[a-zA-Z]/.test(identifier)) {
      identifier = "var" + this.capitalizeFirst(identifier);
    }

    // 移除连续的下划线
    identifier = identifier.replace(/_+/g, "_");

    // 移除开头和结尾的下划线
    identifier = identifier.replace(/^_+|_+$/g, "");

    return identifier;
  }

  /**
   * 根据上下文推荐最佳命名格式
   */
  getRecommendedFormat(context?: string): string {
    if (!context) {
      return "camelCase";
    }

    const lowerContext = context.toLowerCase();

    if (
      lowerContext.includes("class") ||
      lowerContext.includes("interface") ||
      lowerContext.includes("type")
    ) {
      return "PascalCase";
    }

    if (lowerContext.includes("const") || lowerContext.includes("constant")) {
      return "CONSTANT_CASE";
    }

    if (lowerContext.includes("python") || lowerContext.includes(".py")) {
      return "snake_case";
    }

    if (
      lowerContext.includes("css") ||
      lowerContext.includes("html") ||
      lowerContext.includes("file")
    ) {
      return "kebab-case";
    }

    return "camelCase";
  }

  /**
   * 批量生成命名选项
   */
  generateBatchNamingOptions(texts: string[]): Map<string, NamingOption[]> {
    const result = new Map<string, NamingOption[]>();

    texts.forEach((text) => {
      const options = this.generateNamingOptions(text);
      if (options.length > 0) {
        result.set(text, options);
      }
    });

    return result;
  }
}
