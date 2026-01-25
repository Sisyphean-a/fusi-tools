import * as vscode from "vscode";
import { Logger } from "../../logger";
import { FAST_PROMPT } from "./prompts";

export interface CommitOption {
  type: string;
  description: string;
  message: string;
}

export class AiService {
  private get config() {
    return vscode.workspace.getConfiguration("fusi-tools.aiCommit");
  }

  /**
   * 执行生成策略:
   * 1. 发起快速请求 (V3) 生成结果。
   * 2. 注入 Project Meta、Recent Commits 和 Change Summary 上下文。
   */
  async generate(
    diff: string,
    projectMeta: string,
    onUpdate: (options: CommitOption[]) => void,
    changeSummary: string = "(None)",
  ) {
    const apiKey = this.config.get<string>("apiKey");
    const baseUrl = this.config.get<string>("baseUrl");
    const fastModel = this.config.get<string>("model") || "deepseek-chat";

    if (!apiKey) {
      throw new Error("API Key is not configured.");
    }

    try {
      // 准备 System Prompt 注入
      let systemPrompt = FAST_PROMPT;

      // 注入 Project Meta
      systemPrompt = systemPrompt.replace(
        "{{PROJECT_META}}",
        projectMeta || "(None)",
      );

      // 注入 Change Summary
      systemPrompt = systemPrompt.replace(
        "{{CHANGE_SUMMARY}}",
        changeSummary || "(None)",
      );

      const options = await this.fetchFastOptions(
        baseUrl!,
        apiKey,
        fastModel,
        systemPrompt,
        diff,
      );

      this.sortOptions(options);
      onUpdate(options);
    } catch (err) {
      Logger.error("快速模型 (Fast Model) 请求失败", err);
      console.error("快速模型失败:", err);
      throw err; // Re-throw to let upstream handle UI error
    }
  }

  private sortOptions(options: CommitOption[]) {
    // Define sort order
    const order = ["Emoji", "StandardShort", "Conventional", "Smart"];
    options.sort((a, b) => {
      let ia = order.indexOf(a.type);
      let ib = order.indexOf(b.type);
      if (ia === -1) ia = 99;
      if (ib === -1) ib = 99;
      return ia - ib;
    });
  }

  private async fetchFastOptions(
    baseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    diff: string,
  ): Promise<CommitOption[]> {
    return this.callApi(baseUrl, apiKey, model, systemPrompt, diff);
  }

  private async callApi(
    baseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userContent: string,
  ): Promise<CommitOption[]> {
    const requestBody = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream: false,
    };

    Logger.info(`[AI 请求] 模型: ${model}, 字符数: ${userContent.length}`);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${model} request failed: ${response.status} ${text}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return [];

      return this.parseResponse(content);
    } catch (error) {
      Logger.error(`API 调用异常: ${model}`, error);
      // Don't swallow here, let caller handle
      throw error;
    }
  }

  private parseResponse(content: string): CommitOption[] {
    try {
      let cleaned = content
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      // 1. 处理尾随逗号 (常见 AI 输出错误)
      cleaned = cleaned.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");

      // 2. 尝试提取 JSON 数组 (防止 AI 输出额外文字)
      const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        cleaned = jsonArrayMatch[0];
      }

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => this.isValidCommitOption(item));
      } else if (
        typeof parsed === "object" &&
        this.isValidCommitOption(parsed)
      ) {
        return [parsed];
      }
      return [];
    } catch (e) {
      Logger.error("AI 响应解析失败，尝试 fallback 解析", e);
      return this.fallbackParse(content);
    }
  }

  /**
   * 验证对象是否为有效的 CommitOption
   */
  private isValidCommitOption(obj: any): obj is CommitOption {
    return (
      obj &&
      typeof obj === "object" &&
      typeof obj.type === "string" &&
      typeof obj.message === "string"
    );
  }

  /**
   * Fallback 解析：尝试逐个提取 JSON 对象
   */
  private fallbackParse(content: string): CommitOption[] {
    const results: CommitOption[] = [];

    // 尝试匹配单个 JSON 对象
    const objectPattern =
      /\{[^{}]*"type"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*"[^"]*"\s*,\s*"message"\s*:\s*"[^"]*"[^{}]*\}/g;
    const matches = content.match(objectPattern);

    if (matches) {
      for (const match of matches) {
        try {
          const obj = JSON.parse(match);
          if (this.isValidCommitOption(obj)) {
            results.push(obj);
          }
        } catch {
          // 忽略单个解析失败
        }
      }
    }

    if (results.length === 0) {
      Logger.error("Fallback 解析也失败");
      console.error("Fallback parse failed, raw content:", content);
    } else {
      Logger.info(`Fallback 解析成功，提取 ${results.length} 条结果`);
    }

    return results;
  }
}
