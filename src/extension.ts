import * as vscode from 'vscode';
import { WebviewManager } from './WebviewManager';

let webviewManager: WebviewManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
    webviewManager = new WebviewManager(context);

    const openSearchCommand = vscode.commands.registerCommand(
        'custom-search.openSearch',
        () => {
            webviewManager?.show();
        }
    );

    const openNewSearchTabCommand = vscode.commands.registerCommand(
        'custom-search.openNewSearchTab',
        () => {
            webviewManager?.showNewTab();
        }
    );

    context.subscriptions.push(openSearchCommand, openNewSearchTabCommand);
}

export function deactivate(): void {
    webviewManager?.dispose();
}
