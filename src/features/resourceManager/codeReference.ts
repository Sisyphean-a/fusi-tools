import * as path from "path";

type LineOnly = {
  readonly line: number;
};

type SelectionEnd = LineOnly & {
  readonly character: number;
};

export type SelectionLike = {
  readonly start: LineOnly;
  readonly end: SelectionEnd;
  readonly isSingleLine: boolean;
};

export type LineRange = {
  readonly startLine: number;
  readonly endLine: number;
};

type CodeReferenceInput = {
  readonly filePath: string;
  readonly selection: SelectionLike;
  readonly workspaceRoot: string;
};

export function toRelativeWorkspacePath(
  workspaceRoot: string,
  filePath: string
): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join("/");
}

export function getSelectionLineRange(selection: SelectionLike): LineRange {
  const startLine = selection.start.line + 1;
  const endLine = selection.end.character === 0 && !selection.isSingleLine
    ? selection.end.line
    : selection.end.line + 1;

  return { startLine, endLine };
}

export function formatCodeReference(
  relativePath: string,
  range: LineRange
): string {
  const normalizedPath = relativePath.split(path.sep).join("/");

  if (range.startLine === range.endLine) {
    return `@${normalizedPath}:${range.startLine}`;
  }

  return `@${normalizedPath}:${range.startLine}-${range.endLine}`;
}

export function buildCodeReferenceText(
  input: CodeReferenceInput
): string {
  const relativePath = toRelativeWorkspacePath(
    input.workspaceRoot,
    input.filePath
  );
  const lineRange = getSelectionLineRange(input.selection);

  return formatCodeReference(relativePath, lineRange);
}
