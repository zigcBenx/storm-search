import * as vscode from 'vscode';
import { createHighlighter, Highlighter, BundledLanguage, BundledTheme } from 'shiki';

export class SyntaxHighlightService {
    private highlighter: Highlighter | undefined;
    private currentTheme: BundledTheme = 'dark-plus';

    async initialize(): Promise<void> {
        const currentThemeName = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
        this.currentTheme = this.mapVSCodeThemeToShiki(currentThemeName);

        this.highlighter = await createHighlighter({
            themes: [this.currentTheme],
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
                theme: this.currentTheme
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
                    theme: this.currentTheme
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

    private mapVSCodeThemeToShiki(themeName?: string): BundledTheme {
        if (!themeName) {
            return 'dark-plus';
        }

        const themeNameLower = themeName.toLowerCase();

        // Map common VS Code themes to Shiki themes
        if (themeNameLower.includes('light')) {
            return 'light-plus';
        } else if (themeNameLower.includes('dark')) {
            return 'dark-plus';
        } else if (themeNameLower.includes('monokai')) {
            return 'monokai';
        } else if (themeNameLower.includes('solarized') && themeNameLower.includes('light')) {
            return 'solarized-light';
        } else if (themeNameLower.includes('solarized') && themeNameLower.includes('dark')) {
            return 'solarized-dark';
        }

        // Default to dark-plus
        return 'dark-plus';
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
