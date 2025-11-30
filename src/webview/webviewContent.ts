import { Uri } from 'vscode';
import { getNonce } from '../util';
import { Font } from '../types';

type WebviewContentOptions = {
    scriptUri: Uri,
    styleUri: Uri,
    wordWrap?: string;
    fonts?: Font[];
}

function generateFontFaceStyles(fonts?: Font[]): string {
    if (!fonts || fonts.length === 0) {
        return '';
    }

    return fonts.map((font) => `
        @font-face {
            font-family: '${font.fontId}';
            src: url('${font.fontUri}') format('${font.fontFormat}');
            font-weight: ${font.fontWeight || 'normal'};
            font-style: ${font.fontStyle || 'normal'};
            font-size: ${font.fontSize || '16px'};
        }

        .icon-font-${font.fontId} {
            font-family: '${font.fontId}';
        }
    `).join('\n');
}

export function getWebviewContent(options: WebviewContentOptions): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search</title>

    <style>
        ${generateFontFaceStyles(options.fonts)}
    </style>

    <link rel="stylesheet" href="${options.styleUri}">
</head>
<body class="${options.wordWrap === 'off' ? '' : 'wrap-lines'}">
    <div class="search-header">
        <div class="search-input-container">
            <input
                type="text"
                class="search-input"
                id="searchInput"
                placeholder="Search everywhere..."
                autofocus
            />
            <button class="filter-toggle-button" id="filterToggleButton" title="Toggle file mask filter">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 2h14v2l-5 5v5l-4-2V9L1 4V2z"/>
                </svg>
            </button>
        </div>
        <div class="filter-container" id="filterContainer" style="display: none;">
            <label class="filter-label">File mask:</label>
            <input
                type="text"
                class="file-mask-input"
                id="fileMaskInput"
                placeholder="*.ts, *.js (comma-separated)"
            />
        </div>
        <div class="scope-container">
            <div class="scope-buttons">
                <button class="scope-button active" data-scope="project">Project</button>
                <button class="scope-button" data-scope="directory">Directory</button>
            </div>
            <div class="scope-input-container" style="display: none;">
                <input
                    type="text"
                    class="scope-path-input"
                    id="scopePathInput"
                    placeholder="path/to/dir or path1/**,path2/** (comma-separated)"
                />
                <button class="scope-browse-button" id="scopeBrowseButton" title="Browse...">...</button>
            </div>
        </div>
    </div>

    <div class="content-container">
        <div class="results-panel">
            <div class="results-header" id="resultsHeader">
                No results
            </div>
            <div class="results-list" id="resultsList">
                <div class="empty-state">Start typing to search...</div>
            </div>
        </div>

        <div class="preview-panel">
            <div class="preview-header" id="previewHeader">
                No file selected
            </div>
            <div class="preview-content" id="previewContent">
                <div class="empty-state">Select a match to preview</div>
            </div>
        </div>
    </div>

    <!-- Otherwise causes issues when importing types in the script -->
    <script>var exports = {};</script>
    <script nonce="${getNonce()}" src="${options.scriptUri}"></script>
</body>
</html>`;
}
