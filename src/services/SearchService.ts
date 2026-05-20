import * as vscode from 'vscode';
import { FileSearchResult, SearchMatch, SearchOptions } from '../types';
import { BINARY_EXTENSIONS, DEFAULT_SEARCH_OPTIONS } from '../constants';
import { escapeRegExp, matchGlob } from '../util';

interface GitignoreRule {
    pattern: string;
    negated: boolean;
    directoryOnly: boolean;
    anchored: boolean;
    hasSlash: boolean;
}

export class SearchService {
    private options: SearchOptions;

    constructor(options: Partial<SearchOptions> = {}) {
        this.options = { ...DEFAULT_SEARCH_OPTIONS, ...options };
    }

    getSearchOptions(): SearchOptions {
        return this.options;
    }

    async getSearchableFiles(): Promise<vscode.Uri[]> {
        // Get search exclude patterns from VSCode settings
        const searchConfig = vscode.workspace.getConfiguration('search');
        const searchExclude = searchConfig.get<Record<string, boolean>>('exclude', {});
        const filesConfig = vscode.workspace.getConfiguration('files');
        const filesExclude = filesConfig.get<Record<string, boolean>>('exclude', {});

        // Combine exclude patterns from both settings
        const allExcludePatterns: string[] = [];

        // Add patterns from search.exclude
        for (const [pattern, enabled] of Object.entries(searchExclude)) {
            if (enabled) {
                allExcludePatterns.push(pattern);
            }
        }

        // Add patterns from files.exclude that aren't already in search.exclude
        for (const [pattern, enabled] of Object.entries(filesExclude)) {
            if (enabled && !searchExclude.hasOwnProperty(pattern)) {
                allExcludePatterns.push(pattern);
            }
        }

        // Add binary file extensions
        for (const binaryExtension of BINARY_EXTENSIONS) {
            allExcludePatterns.push(`**/*.${binaryExtension}`);
        }

        const excludeGlob = allExcludePatterns.length > 0 ? `{${allExcludePatterns.join(',')}}` : undefined;
        const cancellationTokenSource = new vscode.CancellationTokenSource();
        const timer = setTimeout(() => {
            cancellationTokenSource.cancel();
            cancellationTokenSource.dispose();
        }, 1000);

        const files = await vscode.workspace.findFiles('**/*', excludeGlob, this.options.maxFilesToSearch, cancellationTokenSource.token);;
        clearTimeout(timer);
        cancellationTokenSource.dispose();

        const gitignoreRules = await this.getGitignoreRules();
        const searchableFiles = files.filter(file => !this.isIgnoredByGitignore(file, gitignoreRules));

        const collator = new Intl.Collator('en', { sensitivity: 'base' });
        searchableFiles.sort((a, b) => {
            const pathA = a.path.split('/');
            const pathB = b.path.split('/');

            // Compare each path segment level by level
            const minLength = Math.min(pathA.length, pathB.length);
            for (let i = 0; i < minLength; i++) {
                const isLastA = i === pathA.length - 1;
                const isLastB = i === pathB.length - 1;

                // If one is a file and one is a folder at this level, folder comes first
                if (isLastA !== isLastB) {
                    return isLastA ? 1 : -1; // folder (not last) comes before file (last)
                }

                // Otherwise compare the segments alphabetically
                const comparison = collator.compare(pathA[i], pathB[i]);
                if (comparison !== 0) {
                    return comparison;
                }
            }

            // If all segments match, shorter path (folder) comes first
            return pathA.length - pathB.length;
        });
        return searchableFiles;
    }

    private async getGitignoreRules(): Promise<Map<string, GitignoreRule[]>> {
        const rulesByWorkspaceFolder = new Map<string, GitignoreRule[]>();
        const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

        await Promise.all(workspaceFolders.map(async (workspaceFolder) => {
            const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
            try {
                const content = await vscode.workspace.fs.readFile(gitignoreUri);
                const text = new TextDecoder('utf-8', { fatal: false }).decode(content);
                rulesByWorkspaceFolder.set(workspaceFolder.uri.fsPath, this.parseGitignoreRules(text));
            } catch (error) {
                rulesByWorkspaceFolder.set(workspaceFolder.uri.fsPath, []);
            }
        }));

        return rulesByWorkspaceFolder;
    }

    private parseGitignoreRules(content: string): GitignoreRule[] {
        return content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map((line) => {
                const negated = line.startsWith('!');
                let pattern = negated ? line.slice(1) : line;
                const anchored = pattern.startsWith('/');
                pattern = anchored ? pattern.slice(1) : pattern;
                const directoryOnly = pattern.endsWith('/');
                pattern = directoryOnly ? pattern.slice(0, -1) : pattern;
                return {
                    pattern,
                    negated,
                    directoryOnly,
                    anchored,
                    hasSlash: pattern.includes('/')
                };
            })
            .filter(rule => rule.pattern);
    }

    private isIgnoredByGitignore(file: vscode.Uri, rulesByWorkspaceFolder: Map<string, GitignoreRule[]>): boolean {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
        if (!workspaceFolder) {
            return false;
        }

        const rules = rulesByWorkspaceFolder.get(workspaceFolder.uri.fsPath);
        if (!rules || rules.length === 0) {
            return false;
        }

        const relativePath = vscode.workspace.asRelativePath(file, false).replace(/\\/g, '/');
        let ignored = false;
        for (const rule of rules) {
            if (this.matchesGitignoreRule(rule, relativePath)) {
                ignored = !rule.negated;
            }
        }
        return ignored;
    }

