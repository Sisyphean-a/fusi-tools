import * as vscode from "vscode";
import { GitService } from "./git";
import { AiService } from "./ai";
import { AiCommitViewProvider, CommitItem } from "./treeProvider";

export function activate(context: vscode.ExtensionContext) {
  const gitService = new GitService();
  const aiService = new AiService();
  const provider = new AiCommitViewProvider();

  // 缓存 diff 结果，供 "预处理后生成" 使用
  let cachedDiff: string | null = null;

  // 1. 注册 TreeDataProvider
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("fusi-tools.aiCommitView", provider)
  );

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
          // 清空旧的 生成 选项 (保留预处理结果如果存在)
          // provider.clear() 会全清，所以我们需要一个只清 commitItems 的方法？
          // updatePreProcess 会清空 commitItems，所以如果这次是基于 preProcess 的，只要 refresh 就行。

          // 调用混合策略 AI 服务
          await aiService.generateHybrid(diff, (options) => {
            provider.refresh(options);
          });

          // 聚焦到视图
          vscode.commands.executeCommand("fusi-tools.aiCommitView.focus");
        } catch (error: any) {
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
        const analysis = await gitService.analyzeChanges();
        if (!analysis || analysis.length === 0) {
          provider.clear(); // 清除加载态
          vscode.window.showWarningMessage("未发现暂存更改，请先暂存文件。");
          return;
        }

        // 3. 格式化并缓存
        cachedDiff = await gitService.formatSmartDiff(analysis);

        // 4. 更新 UI 展示文件列表
        provider.updatePreProcess(analysis);

        // 5. 聚焦视图
        vscode.commands.executeCommand("fusi-tools.aiCommitView.focus");
      } catch (error: any) {
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
          console.error("applyCommit 参数无效", arg);
          return;
        }

        if (message) {
          gitService.setCommitMessage(message);
        }
      }
    )
  );
}
