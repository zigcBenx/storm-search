import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { FileSearchResult, SearchMatch } from '../types';

const FLUSH_THRESHOLD = 25;

interface RgMatch {
    type: 'match';
    data: {
        path: { text: string };
        lines: { text: string };
        line_number: number;
        submatches: Array<{ start: number; end: number; match: { text: string } }>;
    };
}

function findRipgrepPath(): string | null {
    const appRoot = vscode.env.appRoot;
    const rgBin = process.platform === 'win32' ? 'rg.exe' : 'rg';
    const candidates = [
        path.join(appRoot, 'node_modules', '@vscode', 'ripgrep', 'bin', rgBin),
        path.join(appRoot, 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', rgBin),
        path.join(appRoot, 'node_modules', 'vscode-ripgrep', 'bin', rgBin),
        path.join(appRoot, 'node_modules.asar.unpacked', 'vscode-ripgrep', 'bin', rgBin),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

export class SearchService {
    private rgPath: string | null;

    constructor() {
        this.rgPath = findRipgrepPath();
        if (!this.rgPath) {
            console.error('Storm Search: ripgrep not found — search will not work');
        }
    }

    search(
        query: string,
        includePattern: string | undefined,
        excludePattern: string | undefined,
        token: vscode.CancellationToken,
        onBatch: (results: FileSearchResult[]) => void
    ): Promise<boolean> {
        if (!query || !this.rgPath) return Promise.resolve(false);

        return new Promise((resolve) => {
            const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
            if (workspaceFolders.length === 0) {
                resolve(false);
                return;
            }

            const pendingByFile = new Map<string, SearchMatch[]>();
            let totalResults = 0;

            const flush = () => {
                if (pendingByFile.size === 0) return;
                const batch: FileSearchResult[] = [];
                pendingByFile.forEach((matches, filePath) => {
                    batch.push({ filePath, relativePath: matches[0].relativePath, matches });
                });
                onBatch(batch);
                pendingByFile.clear();
            };

            const createChunkHandler = () => {
                let buffer = '';

                return (chunk: Buffer) => {
                    if (token.isCancellationRequested) return;

                    buffer += chunk.toString('utf8');
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        if (!line) continue;
                        let parsed: RgMatch;
                        try { parsed = JSON.parse(line); } catch { continue; }
                        if (parsed.type !== 'match') continue;

                        const filePath = parsed.data.path.text;
                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
                        const relativePath = workspaceFolder
                            ? vscode.workspace.asRelativePath(vscode.Uri.file(filePath), false)
                            : filePath;

                        const rawLine = parsed.data.lines.text;
                        const trimmedLine = rawLine.trimStart();
                        const leadingSpaces = rawLine.length - trimmedLine.length;
                        const preview = trimmedLine.trimEnd();

                        if (!pendingByFile.has(filePath)) {
                            pendingByFile.set(filePath, []);
                        }

                        for (const sub of parsed.data.submatches) {
                            pendingByFile.get(filePath)!.push({
                                filePath,
                                relativePath,
                                line: parsed.data.line_number,
                                column: sub.start,
                                preview,
                                previewColumn: Math.max(0, sub.start - leadingSpaces),
                            });
                            totalResults++;
                        }

                        if (pendingByFile.size >= FLUSH_THRESHOLD) {
                            flush();
                        }
                    }
                };
            };

            let remainingChildren = workspaceFolders.length;
            const finishChild = () => {
                remainingChildren--;
                if (remainingChildren === 0) {
                    flush();
                    resolve(totalResults > 0);
                }
            };

            for (const folder of workspaceFolders) {
                const args = buildRipgrepArgs(query, includePattern, excludePattern, folder.uri.fsPath);
                const child = cp.spawn(this.rgPath!, args, {
                    cwd: folder.uri.fsPath,
                    stdio: ['ignore', 'pipe', 'ignore']
                });

                token.onCancellationRequested(() => child.kill());
                child.stdout.on('data', createChunkHandler());

                child.on('close', finishChild);

                child.on('error', (err: Error) => {
                    console.error('ripgrep error:', err);
                    finishChild();
                });
            }
        });
    }
}

export function buildRipgrepArgs(
    query: string,
    includePattern: string | undefined,
    excludePattern: string | undefined,
    workspacePath: string
): string[] {
    const args = ['--json', '-i', '-F', '--no-heading'];

    if (includePattern) {
        toGlobParts(includePattern).forEach(p => args.push('--glob', p));
    }
    if (excludePattern) {
        toGlobParts(excludePattern).forEach(p => args.push('--glob', `!${p}`));
    }

    args.push('--', query, workspacePath);
    return args;
}

function toGlobParts(commaPattern: string): string[] {
    return commaPattern.split(',').map(p => p.trim()).filter(Boolean);
}
