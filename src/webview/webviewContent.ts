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
        <input
            type="text"
            class="search-input"
            id="searchInput"
            placeholder="Search everywhere..."
            autofocus
        />
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
