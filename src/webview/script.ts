/// <reference lib="dom" />

import { FileSearchResult, SearchMatch, WebviewMessage } from "../types";


type SearchMatchWithId = SearchMatch & { matchId: number, icon?: FileSearchResult['icon'] };

// Script run within the webview itself.
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const postMessage = (message: WebviewMessage) => {
        vscode.postMessage(message);
    };

    const searchInput = document.getElementById('searchInput')!;
    const resultsHeader = document.getElementById('resultsHeader')!;
    const resultsList = document.getElementById('resultsList')!;
    const previewHeader = document.getElementById('previewHeader')!;
    const previewContent = document.getElementById('previewContent')!;

    let allMatches: SearchMatchWithId[] = [];
    let allFiles: Set<string> = new Set();

    let selectedMatchIndex = -1;
    let currentQuery = '';
    let fileContentsCache: {
        [key: string]: {
            content: string;
            colorizedLines: string[] | null;
        }
    } = {};
    let searchTimeout: any = null;

    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.command) {
            case 'newSearchResults':
                handleNewSearchResults(message.results);
                break;
            case 'extendSearchResults':
                handleExtendSearchResults(message.results);
                break;
            case 'noResults':
                handleNoResults();
                break;
            case 'fileContent':
                handleFileContent(message.filePath, message.content, message.colorizedLines);
                break;
            case 'clearCache':
                handleClearCache(message.filePath);
                break;
        }
    });

    searchInput.addEventListener('input', (event) => {
        if (!event.target) return;
        const searchText = (event.target as HTMLInputElement).value.trim();

        if (!searchText) {
            clearResults();
            return;
        }

        currentQuery = searchText;
        clearTimeout(searchTimeout);

        // Ensure a longer delay for short queries as they are more likely to change
        const timeoutDelay = searchText.length < 3 ? 500 : 75;
        searchTimeout = setTimeout(() => {
            postMessage({ command: 'search', text: searchText });
        }, timeoutDelay);
    });

    let scrollDebounce: any = null;
    resultsList.addEventListener('scroll', () => {
        if (scrollDebounce) {
            return;
        }
        const scrollPosition = resultsList.scrollTop + resultsList.clientHeight;
        const threshold = resultsList.scrollHeight - 20;

        if (scrollPosition >= threshold) {
            scrollDebounce = setTimeout(() => {
                scrollDebounce = null;
            }, 500);
            const currentlyRenderedCount = resultsList.querySelectorAll('.match-item').length;
            renderMatches(currentlyRenderedCount + 100, true);
        }
    });

    function clearResults() {
        resultsList.innerHTML = '<div class="empty-state">Start typing to search...</div>';
        resultsHeader.textContent = 'No results';
        previewContent.innerHTML = '<div class="empty-state">Select a match to preview</div>';
        previewHeader.textContent = 'No file selected';
        allMatches = [];
        allFiles = new Set();
    }

    function handleNewSearchResults(results: FileSearchResult[]) {
        allMatches = [];
        allFiles = new Set();

        results.forEach((result) => {
            result.matches.forEach((match) => {
                allMatches.push({
                    matchId: allMatches.length,
                    filePath: result.filePath,
                    relativePath: result.relativePath,
                    line: match.line,
                    column: match.column,
                    preview: match.preview,
                    previewColumn: match.previewColumn,
                    icon: result.icon
                });
            });
        });

        renderMatches(100);

        if (allMatches.length > 0) {
            selectMatchById(0);
        }
    }

    function handleExtendSearchResults(results: FileSearchResult[]) {
        const newMatches: SearchMatchWithId[] = [];
        results.forEach((result) => {
            allFiles.add(result.filePath);
            result.matches.forEach((match) => {
                newMatches.push({
                    matchId: allMatches.length,
                    filePath: result.filePath,
                    relativePath: result.relativePath,
                    line: match.line,
                    column: match.column,
                    preview: match.preview,
                    previewColumn: match.previewColumn,
                    icon: result.icon
                });
            });
        });
        allMatches = allMatches.concat(newMatches);

        renderMatches(100, true);
    }

    function handleNoResults() {
        resultsList.innerHTML = '<div class="empty-state">No results found</div>';
        resultsHeader.textContent = '0 results';
        previewContent.innerHTML = '<div class="empty-state">No results</div>';
    }

    function renderMatches(upTo: number, append: boolean = false) {
        let currentFile = '';
        let html = '';

        // Ensure that header is updated with total counts even if rendering is stopped early
        resultsHeader.textContent = `${allMatches.length} results in ${allFiles.size} files`;

        const currentlyRenderedCount = append ? resultsList.querySelectorAll('.match-item').length : 0;
        if (append && currentlyRenderedCount >= upTo) {
            return
        }

        for (let i = 0; i < allMatches.length - currentlyRenderedCount; i++) {
            const match = allMatches[currentlyRenderedCount + i];

            const fileName = match.relativePath.split('/').pop() || match.relativePath;
            const isNewFile = match.relativePath !== currentFile;

            if (isNewFile) {
                if (i > 0) {
                    html += '</div>'; // Close previous file-group
                }

                // Limit number of rendered matches per batch with a soft-cap,
                // because we want to avoid splitting files across batches.
                if (currentlyRenderedCount + i >= upTo) {
                    break;
                }

                currentFile = match.relativePath;
                html += `<div class="file-group">
                <div class="file-header" title="${escapeHtml(match.relativePath)}">
                `

                if (match.icon) {
                    if (match.icon.svgPath) {
                        html += `<img src="${match.icon.svgPath}" class="file-icon" alt="">`
                    } else if (match.icon.fontCharacter) {
                        const fontChar = String.fromCharCode(parseInt(match.icon.fontCharacter.substring(1), 16))

                        html += `<div class="file-icon icon-font-${match.icon.fontId}" style="color: ${match.icon.fontColor};">${fontChar}</div>`
                    }
                } else {
                    html += `<img src="" class="file-icon" alt="">`
                }
                html += `
                    <span class="file-name">${escapeHtml(fileName)}</span>
                </div>`;
            }
            const highlighted = highlightText(match.preview, currentQuery, match.previewColumn);
            html += `<div class="match-item" data-match-id="${match.matchId}" onclick="selectMatchById(${match.matchId})">
                <span class="match-line-number">[${match.line}]</span>
                <span class="match-text">${highlighted}</span>
            </div>`;
        }


        if (append) {
            resultsList.innerHTML += html;
        } else {
            resultsList.innerHTML = html;
        }
    }

    const textEscaper = document.createElement('div');
    function escapeHtml(text: string): string {
        textEscaper.textContent = text;
        return textEscaper.innerHTML;
    }

    function highlightText(text: string, query: string, column: number): string {
        if (!query) return escapeHtml(text);

        const escapedText = escapeHtml(text);
        const index = text.toLowerCase().indexOf(query.toLowerCase(), column);

        if (index === -1) return escapedText;

        const before = escapeHtml(text.substring(0, index));
        const match = escapeHtml(text.substring(index, index + query.length));
        const after = escapeHtml(text.substring(index + query.length));

        return `${before}<span class="match-highlight">${match}</span>${after}`;
    }

    function selectMatchById(matchId: number) {
        if (matchId < 0 || matchId >= allMatches.length) return;

        selectedMatchIndex = matchId;
        const match = allMatches[matchId];

        document.querySelectorAll('.match-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        const selectedItem = document.querySelector(`[data-match-id="${matchId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        previewHeader.textContent = match.relativePath;

        if (!fileContentsCache[match.filePath]) {
            postMessage({
                command: 'getFileContent',
                filePath: match.filePath
            });
        } else {
            displayFilePreview(match.filePath, match.line, match.column);
        }
    };
    // Make available globally for onclick handlers
    // @ts-ignore
    window.selectMatchById = selectMatchById;

    function handleFileContent(filePath: string, content: string, colorizedLines: string[] | null) {
        fileContentsCache[filePath] = {
            content: content,
            colorizedLines: colorizedLines || null
        };

        if (selectedMatchIndex >= 0 && allMatches[selectedMatchIndex].filePath === filePath) {
            displayFilePreview(filePath, allMatches[selectedMatchIndex].line, allMatches[selectedMatchIndex].column);
        }
    }

    function handleClearCache(filePath: string) {
        if (fileContentsCache[filePath]) {
            delete fileContentsCache[filePath];
        }
    }

    function displayFilePreview(filePath: string, lineNumber: number, columnNumber: number) {
        const cached = fileContentsCache[filePath];
        if (!cached) return;

        const lines = cached.content.split('\n');
        const colorizedLines = cached.colorizedLines;
        const totalLines = lines.length;

        let lineNumbersHtml = '';
        let linesHtml = '';

        for (let i = 0; i < totalLines; i++) {
            const isMatchLine = (i + 1) === lineNumber;
            lineNumbersHtml += `<div class="preview-line-number ${isMatchLine ? 'match-line' : ''}" id="line-num-${i + 1}">${i + 1}</div>`;

            let lineContent;
            if (colorizedLines && colorizedLines[i]) {
                // Use syntax-highlighted version from Shiki
                lineContent = colorizedLines[i];

                // Add search query highlighting on top of syntax highlighting
                if (isMatchLine) {
                    lineContent = addSearchHighlightToColorizedLine(lineContent, lines[i], currentQuery, columnNumber);
                }
            } else {
                // Fallback to plain highlighting
                if (isMatchLine) {
                    lineContent = highlightSearchQuery(lines[i], currentQuery, columnNumber);
                } else {
                    lineContent = lines[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }
            }

            linesHtml += `<div class="code-line ${isMatchLine ? 'match-code-line' : ''}" id="code-line-${i + 1}">${lineContent || '&nbsp;'}</div>`;
        }

        previewContent.innerHTML = `
        <div class="preview-code-container">
            <div class="preview-line-numbers" id="previewLineNumbers">${lineNumbersHtml}</div>
            <div class="preview-code-block">
                <pre><code>${linesHtml}</code></pre>
            </div>
        </div>
    `;

        requestAnimationFrame(() => {
            // Adjust line numbers to account for wrapped lines
            adjustLineNumbersForWrapping(totalLines);

            const matchLineElement = document.getElementById('code-line-' + lineNumber);
            if (matchLineElement) {
                matchLineElement.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
        });
    }

    function adjustLineNumbersForWrapping(totalLines: number) {
        const lineNumbersContainer = document.getElementById('previewLineNumbers');
        if (!lineNumbersContainer) return;

        for (let i = 1; i <= totalLines; i++) {
            const lineNumElement = document.getElementById('line-num-' + i);
            const codeLineElement = document.getElementById('code-line-' + i);

            if (!lineNumElement || !codeLineElement) continue;

            const codeLineHeight = codeLineElement.offsetHeight;
            const singleLineHeight = parseFloat(getComputedStyle(codeLineElement).lineHeight);

            // If the code line wraps (height is more than one line)
            if (codeLineHeight > singleLineHeight * 1.2) {
                lineNumElement.style.height = codeLineHeight + 'px';
                lineNumElement.style.display = 'flex';
                lineNumElement.style.alignItems = 'flex-start';
                lineNumElement.style.justifyContent = 'flex-end';

                // Keep the line number at the top
                const lineNumText = lineNumElement.textContent;
                lineNumElement.textContent = lineNumText;
            }
        }
    }

    function highlightSearchQuery(text: string, query: string, columnNumber: number): string {
        if (!query) {
            return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        const index = text.toLowerCase().indexOf(query.toLowerCase(), columnNumber);
        if (index === -1) {
            return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        const before = text.substring(0, index).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const match = text.substring(index, index + query.length).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const after = text.substring(index + query.length).replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return `${before}<span class="match-highlight">${match}</span>${after}`;
    }

    function addSearchHighlightToColorizedLine(colorizedHtml: string, plainText: string, query: string, columnNumber: number): string {
        if (!query) return colorizedHtml;

        const index = plainText.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return colorizedHtml;

        // Create a temporary div to work with the HTML
        const temp = document.createElement('div');
        temp.innerHTML = colorizedHtml;

        // Get the text content and find the position
        const textContent = temp.textContent || '';
        const matchIndex = textContent.toLowerCase().indexOf(query.toLowerCase(), columnNumber);

        if (matchIndex === -1) return colorizedHtml;

        // Walk through the nodes and wrap the matching text
        let currentPos = 0;
        const matchEnd = matchIndex + query.length;

        function wrapTextNodes(node: Node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nodeText = node.textContent || '';
                const nodeStart = currentPos;
                const nodeEnd = currentPos + nodeText.length;

                // Check if this text node contains part of the match
                if (nodeEnd > matchIndex && nodeStart < matchEnd) {
                    const matchStartInNode = Math.max(0, matchIndex - nodeStart);
                    const matchEndInNode = Math.min(nodeText.length, matchEnd - nodeStart);

                    const before = nodeText.substring(0, matchStartInNode);
                    const match = nodeText.substring(matchStartInNode, matchEndInNode);
                    const after = nodeText.substring(matchEndInNode);

                    const span = document.createElement('span');
                    span.className = 'match-highlight';
                    span.textContent = match;

                    const fragment = document.createDocumentFragment();
                    if (before) fragment.appendChild(document.createTextNode(before));
                    fragment.appendChild(span);
                    if (after) fragment.appendChild(document.createTextNode(after));

                    if (node.parentNode) {
                        node.parentNode.replaceChild(fragment, node);
                    }
                }

                currentPos += nodeText.length;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Process child nodes
                const children = Array.from(node.childNodes);
                children.forEach(child => wrapTextNodes(child));
            }
        }

        wrapTextNodes(temp);
        return temp.innerHTML;
    }

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
                postMessage({
                    command: 'openFile',
                    filePath: match.filePath,
                    line: match.line,
                    column: match.column,
                });
            }
        } else if (e.key === 'Escape') {
            postMessage({ command: 'close' });
        }
    });

    searchInput.focus();
}());