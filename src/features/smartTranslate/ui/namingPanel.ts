import * as vscode from "vscode";
import { NamingOption } from "../nameGenerator";

export class NamingPanel {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async show(namingOptions: NamingOption[]): Promise<void> {
    if (!namingOptions || namingOptions.length === 0) {
      vscode.window.showInformationMessage("没有可用的命名建议");
      return;
    }

    // 创建QuickPick项目
    const quickPickItems: NamingQuickPickItem[] = namingOptions.map(
      (option) => ({
        label: option.example,
        description: "",
        detail: "",
        namingOption: option,
      })
    );

    // 显示QuickPick
    const quickPick = vscode.window.createQuickPick<NamingQuickPickItem>();
    quickPick.title = "命名格式";
    quickPick.placeholder = "选择复制到剪贴板";
    quickPick.items = quickPickItems;
    quickPick.canSelectMany = false;

    // 添加按钮
    quickPick.buttons = [
      {
        iconPath: new vscode.ThemeIcon("copy"),
        tooltip: "复制所有格式",
      },
      {
        iconPath: new vscode.ThemeIcon("insert"),
        tooltip: "插入到光标位置",
      },
    ];

    quickPick.onDidChangeSelection(async (items) => {
      if (items.length > 0) {
        const selectedItem = items[0];
        await this.copyToClipboard(selectedItem.namingOption.example);
        quickPick.hide();
      }
    });

    quickPick.onDidTriggerButton(async (button) => {
      if (button.tooltip === "复制所有格式") {
        await this.copyAllFormats(namingOptions);
      } else if (button.tooltip === "插入到光标位置") {
        await this.showInsertOptions(namingOptions);
      }
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
    });

    quickPick.show();
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(`已复制: ${text}`);
    } catch (error) {
      vscode.window.showErrorMessage("复制失败");
    }
  }

  private async copyAllFormats(namingOptions: NamingOption[]): Promise<void> {
    const allFormats = namingOptions
      .map((option) => `${option.format}: ${option.example}`)
      .join("\n");

    try {
      await vscode.env.clipboard.writeText(allFormats);
      vscode.window.showInformationMessage("已复制所有命名格式");
    } catch (error) {
      vscode.window.showErrorMessage("复制失败");
    }
  }

  private async showInsertOptions(
    namingOptions: NamingOption[]
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("没有活动的编辑器");
      return;
    }

    // 创建插入选项的QuickPick
    const insertItems: NamingQuickPickItem[] = namingOptions.map((option) => ({
      label: `${option.icon} 插入 ${option.example}`,
      description: option.format,
      detail: option.description,
      namingOption: option,
    }));

    const selected = await vscode.window.showQuickPick(insertItems, {
      title: "选择要插入的命名格式",
      placeHolder: "选择一个格式插入到光标位置",
    });

    if (selected) {
      await this.insertAtCursor(selected.namingOption.example);
    }
  }

  private async insertAtCursor(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const position = editor.selection.active;

    try {
      await editor.edit((editBuilder) => {
        editBuilder.insert(position, text);
      });

      vscode.window.showInformationMessage(`已插入: ${text}`);
    } catch (error) {
      vscode.window.showErrorMessage("插入失败");
    }
  }
}

interface NamingQuickPickItem extends vscode.QuickPickItem {
  namingOption: NamingOption;
}
