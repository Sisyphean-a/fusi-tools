import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

export interface SmartChange {
  relativePath: string;
  status: string; // Localized status description (e.g. "已删除", "完整")
  content: string; // Diff content or summary description
  rawStatus?: number; // Git status code (optional)
  // 统计信息
  additions: number;
  deletions: number;
  chars: number;
  tokens: number;
}

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
   * 1. 分析暂存区变更，返回结构化数据
   */
  async analyzeChanges(): Promise<SmartChange[] | null> {
    const repo = this.repository;
    if (!repo) return null;

    const changes = repo.state.indexChanges;
    if (changes.length === 0) return null;

    const results: SmartChange[] = [];
    const rootPath = repo.rootUri.fsPath;

    // 简单阈值判断
    const MAX_FILES_FOR_DETAIL = 50;
    const isTooManyFiles = changes.length > MAX_FILES_FOR_DETAIL;

    // [Fix] 使用 git diff --name-status 获取准确的文件状态，避免 API 状态码映射问题
    const statusMap = await this.getIndexStatuses(rootPath);

    const promises = changes.map(async (change: any) => {
      const uri = change.uri;
      const relativePath = path
        .relative(rootPath, uri.fsPath)
        .replace(/\\/g, "/");
      const fileName = path.basename(relativePath);

      // A. 文件过多模式 -> 强制简略
      if (isTooManyFiles) {
        return {
          relativePath,
          status: "TRUNCATED",
          content: "[Pre-check] Too many files, content skipped.",
          additions: 0,
          deletions: 0,
          chars: 0,
          tokens: 0,
        } as SmartChange;
      }

      // 获取准确状态 (默认为 M)
      // git status output paths are strictly relative
      const gitStatus = statusMap.get(relativePath) || "M";

      // B. 正常分析
      return this.processSingleChange(
        change,
        rootPath,
        relativePath,
        fileName,
        gitStatus
      );
    });

    return Promise.all(promises);
  }

  /**
   * 获取暂存区文件的准确状态 (A, D, M, R, etc)
   */
  private async getIndexStatuses(cwd: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      // --name-status return: "A\tfile.txt" or "R100\told.txt\tnew.txt"
      const output = await this.execCommand(
        "git diff --cached --name-status --no-renames",
        cwd
      );
      const lines = output
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => !!l);

      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const statusChar = parts[0].charAt(0).toUpperCase(); // A, M, D
          const filePath = parts[parts.length - 1]; // Take the last part (file path)
          if (statusChar === "R") {
            // parts[1] is old, parts[2] is new
            if (parts.length >= 3) {
              map.set(parts[2], "A"); // Treat rename target as Added/Modified for content purposes
            }
          } else {
            // A, M, D
            // parts[1] is path
            if (parts.length >= 2) {
              map.set(parts[parts.length - 1], statusChar);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to get index statuses", e);
    }
    return map;
  }

  /**
   * 2. 将分析结果格式化为 Prompt 字符串
   *    (包含总大小检查，如果过大则降级为 stat)
   */
  async formatSmartDiff(changes: SmartChange[]): Promise<string> {
    const repo = this.repository;
    if (!repo || !changes || changes.length === 0) return "";

    // 检查是否已经是 "文件过多" 的状态
    const isTruncatedStructure = changes.some(
      (c) => c.status === "TRUNCATED" && c.content.includes("Too many files")
    );
    if (isTruncatedStructure) {
      // 直接返回 Stat
      return this.getDiffStat(repo.rootUri.fsPath);
    }

    let totalOutput = "";
    let isStatFallback = false;

    for (const change of changes) {
      // 这里的 content 已经在 processSingleChange 里处理好了 (包括 [DELETED], [BINARY] 等)
      // 我们只需要拼接
      let entry = "";
      if (
        change.status === "FULL" ||
        change.status === "TRUNCATED" ||
        change.status === "新增(已截断)"
      ) {
        // 只有 FULL/TRUNCATED/新增 可能包含 diff，其他都是一行描述
        entry = change.content;
      } else {
        entry = change.content; // e.g. [DELETED] path
      }

      // 累计大小检查
      if (totalOutput.length + entry.length > 50000) {
        isStatFallback = true;
        break;
      }
      totalOutput += entry + "\n";
    }

    if (isStatFallback) {
      console.log(`[AI Commit] Diff too large, switching to stat mode.`);
      return this.getDiffStat(repo.rootUri.fsPath);
    }

    return totalOutput.trim();
  }

  /**
   * 旧接口兼容: 直接获取 Smart Diff 字符串
   */
  async getSmartDiff(): Promise<string | null> {
    const analysis = await this.analyzeChanges();
    if (!analysis) return null;
    return this.formatSmartDiff(analysis);
  }

  /**
   * 处理单个已变更文件
   */
  private async processSingleChange(
    change: any,
    rootPath: string,
    relativePath: string,
    fileName: string,
    gitStatus: string
  ): Promise<SmartChange> {
    // 1. 状态监测 (DELETED)
    // 根据 git status 字符判断 'D'
    if (gitStatus.startsWith("D")) {
      return {
        relativePath,
        status: "已删除",
        content: `[已删除] ${relativePath}`,
        additions: 0,
        deletions: 0,
        chars: 0,
        tokens: 0,
      };
    }

    // 2. 锁文件
    if (
      fileName === "package-lock.json" ||
      fileName === "yarn.lock" ||
      fileName === "pnpm-lock.yaml"
    ) {
      return {
        relativePath,
        status: "锁文件",
        content: `File Changed: ${relativePath} (dependency lockfile update)`,
        additions: 0,
        deletions: 0,
        chars: 0,
        tokens: 0,
      };
    }

    // 3. 二进制/资源
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
      return {
        relativePath,
        status: "二进制/媒体",
        content: `[BINARY/ASSET] ${relativePath}`,
        additions: 0,
        deletions: 0,
        chars: 0,
        tokens: 0,
      };
    }

    // 4. Minified
    if (
      fileName.endsWith(".min.js") ||
      fileName.endsWith(".min.css") ||
      fileName.endsWith(".map")
    ) {
      return {
        relativePath,
        status: "压缩文件",
        content: `[MINIFIED/GENERATED] ${relativePath}`,
        additions: 0,
        deletions: 0,
        chars: 0,
        tokens: 0,
      };
    }

    // 5. 读取内容 diff
    try {
      const diffContent = await this.execGitDiff(rootPath, relativePath);
      const lines = diffContent.split("\n");

      // 计算统计信息
      let additions = 0;
      let deletions = 0;
      for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          additions++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          deletions++;
        }
      }
      const chars = diffContent.length;
      const tokens = Math.ceil(chars / 4); // 粗略估算

      // A. 新增文件特殊处理 (Added)
      // Use gitStatus 'A'
      if (gitStatus === "A") {
        if (lines.length > 50) {
          const head = lines.slice(0, 25).join("\n");
          const tail = lines.slice(-25).join("\n");
          return {
            relativePath,
            status: "新增(已截断)",
            content: `File: ${relativePath} (New File Truncated)\n${head}\n... (middle ${
              lines.length - 50
            } lines skipped) ...\n${tail}`,
            additions,
            deletions,
            chars,
            tokens,
          };
        }
      }

      // B. 普通修改文件截断
      // 如果非常大，依然截断
      if (lines.length > 250) {
        const head = lines.slice(0, 200).join("\n");
        const tail = lines.slice(-50).join("\n");
        return {
          relativePath,
          status: "已截断",
          content: `File: ${relativePath}\n${head}\n... (content skipped) ...\n${tail}`,
          additions,
          deletions,
          chars,
          tokens,
        };
      }

      return {
        relativePath,
        status: "完整",
        content: `File: ${relativePath}\n${diffContent}`,
        additions,
        deletions,
        chars,
        tokens,
      };
    } catch (e) {
      console.error(`Failed to get diff for ${relativePath}`, e);
      return {
        relativePath,
        status: "完整", // 标记为 Full 但内容是错误提示
        content: `File: ${relativePath} (Error reading diff)`,
        additions: 0,
        deletions: 0,
        chars: 0,
        tokens: 0,
      };
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
