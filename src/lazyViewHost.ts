import * as vscode from "vscode";
import { FeatureActivationResult } from "./types/feature";

type ViewProvider = vscode.TreeDataProvider<any>;
const AI_COMMIT_VIEW_ID = "fusi-tools.aiCommitView";
type ViewEntry = {
  proxy: LazyTreeDataProviderProxy;
  treeView: vscode.TreeView<any>;
};

class LazyTreeDataProviderProxy implements vscode.TreeDataProvider<any>, vscode.Disposable {
  private delegate?: ViewProvider;
  private delegateSubscription?: vscode.Disposable;
  private readonly emitter = new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(
    private readonly moduleName: string,
    private readonly viewId: string,
    private readonly activate: () => Promise<FeatureActivationResult>
  ) {}

  attach(provider: ViewProvider): void {
    this.delegate = provider;
    this.delegateSubscription?.dispose();
    this.delegateSubscription = provider.onDidChangeTreeData?.(() => this.emitter.fire(undefined));
    this.emitter.fire(undefined);
  }

  detach(provider?: ViewProvider): void {
    if (provider && this.delegate !== provider) {
      return;
    }

    this.delegateSubscription?.dispose();
    this.delegateSubscription = undefined;
    this.delegate = undefined;
    this.emitter.fire(undefined);
  }

  getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
    if (this.delegate) {
      return this.delegate.getTreeItem(element);
    }
    return element instanceof vscode.TreeItem ? element : new vscode.TreeItem(String(element));
  }

  async getChildren(element?: any): Promise<any[]> {
    if (!this.delegate) {
      const result = await this.activate();
      if (!result.success) {
        return [new vscode.TreeItem(`模块 ${this.moduleName} 加载失败`)];
      }
      if (result.disabled) {
        return [new vscode.TreeItem(`功能 \"${this.moduleName}\" 已被禁用`)];
      }
      if (!this.delegate) {
        return [new vscode.TreeItem(`视图 ${this.viewId} 未注册数据提供器`)];
      }
    }

    return (await this.delegate.getChildren(element)) ?? [];
  }

  dispose(): void {
    this.detach();
    this.emitter.dispose();
  }
}

export class LazyViewHost {
  private entries = new Map<string, ViewEntry>();

  registerPlaceholder(
    viewId: string,
    moduleName: string,
    activate: () => Promise<FeatureActivationResult>,
    context: vscode.ExtensionContext
  ): void {
    const proxy = new LazyTreeDataProviderProxy(moduleName, viewId, activate);
    const treeView = vscode.window.createTreeView(viewId, {
      treeDataProvider: proxy,
      showCollapseAll: viewId !== AI_COMMIT_VIEW_ID,
    });

    this.entries.set(viewId, { proxy, treeView });
    context.subscriptions.push(proxy, treeView);
  }

  async withInterception<T>(viewIds: readonly string[] | undefined, task: () => Promise<T> | T): Promise<T> {
    if (!viewIds?.length) {
      return await Promise.resolve(task());
    }

    const originalRegister = vscode.window.registerTreeDataProvider;
    const originalCreate = vscode.window.createTreeView;

    vscode.window.registerTreeDataProvider = ((viewId: string, provider: ViewProvider) => {
      const entry = this.match(viewIds, viewId);
      if (!entry) {
        return originalRegister(viewId, provider);
      }

      entry.proxy.attach(provider);
      return new vscode.Disposable(() => entry.proxy.detach(provider));
    }) as typeof vscode.window.registerTreeDataProvider;

    vscode.window.createTreeView = ((viewId: string, options: vscode.TreeViewOptions<any>) => {
      const entry = this.match(viewIds, viewId);
      if (!entry) {
        return (originalCreate as any)(viewId, options);
      }

      entry.proxy.attach(options.treeDataProvider);
      return entry.treeView;
    }) as typeof vscode.window.createTreeView;

    try {
      return await Promise.resolve(task());
    } finally {
      vscode.window.registerTreeDataProvider = originalRegister;
      vscode.window.createTreeView = originalCreate;
    }
  }

  private match(viewIds: readonly string[], viewId: string): ViewEntry | undefined {
    if (!viewIds.includes(viewId)) {
      return undefined;
    }
    return this.entries.get(viewId);
  }
}
