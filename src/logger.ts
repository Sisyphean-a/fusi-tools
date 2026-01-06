import * as vscode from "vscode";

export class Logger {
  private static _outputChannel: vscode.OutputChannel;

  public static get outputChannel(): vscode.OutputChannel {
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel("Fusi Tools");
    }
    return this._outputChannel;
  }

  public static info(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] [INFO] ${message}`);
  }

  public static error(message: string, error?: any): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
    if (error) {
      this.outputChannel.appendLine(JSON.stringify(error, null, 2));
    }
  }

  public static show(): void {
    this._outputChannel.show(true);
  }
}
