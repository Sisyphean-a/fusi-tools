import * as vscode from "vscode";

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * 日志管理器
 * 支持日志级别配置，减少生产环境的日志输出
 */
export class Logger {
  private static _outputChannel: vscode.OutputChannel;
  private static _logLevel: LogLevel = LogLevel.INFO;

  /**
   * 获取输出通道
   */
  public static get outputChannel(): vscode.OutputChannel {
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel("Fusi Tools");
    }
    return this._outputChannel;
  }

  /**
   * 设置日志级别
   * @param level 日志级别
   */
  public static setLogLevel(level: LogLevel): void {
    this._logLevel = level;
  }

  /**
   * 从配置中读取日志级别
   */
  public static loadLogLevelFromConfig(): void {
    const config = vscode.workspace.getConfiguration("fusi-tools");
    const levelStr = config.get<string>("logLevel", "info").toLowerCase();
    
    switch (levelStr) {
      case "debug":
        this._logLevel = LogLevel.DEBUG;
        break;
      case "info":
        this._logLevel = LogLevel.INFO;
        break;
      case "warn":
        this._logLevel = LogLevel.WARN;
        break;
      case "error":
        this._logLevel = LogLevel.ERROR;
        break;
      case "none":
        this._logLevel = LogLevel.NONE;
        break;
      default:
        this._logLevel = LogLevel.INFO;
    }
  }

  /**
   * 记录调试信息
   * @param message 日志消息
   */
  public static debug(message: string): void {
    if (this._logLevel <= LogLevel.DEBUG) {
      const timestamp = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`[${timestamp}] [DEBUG] ${message}`);
    }
  }

  /**
   * 记录一般信息
   * @param message 日志消息
   */
  public static info(message: string): void {
    if (this._logLevel <= LogLevel.INFO) {
      const timestamp = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`[${timestamp}] [INFO] ${message}`);
    }
  }

  /**
   * 记录警告信息
   * @param message 日志消息
   */
  public static warn(message: string): void {
    if (this._logLevel <= LogLevel.WARN) {
      const timestamp = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`[${timestamp}] [WARN] ${message}`);
    }
  }

  /**
   * 记录错误信息
   * @param message 日志消息
   * @param error 错误对象（可选）
   */
  public static error(message: string, error?: any): void {
    if (this._logLevel <= LogLevel.ERROR) {
      const timestamp = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
      if (error) {
        // 优化错误对象的序列化
        if (error instanceof Error) {
          this.outputChannel.appendLine(`  Message: ${error.message}`);
          if (error.stack) {
            this.outputChannel.appendLine(`  Stack: ${error.stack}`);
          }
        } else if (typeof error === "object") {
          try {
            this.outputChannel.appendLine(`  Details: ${JSON.stringify(error, null, 2)}`);
          } catch {
            this.outputChannel.appendLine(`  Details: [无法序列化错误对象]`);
          }
        } else {
          this.outputChannel.appendLine(`  Details: ${error}`);
        }
      }
    }
  }

  /**
   * 显示输出通道
   */
  public static show(): void {
    this._outputChannel?.show(true);
  }

  /**
   * 清空日志
   */
  public static clear(): void {
    this._outputChannel?.clear();
  }
}
