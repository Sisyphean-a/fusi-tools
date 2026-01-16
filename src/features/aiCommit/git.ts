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

    const rootPath = repo.rootUri.fsPath;

    // [Fix] 使用 git diff --name-status 获取准确的文件状态
    const statusMap = await this.getIndexStatuses(rootPath);
    
    // [Optimization] 批量获取所有文件的 Diff，避免 N 次进程调用
    console.time("git-bulk-diff");
    const fullDiffMap = await this.getAllDiffs(rootPath);
    console.timeEnd("git-bulk-diff");

    const results: SmartChange[] = [];
    
    // 简单阈值判断 (即便有了批量 Diff，如果文件数极多，处理大量 DOM/TreeItem 依然可能慢，保留此检查作为一个软限制，但可以放宽)
    const MAX_FILES_FOR_DETAIL = 100; 
    const isTooManyFiles = changes.length > MAX_FILES_FOR_DETAIL;

    for (const change of changes) {
      const uri = change.uri;
      const relativePath = path
        .relative(rootPath, uri.fsPath)
        .replace(/\\/g, "/");
      const fileName = path.basename(relativePath);

      // A. 文件过多模式 -> 强制简略
      if (isTooManyFiles) {
        results.push({
          relativePath,
          status: "TRUNCATED",
          content: "[Pre-check] Too many files, content skipped.",
          additions: 0,
          deletions: 0,
          chars: 0,
          tokens: 0,
        });
        continue;
      }

      const gitStatus = statusMap.get(relativePath) || "M";
      // 从 Map 中获取预先抓取的 Diff (如果有)
      const cachedDiff = fullDiffMap.get(relativePath);

      const smartChange = await this.processSingleChange(
        rootPath,
        relativePath,
        fileName,
        gitStatus,
        cachedDiff
      );
      results.push(smartChange);
    }

    return results;
  }

  /**
   * 获取暂存区文件的准确状态 (A, D, M, R, etc)
   */
  private async getIndexStatuses(cwd: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
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
          const statusChar = parts[0].charAt(0).toUpperCase(); 
          // parts[1] is path OR old_path new_path
          if (statusChar === "R") {
            if (parts.length >= 3) {
              map.set(parts[2], "A"); // Treat rename target as Added
            }
          } else {
             map.set(parts[parts.length - 1], statusChar);
          }
        }
      }
    } catch (e) {
      console.error("Failed to get index statuses", e);
    }
    return map;
  }

  /**
   * [Optimization] 一次性获取所有 Staged 文件的 Diff
   * 返回 Map<relativePath, diffContent>
   */
  private async getAllDiffs(cwd: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      // --no-color is crucial
      // -U10000 is risky for huge files, default context (3 lines) is safer for summary?
      // Actually standard diff (defaults to 3 lines context) is usually fine for AI.
      // But if we want AI to see more code, maybe -U10? Let's stick to default for now to keep size small.
      const output = await this.execCommand("git diff --cached --no-color", cwd);
      
      return this.parseDiffOutput(output);
    } catch (e) {
      console.error("Failed to get bulk diff", e);
      return map;
    }
  }

  /**
   * 解析原生 Git Diff 输出，将其拆分为单独的文件块
   */
  private parseDiffOutput(fullOutput: string): Map<string, string> {
    const map = new Map<string, string>();
    
    // Git diff format usually starts with:
    // diff --git a/path/to/file b/path/to/file
    const lines = fullOutput.split("\n");
    let currentFile = "";
    let currentBuffer: string[] = [];

    // Helper to flush buffer
    const flush = () => {
      if (currentFile && currentBuffer.length > 0) {
        map.set(currentFile, currentBuffer.join("\n"));
      }
    };

    for (const line of lines) {
      if (line.startsWith("diff --git ")) {
        // Start of a new file
        flush();
        currentFile = "";
        currentBuffer = [];

        // Parse filename from "diff --git a/foo/bar.txt b/foo/bar.txt"
        // Caution: logic needs to handle spaces in filenames carefully if possible.
        // Simple regex strategy:
        // diff --git a/(.*) b/(.*)
        // usually a/ and b/ are the same unless renamed.
        // We need the relative path that matches our other logic.
        const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
        if (match) {
          // use the 'b' path as it represents the new state
          currentFile = match[2]; 
          // Note: git output might quote filenames with spaces or non-ascii. 
          // E.g. "a/file with space.txt" or "\344\270\255\346\226\207.txt"
          // This simple parser might fail on very complex paths (quoted octal), 
          // but for 99% cases it works.
          // Handling unquote is complex in JS without substantial libs.
          // Let's assume standard paths for now.
        }
      }
      
      if (currentFile) {
        currentBuffer.push(line);
      }
    }
    
    flush(); // Flush last file
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
      return this.getDiffStat(repo.rootUri.fsPath);
    }

    let totalOutput = "";
    let isStatFallback = false;
    
    // [Optimization] 提升 Token 限制至 200,000 字符 (适配 DeepSeek V3 128k context)
    const MAX_CHARS = 200000;

    for (const change of changes) {
      let entry = "";
      if (
        change.status === "FULL" ||
        change.status === "TRUNCATED" ||
        change.status === "新增(已截断)" ||
        change.status === "完整" || 
        change.status === "已截断" 
      ) {
        entry = change.content;
      } else {
        entry = change.content; // e.g. [DELETED] path
      }

      // 累计大小检查
      if (totalOutput.length + entry.length > MAX_CHARS) {
        isStatFallback = true;
        break;
      }
      totalOutput += entry + "\n";
    }

    if (isStatFallback) {
      console.log(`[AI Commit] Diff too large (> ${MAX_CHARS}), switching to stat mode.`);
      // Even with stat fallback, we might append the list of changed files if stat is too simple?
      // For now, keep original behavior: use git diff --stat
      return this.getDiffStat(repo.rootUri.fsPath);
    }

    return totalOutput.trim();
  }

  /**
   * 获取最近的 N 条提交记录作为参考
   */
  async getRecentCommits(limit: number = 5): Promise<string[]> {
    const repo = this.repository;
    if (!repo) return [];
    try {
      // %s = subject only, %B = raw body (subject + body)
      // Let's use %B to capture full style (including body formatting)
      const output = await this.execCommand(
        `git log -n ${limit} --pretty=format:"%B%n------------------------"`,
        repo.rootUri.fsPath
      );
      
      const debugLogs = output
        .split("------------------------")
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
      return debugLogs;
    } catch (e) {
      console.warn("Failed to fetch recent commits", e);
      return [];
    }
  }

  /**
   * 旧接口兼容
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
    rootPath: string,
    relativePath: string,
    fileName: string,
    gitStatus: string,
    cachedDiffContent?: string // [New Parameter]
  ): Promise<SmartChange> {
    // 1. 状态监测 (DELETED)
    if (gitStatus.startsWith("D")) {
      return {
        relativePath,
        status: "已删除",
        content: `[DELETED] ${relativePath}`,
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
      ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot",
      ".mp4", ".webm", ".mp3", ".wav", ".zip", ".tar", ".gz", ".7z", ".pdf", ".exe", ".dll", 
      ".so", ".dylib", ".bin", ".dat", ".db", ".sqlite",
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
      // Use cached diff if available, otherwise fallback to individual command (should rarely happen if parser works)
      const diffContent = cachedDiffContent || await this.execGitDiff(rootPath, relativePath);
      
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
      const tokens = Math.ceil(chars / 4);

      // A. 新增文件特殊处理 (Added)
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
      // 如果非常大，依然截断 -> 防止单个文件撑爆
      if (lines.length > 1000) { // Relaxed from 250 to 1000 for better context
        const head = lines.slice(0, 800).join("\n");
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
      // silent fail
      return {
        relativePath,
        status: "完整", 
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
        { cwd, maxBuffer: 1024 * 1024 * 50 }, // Increased buffer to 50MB for potential bulk diffs
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
