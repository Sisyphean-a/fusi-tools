import * as vscode from "vscode";
import * as path from "path";
import { Logger } from "../../logger";

// Helper for generating IDs if uuid is not available or too heavy
function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export interface FavoriteFile {
  id: string;
  path: string; // stored relative if possible
  type: "file" | "folder";
  alias?: string;
  icon?: string;
  // Runtime property, not persisted
  exists?: boolean;
}

export interface FavoriteCategory {
  id: string;
  name: string;
  expanded: boolean;
  fileIds: string[];
}

interface FavoriteData {
  files: { [fileId: string]: FavoriteFile };
  categories: FavoriteCategory[];
}

const STORAGE_KEY = "fusi-tools.projectFavorites.data";

export class FavoritesManager {
  private _data: FavoriteData;
  private _context: vscode.ExtensionContext;
  private _onDidChangeTreeData: vscode.EventEmitter<
    void | FavoriteCategory | undefined
  > = new vscode.EventEmitter<void | FavoriteCategory | undefined>();
  readonly onDidChangeTreeData: vscode.Event<
    void | FavoriteCategory | undefined
  > = this._onDidChangeTreeData.event;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._data = this._context.workspaceState.get<FavoriteData>(STORAGE_KEY, {
      files: {},
      categories: [
        {
          id: "default",
          name: "默认分类",
          expanded: true,
          fileIds: [],
        },
      ],
    });

    // Ensure data integrity (in case of corruption or fresh start)
    if (!this._data.categories || this._data.categories.length === 0) {
      this._data.categories = [
        {
          id: "default",
          name: "默认分类",
          expanded: true,
          fileIds: [],
        },
      ];
    }
    if (!this._data.files) {
      this._data.files = {};
    }

