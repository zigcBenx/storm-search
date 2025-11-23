import * as vscode from 'vscode';
import { WebviewMessage } from './types';
import { SearchService } from './services/SearchService';
import { FileService } from './services/FileService';
import { SyntaxHighlightService } from './services/SyntaxHighlightService';
import { getWebviewContent } from './webview/webviewContent';

export class WebviewManager {
    private panel: vscode.WebviewPanel | undefined;
    private searchService: SearchService;
    private fileService: FileService;
    private syntaxHighlightService: SyntaxHighlightService;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.searchService = new SearchService();
        this.fileService = new FileService();
        this.syntaxHighlightService = new SyntaxHighlightService();
    }

    show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.createPanel();
    }

    dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.syntaxHighlightService.dispose();
    }

    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'customSearch',
            'Search',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = getWebviewContent();
        this.setupMessageHandler();
        this.setupPanelDisposal();
    }

    private setupMessageHandler(): void {
        if (!this.panel) {
            return;
        }

        const messageHandler = this.panel.webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        this.disposables.push(messageHandler);
    }

    private async handleMessage(message: WebviewMessage): Promise<void> {
        switch (message.command) {
            case 'close':
                this.panel?.dispose();
                break;

            case 'search':
                if (message.text) {
                    await this.handleSearch(message.text);
                }
                break;

            case 'getFileContent':
                if (message.filePath) {
                    await this.handleGetFileContent(message.filePath);
                }
                break;

            case 'openFile':
                if (message.filePath && message.line !== undefined) {
                    await this.handleOpenFile(message.filePath, message.line);
                }
                break;
        }
    }

    private async handleSearch(query: string): Promise<void> {
        if (!this.panel) {
            return;
        }

        try {
            const results = await this.searchService.search(query);

            this.panel.webview.postMessage({
                command: 'searchResults',
                results
            });
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    private async handleGetFileContent(filePath: string): Promise<void> {
        if (!this.panel) {
            return;
        }

        try {
            const content = await this.fileService.getFileContent(filePath);
            const lines = content.split('\n');
            const colorizedLines = await this.syntaxHighlightService.highlightLines(lines, filePath);

            this.panel.webview.postMessage({
                command: 'fileContent',
                filePath,
                content,
                colorizedLines
            });
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }

    private async handleOpenFile(filePath: string, line: number): Promise<void> {
        try {
            await this.fileService.openFileAtLocation(filePath, line);
            this.panel?.dispose();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private setupPanelDisposal(): void {
        if (!this.panel) {
            return;
        }

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
                this.disposables.forEach(d => d.dispose());
                this.disposables = [];
            },
            null,
            this.context.subscriptions
        );
    }
}
