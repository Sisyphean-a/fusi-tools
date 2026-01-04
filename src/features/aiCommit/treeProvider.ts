import * as vscode from 'vscode';
import { CommitOption } from './ai';

export class CommitItem extends vscode.TreeItem {
    constructor(
        public readonly option: CommitOption
    ) {
        super(option.type, vscode.TreeItemCollapsibleState.None);
        this.description = option.description; // e.g., "Short summary"
        this.tooltip = option.message;
        
        // When clicked, trigger the apply command with the message
        this.command = {
            command: 'fusi-tools.applyCommit',
            title: 'Apply',
            arguments: [option.message]
        };
        
        this.contextValue = 'commitItem';
    }
}

export class AiCommitViewProvider implements vscode.TreeDataProvider<CommitItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommitItem | undefined | null | void> = new vscode.EventEmitter<CommitItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommitItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private items: CommitItem[] = [];

    refresh(options: CommitOption[]): void {
        this.items = options.map(opt => new CommitItem(opt));
        this._onDidChangeTreeData.fire();
    }

    clear(): void {
        this.items = [];
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommitItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommitItem): vscode.ProviderResult<CommitItem[]> {
        if (element) {
            return [];
        }
        return this.items;
    }
}
