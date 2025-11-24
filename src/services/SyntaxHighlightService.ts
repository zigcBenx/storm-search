import * as vscode from 'vscode';
import { createHighlighter, Highlighter, BundledLanguage } from 'shiki';
import path from 'path';


type TokenColor = {
    scope: string[];
    settings: any
}

type Theme = {
    name: string;
    settings: TokenColor[];
    fg: string;
    bg: string;
}

// Lifted and adapted from: https://github.com/microsoft/vscode/issues/32813#issuecomment-524174937
export function getTheme(themeName: string | undefined): Theme | null {
    if (!themeName) {
        return null;
    }

    // Resolves theme folder path at runtime
    let currentThemePath;
    for (const extension of vscode.extensions.all) {
        // extension.packageJSON.contributes.themes is resolveable even if the extension doesn't actually contribute any themes
        const themes = extension.packageJSON.contributes && extension.packageJSON.contributes.themes;
        const currentTheme = themes && themes.find((theme: any) => theme.label === themeName || theme.id === themeName);
        if (currentTheme) {
            currentThemePath = path.join(extension.extensionPath, currentTheme.path);
            break;
        }
    }

    const colors = new Map();
    const tokenColors = new Map();

    // Resolve all included themes, add nested theme paths if necessary
    const themePaths = [];
    if (currentThemePath) { themePaths.push(currentThemePath); }

    while (themePaths.length > 0) {
        const themePath = themePaths.pop();
        if (!themePath) throw new Error("this is to make typescript happy");
        const theme: any = require(themePath);
        if (theme) {
            if (theme.include) {
                themePaths.push(path.join(path.dirname(themePath), theme.include));
            }
            if (theme.colors) {
                for (const colorId in theme.colors) {
                    if (!colors.has(colorId)) {
                        colors.set(colorId, theme.colors[colorId]);
                    }
                }
            }
            if (theme.tokenColors) {
                theme.tokenColors.forEach((rule: any) => {
                    if (typeof rule.scope === "string" && !tokenColors.has(rule.scope)) {
                        tokenColors.set(rule.scope, rule.settings);
                    } else if (rule.scope instanceof Array) {
                        rule.scope.forEach((scope: any) => {
                            if (!tokenColors.has(rule.scope)) {
                                tokenColors.set(scope, rule.settings);
                            }
                        });
                    }
                });
            }
        }
    }

    // Convert back to settings array, digestible by shiki
    const finalSettings: TokenColor[] = []
    for (const [scope, settings] of tokenColors) {
        // Circumvent circular issue
        const safeSettings = { ...settings };
        finalSettings.push({ scope: [scope], settings: safeSettings });
    }

    if (finalSettings.length === 0) {
        return null
    }
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const foregroundColor = colors.get('editor.foreground') || (isDark ? '#FFFFFF' : '#000000');
    const backgroundColor = colors.get('editor.background') || (isDark ? '#1E1E1E' : '#FFFFFF');

    return {
        name: "custom-theme",
        settings: finalSettings,
        fg: foregroundColor,
        bg: backgroundColor
    }
}


export class SyntaxHighlightService {
    private highlighter: Highlighter | undefined;
    private customTheme?: Theme;

    async initialize(): Promise<void> {
        const currentThemeName = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
        const theme = getTheme(currentThemeName);
        if (theme) {
            this.customTheme = theme;
        }

        this.highlighter = await createHighlighter({
            themes: [this.customTheme || "dark-plus"],
            langs: [
                'typescript', 'javascript', 'python', 'java', 'css', 'html',
                'json', 'markdown', 'yaml', 'xml', 'sql', 'shell', 'php',
                'ruby', 'go', 'rust', 'c', 'cpp', 'vue', 'svelte'
            ]
        });
    }

    async highlightCode(code: string, filePath: string): Promise<string> {
        if (!this.highlighter) {
            await this.initialize();
        }

        const language = this.detectLanguage(filePath);

        try {
            const html = this.highlighter!.codeToHtml(code, {
                lang: language,
                theme: this.customTheme ? this.customTheme.name : "dark-plus"
            });

            // Extract just the code part without the pre/code wrapper
            const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
            return match ? match[1] : code;
        } catch (error) {
            console.error('Error highlighting code:', error);
            return this.escapeHtml(code);
        }
    }

    async highlightLines(lines: string[], filePath: string): Promise<string[]> {
        if (!this.highlighter) {
            await this.initialize();
        }

        const language = this.detectLanguage(filePath);
        const colorizedLines: string[] = [];

        for (const line of lines) {
            try {
                const html = this.highlighter!.codeToHtml(line || ' ', {
                    lang: language,
                    theme: this.customTheme ? this.customTheme.name : "dark-plus"
                });

                // Extract just the line content
                const match = html.match(/<code[^>]*><span class="line">([\s\S]*?)<\/span><\/code>/);
                colorizedLines.push(match ? match[1] : this.escapeHtml(line));
            } catch (error) {
                colorizedLines.push(this.escapeHtml(line));
            }
        }

        return colorizedLines;
    }

    private detectLanguage(filePath: string): BundledLanguage {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';

        const langMap: Record<string, BundledLanguage> = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'java': 'java',
            'css': 'css',
            'scss': 'css',
            'html': 'html',
            'json': 'json',
            'md': 'markdown',
            'yaml': 'yaml',
            'yml': 'yaml',
            'xml': 'xml',
            'sql': 'sql',
            'sh': 'shell',
            'bash': 'shell',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'c': 'c',
            'cpp': 'cpp',
            'h': 'cpp',
            'vue': 'vue',
            'svelte': 'svelte'
        };

        return langMap[ext] || 'typescript';
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    dispose(): void {
        this.highlighter = undefined;
    }
}
