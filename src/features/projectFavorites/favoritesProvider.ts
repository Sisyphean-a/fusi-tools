import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  FavoritesManager,
  FavoriteCategory,
  FavoriteFile,
} from "./favoritesManager";
import { Logger } from "../../logger";

interface FileSystemNode {
  type: "fsNode";
  resourceUri: vscode.Uri;
  isDirectory: boolean;
}

type TreeElement =
  | FavoriteCategory
  | { file: FavoriteFile; categoryId: string }
  | FileSystemNode;

export class FavoritesProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeElement | undefined | null | void
  > = new vscode.EventEmitter<TreeElement | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeElement | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private manager: FavoritesManager) {
    // Relay events from manager
    this.manager.onDidChangeTreeData(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if (this.isCategory(element)) {
      // It's a Category
      const item = new vscode.TreeItem(
        element.name,
        element.expanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = "favoriteCategory";
      item.id = `category:${element.id}`;
      item.iconPath = new vscode.ThemeIcon("list-flat");
      return item;
    } else if (this.isFileSystemNode(element)) {
      // It's a real file system node (inside a favorite folder)
      const item = new vscode.TreeItem(element.resourceUri);

      if (element.isDirectory) {
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.contextValue = "fsFolder";
        item.iconPath = vscode.ThemeIcon.Folder;
      } else {
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.contextValue = "fsFile";
        item.iconPath = vscode.ThemeIcon.File;
        item.command = {
          command: "vscode.open",
          title: "打开文件",
          arguments: [element.resourceUri],
        };
      }
      return item;
    } else {
      // It's a Favorite File (Root item in standard view)
      const { file, categoryId } = element;
      const absolutePath = this.manager.resolvePath(file.path);
      const exists = fs.existsSync(absolutePath);

      const item = new vscode.TreeItem(
        file.alias || path.basename(absolutePath)
      );

      item.resourceUri = vscode.Uri.file(absolutePath);
      item.id = `file:${categoryId}:${file.id}`;
      item.tooltip = absolutePath;

      if (!exists) {
        item.description = "(已删除)";
        item.contextValue = "favoriteGhostFile";
        item.iconPath = new vscode.ThemeIcon("warning");
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      } else {
        item.description = file.alias ? path.basename(absolutePath) : "";

        if (file.type === "folder") {
          // It's a favorite folder -> Expandable
          item.contextValue = "favoriteFolder";
          item.iconPath = vscode.ThemeIcon.Folder;
          item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        } else {
          // It's a favorite file -> Leaf
          item.contextValue = "favoriteFile";
          item.iconPath = vscode.ThemeIcon.File;
          item.collapsibleState = vscode.TreeItemCollapsibleState.None;
          item.command = {
            command: "vscode.open",
            title: "打开文件",
            arguments: [item.resourceUri],
          };
        }
      }
      return item;
    }
  }

  getChildren(element?: TreeElement): Thenable<TreeElement[]> {
    if (!element) {
      // Root: Categories
      return Promise.resolve(this.manager.getCategories());
    }

    if (this.isCategory(element)) {
      // Category children: Favorite Files
      const files = this.manager.getFilesInCategory(element.id);
      return Promise.resolve(
        files.map((f) => ({ file: f, categoryId: element.id }))
      );
    }

    if (this.isFavoriteFile(element) && element.file.type === "folder") {
      // Favorite Folder -> Show FS content
      const folderPath = this.manager.resolvePath(element.file.path);
      return this.readDirectory(folderPath);
    }

    if (this.isFileSystemNode(element) && element.isDirectory) {
      // FS Folder -> Show sub-FS content
      return this.readDirectory(element.resourceUri.fsPath);
    }

    return Promise.resolve([]);
  }

  private async readDirectory(dirPath: string): Promise<TreeElement[]> {
    try {
      const dirents = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath)
      );
      // Sort: folders first, then files
      dirents.sort((a, b) => {
        if (a[1] === b[1]) {
          return a[0].localeCompare(b[0]);
        }
        return a[1] === vscode.FileType.Directory ? -1 : 1;
      });

      return dirents.map(
        ([name, type]) =>
          ({
            type: "fsNode",
            resourceUri: vscode.Uri.file(path.join(dirPath, name)),
            isDirectory: (type & vscode.FileType.Directory) !== 0,
          } as FileSystemNode)
      );
    } catch (e: any) {
      Logger.error(`读取目录失败: ${dirPath}`, e.message);
      return [];
    }
  }

  private isCategory(element: TreeElement): element is FavoriteCategory {
    return (element as FavoriteCategory).fileIds !== undefined;
  }

  private isFavoriteFile(
    element: TreeElement
  ): element is { file: FavoriteFile; categoryId: string } {
    return (element as any).file !== undefined;
  }

  private isFileSystemNode(element: TreeElement): element is FileSystemNode {
    return (element as FileSystemNode).type === "fsNode";
  }
}
