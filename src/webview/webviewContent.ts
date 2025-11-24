import { getStyles } from './styles';
import { getClientScript } from './script';

export function getWebviewContent(wordWrap: string = 'off'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    ${getStyles(wordWrap)}
</head>
<body>
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

    <script>
        ${getClientScript()}
    </script>
</body>
</html>`;
}
