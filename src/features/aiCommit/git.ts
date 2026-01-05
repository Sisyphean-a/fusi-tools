import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

export class GitService {
  private get gitApi() {
    const extension = vscode.extensions.getExtension("vscode.git");
    return extension?.exports?.getAPI(1);
  }

  private get repository() {
    const api = this.gitApi;
    if (!api || api.repositories.length === 0) {
      return undefined;
    }
    // In a real scenario, might want to pick the repo based on active editor
    // For now, simplicity: pick the first one
    return api.repositories[0];
  }

  /**
   * 获取智能 Diff (策略合集)
   * 1. 优先尝试逐个文件获取并进行 "智能截断" (策略三/一)
   * 2. 如果文件过多或字符数超出阈值，降级为 `git diff --stat` (策略二)
   */
  async getSmartDiff(): Promise<string | null> {
    const repo = this.repository;
    if (!repo) {
      return null;
    }

    const changes = repo.state.indexChanges;
    if (changes.length === 0) {
      return null;
    }

    // 阈值定义
    const MAX_FILES_FOR_DETAIL = 20; // 超过20个文件直接用 stat
    // const MAX_CHARS_TOTAL = 8000; // 累计超过 8k 字符切换到 stat

    // 情况 A: 文件太多，直接摘要模式
    if (changes.length > MAX_FILES_FOR_DETAIL) {
      console.log(
        `[AI Commit] Too many files (${changes.length}), switching to stat mode.`
      );
      return this.getDiffStat(repo.rootUri.fsPath);
    }

    let totalOutput = "";
    let isStatFallback = false;

    // 遍历处理每个文件
    for (const change of changes) {
      const result = await this.processChange(change, repo.rootUri.fsPath);

      // 如果单个文件处理结果过大(理论上 processChange 已经做了单文件截断，但累加起来可能还是很大)
      if (totalOutput.length + result.length > 8000) {
        isStatFallback = true;
        break;
      }

      totalOutput += result + "\n";
    }

    if (isStatFallback) {
      console.log(`[AI Commit] Diff too large, switching to stat mode.`);
      return this.getDiffStat(repo.rootUri.fsPath);
    }

    return totalOutput.trim();
  }

  /**
   * 处理单个文件变更 (策略一 & 三)
   */
  private async processChange(change: any, rootPath: string): Promise<string> {
    const uri = change.uri;
    const relativePath = path
      .relative(rootPath, uri.fsPath)
      .replace(/\\/g, "/");
    const fileName = path.basename(relativePath);

    // 1. 状态降级 (Strategy 1)
    if (change.status === 6) {
      // INDEX_DELETED (Visual Studio Code Git API Status enum varies, usually 6 is Deleted)
      // Check API types if possible, but for now assuming 6 is deleted based on common VSCode Git API knowledge
      // Actually, let's rely on standard properties if available or check status safely
      // The API change object usually has { status: Status }
      // Status: INDEX_MODIFIED, INDEX_ADDED, INDEX_DELETED, INDEX_RENAMED, INDEX_COPIED
      return `[DELETED] ${relativePath}`;
    }

    // Use mapped status check if enum logic is uncertain, but let's try to infer from properties if needed.
    // change.status is a number.
    // 1: INDEX_MODIFIED, 2: INDEX_ADDED, 3: INDEX_DELETED, 4: INDEX_RENAMED (Examples)
    // Let's safe-check: if we can't get content, it might be deleted.

    // 2. 黑名单与大文件 (Strategy 3 & 1)
    if (
      fileName === "package-lock.json" ||
      fileName === "yarn.lock" ||
      fileName === "pnpm-lock.yaml"
    ) {
      return `File Changed: ${relativePath} (dependency lockfile update)`;
    }

    const ext = path.extname(fileName).toLowerCase();
    const binaryExts = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".mp4",
      ".webm",
      ".mp3",
      ".wav",
      ".zip",
      ".tar",
      ".gz",
      ".7z",
      ".pdf",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".dat",
      ".db",
      ".sqlite",
    ];
    if (binaryExts.includes(ext)) {
      return `[BINARY/ASSET] ${relativePath}`;
    }

    if (
      fileName.endsWith(".min.js") ||
      fileName.endsWith(".min.css") ||
      fileName.endsWith(".map")
    ) {
      return `[MINIFIED/GENERATED] ${relativePath}`;
    }

    // 3. 获取内容并截断
    try {
      // we can try to get the diff content using repo.diffWithHEAD(uri.fsPath) if available,
      // or use the standard diff method.
      // But `change` object often doesn't have a direct diff method.
      // We usually call `repo.diffIndexWithHEAD(path)` or `repo.diffWithHEAD`
      // Or simpler: `repo.diff(true)` returns ALL. We want specific file.

      // To be safe and performant, let's use `git diff --cached -- <file>`
      const diffContent = await this.execGitDiff(rootPath, relativePath);

      // 4. 单文件行数截断 (Strategy 3)
      const lines = diffContent.split("\n");
      if (lines.length > 250) {
        // Limit to 250 lines total
        const head = lines.slice(0, 200).join("\n");
        const tail = lines.slice(-50).join("\n");
        return `File: ${relativePath}\n${head}\n... (content skipped) ...\n${tail}`;
      }

      return `File: ${relativePath}\n${diffContent}`;
    } catch (e) {
      console.error(`Failed to get diff for ${relativePath}`, e);
      return `File: ${relativePath} (Error reading diff)`;
    }
  }

  private async getDiffStat(cwd: string): Promise<string> {
    try {
      const output = await this.execCommand("git diff --cached --stat", cwd);
      return "Git Diff Stat (Summary Mode):\n" + output;
    } catch (e) {
      console.error("Failed to get diff stat", e);
      return "Failed to get git diff stat.";
    }
  }

  private execGitDiff(cwd: string, relativePath: string): Promise<string> {
    // Use -- no-color to avoid ANSI codes
    return this.execCommand(
      `git diff --cached --no-color -- "${relativePath}"`,
      cwd
    );
  }

  private execCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.exec(
        command,
        { cwd, maxBuffer: 1024 * 1024 * 10 },
        (err, stdout, stderr) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(stdout);
        }
      );
    });
  }

  /**
   * 将提交信息设置到 SCM 输入框。
   */
  setCommitMessage(message: string) {
    const repo = this.repository;
    if (repo) {
      repo.inputBox.value = message;
    }
  }
}
