import * as vscode from 'vscode';
import { FileSearchResult, SearchMatch, SearchOptions } from '../types';
import { BINARY_EXTENSIONS, DEFAULT_SEARCH_OPTIONS } from '../constants';
import { escapeRegExp, matchGlob } from '../util';

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

        const collator = new Intl.Collator('en', { sensitivity: 'base' });
        files.sort((a, b) => {
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
        return files;
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
