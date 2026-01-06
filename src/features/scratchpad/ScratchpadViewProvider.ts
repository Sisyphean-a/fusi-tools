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

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

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

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scratchpad</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        textarea {
            width: 100%;
            height: 100vh;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            border: none;
            outline: none;
            resize: none;
            padding: 8px;
        }
        textarea::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
    </style>
</head>
<body>
    <textarea id="scratchpad" placeholder="Type your notes here..."></textarea>
    <script>
        const vscode = acquireVsCodeApi();
        const textarea = document.getElementById('scratchpad');

        // 监听内容变化
        textarea.addEventListener('input', () => {
            vscode.postMessage({
                type: 'contentChanged',
                content: textarea.value
            });
        });

        // 接收来自扩展的消息
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'restoreContent':
                    textarea.value = message.content;
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}
