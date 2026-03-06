import * as assert from "assert";
import * as vscode from "vscode";
import { FeatureLoader } from "../featureLoader";
import { FeatureModule } from "../types/feature";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

suite("FeatureLoader", () => {
  test("view trigger should dispose command proxy before module registers real command", async () => {
    const loader = new FeatureLoader();
    const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
    const commandHandlers = new Map<string, (...args: unknown[]) => unknown>();
    let capturedProvider: vscode.TreeDataProvider<vscode.TreeItem> | undefined;

    const originalRegisterCommand = vscode.commands.registerCommand;
    const originalRegisterTreeDataProvider = vscode.window.registerTreeDataProvider;

    vscode.commands.registerCommand = ((commandId: string, handler: (...args: unknown[]) => unknown) => {
      if (commandHandlers.has(commandId)) {
        throw new Error(`command '${commandId}' already exists`);
      }
      commandHandlers.set(commandId, handler);
      return new vscode.Disposable(() => {
        commandHandlers.delete(commandId);
      });
    }) as typeof vscode.commands.registerCommand;

    vscode.window.registerTreeDataProvider = ((_: string, provider: vscode.TreeDataProvider<vscode.TreeItem>) => {
      capturedProvider = provider;
      return new vscode.Disposable(() => {
        capturedProvider = undefined;
      });
    }) as typeof vscode.window.registerTreeDataProvider;

    const module: FeatureModule = {
      name: "aiCommit",
      activationStrategy: "command",
      commandTriggers: ["fusi-tools.previewSmartDiff"],
      viewTriggers: ["fusi-tools.aiCommitView"],
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

      assert.ok(capturedProvider);
      assert.ok(commandHandlers.has("fusi-tools.previewSmartDiff"));

      const children = await capturedProvider.getChildren();

      assert.deepStrictEqual(children, []);
      assert.ok(loader.isActivated("aiCommit"));
      assert.ok(commandHandlers.has("fusi-tools.previewSmartDiff"));
    } finally {
      vscode.commands.registerCommand = originalRegisterCommand;
      vscode.window.registerTreeDataProvider = originalRegisterTreeDataProvider;
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
