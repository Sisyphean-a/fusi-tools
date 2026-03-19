import * as assert from "assert";
import {
  buildAddWorktreeCommand,
  buildRemoveWorktreeCommand,
} from "../../features/gitWorktree/worktreeService";

suite("GitWorktree WorktreeService", () => {
  test("buildAddWorktreeCommand 应支持基于已有分支创建工作树", () => {
    const command = buildAddWorktreeCommand({
      worktreePath: "F:\\ws\\repo-feature",
      branchName: "feature/x",
      createBranch: false,
    });

    assert.strictEqual(
      command,
      'git worktree add "F:\\ws\\repo-feature" "feature/x"',
    );
  });

  test("buildAddWorktreeCommand 应支持新建分支并创建工作树", () => {
    const command = buildAddWorktreeCommand({
      worktreePath: "F:\\ws\\repo-feature",
      branchName: "feature/new",
      createBranch: true,
    });

    assert.strictEqual(
      command,
      'git worktree add -b "feature/new" "F:\\ws\\repo-feature"',
    );
  });

  test("buildRemoveWorktreeCommand 应支持 force 删除", () => {
    const command = buildRemoveWorktreeCommand({
      worktreePath: "F:\\ws\\repo-feature",
      force: true,
    });

    assert.strictEqual(
      command,
      'git worktree remove --force "F:\\ws\\repo-feature"',
    );
  });
});
