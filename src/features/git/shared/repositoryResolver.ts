import * as path from "path";
import * as vscode from "vscode";

export interface GitRepositoryLike {
  rootUri: { fsPath: string };
  state?: { indexChanges?: unknown[] };
  inputBox?: { value: string };
}

export interface ResolvedRepository<TRepo extends GitRepositoryLike> {
  repository: TRepo;
  source: "resource" | "activeEditor" | "staged" | "single" | "picked";
}

export interface GitRepository extends GitRepositoryLike {
  rootUri: vscode.Uri;
  state: { indexChanges: Array<{ uri: vscode.Uri }> };
  inputBox: { value: string };
}

interface ResolveContext<TRepo extends GitRepositoryLike> {
  repositories: TRepo[];
  resourceUriPath?: string;
  activeUriPath?: string;
  pickRepository?: (repositories: TRepo[]) => Promise<TRepo | undefined>;
}

function normalizeFsPath(input: string): string {
  return path.normalize(input).replace(/[\\/]+/g, path.sep).toLowerCase();
}

function isPathInside(filePath: string, rootPath: string): boolean {
  const file = normalizeFsPath(filePath);
  const root = normalizeFsPath(rootPath);
  if (file === root) {
    return true;
  }
  return file.startsWith(`${root}${path.sep}`);
}

function findRepositoryByPath<TRepo extends GitRepositoryLike>(
  repositories: TRepo[],
  targetPath?: string,
): TRepo | undefined {
  if (!targetPath) {
    return undefined;
  }
  return repositories.find((repo) =>
    isPathInside(targetPath, repo.rootUri.fsPath),
  );
}

function getStagedRepositories<TRepo extends GitRepositoryLike>(
  repositories: TRepo[],
): TRepo[] {
  return repositories.filter((repo) => (repo.state?.indexChanges?.length || 0) > 0);
}

export async function resolveRepositoryFromContext<
  TRepo extends GitRepositoryLike,
>(
  context: ResolveContext<TRepo>,
): Promise<ResolvedRepository<TRepo>> {
  if (context.repositories.length === 0) {
    throw new Error("当前工作区未检测到 Git 仓库。");
  }

  const resourceRepo = findRepositoryByPath(
    context.repositories,
    context.resourceUriPath,
  );
  if (resourceRepo) {
    return { repository: resourceRepo, source: "resource" };
  }

  const activeRepo = findRepositoryByPath(
    context.repositories,
    context.activeUriPath,
  );
  if (activeRepo) {
    return { repository: activeRepo, source: "activeEditor" };
  }

  const stagedRepos = getStagedRepositories(context.repositories);
  if (stagedRepos.length === 1) {
    return { repository: stagedRepos[0], source: "staged" };
  }

  if (context.repositories.length === 1) {
    return { repository: context.repositories[0], source: "single" };
  }

  if (!context.pickRepository) {
    throw new Error("无法自动确定目标仓库，请提供仓库选择器。");
  }

  const selected = await context.pickRepository(context.repositories);
  if (!selected) {
    throw new Error("已取消仓库选择。");
  }

  return { repository: selected, source: "picked" };
}

function getGitApi(): any | undefined {
  const extension = vscode.extensions.getExtension("vscode.git");
  return extension?.exports?.getAPI?.(1);
}

export function getGitRepositories(): GitRepository[] {
  const api = getGitApi();
  if (!api) {
    return [];
  }
  return (api.repositories || []) as GitRepository[];
}

async function pickRepositoryFromQuickPick(
  repositories: GitRepository[],
  title: string,
): Promise<GitRepository | undefined> {
  const items = repositories.map((repository) => ({
    label: path.basename(repository.rootUri.fsPath),
    description: repository.rootUri.fsPath,
    repository,
  }));
  const picked = await vscode.window.showQuickPick(items, { title });
  return picked?.repository;
}

export async function resolveRepository(options?: {
  resourceUri?: vscode.Uri;
  activeEditorUri?: vscode.Uri;
  quickPickTitle?: string;
}): Promise<ResolvedRepository<GitRepository>> {
  const repositories = getGitRepositories();
  const activeEditorUri =
    options?.activeEditorUri || vscode.window.activeTextEditor?.document.uri;

  return resolveRepositoryFromContext({
    repositories,
    resourceUriPath: options?.resourceUri?.fsPath,
    activeUriPath: activeEditorUri?.fsPath,
    pickRepository: (candidates) =>
      pickRepositoryFromQuickPick(
        candidates,
        options?.quickPickTitle || "请选择目标 Git 仓库",
      ),
  });
}
