import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * 树生成器配置选项
 */
export interface TreeGeneratorOptions {
  maxDepth: number;
}

/**
 * 生成目录结构树
 */
export class TreeGenerator {
  /**
   * 生成指定目录的树状结构字符串
   * @param rootPath 根目录路径
   * @param options 配置选项
   */
  public static async generate(
    rootPath: string,
    options: TreeGeneratorOptions
  ): Promise<string> {
    const rootName = path.basename(rootPath);
    const stats = await fs.promises.stat(rootPath);

    if (!stats.isDirectory()) {
      return rootName;
    }

    const treeContent = await this.generateTreeRecursive(
      rootPath,
      "",
      0,
      options.maxDepth
    );
    return `.\n${treeContent}`;
  }

  private static async generateTreeRecursive(
    currentPath: string,
    prefix: string,
    currentDepth: number,
    maxDepth: number
  ): Promise<string> {
    if (maxDepth !== -1 && currentDepth >= maxDepth) {
      return "";
    }

    let output = "";
    try {
      const entries = await fs.promises.readdir(currentPath, {
        withFileTypes: true,
      });
      // 过滤掉隐藏文件/文件夹 (以 . 开头)
      const visibleEntries = entries.filter(
        (entry) => !entry.name.startsWith(".")
      );

      // 排序: 文件夹在前，文件在后，按字母顺序
      visibleEntries.sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory() ? -1 : 1;
      });

      for (let i = 0; i < visibleEntries.length; i++) {
        const entry = visibleEntries[i];
        const isLast = i === visibleEntries.length - 1;
        const entryPath = path.join(currentPath, entry.name);

        const connector = isLast ? "└── " : "├── ";
        const childPrefix = isLast ? "    " : "│   ";

        output += `${prefix}${connector}${entry.name}\n`;

        if (entry.isDirectory()) {
          output += await this.generateTreeRecursive(
            entryPath,
            prefix + childPrefix,
            currentDepth + 1,
            maxDepth
          );
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }

    return output;
  }
}
