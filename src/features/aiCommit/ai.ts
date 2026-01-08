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
   * 1. 发起快速请求 (V3) 生成 "Concise" (简短) + "Conventional" (规范) 风格。
   * 2. 数据可用时立即调用 onUpdate。
   */
  async generate(diff: string, onUpdate: (options: CommitOption[]) => void) {
    const apiKey = this.config.get<string>("apiKey");
    const baseUrl = this.config.get<string>("baseUrl");
    const fastModel = this.config.get<string>("model") || "deepseek-chat";

    if (!apiKey) {
      throw new Error("API Key is not configured.");
    }

    try {
      const options = await this.fetchFastOptions(
        baseUrl!,
        apiKey,
        fastModel,
        diff
      );
      onUpdate(options);
    } catch (err) {
      Logger.error("快速模型 (Fast Model) 请求失败", err);
      console.error("快速模型失败:", err);
    }
  }

  private sortOptions(options: CommitOption[]) {
    const order = ["Emoji", "Conventional", "StandardShort", "Smart"];
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
    diff: string
  ): Promise<CommitOption[]> {
    return this.callApi(baseUrl, apiKey, model, FAST_PROMPT, diff);
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

    // [DEBUG] 打印完整请求参数
    // console.log("--- [AI Commit Request Payload] ---");
    // console.log(JSON.stringify(requestBody, null, 2));
    // console.log("-----------------------------------");
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
      console.error(error);
      return []; // Return empty on failure to not crash the whole Promise.all
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
        // Should not happen with new prompts, but fallback
        return [parsed];
      }
      return [];
    } catch (e) {
      Logger.error("AI 响应解析失败", e);
      console.error("Parse error", content);
      return [];
    }
  }
}
