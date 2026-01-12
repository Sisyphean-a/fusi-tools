import * as vscode from "vscode";
import { FavoritesManager } from "./favoritesManager";
import { FavoritesProvider } from "./favoritesProvider";
import * as path from "path";
import { Logger } from "../../logger";

export function activate(context: vscode.ExtensionContext) {
  Logger.info("正在激活项目常用文件功能...");
  const manager = new FavoritesManager(context);
  const provider = new FavoritesProvider(manager);
  
  // 注册清理函数
  context.subscriptions.push({
    dispose: () => manager.dispose()
  });

  // Register Tree View
  const treeView = vscode.window.createTreeView(
    "fusi-tools.projectFavorites.view",
    {
      treeDataProvider: provider,
      showCollapseAll: true,
    }
  );

  context.subscriptions.push(treeView);

  // --- Commands ---

  // 1. Add File (from Explorer context)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.addFile",
      async (uri?: vscode.Uri) => {
        Logger.info("命令触发: addFile");
        if (!uri) {
          // Fallback: use active editor
          uri = vscode.window.activeTextEditor?.document.uri;
        }
        if (!uri) {
          vscode.window.showWarningMessage("未选择要添加的文件。");
          return;
        }

        const categories = manager.getCategories();
        const items = categories.map((c) => ({ label: c.name, id: c.id }));
        items.push({
          label: "$(plus) 创建新分类...",
          id: "CREATE_NEW",
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "选择要添加到的分类",
        });

        if (!selected) {
          return;
        }

        let targetCategoryId = selected.id;
        if (targetCategoryId === "CREATE_NEW") {
          const newName = await vscode.window.showInputBox({
            prompt: "输入新分类名称",
          });
          if (!newName) {
            return;
          }
          targetCategoryId = manager.addCategory(newName);
        }

        await manager.addFile(uri, targetCategoryId);
        provider.refresh();
      }
    )
  );

  // 2. Add Category
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.addCategory",
      async () => {
        Logger.info("命令触发: addCategory");
        const name = await vscode.window.showInputBox({
          prompt: "分类名称",
          placeHolder: "例如：核心工具",
        });
        if (name) {
          manager.addCategory(name);
          provider.refresh();
        }
      }
    )
  );

  // 3. Remove File (from Tree Item)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.removeFile",
      (item: any) => {
        Logger.info("命令触发: removeFile");
        if (item && item.file && item.categoryId) {
          manager.removeFileFromCategory(item.file.id, item.categoryId);
          provider.refresh();
        }
      }
    )
  );

  // 4. Remove Category
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.removeCategory",
      async (item: any) => {
        Logger.info("命令触发: removeCategory");
        if (item && item.id && item.fileIds) {
          // It's a category
          const confirm = await vscode.window.showWarningMessage(
            `确定要删除分类 '${item.name}' 吗？`,
            { modal: true },
            "删除"
          );
          if (confirm === "删除") {
            manager.removeCategory(item.id);
            provider.refresh();
          }
        }
      }
    )
  );

  // 5. Rename Category
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.renameCategory",
      async (item: any) => {
        Logger.info("命令触发: renameCategory");
        if (item && item.id && item.fileIds) {
          const newName = await vscode.window.showInputBox({
            prompt: "新分类名称",
            value: item.name,
          });
          if (newName) {
            manager.renameCategory(item.id, newName);
            provider.refresh();
          }
        }
      }
    )
  );

  // New: Move to Category
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.moveToCategory",
      async (item: any) => {
        Logger.info("命令触发: moveToCategory");
        // item should be { file: FavoriteFile; categoryId: string }
        if (!item || !item.file || !item.categoryId) {
          return;
        }

        const categories = manager.getCategories();
        // Exclude current category
        const availableCategories = categories.filter(
          (c) => c.id !== item.categoryId
        );

        if (availableCategories.length === 0) {
          vscode.window.showInformationMessage("没有其他可用的分类。");
          return;
        }

        const items = availableCategories.map((c) => ({
          label: c.name,
          id: c.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "选择目标分类",
        });

        if (selected) {
          manager.moveFileToCategory(
            item.file.id,
            item.categoryId,
            selected.id
          );
          provider.refresh();
        }
      }
    )
  );

  // 6. Set Alias (Rename File in View)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.renameFile",
      async (item: any) => {
        Logger.info("命令触发: renameFile");
        if (item && item.file) {
          const currentAlias = item.file.alias || path.basename(item.file.path);
          const newAlias = await vscode.window.showInputBox({
            prompt: "设置文件别名 (留空则重置)",
            value: currentAlias,
          });

          if (newAlias !== undefined) {
            manager.setFileAlias(
              item.file.id,
              newAlias === "" ? undefined : newAlias
            );
            provider.refresh();
          }
        }
      }
    )
  );

  // 7. Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fusi-tools.projectFavorites.refresh",
      () => {
        Logger.info("命令触发: refresh");
        provider.refresh();
      }
    )
  );

  // --- File Watchers ---

  // Watch for renames
  const renameWatcher = vscode.workspace.onDidRenameFiles((e) => {
    manager.handleFileRenames(e);
    provider.refresh(); // Visual refresh
  });
  context.subscriptions.push(renameWatcher);

  // Watch for deletions
  const deleteWatcher = vscode.workspace.onDidDeleteFiles((e) => {
    manager.handleFileDeletions(e);
    // handleFileDeletions triggers event internally if needed, or we just refresh ui
    provider.refresh();
  });
  context.subscriptions.push(deleteWatcher);
}