    // Check for ghost files on startup
    this.checkFileExistence();
  }

  private saveData() {
    this._context.workspaceState.update(STORAGE_KEY, this._data);
    this._onDidChangeTreeData.fire();
  }

  private checkFileExistence() {
    // This is a lightweight check. For UI, we often check on render,
    // but here we might want to flag things.
    // Real-time checks happen when providing tree items.
  }

  // --- Path Helpers ---

  private toRelativePath(absolutePath: string): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      return absolutePath;
    } // No workspace, use absolute

    // Try to find a workspace folder that contains this file
    for (const folder of folders) {
      const folderPath = folder.uri.fsPath;
      if (absolutePath.startsWith(folderPath)) {
        // Return relative path
        return path.relative(folderPath, absolutePath);
      }
    }
    return absolutePath; // Outside workspace
  }

  public resolvePath(storedPath: string): string {
    if (path.isAbsolute(storedPath)) {
      return storedPath;
    }

    // It's relative, try to resolve against workspace folders
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return storedPath; // Can't resolve without workspace
    }

    return path.join(folders[0].uri.fsPath, storedPath);
  }

  // --- Data Ops ---

  public getCategories(): FavoriteCategory[] {
    return this._data.categories;
  }

  public getFilesInCategory(categoryId: string): FavoriteFile[] {
    const category = this._data.categories.find((c) => c.id === categoryId);
    if (!category) {
      return [];
    }

    return category.fileIds
      .map((id) => this._data.files[id])
      .filter((f) => !!f); // filter out broken links if any
  }

  public async addFile(uri: vscode.Uri, categoryId: string = "default") {
    Logger.info(`正在添加文件到常用: ${uri.fsPath} (分类 ID: ${categoryId})`);
    const stats = await vscode.workspace.fs.stat(uri);
    const type = stats.type & vscode.FileType.Directory ? "folder" : "file";
    const relativePath = this.toRelativePath(uri.fsPath);

    let existingFileId: string | undefined;
    for (const id in this._data.files) {
      if (this._data.files[id].path === relativePath) {
        existingFileId = id;
        break;
      }
    }

    const fileId = existingFileId || generateId();

    if (!existingFileId) {
      this._data.files[fileId] = {
        id: fileId,
        path: relativePath,
        type: type,
      };
    }

    // Add to category
    const category = this._data.categories.find((c) => c.id === categoryId);
    if (category) {
      if (!category.fileIds.includes(fileId)) {
        category.fileIds.push(fileId);
        this.saveData();
        Logger.info(`文件添加成功。ID: ${fileId}`);
      }
    }
  }

  public moveFileToCategory(
    fileId: string,
    oldCategoryId: string,
    newCategoryId: string
  ) {
    if (oldCategoryId === newCategoryId) {
      return;
    }

    const oldCategory = this._data.categories.find(
      (c) => c.id === oldCategoryId
    );
    const newCategory = this._data.categories.find(
      (c) => c.id === newCategoryId
    );

    if (oldCategory && newCategory) {
      Logger.info(
        `正在将文件 ${fileId} 从分类 '${oldCategory.name}' 移动到 '${newCategory.name}'`
      );
      // Remove from old
      oldCategory.fileIds = oldCategory.fileIds.filter((id) => id !== fileId);
      // Add to new (if not exists)
      if (!newCategory.fileIds.includes(fileId)) {
        newCategory.fileIds.push(fileId);
      }
      this.saveData();
      // GC not needed as file is preserved
    }
  }

  public removeFileFromCategory(fileId: string, categoryId: string) {
    Logger.info(`正在从分类 ${categoryId} 中移除文件 ${fileId}`);
    const category = this._data.categories.find((c) => c.id === categoryId);
    if (category) {
      category.fileIds = category.fileIds.filter((id) => id !== fileId);
      this.saveData();
      // Optional: Garbage collect from file pool if no longer used in any category
      this.gcFiles();
    }
  }

  private gcFiles() {
    const usedIds = new Set<string>();
    this._data.categories.forEach((c) =>
      c.fileIds.forEach((id) => usedIds.add(id))
    );

    for (const id in this._data.files) {
      if (!usedIds.has(id)) {
        delete this._data.files[id];
      }
    }
    // saveData called by caller
  }

  public addCategory(name: string): string {
    Logger.info(`正在创建新分类: ${name}`);
    const id = generateId();
    this._data.categories.push({
      id,
      name,
      expanded: true,
      fileIds: [],
    });
    this.saveData();
    return id;
  }

  public removeCategory(id: string) {
    Logger.info(`正在移除分类: ${id}`);
    this._data.categories = this._data.categories.filter((c) => c.id !== id);
    this.saveData();
    this.gcFiles();
  }

  public renameCategory(id: string, newName: string) {
    Logger.info(`正在将分类 ${id} 重命名为 ${newName}`);
    const cat = this._data.categories.find((c) => c.id === id);
    if (cat) {
      cat.name = newName;
      this.saveData();
    }
  }

  public setFileAlias(fileId: string, alias: string | undefined) {
    Logger.info(`正在为文件 ${fileId} 设置别名: ${alias}`);
    const file = this._data.files[fileId];
    if (file) {
      file.alias = alias;
      this.saveData();
    }
  }

  // --- Listeners ---

  public handleFileRenames(e: vscode.FileRenameEvent) {
    Logger.info(`检测到文件重命名: ${e.files.length} 个文件`);
    let changed = false;
    for (const { oldUri, newUri } of e.files) {
      const oldPathRel = this.toRelativePath(oldUri.fsPath);
      const newPathRel = this.toRelativePath(newUri.fsPath);

      // Find file in pool
      for (const id in this._data.files) {
        const file = this._data.files[id];
        if (file.path === oldPathRel) {
          file.path = newPathRel;
          changed = true;
        } else if (file.path.startsWith(oldPathRel + path.sep)) {
          file.path = file.path.replace(oldPathRel, newPathRel);
          changed = true;
        }
      }
    }
    if (changed) {
      this.saveData();
    }
  }

  public handleFileDeletions(e: vscode.FileDeleteEvent) {
    Logger.info(`检测到文件删除: ${e.files.length} 个文件`);
  }
}
