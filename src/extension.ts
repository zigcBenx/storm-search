import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('custom-search.openSearch', () => {
        if (currentPanel) {
            currentPanel.reveal();
            return;
        }

        currentPanel = vscode.window.createWebviewPanel(
            'customSearch',
            'Search',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        currentPanel.webview.html = getWebviewContent();

        currentPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'close':
                        currentPanel?.dispose();
                        break;
                    case 'search':
                        await performSearch(message.text);
                        break;
                    case 'getFileContent':
                        await getFileContent(message.filePath);
                        break;
                    case 'openFile':
                        await openFileAtLocation(message.filePath, message.line);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        currentPanel.onDidDispose(
            () => {
                currentPanel = undefined;
            },
            null,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

async function performSearch(query: string) {
    if (!query || !currentPanel) {
        return;
    }

    const fileMatchMap = new Map<string, any[]>();

    // Comprehensive exclude patterns for build/dependency folders
    const excludePatterns = [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/CVS/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.min.js',
        '**/*.min.css',
        '**/bower_components/**',
        '**/vendor/**',
        '**/__pycache__/**',
        '**/*.pyc',
        '**/venv/**',
        '**/.venv/**',
        '**/target/**',
        '**/.gradle/**',
        '**/.idea/**',
        '**/.vscode/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/tmp/**',
        '**/temp/**',
        '**/.cache/**',
        '**/public/build/**',
        '**/.nuxt/**',
        '**/generated/**',
        '**/*.lock',
        '**/package-lock.json',
        '**/yarn.lock'
    ];

    const exclude = `{${excludePatterns.join(',')}}`;

    // Find files with better limits
    const files = await vscode.workspace.findFiles('**/*', exclude, 1000);

    // Filter to text files only (skip binary extensions)
    const binaryExtensions = new Set([
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'webp',
        'mp4', 'avi', 'mov', 'wmv', 'flv', 'mp3', 'wav', 'ogg',
        'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so',
        'bin', 'dat', 'db', 'sqlite', 'woff', 'woff2', 'ttf', 'eot',
        'class', 'jar', 'war', 'ear', 'o', 'a', 'lib', 'dylib'
    ]);

    const textFiles = files.filter(file => {
        const ext = file.fsPath.split('.').pop()?.toLowerCase() || '';
        return !binaryExtensions.has(ext);
    });

    // Process files in parallel batches for better performance
    const BATCH_SIZE = 100; // Increased batch size
    const MAX_FILE_SIZE = 500 * 1024; // 500KB limit for faster processing
    const MAX_RESULTS = 100; // More results
    const queryLower = query.toLowerCase();

    // Process only first N files for speed
    const filesToSearch = textFiles.slice(0, 2000);

    for (let i = 0; i < filesToSearch.length && fileMatchMap.size < MAX_RESULTS; i += BATCH_SIZE) {
        const batch = filesToSearch.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(batch.map(async (file) => {
            try {
                const stat = await vscode.workspace.fs.stat(file);

                // Skip large files
                if (stat.size > MAX_FILE_SIZE) {
                    return null;
                }

                const uint8Array = await vscode.workspace.fs.readFile(file);
                const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);

                // Quick check if file contains query at all
                const textLower = text.toLowerCase();
                if (!textLower.includes(queryLower)) {
                    return null;
                }

                const lines = text.split('\n');
                const filePath = file.fsPath;
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
                const relativePath = workspaceFolder
                    ? vscode.workspace.asRelativePath(file, false)
                    : filePath;

                const matches = [];
                for (let i = 0; i < lines.length && matches.length < 5; i++) {
                    const line = lines[i];
                    const lineLower = line.toLowerCase();
                    if (lineLower.includes(queryLower)) {
                        matches.push({
                            filePath: filePath,
                            relativePath: relativePath,
                            line: i + 1,
                            column: lineLower.indexOf(queryLower),
                            text: line.trim()
                        });
                    }
                }

                return matches.length > 0 ? { filePath, matches } : null;
            } catch (error) {
                return null;
            }
        }));

        // Collect results
        for (const result of results) {
            if (result && fileMatchMap.size < MAX_RESULTS) {
                fileMatchMap.set(result.filePath, result.matches);
            }
        }

        // Send intermediate results for instant feedback
        if (fileMatchMap.size > 0 && i % (BATCH_SIZE * 2) === 0) {
            const intermediateResults: any[] = [];
            fileMatchMap.forEach((matches, filePath) => {
                intermediateResults.push({
                    filePath: filePath,
                    relativePath: matches[0].relativePath,
                    matches: matches
                });
            });

            currentPanel.webview.postMessage({
                command: 'searchResults',
                results: intermediateResults
            });
        }
    }

    // Convert map to grouped results
    const groupedResults: any[] = [];
    fileMatchMap.forEach((matches, filePath) => {
        groupedResults.push({
            filePath: filePath,
            relativePath: matches[0].relativePath,
            matches: matches
        });
    });

    currentPanel.webview.postMessage({
        command: 'searchResults',
        results: groupedResults
    });
}

async function getFileContent(filePath: string) {
    if (!currentPanel) {
        return;
    }

    try {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();

        currentPanel.webview.postMessage({
            command: 'fileContent',
            filePath: filePath,
            content: content
        });
    } catch (error) {
        console.error('Error reading file:', error);
    }
}

async function openFileAtLocation(filePath: string, line: number) {
    try {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );

        currentPanel?.dispose();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .search-header {
            padding: 12px 16px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .search-input {
            width: 100%;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            outline: none;
            color: var(--vscode-input-foreground);
            font-size: 13px;
            padding: 6px 10px;
            font-family: var(--vscode-font-family);
        }

        .search-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .search-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .content-container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .results-panel {
            width: 400px;
            background: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .results-header {
            padding: 8px 16px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .results-list {
            flex: 1;
            overflow-y: auto;
        }

        .file-group {
            margin-bottom: 4px;
        }

        .file-header {
            padding: 6px 16px;
            font-size: 12px;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .file-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .file-icon {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }

        .match-item {
            padding: 6px 16px 6px 38px;
            font-size: 12px;
            cursor: pointer;
            border-left: 2px solid transparent;
        }

        .match-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .match-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-left-color: var(--vscode-list-activeSelectionForeground);
        }

        .match-line-number {
            display: inline-block;
            width: 40px;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }

        .match-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .match-highlight {
            background: var(--vscode-editor-findMatchHighlightBackground);
            color: var(--vscode-editor-foreground);
        }

        .preview-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--vscode-editor-background);
            overflow: hidden;
        }

        .preview-header {
            padding: 8px 16px;
            font-size: 12px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            color: var(--vscode-foreground);
        }

        .preview-content {
            flex: 1;
            overflow: auto;
            padding: 0;
            background: var(--vscode-editor-background);
        }

        .preview-code-container {
            display: flex;
            padding: 16px 0;
        }

        .preview-line-numbers {
            padding: 0 16px;
            text-align: right;
            color: var(--vscode-editorLineNumber-foreground);
            background: var(--vscode-editor-background);
            user-select: none;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.6;
            border-right: 1px solid var(--vscode-panel-border);
        }

        .preview-code-block {
            flex: 1;
            padding: 0 16px;
            overflow-x: auto;
        }

        .preview-code-block pre {
            margin: 0;
            padding: 0;
            background: transparent !important;
            font-size: 13px;
        }

        .preview-code-block code {
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.6;
            background: transparent !important;
            display: block;
        }

        .preview-line {
            white-space: pre;
            padding: 2px 0;
        }

        .preview-line-number {
            display: block;
            padding: 2px 0;
        }

        .preview-line-number.match-line {
            background: var(--vscode-editor-lineHighlightBackground);
            font-weight: bold;
        }

        .code-line {
            white-space: pre;
            min-height: 20px;
        }

        .code-line.match-code-line {
            background: var(--vscode-editor-lineHighlightBackground);
        }

        .match-highlight {
            background: var(--vscode-editor-findMatchBackground) !important;
            border: 1px solid var(--vscode-editor-findMatchBorder);
            padding: 0 2px;
        }

        /* Override highlight.js background */
        .hljs {
            background: var(--vscode-editor-background) !important;
            color: var(--vscode-editor-foreground);
        }

        .empty-state {
            padding: 40px 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
    </style>
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
        const vscode = acquireVsCodeApi();
        const searchInput = document.getElementById('searchInput');
        const resultsHeader = document.getElementById('resultsHeader');
        const resultsList = document.getElementById('resultsList');
        const previewHeader = document.getElementById('previewHeader');
        const previewContent = document.getElementById('previewContent');

        let currentResults = [];
        let allMatches = [];
        let selectedMatchIndex = -1;
        let currentQuery = '';
        let fileContentsCache = {};
        let searchTimeout;

        // Receive messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'searchResults':
                    handleSearchResults(message.results);
                    break;
                case 'fileContent':
                    handleFileContent(message.filePath, message.content);
                    break;
            }
        });

        // Debounced search input
        searchInput.addEventListener('input', (e) => {
            const searchText = e.target.value.trim();

            if (!searchText) {
                resultsList.innerHTML = '<div class="empty-state">Start typing to search...</div>';
                resultsHeader.textContent = 'No results';
                previewContent.innerHTML = '<div class="empty-state">Select a match to preview</div>';
                previewHeader.textContent = 'No file selected';
                currentResults = [];
                allMatches = [];
                return;
            }

            currentQuery = searchText;

            // Debounce search (75ms)
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                vscode.postMessage({
                    command: 'search',
                    text: searchText
                });
            }, 75);
        });

        function handleSearchResults(results) {
            currentResults = results;
            allMatches = [];

            if (!results || results.length === 0) {
                resultsList.innerHTML = '<div class="empty-state">No results found</div>';
                resultsHeader.textContent = '0 results';
                previewContent.innerHTML = '<div class="empty-state">No results</div>';
                return;
            }

            // Flatten matches for navigation
            results.forEach(file => {
                file.matches.forEach(match => {
                    allMatches.push({
                        filePath: file.filePath,
                        relativePath: file.relativePath,
                        line: match.line,
                        text: match.text
                    });
                });
            });

            const totalMatches = allMatches.length;
            resultsHeader.textContent = \`\${totalMatches} results in \${results.length} files\`;

            let html = '';
            results.forEach((file, fileIndex) => {
                html += \`<div class="file-group">
                    <div class="file-header">
                        <span>\${file.relativePath}</span>
                    </div>\`;

                file.matches.forEach((match, matchIndex) => {
                    const highlighted = highlightText(match.text, currentQuery);
                    const matchId = allMatches.findIndex(m =>
                        m.filePath === file.filePath && m.line === match.line
                    );
                    const isSelected = matchId === 0;
                    html += \`<div class="match-item \${isSelected ? 'selected' : ''}"
                              data-match-id="\${matchId}"
                              onclick="selectMatchById(\${matchId})">
                        <span class="match-line-number">[\${match.line}]</span>
                        <span class="match-text">\${highlighted}</span>
                    </div>\`;
                });

                html += '</div>';
            });

            resultsList.innerHTML = html;

            // Auto-select first result
            if (allMatches.length > 0) {
                selectMatchById(0);
            }
        }

        function highlightText(text, query) {
            if (!query) return text;
            const index = text.toLowerCase().indexOf(query.toLowerCase());
            if (index === -1) return text;

            const before = text.substring(0, index);
            const match = text.substring(index, index + query.length);
            const after = text.substring(index + query.length);

            return \`\${before}<span class="match-highlight">\${match}</span>\${after}\`;
        }

        window.selectMatchById = function(matchId) {
            if (matchId < 0 || matchId >= allMatches.length) return;

            selectedMatchIndex = matchId;
            const match = allMatches[matchId];

            // Update selection in results list
            document.querySelectorAll('.match-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedItem = document.querySelector(\`[data-match-id="\${matchId}"]\`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
                selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            // Update preview header
            previewHeader.textContent = match.relativePath;

            // Request file content if not cached
            if (!fileContentsCache[match.filePath]) {
                vscode.postMessage({
                    command: 'getFileContent',
                    filePath: match.filePath
                });
            } else {
                displayFilePreview(match.filePath, match.line);
            }
        };

        function handleFileContent(filePath, content) {
            fileContentsCache[filePath] = content;

            // If this is the currently selected match, display it
            if (selectedMatchIndex >= 0 && allMatches[selectedMatchIndex].filePath === filePath) {
                displayFilePreview(filePath, allMatches[selectedMatchIndex].line);
            }
        }

        function displayFilePreview(filePath, lineNumber) {
            const content = fileContentsCache[filePath];
            if (!content) return;

            // Detect language from file extension
            const ext = filePath.split('.').pop().toLowerCase();
            const languageMap = {
                'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
                'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'cs': 'csharp',
                'go': 'go', 'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'swift': 'swift',
                'kt': 'kotlin', 'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json',
                'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown', 'sh': 'bash', 'sql': 'sql'
            };
            const language = languageMap[ext] || 'plaintext';

            const lines = content.split('\\n');
            const totalLines = lines.length;

            // For large files, only highlight visible portion around match
            const MAX_LINES_TO_HIGHLIGHT = 500;
            let startHighlight = 0;
            let endHighlight = totalLines;

            if (totalLines > MAX_LINES_TO_HIGHLIGHT) {
                // Highlight window around the match line
                startHighlight = Math.max(0, lineNumber - Math.floor(MAX_LINES_TO_HIGHLIGHT / 2));
                endHighlight = Math.min(totalLines, startHighlight + MAX_LINES_TO_HIGHLIGHT);
                startHighlight = Math.max(0, endHighlight - MAX_LINES_TO_HIGHLIGHT);
            }

            // Build line numbers for entire file (fast)
            let lineNumbersHtml = '';
            for (let i = 0; i < totalLines; i++) {
                const isMatchLine = (i + 1) === lineNumber;
                lineNumbersHtml += \`<div class="preview-line-number \${isMatchLine ? 'match-line' : ''}" id="line-num-\${i + 1}">\${i + 1}</div>\`;
            }

            // Build code HTML with selective highlighting
            let linesHtml = '';

            for (let i = 0; i < totalLines; i++) {
                const isMatchLine = (i + 1) === lineNumber;
                let lineHtml;

                if (i >= startHighlight && i < endHighlight) {
                    // Highlight this line
                    const line = lines[i];
                    if (hljs.getLanguage(language)) {
                        lineHtml = hljs.highlight(line, { language: language }).value;
                    } else {
                        lineHtml = hljs.highlightAuto(line).value;
                    }

                    if (isMatchLine) {
                        lineHtml = highlightText(lineHtml, currentQuery);
                    }
                } else {
                    // Plain text for far away lines
                    lineHtml = lines[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }

                linesHtml += \`<div class="code-line \${isMatchLine ? 'match-code-line' : ''}" id="code-line-\${i + 1}">\${lineHtml || '&nbsp;'}</div>\`;
            }

            previewContent.innerHTML = \`
                <div class="preview-code-container">
                    <div class="preview-line-numbers">\${lineNumbersHtml}</div>
                    <div class="preview-code-block">
                        <pre><code class="hljs">\${linesHtml}</code></pre>
                    </div>
                </div>
            \`;

            // Scroll to the highlighted line
            requestAnimationFrame(() => {
                const matchLine = document.getElementById('code-line-' + lineNumber);
                if (matchLine) {
                    matchLine.scrollIntoView({ behavior: 'instant', block: 'center' });
                }
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedMatchIndex < allMatches.length - 1) {
                    selectMatchById(selectedMatchIndex + 1);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedMatchIndex > 0) {
                    selectMatchById(selectedMatchIndex - 1);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedMatchIndex >= 0) {
                    const match = allMatches[selectedMatchIndex];
                    vscode.postMessage({
                        command: 'openFile',
                        filePath: match.filePath,
                        line: match.line
                    });
                }
            } else if (e.key === 'Escape') {
                vscode.postMessage({ command: 'close' });
            }
        });

        // Focus input on load
        searchInput.focus();
    </script>
</body>
</html>`;
}

export function deactivate() {}
