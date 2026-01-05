import * as vscode from "vscode";
import { TranslatorService, TranslationResult } from "./translator";
import { StatusBarManager } from "./ui/statusBar";
import { NameGenerator } from "./nameGenerator";
import { NamingPanel } from "./ui/namingPanel";
import { SelectionDebugger } from "./utils/selectionDebugger";

let translatorService: TranslatorService | undefined;
let statusBarManager: StatusBarManager | undefined;
let nameGenerator: NameGenerator | undefined;
let namingPanel: NamingPanel | undefined;
let lastTranslationResult: TranslationResult | null = null;
let selectionDebugger: SelectionDebugger | undefined;

// 防抖相关变量
let selectionDebounceTimer: NodeJS.Timeout | undefined;
let lastSelectionText: string = "";
let disposables: vscode.Disposable[] = [];
let isEnabled = false;

export function activate(context: vscode.ExtensionContext) {
  console.log("Smart Translate feature is initializing...");

  // 注册切换命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.toggleSmartTranslate",
      async () => {
        await toggleFeature();
      }
    )
  );

  // 注册内部交互命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.smartTranslate.showActions",
      async () => {
        await showStatusMenu();
      }
    )
  );

  // 检查配置是否启用
  const config = vscode.workspace.getConfiguration("fusi-tools.smartTranslate");
  if (config.get<boolean>("enabled", true)) {
    startFeature(context);
  }

  // 监听配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("fusi-tools.smartTranslate.enabled")) {
        const newEnabled = vscode.workspace
          .getConfiguration("fusi-tools.smartTranslate")
          .get<boolean>("enabled", true);
        if (newEnabled) {
          startFeature(context);
        } else {
          stopFeature();
        }
      }
    })
  );
}

export function deactivate() {
  stopFeature();
}

async function toggleFeature() {
  const config = vscode.workspace.getConfiguration("fusi-tools.smartTranslate");
  const currentEnabled = config.get<boolean>("enabled", true);
  await config.update(
    "enabled",
    !currentEnabled,
    vscode.ConfigurationTarget.Global
  );

  if (!currentEnabled) {
    vscode.window.showInformationMessage("Smart Translate 已启用");
  } else {
    vscode.window.showInformationMessage("Smart Translate 已禁用");
  }
}

function startFeature(context: vscode.ExtensionContext) {
  if (isEnabled) {
    return;
  }

  // 初始化服务
  translatorService = new TranslatorService();
  statusBarManager = new StatusBarManager();
  nameGenerator = new NameGenerator();
  namingPanel = new NamingPanel(context);
  selectionDebugger = SelectionDebugger.getInstance();

  // 监听文本选择变化
  const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
    async (event) => {
      handleSelectionChange(event);
    }
  );

  disposables.push(selectionChangeListener);
  disposables.push(statusBarManager); // 确保状态栏被清理

  isEnabled = true;
  console.log("Smart Translate feature started.");
}

function stopFeature() {
  if (!isEnabled) {
    return;
  }

  // 清理资源
  if (selectionDebounceTimer) {
    clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = undefined;
  }

  disposables.forEach((d) => d.dispose());
  disposables = [];

  // 清理引用
  translatorService = undefined;
  statusBarManager = undefined;
  nameGenerator = undefined;
  namingPanel = undefined;
  lastTranslationResult = null;

  isEnabled = false;
  console.log("Smart Translate feature stopped.");
}

async function handleSelectionChange(
  event: vscode.TextEditorSelectionChangeEvent
) {
  if (!isEnabled || event.selections.length === 0) {
    return;
  }

  // 清除之前的防抖定时器
  if (selectionDebounceTimer) {
    clearTimeout(selectionDebounceTimer);
  }

  const selection = event.selections[0];
  if (selection.isEmpty) {
    return;
  }

  // 使用防抖机制，延迟处理选择事件
  selectionDebounceTimer = setTimeout(async () => {
    try {
      // 再次检查选择是否仍然有效
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const currentSelection = editor.selection;
      if (currentSelection.isEmpty) {
        return;
      }

      // 获取选中的文本
      const selectedText = await getSelectedTextSafely(
        editor,
        currentSelection
      );

      if (
        selectedText &&
        selectedText.length > 0 &&
        selectedText.length < 500
      ) {
        // 避免重复翻译相同的文本
        if (selectedText !== lastSelectionText) {
          lastSelectionText = selectedText;
          await translateSelectedText(selectedText);
        }
      }
    } catch (error) {
      console.error("Selection processing error:", error);
    }
  }, 300); // 300ms 防抖延迟
}

