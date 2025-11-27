export interface SearchMatch {
    filePath: string;
    relativePath: string;
    line: number;
    column: number;
    previewColumn: number;
    preview: string;
}

export interface FileSearchResult {
    filePath: string;
    relativePath: string;
    matches: SearchMatch[];
}

export type WebviewMessage = {
    command: 'search'
    text: string;
} | {
    command: 'getFileContent'
    filePath: string;
} | {
    command: 'openFile'
    filePath: string;
    line: number;
    column: number;
} | {
    command: 'close';
}

export interface SearchOptions {
    maxResults?: number;
    maxMatchesPerFile?: number;
    maxFilesToSearch?: number;
    maxFileSize: number;
    batchSize: number;
}
