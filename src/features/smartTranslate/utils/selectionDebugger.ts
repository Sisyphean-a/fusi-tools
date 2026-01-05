import * as vscode from "vscode";

/**
 * 选择调试器 - 用于跟踪和调试文本选择问题
 */
export class SelectionDebugger {
  private static instance: SelectionDebugger;
  private isEnabled: boolean = false;
  private selectionHistory: SelectionEvent[] = [];
  private maxHistorySize: number = 50;

  private constructor() {}

  static getInstance(): SelectionDebugger {
    if (!SelectionDebugger.instance) {
      SelectionDebugger.instance = new SelectionDebugger();
    }
    return SelectionDebugger.instance;
  }

  /**
   * 启用调试模式
   */
  enable(): void {
    this.isEnabled = true;
    console.log("[SelectionDebugger] Debug mode enabled");
  }

  /**
   * 禁用调试模式
   */
  disable(): void {
    this.isEnabled = false;
    console.log("[SelectionDebugger] Debug mode disabled");
  }

  /**
   * 记录选择事件
   */
  logSelectionEvent(
    event: vscode.TextEditorSelectionChangeEvent,
    selectedText: string,
    processingDelay?: number
  ): void {
    if (!this.isEnabled) {
      return;
    }

    const selectionEvent: SelectionEvent = {
      timestamp: Date.now(),
      kind: event.kind,
      selections: event.selections.map((sel) => ({
        start: { line: sel.start.line, character: sel.start.character },
        end: { line: sel.end.line, character: sel.end.character },
        isEmpty: sel.isEmpty,
        isReversed: sel.isReversed,
      })),
      selectedText,
      textLength: selectedText.length,
      processingDelay,
    };

    this.selectionHistory.push(selectionEvent);

    // 限制历史记录大小
    if (this.selectionHistory.length > this.maxHistorySize) {
      this.selectionHistory.shift();
    }

    this.logEvent(selectionEvent);
  }

  /**
   * 记录文本获取尝试
   */
  logTextRetrievalAttempt(
    attempt: number,
    selection: vscode.Selection,
    retrievedText: string,
    success: boolean,
    error?: string
  ): void {
    if (!this.isEnabled) {
      return;
    }

    console.log(`[SelectionDebugger] Text retrieval attempt ${attempt}:`, {
      selection: {
        start: {
          line: selection.start.line,
          character: selection.start.character,
        },
        end: { line: selection.end.line, character: selection.end.character },
        isEmpty: selection.isEmpty,
        isReversed: selection.isReversed,
      },
      retrievedText: `"${retrievedText}"`,
      textLength: retrievedText.length,
      success,
      error,
    });
  }

  /**
   * 获取选择历史
   */
  getSelectionHistory(): SelectionEvent[] {
    return [...this.selectionHistory];
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.selectionHistory = [];
    console.log("[SelectionDebugger] History cleared");
  }

  /**
   * 分析选择模式
   */
  analyzeSelectionPatterns(): SelectionAnalysis {
    const events = this.selectionHistory;
    if (events.length === 0) {
      return {
        totalEvents: 0,
        averageTextLength: 0,
        emptySelections: 0,
        rapidChanges: 0,
        textLossEvents: 0,
      };
    }

    let emptySelections = 0;
    let rapidChanges = 0;
    let textLossEvents = 0;
    let totalTextLength = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      if (event.textLength === 0) {
        emptySelections++;
      }

      totalTextLength += event.textLength;

      // 检测快速变化（100ms内的连续事件）
      if (i > 0) {
        const timeDiff = event.timestamp - events[i - 1].timestamp;
        if (timeDiff < 100) {
          rapidChanges++;
        }

        // 检测文本丢失（后续事件的文本比前一个短）
        if (
          event.textLength < events[i - 1].textLength &&
          events[i - 1].textLength > 0
        ) {
          textLossEvents++;
        }
      }
    }

    return {
      totalEvents: events.length,
      averageTextLength: totalTextLength / events.length,
      emptySelections,
      rapidChanges,
      textLossEvents,
    };
  }

  /**
   * 生成调试报告
   */
  generateDebugReport(): string {
    const analysis = this.analyzeSelectionPatterns();
    const recentEvents = this.selectionHistory.slice(-10);

    const report = [
      "=== Selection Debug Report ===",
      `Total Events: ${analysis.totalEvents}`,
      `Average Text Length: ${analysis.averageTextLength.toFixed(2)}`,
      `Empty Selections: ${analysis.emptySelections}`,
      `Rapid Changes: ${analysis.rapidChanges}`,
      `Text Loss Events: ${analysis.textLossEvents}`,
      "",
      "=== Recent Events ===",
      ...recentEvents.map(
        (event, index) =>
          `${index + 1}. [${new Date(event.timestamp).toISOString()}] ` +
          `"${event.selectedText}" (${event.textLength} chars) ` +
          `Kind: ${event.kind || "unknown"}`
      ),
      "==========================",
    ];

    return report.join("\n");
  }

  private logEvent(event: SelectionEvent): void {
    console.log(`[SelectionDebugger] Selection event:`, {
      timestamp: new Date(event.timestamp).toISOString(),
      kind: event.kind,
      selectedText: `"${event.selectedText}"`,
      textLength: event.textLength,
      selections: event.selections,
      processingDelay: event.processingDelay,
    });
  }
}

interface SelectionEvent {
  timestamp: number;
  kind?: vscode.TextEditorSelectionChangeKind;
  selections: Array<{
    start: { line: number; character: number };
    end: { line: number; character: number };
    isEmpty: boolean;
    isReversed: boolean;
  }>;
  selectedText: string;
  textLength: number;
  processingDelay?: number;
}

interface SelectionAnalysis {
  totalEvents: number;
  averageTextLength: number;
  emptySelections: number;
  rapidChanges: number;
  textLossEvents: number;
}
