export class TextProcessor {
  /**
   * 清理和标准化文本
   */
  static cleanText(text: string): string {
    if (!text) {
      return "";
    }

    return text
      .trim()
      .replace(/\s+/g, " ") // 合并多个空格
      .replace(/[\r\n\t]/g, " ") // 替换换行符和制表符
      .trim();
  }

  /**
   * 检查文本是否适合翻译
   */
  static isTranslatable(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const cleanText = this.cleanText(text);

    // 检查长度
    if (cleanText.length < 1 || cleanText.length > 500) {
      return false;
    }

    // 检查是否只包含数字、符号等
    const meaningfulChars = cleanText.replace(/[\d\s\-_.,;:!?()[\]{}'"]/g, "");
    if (meaningfulChars.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 分割复合词（用于编程命名）
   */
  static splitCompoundWord(text: string): string[] {
    if (!text) {
      return [];
    }

    // 处理驼峰命名
    const camelCaseSplit = text.replace(/([a-z])([A-Z])/g, "$1 $2");

    // 处理下划线和短横线
    const result = camelCaseSplit
      .replace(/[_-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => word.toLowerCase());

    return result;
  }

  /**
   * 为翻译准备复合词文本
   */
  static prepareCompoundWordForTranslation(text: string): string {
    if (!text) {
      return "";
    }

    // 检查是否是编程风格的复合词
    const hasUpperCase = /[A-Z]/.test(text);
    const hasUnderscore = /_/.test(text);
    const hasDash = /-/.test(text);

    if (hasUpperCase || hasUnderscore || hasDash) {
      // 分割复合词并用空格连接
      const words = this.splitCompoundWord(text);
      return words.join(" ");
    }

    return text;
  }

  /**
   * 将文本转换为适合命名的格式
   */
  static prepareForNaming(text: string): string {
    if (!text) {
      return "";
    }

    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, "") // 保留字母、数字、空格和中文
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * 检查是否为编程关键字
   */
  static isProgrammingKeyword(text: string): boolean {
    const keywords = [
      // JavaScript/TypeScript
      "abstract",
      "arguments",
      "await",
      "boolean",
      "break",
      "byte",
      "case",
      "catch",
      "char",
      "class",
      "const",
      "continue",
      "debugger",
      "default",
      "delete",
      "do",
      "double",
      "else",
      "enum",
      "eval",
      "export",
      "extends",
      "false",
      "final",
      "finally",
      "float",
      "for",
      "function",
      "goto",
      "if",
      "implements",
      "import",
      "in",
      "instanceof",
      "int",
      "interface",
      "let",
      "long",
      "native",
      "new",
      "null",
      "package",
      "private",
      "protected",
      "public",
      "return",
      "short",
      "static",
      "super",
      "switch",
      "synchronized",
      "this",
      "throw",
      "throws",
      "transient",
      "true",
      "try",
      "typeof",
      "var",
      "void",
      "volatile",
      "while",
      "with",
      "yield",

      // Python
      "and",
      "as",
      "assert",
      "async",
      "await",
      "break",
      "class",
      "continue",
      "def",
      "del",
      "elif",
      "else",
      "except",
      "finally",
      "for",
      "from",
      "global",
      "if",
      "import",
      "in",
      "is",
      "lambda",
      "nonlocal",
      "not",
      "or",
      "pass",
      "raise",
      "return",
      "try",
      "while",
      "with",
      "yield",

      // Common programming terms
      "undefined",
      "null",
      "true",
      "false",
    ];

    return keywords.includes(text.toLowerCase());
  }

  /**
   * 获取文本的显示预览
   */
  static getPreview(text: string, maxLength: number = 50): string {
    if (!text) {
      return "";
    }

    const cleanText = this.cleanText(text);
    if (cleanText.length <= maxLength) {
      return cleanText;
    }

    return cleanText.substring(0, maxLength - 3) + "...";
  }
}
