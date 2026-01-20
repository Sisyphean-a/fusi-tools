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
   * 2. 注入 Project Meta 和 Recent Commits 上下文。
   */
  async generate(
    diff: string, 
    projectMeta: string,
    onUpdate: (options: CommitOption[]) => void
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
      systemPrompt = systemPrompt.replace("{{PROJECT_META}}", projectMeta || "(None)");

      const options = await this.fetchFastOptions(
        baseUrl!,
        apiKey,
        fastModel,
        systemPrompt,
        diff
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
    diff: string
  ): Promise<CommitOption[]> {
    return this.callApi(baseUrl, apiKey, model, systemPrompt, diff);
  }

  private async callApi(
    baseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userContent: string
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
      const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === "object") {
        return [parsed];
      }
      return [];
    } catch (e) {
      Logger.error("AI 响应解析失败", e);
      console.error("Parse error content:", content);
      return [];
    }
  }
}