    private matchesGitignoreRule(rule: GitignoreRule, relativePath: string): boolean {
        if (rule.directoryOnly) {
            return this.matchesGitignorePattern(rule, relativePath) || relativePath.startsWith(`${rule.pattern}/`);
        }
        return this.matchesGitignorePattern(rule, relativePath);
    }

    private matchesGitignorePattern(rule: GitignoreRule, relativePath: string): boolean {
        if (rule.anchored) {
            return matchGlob(rule.pattern, relativePath);
        }

        if (rule.hasSlash) {
            return matchGlob(rule.pattern, relativePath) || matchGlob(`**/${rule.pattern}`, relativePath);
        }

        return relativePath.split('/').some(segment => matchGlob(rule.pattern, segment));
    }

    async search(files: vscode.Uri[], query: string, includePattern?: string, excludePattern?: string): Promise<FileSearchResult[]> {
        const fileMatchMap = new Map<string, SearchMatch[]>();
        if (!query) {
            return [];
        }

        // Filter files based on include/exclude patterns
        let filteredFiles = files;
        if (includePattern || excludePattern) {
            filteredFiles = this.filterFilesByPatterns(files, includePattern, excludePattern);
        }

        const queryLower = query.toLowerCase();
        await this.searchInBatches(filteredFiles, queryLower, fileMatchMap);
        return this.convertMapToResults(fileMatchMap);
    }

    private filterFilesByPatterns(files: vscode.Uri[], includePattern?: string, excludePattern?: string): vscode.Uri[] {
        return files.filter((file) => {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
            const relativePath = workspaceFolder
                ? vscode.workspace.asRelativePath(file, false)
                : file.fsPath;

            // If include pattern is specified, file must match it
            if (includePattern && includePattern.trim()) {
                const patterns = includePattern.split(',').map(p => p.trim()).filter(p => p);
                const matchesInclude = patterns.some(pattern => matchGlob(pattern, relativePath));
                if (!matchesInclude) {
                    return false;
                }
            }

            // If exclude pattern is specified, file must not match it
            if (excludePattern && excludePattern.trim()) {
                const patterns = excludePattern.split(',').map(p => p.trim()).filter(p => p);
                const matchesExclude = patterns.some(pattern => matchGlob(pattern, relativePath));
                if (matchesExclude) {
                    return false;
                }
            }

            return true;
        });
    }

    private async searchInBatches(
        files: vscode.Uri[],
        queryLower: string,
        fileMatchMap: Map<string, SearchMatch[]>
    ): Promise<void> {
        for (let i = 0; i < files.length; i += this.options.batchSize) {
            if (this.options.maxResults && fileMatchMap.size >= this.options.maxResults) {
                break;
            }

            const batch = files.slice(i, i + this.options.batchSize);
            const results = await this.searchBatch(batch, queryLower);

            for (const result of results) {
                if (result) {
                    fileMatchMap.set(result.filePath, result.matches);
                }
            }
        }
    }

    private async searchBatch(
        batch: vscode.Uri[],
        queryLower: string
    ): Promise<Array<{ filePath: string; matches: SearchMatch[] } | null>> {
        return Promise.all(batch.map(async (file) => {
            try {
                const stat = await vscode.workspace.fs.stat(file);

                if (stat.size > this.options.maxFileSize) {
                    return null;
                }

                const uint8Array = await vscode.workspace.fs.readFile(file);
                const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
                const textLower = text.toLowerCase();

                if (!textLower.includes(queryLower)) {
                    return null;
                }

                const matches = this.findMatchesInFile(file, text, textLower, queryLower);
                return matches.length > 0 ? { filePath: file.fsPath, matches } : null;
            } catch (error) {
                return null;
            }
        }));
    }

    private findMatchesInFile(
        file: vscode.Uri,
        text: string,
        textLower: string,
        queryLower: string
    ): SearchMatch[] {
        const regularLines = text.split('\n');
        const lowerLines = textLower.split('\n');
        const matches: SearchMatch[] = [];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
        const relativePath = workspaceFolder
            ? vscode.workspace.asRelativePath(file, false)
            : file.fsPath;

        const matchExp = new RegExp(escapeRegExp(queryLower), 'g');
        for (let i = 0; i < lowerLines.length; i++) {
            if (this.options.maxMatchesPerFile && matches.length >= this.options.maxMatchesPerFile) {
                break;
            }

            const previewLine = regularLines[i];
            // const previewTrimOffset = regularLine.length - previewLine.length;

            const lowerLine = lowerLines[i];
            const lineMatches = lowerLine.matchAll(matchExp);
            for (const match of lineMatches) {
                // clamp line preview to max 50 characters before and after to prevent issues with extremely long lines
                const start = Math.max(0, match.index - 50);
                const end = Math.min(previewLine.length, match.index + queryLower.length + 50);
                const preview = previewLine.substring(start, end);

                const trimmedPreview = preview.trimStart();
                const leadingSpaces = preview.length - trimmedPreview.length;

                // Adjusted column to account for clamping
                const previewColumn = match.index - start - leadingSpaces;

                matches.push({
                    filePath: file.fsPath,
                    relativePath,
                    line: i + 1,
                    column: match.index,
                    preview: trimmedPreview.trimEnd(),
                    previewColumn
                });
            }
        }

        return matches;
    }

    private convertMapToResults(fileMatchMap: Map<string, SearchMatch[]>): FileSearchResult[] {
        const results: FileSearchResult[] = [];

        fileMatchMap.forEach((matches, filePath) => {
            results.push({
                filePath,
                relativePath: matches[0].relativePath,
                matches
            });
        });

        return results;
    }
}
