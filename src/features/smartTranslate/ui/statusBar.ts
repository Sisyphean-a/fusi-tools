import * as vscode from "vscode";
import { TranslationResult } from "../translator";

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private clearTimer?: NodeJS.Timeout;
  private selectionCheckTimer?: NodeJS.Timeout;
  private isDisplaying: boolean = false;

  constructor() {
    // 获取配置
    const config = vscode.workspace.getConfiguration(
      "fusi-tools.smartTranslate"
    );
    const position = config.get<string>("statusBarPosition", "right");

    const alignment =
      position === "left"
        ? vscode.StatusBarAlignment.Left
        : vscode.StatusBarAlignment.Right;

    this.statusBarItem = vscode.window.createStatusBarItem(alignment, 100);
    this.statusBarItem.show();
  }

  showTranslation(result: TranslationResult): void {
    const config = vscode.workspace.getConfiguration(
      "fusi-tools.smartTranslate"
    );
    const duration = config.get<number>("displayDuration", 5000);

    // 清除之前的定时器
    this.clearTimer && clearTimeout(this.clearTimer);
    this.selectionCheckTimer && clearTimeout(this.selectionCheckTimer);

    // 设置状态栏内容
    const displayText = this.formatTranslationText(result);
    const tooltip = this.createTooltip(result);

    this.statusBarItem.text = `$(globe) ${displayText}`;

    // 统一左键点击行为：显示操作菜单
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.command = "fusi-tools.smartTranslate.showActions";

    this.isDisplaying = true;

    // 设置基于选区的自动清除逻辑
    this.scheduleSelectionBasedClear(duration);
  }

  showLoading(): void {
    this.clearTimer && clearTimeout(this.clearTimer);

    this.statusBarItem.text = "$(loading~spin) 翻译中...";
    this.statusBarItem.tooltip = "正在翻译，请稍候";
    this.statusBarItem.command = undefined;
  }

  showError(message: string): void {
    this.clearTimer && clearTimeout(this.clearTimer);

    this.statusBarItem.text = `$(error) ${message}`;
    this.statusBarItem.tooltip = message;
    this.statusBarItem.command = undefined;

    // 错误信息显示时间稍长
    this.scheduleAutoClear(3000);
  }

  clear(): void {
    this.clearTimer && clearTimeout(this.clearTimer);
    this.selectionCheckTimer && clearTimeout(this.selectionCheckTimer);
    this.statusBarItem.text = "";
    this.statusBarItem.tooltip = "";
    this.statusBarItem.command = undefined;
    this.isDisplaying = false;
  }

  private formatTranslationText(result: TranslationResult): string {
    const maxLength = 30;
    let displayText = result.translatedText;

    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength - 3) + "...";
    }

    return displayText;
  }

  private createTooltip(result: TranslationResult): string {
    const sourceLanguage = result.sourceLanguage === "zh" ? "中文" : "English";
    const targetLanguage = result.targetLanguage === "zh" ? "中文" : "English";

    return [
      `原文 (${sourceLanguage}): ${result.originalText}`,
      `译文 (${targetLanguage}): ${result.translatedText}`,
      "",
      "点击查看更多选项",
    ].join("\n");
  }

  private scheduleAutoClear(duration: number): void {
    this.clearTimer = setTimeout(() => {
      this.clear();
    }, duration);
  }

  private scheduleSelectionBasedClear(minDuration: number): void {
    // 首先设置最小显示时间
    this.clearTimer = setTimeout(() => {
      // 最小时间到达后，开始检查选区状态
      this.startSelectionCheck();
    }, minDuration);
  }

  private startSelectionCheck(): void {
    // 每500ms检查一次选区状态
    this.selectionCheckTimer = setTimeout(() => {
      if (!this.isDisplaying) {
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        this.clear();
        return;
      }

      const selection = editor.selection;
      const hasSelection = !selection.isEmpty;

      if (!hasSelection) {
        // 没有选区，清除显示
        this.clear();
      } else {
        // 还有选区，继续检查
        this.startSelectionCheck();
      }
    }, 500);
  }

  dispose(): void {
    this.clearTimer && clearTimeout(this.clearTimer);
    this.selectionCheckTimer && clearTimeout(this.selectionCheckTimer);
    this.statusBarItem.dispose();
  }
}
