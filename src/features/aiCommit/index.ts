import * as vscode from "vscode";
import { Logger } from "../../logger";
import { GitService } from "./git";
import { AiService } from "./ai";
import { AiCommitViewProvider, CommitItem } from "./treeProvider";
import { FAST_PROMPT } from "./prompts";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("fusi-tools");
  const enabled = config.get<boolean>("aiCommit.enabled", true);

  if (!enabled) {
    Logger.info("AI Commit is disabled by configuration.");
    return;
  }

  const gitService = new GitService();
  const aiService = new AiService();
  const provider = new AiCommitViewProvider();

  // 缓存 diff 结果，供 "预处理后生成" 使用
  let cachedDiff: string | null = null;
  // 缓存上下文信息，供 "预览 Prompt" 使用
  let lastContext: { diff: string; projectMeta: string } | null = null;

  // 1. 注册 TreeDataProvider
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("fusi-tools.aiCommitView", provider)
  );

  // 1.1 注册文本内容提供者 (用于 Prompt 预览)
  const promptProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      if (!lastContext) return "No Prompt generated yet.";
      
      const { diff, projectMeta } = lastContext;
      let content = FAST_PROMPT;
      content = content.replace("{{PROJECT_META}}", projectMeta || "(None)");

      return `=== SYSTEM PROMPT ===\n${content}\n\n=== USER CONTENT (DIFF) ===\n${diff}`;
    }
  })();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("fusi-ai-prompt", promptProvider)
  );


  // ---------------------------------------------------------
  // 辅助函数：获取 Project Meta
  // ---------------------------------------------------------
  const getProjectMeta = async (): Promise<string> => {
    try {
      if (!vscode.workspace.workspaceFolders) return "";
      const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const pkgPath = path.join(rootPath, "package.json");
      if (fs.existsSync(pkgPath)) {
        const raw = await fs.promises.readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(raw);
        return `Project: ${pkg.name || "Unnamed"} - ${pkg.description || "No description"}`;
      }
    } catch (e) {
      // ignore
    }
    return "";
  };

  // ---------------------------------------------------------
  // 辅助函数：执行 AI 生成
  // ---------------------------------------------------------
  const runAiGeneration = async (diff: string) => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "AI 提交助手：正在生成提交信息...",
        cancellable: false,
      },
      async () => {
        try {
          // A. (Removed) 获取 Git 历史 (Few-shot)
          // const recentCommits = await gitService.getRecentCommits(5);
          
          // B. 获取项目元数据
          const projectMeta = await getProjectMeta();

          // 保存上下文供预览
          lastContext = { diff, projectMeta };

          // 调用快速 AI 服务
          Logger.info(
            `正在调用 AI 生成 (DeepSeek V3)... Diff 长度: ${diff.length}`
          );
          
          await aiService.generate(diff, projectMeta, (options) => {
            Logger.info(`收到 AI 部分结果: ${options.length} 条建议`);
            provider.refresh(options);
          });
          Logger.info("AI 生成流程完成");

          // 聚焦到视图
          vscode.commands.executeCommand("fusi-tools.aiCommitView.focus");
        } catch (error: any) {
          Logger.error("AI 生成中断或失败", error);
          vscode.window.showErrorMessage(`生成失败: ${error.message}`);
        }
      }
    );
  };

  // ---------------------------------------------------------
  // 命令 1: 查看预处理 (Preview Smart Diff)
  // ---------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("fusi-tools.previewSmartDiff", async () => {
      try {
        // 1. 显示加载中
        provider.showLoading("正在分析暂存文件与预处理...");

        // 简短延迟让 UI 刷新
        await new Promise((r) => setTimeout(r, 100));

        // 2. 分析
        Logger.info("正在分析文件变更 (智能预处理)...");
        const analysis = await gitService.analyzeChanges();
        if (!analysis || analysis.length === 0) {
          provider.clear(); // 清除加载态
          vscode.window.showWarningMessage("未发现暂存更改，请先暂存文件。");
          return;
        }

        // 3. 格式化并缓存
        cachedDiff = await gitService.formatSmartDiff(analysis);

        // [New] 预加载上下文，以便用户可以在“生成前”查看 Prompt
        const projectMeta = await getProjectMeta();
        lastContext = { diff: cachedDiff, projectMeta };

        // 4. 更新 UI 展示文件列表
        provider.updatePreProcess(analysis);

        // 5. 聚焦视图
        Logger.info("预处理完成，已更新 UI。");
        vscode.commands.executeCommand("fusi-tools.aiCommitView.focus");
      } catch (error: any) {
        Logger.error("预处理执行失败", error);
        provider.clear();
        vscode.window.showErrorMessage(`预处理失败: ${error.message}`);
      }
    })
  );

  // ---------------------------------------------------------
  // 命令 2: 预处理后生成 (Generate from Smart Diff)
  // ---------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("fusi-tools.generateSmart", async () => {
      if (!cachedDiff) {
        // 如果没有缓存，自动执行一次预处理
        await vscode.commands.executeCommand("fusi-tools.previewSmartDiff");
        if (!cachedDiff) return; // 如果还是没有 (e.g. 无更改)，终止
      }

      await runAiGeneration(cachedDiff);
    })
  );

  // ---------------------------------------------------------
  // 命令 3: 直接生成 (Direct Generate)
  // ---------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("fusi-tools.generateDirect", async () => {
      try {
        // 1. 显示加载
        provider.showLoading("正在直接生成...");

        // 2. 获取 diff (不做 UI 预览，直接获取字符串)
        const analysis = await gitService.analyzeChanges();
        if (!analysis || analysis.length === 0) {
          provider.clear();
          vscode.window.showWarningMessage("未发现暂存更改，请先暂存文件。");
          return;
        }

        const diff = await gitService.formatSmartDiff(analysis);
        cachedDiff = diff; // 顺便缓存

        // 更新 UI (后台更新，不聚焦，作为副产品)
        provider.updatePreProcess(analysis);

        // 3. 直接执行生成
        await runAiGeneration(diff);
      } catch (error: any) {
        provider.clear();
        vscode.window.showErrorMessage(`生成失败: ${error.message}`);
      }
    })
  );

  // ---------------------------------------------------------
  // 命令 4: 应用提交信息
  // ---------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.applyCommit",
      (arg: string | CommitItem) => {
        let message = "";

        if (typeof arg === "string") {
          // 点击 TreeItem 触发（传入参数为字符串）
          message = arg;
        } else if (arg instanceof CommitItem) {
          // 右键菜单触发
          message = arg.option.message;
        } else {
          Logger.error("应用提交失败: 参数无效", arg);
          console.error("applyCommit 参数无效", arg);
          return;
        }

        if (message) {
          Logger.info("尝试应用提交信息到 Git 输入框");
          gitService.setCommitMessage(message);
        }
      }
    )
  );

  // ---------------------------------------------------------
  // 命令 5: 预览 AI Prompt (Native Text Editor)
  // ---------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("fusi-tools.viewAiPrompt", async () => {
      if (!lastContext) {
        vscode.window.showInformationMessage("尚未生成任何 AI 请求。请先执行生成操作。");
        return;
      }
      const uri = vscode.Uri.parse("fusi-ai-prompt://preview/prompt.md");
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    })
  );
}
