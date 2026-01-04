import * as vscode from 'vscode';

export interface CommitOption {
    type: string;
    description: string;
    message: string;
}

export class AiService {
    private get config() {
        return vscode.workspace.getConfiguration('fusi-tools.aiCommit');
    }

    /**
     * 执行混合策略:
     * 1. 发起快速请求 (V3) 生成 "Concise" (简短) + "Conventional" (规范) 风格。
     * 2. 发起推理请求 (R1) 生成 "Detailed" (详细) 风格。
     * 3. 任何数据可用时立即调用 onUpdate。
     */
    async generateHybrid(diff: string, onUpdate: (options: CommitOption[]) => void) {
        const apiKey = this.config.get<string>('apiKey');
        const baseUrl = this.config.get<string>('baseUrl');
        const fastModel = this.config.get<string>('model') || 'deepseek-chat';
        const reasonerModel = this.config.get<string>('reasonerModel') || 'deepseek-reasoner';

        if (!apiKey) {
            throw new Error('API Key is not configured.');
        }

        // 共享结果状态
        // [Concise, Conventional, Detailed]
        const results: CommitOption[] = [];

        // 定义两个并行任务
        const fastTask = this.fetchFastOptions(baseUrl!, apiKey, fastModel, diff).then(options => {
            // 假设快速任务返回 [Concise, Conventional]
            // 将它们插入到开头
            results.splice(0, 0, ...options);
            onUpdate([...results]);
        }).catch(err => {
            console.error('快速模型失败:', err);
            // 可选：插入错误占位符？
        });

        const reasoningTask = this.fetchDetailedOption(baseUrl!, apiKey, reasonerModel, diff).then(option => {
            // 假设推理任务返回一个选项
            // 我们通常希望它是最后一个，或者特定的 "Detailed" 类型。
            // 如果快速任务未完成，它可能位于索引 0，这没关系，
            // 但理想情况下我们希望严格排序: [Concise, Conventional, Detailed]
            
            // 为防止竞态条件，我们只需推送并排序
            results.push(option);
            
            // 排序以确保一致性
            // 例如: Emoji -> Conventional -> Detailed
            this.sortOptions(results);
            
            onUpdate([...results]);
        }).catch(err => {
             console.error('推理模型失败:', err);
        });

        // 等待两者？还是直接让它们运行？
        // 调用者 (命令) 通常想知道何时“所有事情”都完成了以停止加载动画。
        await Promise.allSettled([fastTask, reasoningTask]);
    }

    private sortOptions(options: CommitOption[]) {
        const order = ['Emoji', 'Conventional', 'Detailed'];
        options.sort((a, b) => {
            let ia = order.indexOf(a.type);
            let ib = order.indexOf(b.type);
            if (ia === -1) ia = 99;
            if (ib === -1) ib = 99;
            return ia - ib;
        });
    }

    private async fetchFastOptions(baseUrl: string, apiKey: string, model: string, diff: string): Promise<CommitOption[]> {
        const prompt = `
You are a developer assistant. Analyze git diff and generate 2 commit messages:
1. "Emoji": Concise, starts with emoji (e.g. ✨), max 50 chars.
2. "Conventional": Standard Conventional Commits format (feat(scope): subject). **Can be multi-line** if explanation is needed.
Both messages must be in Simplified Chinese (简体中文).

Return strictly a JSON Array:
[
  {"type":"Emoji","description":"Emoji 风格 (简短)","message":"✨ ..."}, 
  {"type":"Conventional","description":"Conventional 规范 (标准)","message":"feat(scope): ...\\n\\nBody..."}
]
`;
        return this.callApi(baseUrl, apiKey, model, prompt, diff);
    }

    private async fetchDetailedOption(baseUrl: string, apiKey: string, model: string, diff: string): Promise<CommitOption> {
         const prompt = `
You are an expert developer. Analyze the git diff deeply.
Generate 1 "Detailed" commit message using the following format:

<Header line (Conventional format)>
<BLANK LINE>
<Body paragraph explaining WHAT and WHY change was made>
<BLANK LINE>
<Footer (optional, e.g. Breaking Changes)>

Use Simplified Chinese (简体中文).
Return strictly a JSON Array containing ONE object:
[{"type":"Detailed","description":"详细说明 (多行)","message":"feat: header\\n\\nDetailed explanation..."}]
`;
        const options = await this.callApi(baseUrl, apiKey, model, prompt, diff);
        return options[0];
    }

    private async callApi(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userContent: string): Promise<CommitOption[]> {
        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ],
                    stream: false
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`${model} request failed: ${response.status} ${text}`);
            }

            const data = await response.json() as any;
            const content = data.choices?.[0]?.message?.content;
            if (!content) return [];

            return this.parseResponse(content);
        } catch (error) {
            console.error(error);
            return []; // Return empty on failure to not crash the whole Promise.all
        }
    }

    private parseResponse(content: string): CommitOption[] {
        try {
            const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                return parsed;
            } else if (typeof parsed === 'object') {
                // Should not happen with new prompts, but fallback
                return [parsed];
            }
            return [];
        } catch (e) {
            console.error('Parse error', content);
            return [];
        }
    }
}