async function getSelectedTextSafely(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  maxRetries: number = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (selection.isEmpty) return "";

      const text = editor.document.getText(selection);
      const trimmedText = text.trim();

      if (trimmedText.length === 0) {
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }
        return "";
      }
      return trimmedText;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }
  return "";
}

async function translateSelectedText(text: string): Promise<void> {
  if (!translatorService || !statusBarManager) {
    return;
  }

  try {
    // 显示加载状态
    statusBarManager.showLoading();

    // 执行翻译
    const result = await translatorService.translate(text);

    // 保存最近的翻译结果
    lastTranslationResult = result;

    // 显示翻译结果
    statusBarManager.showTranslation(result);
  } catch (error) {
    console.error("Translation error:", error);
    statusBarManager.showError("翻译失败");
  }
}

async function showStatusMenu(): Promise<void> {
  if (!lastTranslationResult) {
    // 如果没有最近的翻译，尝试直接翻译当前选区
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      const text = editor.document.getText(editor.selection).trim();
      if (text) {
        await translateSelectedText(text);
        return;
      }
    }
    vscode.window.showInformationMessage("暂无翻译记录");
    return;
  }

  const items: vscode.QuickPickItem[] = [
    {
      label: "$(copy) 复制译文",
      description: lastTranslationResult.translatedText,
      detail: "将翻译结果复制到剪贴板",
    },
  ];

  // 如果是中文翻译成英文，添加命名建议选项
  if (
    !lastTranslationResult.sourceLanguage ||
    lastTranslationResult.sourceLanguage === "zh"
  ) {
    items.push({
      label: "$(symbol-key) 查看命名建议",
      description: "生成变量命名 (camelCase, snake_case...)",
      detail: "",
    });
  }

  items.push(
    {
      label: "$(replace) 替换选中内容",
      description: "用译文替换当前选中的文本",
      detail: "",
    },
    {
      label: "$(sync) 重新翻译",
      description: "重新翻译当前选中的文本",
      detail: "",
    }
  );

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "选择操作",
    title: "翻译操作菜单",
  });

  if (!selected) {
    return;
  }

  if (selected.label.includes("复制译文")) {
    await vscode.env.clipboard.writeText(lastTranslationResult.translatedText);
    vscode.window.showInformationMessage("已复制译文");
  } else if (selected.label.includes("替换选中内容")) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      if (editor.selection.isEmpty) {
        vscode.window.showWarningMessage("请先选择要替换的文本");
      } else {
        await editor.edit((editBuilder) => {
          editBuilder.replace(
            editor.selection,
            lastTranslationResult!.translatedText
          );
        });
      }
    }
  } else if (selected.label.includes("查看命名建议")) {
    await showNamingOptions();
  } else if (selected.label.includes("重新翻译")) {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      const text = editor.document.getText(editor.selection).trim();
      if (text) await translateSelectedText(text);
    }
  }
}

async function showNamingOptions(): Promise<void> {
  if (!nameGenerator || !namingPanel || !lastTranslationResult) {
    return;
  }

  const englishText = lastTranslationResult.translatedText;

  try {
    const namingOptions = nameGenerator.generateNamingOptions(englishText);
    if (namingOptions.length === 0) {
      vscode.window.showInformationMessage("无法为此文本生成命名建议");
      return;
    }
    await namingPanel.show(namingOptions);
  } catch (error) {
    vscode.window.showErrorMessage("生成命名建议失败");
  }
}
