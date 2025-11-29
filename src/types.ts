import { type Uri } from 'vscode';

export interface SearchMatch {
    filePath: string;
    relativePath: string;
    line: number;
    column: number;
    previewColumn: number;
    preview: string;
}

export interface Font {
    fontId: string;
    fontFormat: string;
    fontUri: Uri;
    fontWeight?: string;
    fontStyle?: string;
    fontSize?: string;
}

export type ResolvedIconDefinition = {
    fontCharacter?: never
    svgPath: string;
} | {
    svgPath?: never;
    fontCharacter: string;
    fontColor?: string;
    fontSize?: string;
    fontId?: string;
};

export interface FileSearchResult {
    filePath: string;
    relativePath: string;
    matches: SearchMatch[];
    icon?: ResolvedIconDefinition;
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
