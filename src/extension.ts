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

    const searchInFolderCommand = vscode.commands.registerCommand(
        'custom-search.searchInFolder',
        async (uri?: vscode.Uri) => {
            // Get selected text from active editor
            let selectedText: string | undefined;
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                selectedText = editor.document.getText(editor.selection);
            }

            // Handle folder context menu
            if (uri && uri.fsPath) {
                try {
                    const fileStat = await vscode.workspace.fs.stat(uri);
                    if (fileStat.type === vscode.FileType.Directory) {
                        const relativePath = vscode.workspace.asRelativePath(uri, false);
                        webviewManager?.showWithDirectory(relativePath, selectedText);
                        return;
                    }
                } catch (error) {
                    // Ignore error and fall through to default
                }
            }

            // Fallback: open normal search tab (potentially with selected text)
            webviewManager?.showNewTab(selectedText);
        }
    );

    context.subscriptions.push(openSearchCommand, openNewSearchTabCommand, searchInFolderCommand);
}

export function deactivate(): void {
    webviewManager?.dispose();
}
