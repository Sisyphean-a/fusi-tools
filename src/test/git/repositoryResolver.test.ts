import * as assert from "assert";
import {
  resolveRepositoryFromContext,
  GitRepositoryLike,
} from "../../features/git/shared/repositoryResolver";

function createRepo(
  root: string,
  stagedCount: number = 0,
): GitRepositoryLike {
  return {
    rootUri: { fsPath: root },
    state: {
      indexChanges: Array.from({ length: stagedCount }, () => ({})),
    },
  };
}

suite("RepositoryResolver", () => {
  test("应优先命中 resourceUri 所在仓库", async () => {
    const repoA = createRepo("F:\\ws\\repo-a", 0);
    const repoB = createRepo("F:\\ws\\repo-b", 2);

    const resolved = await resolveRepositoryFromContext({
      repositories: [repoA, repoB],
      resourceUriPath: "F:\\ws\\repo-a\\src\\a.ts",
    });

    assert.strictEqual(resolved.repository.rootUri.fsPath, repoA.rootUri.fsPath);
    assert.strictEqual(resolved.source, "resource");
  });

  test("无 resource/editor 时应自动选择唯一有 staged 变更的仓库", async () => {
    const repoA = createRepo("F:\\ws\\repo-a", 0);
    const repoB = createRepo("F:\\ws\\repo-b", 1);

    const resolved = await resolveRepositoryFromContext({
      repositories: [repoA, repoB],
    });

    assert.strictEqual(resolved.repository.rootUri.fsPath, repoB.rootUri.fsPath);
    assert.strictEqual(resolved.source, "staged");
  });

  test("多候选且无唯一 staged 时应走选择器", async () => {
    const repoA = createRepo("F:\\ws\\repo-a", 1);
    const repoB = createRepo("F:\\ws\\repo-b", 1);
    let pickerCalled = false;

    const resolved = await resolveRepositoryFromContext({
      repositories: [repoA, repoB],
      pickRepository: async (candidates: GitRepositoryLike[]) => {
        pickerCalled = true;
        assert.strictEqual(candidates.length, 2);
        return repoB;
      },
    });

    assert.strictEqual(pickerCalled, true);
    assert.strictEqual(resolved.repository.rootUri.fsPath, repoB.rootUri.fsPath);
    assert.strictEqual(resolved.source, "picked");
  });
});
