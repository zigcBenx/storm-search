import { SearchOptions } from './types';

export const BINARY_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'webp',
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'mp3', 'wav', 'ogg',
    'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so',
    'bin', 'dat', 'db', 'sqlite', 'woff', 'woff2', 'ttf', 'eot',
    'class', 'jar', 'war', 'ear', 'o', 'a', 'lib', 'dylib'
]);

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
    maxResults: undefined,
    maxMatchesPerFile: undefined,
    maxFilesToSearch: undefined,
    maxFileSize: 500 * 1024, // 500KB
    batchSize: 100,
};

export const LANGUAGE_MAP: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sh': 'bash',
    'sql': 'sql'
};
