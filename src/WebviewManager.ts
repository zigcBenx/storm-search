import * as vscode from 'vscode';
import { WebviewMessage } from './types';
import { SearchService } from './services/SearchService';
import { FileService } from './services/FileService';
import { SyntaxHighlightService } from './services/SyntaxHighlightService';
import { getWebviewContent } from './webview/webviewContent';
import { IconThemeService } from './services/IconThemeService';

export class WebviewManager {
    private panels: Map<string, vscode.WebviewPanel> = new Map();
    private panelSearches: Map<string, string> = new Map();

    private searchService: SearchService;
    private fileService: FileService;
    private iconThemeService: IconThemeService;
    private syntaxHighlightService: SyntaxHighlightService;
    private disposables: vscode.Disposable[] = [];
    private panelCounter: number = 0;

    constructor(private context: vscode.ExtensionContext) {
        this.searchService = new SearchService();
        this.fileService = new FileService();
        this.syntaxHighlightService = new SyntaxHighlightService();
        this.iconThemeService = new IconThemeService();

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            this.clearCache(e.document.uri.toString());
        });
        this.disposables.push(changeDocumentSubscription);
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
        this.panelSearches.clear();
        this.disposables.forEach(d => d.dispose());
        this.syntaxHighlightService.dispose();
    }

    private createPanel(): void {
        this.panelCounter++;
        const panelId = `search-${this.panelCounter}`;
        const tabNumber = this.panels.size + 1;

        const localResourceRoots = [
            vscode.Uri.joinPath(this.context.extensionUri, 'media'),
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')
        ]

        const iconThemeExtension = this.iconThemeService.getIconThemeExtension();
        if (iconThemeExtension) {
            localResourceRoots.push(iconThemeExtension.extensionUri);
        }

        const panel = vscode.window.createWebviewPanel(
            'customSearch',
            `Search ${tabNumber}`,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots
            }
        );

        this.panels.set(panelId, panel);

        // Get word wrap setting
        const editorConfig = vscode.workspace.getConfiguration('editor');
        const wordWrap = editorConfig.get<string>('wordWrap', 'off');

        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'script.js'));
        const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css'));

        const iconFonts = this.iconThemeService.getIconFonts();

        console.log('Icon Fonts:', iconFonts);
        panel.webview.html = getWebviewContent({
            scriptUri,
            styleUri,
            wordWrap,
            fonts: iconFonts.map((font) => ({
                ...font,
                fontUri: panel.webview.asWebviewUri(font.fontUri)
            }))
        });
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
                    await this.handleSearch(panelId, panel, message.text);
                }
                break;

            case 'getFileContent':
                if (message.filePath) {
                    await this.handleGetFileContent(panel, message.filePath);
                }
                break;

            case 'openFile':
                if (message.filePath && message.line !== undefined) {
                    await this.handleOpenFile(panel, message.filePath, message.line, message.column);
                }
                break;
        }
    }

    private async handleSearch(panelId: string, panel: vscode.WebviewPanel, query: string): Promise<void> {
        try {
            this.panelSearches.set(panelId, query);

            const searchableFiles = await this.searchService.getSearchableFiles();
            const searchOptions = this.searchService.getSearchOptions();
            let resultCount = 0;

            for (let i = 0; i < searchableFiles.length; i += searchOptions.batchSize) {
                if (this.panelSearches.get(panelId) !== query) {
                    // A new search has been initiated in this panel, abort current search
                    return;
                }

                const batch = searchableFiles.slice(i, i + searchOptions.batchSize);
                const results = await this.searchService.search(batch, query);
                if (results.length === 0) {
                    continue;
                }
                resultCount += results.length;
                panel.webview.postMessage({
                    command: i === 0 ? 'newSearchResults' : 'extendSearchResults',
                    results: results.map((result) => {
                        const icon = this.iconThemeService.getIconForPath(result.filePath);
                        if (icon?.svgPath) {
                            icon.svgPath = panel.webview.asWebviewUri(vscode.Uri.file(icon.svgPath)).toString();
                        }

                        return {
                            ...result,
                            icon
                        }
                    })
                });
            }

            if (resultCount === 0) {
                panel.webview.postMessage({
                    command: 'noResults'
                });
            }
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

    private async clearCache(filePath: string): Promise<void> {
        for (const panel of this.panels.values()) {
            panel.webview.postMessage({
                command: 'clearCache',
                filePath
            });
        }
    }

    private async handleOpenFile(panel: vscode.WebviewPanel, filePath: string, line: number, column: number): Promise<void> {
        try {
            await this.fileService.openFileAtLocation(filePath, line, column);
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
