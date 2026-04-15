import * as vscode from "vscode";

export const clipboardRuntime = {
  writeText: async (value: string): Promise<void> => {
    await vscode.env.clipboard.writeText(value);
  },
  showInformationMessage: async (
    message: string
  ): Promise<string | undefined> => {
    return vscode.window.showInformationMessage(message);
  },
};

export async function copyTextToClipboard(
  value: string,
  successMessage?: string
): Promise<void> {
  await clipboardRuntime.writeText(value);

  if (successMessage) {
    await clipboardRuntime.showInformationMessage(successMessage);
  }
}
