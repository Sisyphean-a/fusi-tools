import * as assert from "assert";
import * as vscode from "vscode";
import { FeatureLoader } from "../featureLoader";
import { FeatureModule } from "../types/feature";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createContext(): vscode.ExtensionContext {
  return { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
}

function createTreeViewStub(): vscode.TreeView<any> {
  return {
    dispose() {},
    onDidChangeVisibility: () => new vscode.Disposable(() => undefined),
    visible: true,
  } as unknown as vscode.TreeView<any>;
}

suite("FeatureLoader", () => {
  test("view trigger should surface real tree items through the bound provider", async () => {
    const loader = new FeatureLoader();
    const context = createContext();
    let boundProvider: vscode.TreeDataProvider<vscode.TreeItem> | undefined;
    const originalRegisterCommand = vscode.commands.registerCommand;
    const originalRegisterTreeDataProvider = vscode.window.registerTreeDataProvider;
    const originalCreateTreeView = vscode.window.createTreeView;

    vscode.commands.registerCommand = (() => new vscode.Disposable(() => undefined)) as typeof vscode.commands.registerCommand;
    vscode.window.registerTreeDataProvider = (() => new vscode.Disposable(() => undefined)) as typeof vscode.window.registerTreeDataProvider;
    vscode.window.createTreeView = ((_: string, options: vscode.TreeViewOptions<vscode.TreeItem>) => {
      if (!boundProvider) boundProvider = options.treeDataProvider;
      return createTreeViewStub();
    }) as typeof vscode.window.createTreeView;

    try {
      loader.register({
        name: "aiCommit",
        activationStrategy: "command",
        viewTriggers: ["fusi-tools.aiCommitView"],
        activate(moduleContext) {
          moduleContext.subscriptions.push(
            vscode.window.registerTreeDataProvider("fusi-tools.aiCommitView", {
              getTreeItem: (element: vscode.TreeItem) => element,
              getChildren: async () => [new vscode.TreeItem("real item")],
            })
          );
          return { success: true };
        },
      });
      loader.registerLazyEntrypoints(context);

      const children = await boundProvider?.getChildren();

      assert.deepStrictEqual(children?.map((item) => item.label), ["real item"]);
    } finally {
      vscode.commands.registerCommand = originalRegisterCommand;
      vscode.window.registerTreeDataProvider = originalRegisterTreeDataProvider;
      vscode.window.createTreeView = originalCreateTreeView;
    }
  });

  test("view trigger should forward refresh events from the attached provider", async () => {
    const loader = new FeatureLoader();
    const context = createContext();
    const emitter = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    let boundProvider: vscode.TreeDataProvider<vscode.TreeItem> | undefined;
    let fired = false;
    const originalRegisterCommand = vscode.commands.registerCommand;
    const originalRegisterTreeDataProvider = vscode.window.registerTreeDataProvider;
    const originalCreateTreeView = vscode.window.createTreeView;

    vscode.commands.registerCommand = (() => new vscode.Disposable(() => undefined)) as typeof vscode.commands.registerCommand;
    vscode.window.registerTreeDataProvider = (() => new vscode.Disposable(() => undefined)) as typeof vscode.window.registerTreeDataProvider;
    vscode.window.createTreeView = ((_: string, options: vscode.TreeViewOptions<vscode.TreeItem>) => {
      if (!boundProvider) boundProvider = options.treeDataProvider;
      return createTreeViewStub();
    }) as typeof vscode.window.createTreeView;

    try {
      loader.register({
        name: "aiCommit",
        activationStrategy: "command",
        viewTriggers: ["fusi-tools.aiCommitView"],
        activate(moduleContext) {
          moduleContext.subscriptions.push(
            vscode.window.registerTreeDataProvider("fusi-tools.aiCommitView", {
              onDidChangeTreeData: emitter.event,
              getTreeItem: (element: vscode.TreeItem) => element,
              getChildren: async () => [],
            })
          );
          return { success: true };
        },
      });
      loader.registerLazyEntrypoints(context);
      await boundProvider?.getChildren();
      boundProvider?.onDidChangeTreeData?.(() => {
        fired = true;
      });
      emitter.fire(undefined);

      assert.ok(fired);
    } finally {
      vscode.commands.registerCommand = originalRegisterCommand;
      vscode.window.registerTreeDataProvider = originalRegisterTreeDataProvider;
      vscode.window.createTreeView = originalCreateTreeView;
      emitter.dispose();
    }
  });

  test("view trigger should dispose command proxy before module registers real command", async () => {
    const loader = new FeatureLoader();
    const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
    const commandHandlers = new Map<string, (...args: unknown[]) => unknown>();

    const originalRegisterCommand = vscode.commands.registerCommand;
    const originalExecuteCommand = vscode.commands.executeCommand;

    vscode.commands.registerCommand = ((commandId: string, handler: (...args: unknown[]) => unknown) => {
      if (commandHandlers.has(commandId)) {
        throw new Error(`command '${commandId}' already exists`);
      }
      commandHandlers.set(commandId, handler);
      return new vscode.Disposable(() => {
        commandHandlers.delete(commandId);
      });
    }) as typeof vscode.commands.registerCommand;
    vscode.commands.executeCommand = (async (commandId: string, ...args: unknown[]) => {
      return commandHandlers.get(commandId)?.(...args);
    }) as typeof vscode.commands.executeCommand;

    const module: FeatureModule = {
      name: "aiCommit",
      activationStrategy: "command",
      commandTriggers: ["fusi-tools.previewSmartDiff"],
      activate(moduleContext) {
        moduleContext.subscriptions.push(
          vscode.commands.registerCommand("fusi-tools.previewSmartDiff", async () => undefined)
        );
        return { success: true };
      },
    };

    try {
      loader.register(module);
      loader.registerLazyEntrypoints(context);

      assert.ok(commandHandlers.has("fusi-tools.previewSmartDiff"));

      await commandHandlers.get("fusi-tools.previewSmartDiff")?.();

      assert.ok(loader.isActivated("aiCommit"));
      assert.ok(commandHandlers.has("fusi-tools.previewSmartDiff"));
    } finally {
      vscode.commands.registerCommand = originalRegisterCommand;
      vscode.commands.executeCommand = originalExecuteCommand;
    }
  });

  test("activateAll should activate modules in parallel", async () => {
    const loader = new FeatureLoader();
    const context = { subscriptions: [] } as any;

    const createSlowModule = (name: string): FeatureModule => ({
      name,
      async activate() {
        await sleep(80);
        return { success: true };
      },
    });

    loader.register(createSlowModule("m1"));
    loader.register(createSlowModule("m2"));

    const start = Date.now();
    await loader.activateAll(context);
    const elapsed = Date.now() - start;

    assert.ok(
      elapsed < 140,
      `expected parallel activation under 140ms, got ${elapsed}ms`
    );
  });
});
