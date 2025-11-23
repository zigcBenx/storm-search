import * as vscode from 'vscode';
import { WebviewMessage } from './types';
import { SearchService } from './services/SearchService';
import { FileService } from './services/FileService';
import { SyntaxHighlightService } from './services/SyntaxHighlightService';
import { getWebviewContent } from './webview/webviewContent';

export class WebviewManager {
    private panels: Map<string, vscode.WebviewPanel> = new Map();
    private searchService: SearchService;
    private fileService: FileService;
    private syntaxHighlightService: SyntaxHighlightService;
    private disposables: vscode.Disposable[] = [];
    private panelCounter: number = 0;

    constructor(private context: vscode.ExtensionContext) {
        this.searchService = new SearchService();
        this.fileService = new FileService();
        this.syntaxHighlightService = new SyntaxHighlightService();
    }

    show(): void {
        // If there's at least one panel, reveal the most recent one
        if (this.panels.size > 0) {
            const lastPanel = Array.from(this.panels.values()).pop();
            lastPanel?.reveal();
            return;
        }

        this.createPanel();
    }

    showNewTab(): void {
        // Always create a new panel
        this.createPanel();
    }

    dispose(): void {
        this.panels.forEach(panel => panel.dispose());
        this.panels.clear();
        this.disposables.forEach(d => d.dispose());
        this.syntaxHighlightService.dispose();
    }

    private createPanel(): void {
        this.panelCounter++;
        const panelId = `search-${this.panelCounter}`;
        const tabNumber = this.panels.size + 1;

        const panel = vscode.window.createWebviewPanel(
            'customSearch',
            `Search ${tabNumber}`,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panels.set(panelId, panel);

        panel.webview.html = getWebviewContent();
        this.setupMessageHandler(panelId, panel);
        this.setupPanelDisposal(panelId, panel);
    }

    private setupMessageHandler(panelId: string, panel: vscode.WebviewPanel): void {
        const messageHandler = panel.webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                await this.handleMessage(panelId, panel, message);
            },
            undefined,
            this.context.subscriptions
        );

        this.disposables.push(messageHandler);
    }

    private async handleMessage(panelId: string, panel: vscode.WebviewPanel, message: WebviewMessage): Promise<void> {
        switch (message.command) {
            case 'close':
                panel.dispose();
                break;

            case 'search':
                if (message.text) {
                    await this.handleSearch(panel, message.text);
                }
                break;

            case 'getFileContent':
                if (message.filePath) {
                    await this.handleGetFileContent(panel, message.filePath);
                }
                break;

            case 'openFile':
                if (message.filePath && message.line !== undefined) {
                    await this.handleOpenFile(panel, message.filePath, message.line);
                }
                break;
        }
    }

    private async handleSearch(panel: vscode.WebviewPanel, query: string): Promise<void> {
        try {
            const results = await this.searchService.search(query);

            panel.webview.postMessage({
                command: 'searchResults',
                results
            });
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    private async handleGetFileContent(panel: vscode.WebviewPanel, filePath: string): Promise<void> {
        try {
            const content = await this.fileService.getFileContent(filePath);
            const lines = content.split('\n');
            const colorizedLines = await this.syntaxHighlightService.highlightLines(lines, filePath);

            panel.webview.postMessage({
                command: 'fileContent',
                filePath,
                content,
                colorizedLines
            });
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }

    private async handleOpenFile(panel: vscode.WebviewPanel, filePath: string, line: number): Promise<void> {
        try {
            await this.fileService.openFileAtLocation(filePath, line);
            panel.dispose();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private setupPanelDisposal(panelId: string, panel: vscode.WebviewPanel): void {
        panel.onDidDispose(
            () => {
                this.panels.delete(panelId);
            },
            null,
            this.context.subscriptions
        );
    }
}
