import * as vscode from "vscode";
import { Logger } from "../../logger";

/**
 * Scratchpad Webview 视图提供者
 * 提供一个临时的文本输入区域，内容仅保存在内存中
 */
export class ScratchpadViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "scratchpad.view";

  private _view?: vscode.WebviewView;
  private _content: string = "";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    Logger.info("Scratchpad 视图正在初始化...");
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // 异步加载 HTML 内容
    this._updateWebviewHtml(webviewView);

    // 监听来自 Webview 的消息
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "contentChanged":
          this._content = message.content;
          // 不记录频繁的内容变更日志，以免刷屏
          break;
      }
    }, undefined);

    // 当视图可见时恢复内容
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        Logger.info("Scratchpad 视图变为可见，正在恢复内容...");
        this._restoreContent();
      }
    });
  }

  private _restoreContent(): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: "restoreContent",
        content: this._content,
      });
      Logger.info(`Scratchpad 内容已恢复 (长度: ${this._content.length})`);
    }
  }

  private async _updateWebviewHtml(webviewView: vscode.WebviewView) {
    const htmlUri = vscode.Uri.joinPath(
      this._extensionUri,
      "src",
      "features",
      "scratchpad",
      "scratchpad.html"
    );
    try {
      const uint8Array = await vscode.workspace.fs.readFile(htmlUri);
      const htmlContent = new TextDecoder().decode(uint8Array);
      webviewView.webview.html = htmlContent;
    } catch (error) {
      Logger.error(`读取 Scratchpad HTML 失败: ${error}`);
      webviewView.webview.html = `<!DOCTYPE html><html><body>Error loading UI</body></html>`;
    }
  }
}
