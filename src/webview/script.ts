export function getClientScript(): string {
    return `
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

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'searchResults':
            handleSearchResults(message.results);
            break;
        case 'fileContent':
            handleFileContent(message.filePath, message.content, message.colorizedLines);
            break;
    }
});

searchInput.addEventListener('input', (e) => {
    const searchText = e.target.value.trim();

    if (!searchText) {
        clearResults();
        return;
    }

    currentQuery = searchText;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        vscode.postMessage({ command: 'search', text: searchText });
    }, 75);
});

function clearResults() {
    resultsList.innerHTML = '<div class="empty-state">Start typing to search...</div>';
    resultsHeader.textContent = 'No results';
    previewContent.innerHTML = '<div class="empty-state">Select a match to preview</div>';
    previewHeader.textContent = 'No file selected';
    currentResults = [];
    allMatches = [];
}

function handleSearchResults(results) {
    currentResults = results;
    allMatches = [];

    if (!results || results.length === 0) {
        resultsList.innerHTML = '<div class="empty-state">No results found</div>';
        resultsHeader.textContent = '0 results';
        previewContent.innerHTML = '<div class="empty-state">No results</div>';
        return;
    }

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

    renderResults(results);

    if (allMatches.length > 0) {
        selectMatchById(0);
    }
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const name = fileName.toLowerCase();

    // Icon configuration with colors and labels
    const iconMap = {
        // Special files
        'package.json': { label: 'PKG', color: '#e8274b' },
        'tsconfig.json': { label: 'TS', color: '#519aba' },
        '.gitignore': { label: 'GIT', color: '#41535b' },
        'dockerfile': { label: 'DOK', color: '#519aba' },
        'readme.md': { label: 'MD', color: '#519aba' },

        // Extensions
        'ts': { label: 'TS', color: '#519aba' },
        'tsx': { label: 'TSX', color: '#519aba' },
        'js': { label: 'JS', color: '#cbcb41' },
        'jsx': { label: 'JSX', color: '#61dafb' },
        'json': { label: 'JSON', color: '#cbcb41' },
        'md': { label: 'MD', color: '#519aba' },
        'py': { label: 'PY', color: '#3776ab' },
        'java': { label: 'JAVA', color: '#cc3e44' },
        'css': { label: 'CSS', color: '#519aba' },
        'scss': { label: 'SCSS', color: '#f55385' },
        'html': { label: 'HTML', color: '#e37933' },
        'xml': { label: 'XML', color: '#e37933' },
        'sql': { label: 'SQL', color: '#f55385' },
        'sh': { label: 'SH', color: '#4d5a5e' },
        'yaml': { label: 'YML', color: '#cbcb41' },
        'yml': { label: 'YML', color: '#cbcb41' },
        'txt': { label: 'TXT', color: '#858585' },
        'log': { label: 'LOG', color: '#858585' },
        'php': { label: 'PHP', color: '#a074c4' },
        'rb': { label: 'RB', color: '#cc3e44' },
        'go': { label: 'GO', color: '#519aba' },
        'rs': { label: 'RS', color: '#e37933' },
        'c': { label: 'C', color: '#519aba' },
        'cpp': { label: 'CPP', color: '#519aba' },
        'h': { label: 'H', color: '#a074c4' },
        'vue': { label: 'VUE', color: '#42b883' },
        'svelte': { label: 'SVL', color: '#ff3e00' }
    };

    const icon = iconMap[name] || iconMap[ext] || { label: 'FILE', color: '#858585' };

    // Create SVG icon
    const svg = \`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="\${icon.color}" stroke-width="1"/>
        <text x="8" y="11.5" font-family="Arial, sans-serif" font-size="6" font-weight="bold" text-anchor="middle" fill="\${icon.color}">\${icon.label}</text>
    </svg>\`;

    return 'data:image/svg+xml;base64,' + btoa(svg);
}

function renderResults(results) {
    const totalMatches = allMatches.length;
    resultsHeader.textContent = \`\${totalMatches} results in \${results.length} files\`;

    let html = '';
    results.forEach(file => {
        const fileName = file.relativePath.split('/').pop() || file.relativePath;
        const iconSrc = getFileIcon(fileName);

        html += \`<div class="file-group">
            <div class="file-header" title="\${escapeHtml(file.relativePath)}">
                <img src="\${iconSrc}" class="file-icon" alt="">
                <span class="file-name">\${escapeHtml(fileName)}</span>
            </div>\`;

        file.matches.forEach(match => {
            const highlighted = highlightText(match.text, currentQuery);
            const matchId = allMatches.findIndex(m =>
                m.filePath === file.filePath && m.line === match.line
            );
            html += \`<div class="match-item" data-match-id="\${matchId}" onclick="selectMatchById(\${matchId})">
                <span class="match-line-number">[\${match.line}]</span>
                <span class="match-text">\${highlighted}</span>
            </div>\`;
        });

        html += '</div>';
    });

    resultsList.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightText(text, query) {
    if (!query) return escapeHtml(text);

    const escapedText = escapeHtml(text);
    const index = text.toLowerCase().indexOf(query.toLowerCase());

    if (index === -1) return escapedText;

    const before = escapeHtml(text.substring(0, index));
    const match = escapeHtml(text.substring(index, index + query.length));
    const after = escapeHtml(text.substring(index + query.length));

    return \`\${before}<span class="match-highlight">\${match}</span>\${after}\`;
}

window.selectMatchById = function(matchId) {
    if (matchId < 0 || matchId >= allMatches.length) return;

    selectedMatchIndex = matchId;
    const match = allMatches[matchId];

    document.querySelectorAll('.match-item').forEach(item => {
        item.classList.remove('selected');
    });

    const selectedItem = document.querySelector(\`[data-match-id="\${matchId}"]\`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    previewHeader.textContent = match.relativePath;

    if (!fileContentsCache[match.filePath]) {
        vscode.postMessage({
            command: 'getFileContent',
            filePath: match.filePath
        });
    } else {
        displayFilePreview(match.filePath, match.line);
    }
};

function handleFileContent(filePath, content, colorizedLines) {
    fileContentsCache[filePath] = {
        content: content,
        colorizedLines: colorizedLines || null
    };

    if (selectedMatchIndex >= 0 && allMatches[selectedMatchIndex].filePath === filePath) {
        displayFilePreview(filePath, allMatches[selectedMatchIndex].line);
    }
}

function getLanguageFromExtension(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const languageMap = {
        'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
        'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'cs': 'csharp',
        'go': 'go', 'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'swift': 'swift',
        'kt': 'kotlin', 'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json',
        'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown', 'sh': 'bash', 'sql': 'sql'
    };
    return languageMap[ext] || 'plaintext';
}

function displayFilePreview(filePath, lineNumber) {
    const cached = fileContentsCache[filePath];
    if (!cached) return;

    const lines = cached.content.split('\\n');
    const colorizedLines = cached.colorizedLines;
    const totalLines = lines.length;

    let lineNumbersHtml = '';
    let linesHtml = '';

    for (let i = 0; i < totalLines; i++) {
        const isMatchLine = (i + 1) === lineNumber;
        lineNumbersHtml += \`<div class="preview-line-number \${isMatchLine ? 'match-line' : ''}" id="line-num-\${i + 1}">\${i + 1}</div>\`;

        let lineContent;
        if (colorizedLines && colorizedLines[i]) {
            // Use syntax-highlighted version from Shiki
            lineContent = colorizedLines[i];

            // Add search query highlighting on top of syntax highlighting
            if (isMatchLine) {
                lineContent = addSearchHighlightToColorizedLine(lineContent, lines[i], currentQuery);
            }
        } else {
            // Fallback to plain highlighting
            if (isMatchLine) {
                lineContent = highlightSearchQuery(lines[i], currentQuery);
            } else {
                lineContent = lines[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
        }

        linesHtml += \`<div class="code-line \${isMatchLine ? 'match-code-line' : ''}" id="code-line-\${i + 1}">\${lineContent || '&nbsp;'}</div>\`;
    }

    previewContent.innerHTML = \`
        <div class="preview-code-container">
            <div class="preview-line-numbers">\${lineNumbersHtml}</div>
            <div class="preview-code-block">
                <pre><code>\${linesHtml}</code></pre>
            </div>
        </div>
    \`;

    requestAnimationFrame(() => {
        const matchLineElement = document.getElementById('code-line-' + lineNumber);
        if (matchLineElement) {
            matchLineElement.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
    });
}

function highlightSearchQuery(text, query) {
    if (!query) {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const before = text.substring(0, index).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const match = text.substring(index, index + query.length).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const after = text.substring(index + query.length).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return \`\${before}<span class="match-highlight">\${match}</span>\${after}\`;
}

function addSearchHighlightToColorizedLine(colorizedHtml, plainText, query) {
    if (!query) return colorizedHtml;

    const index = plainText.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return colorizedHtml;

    // Create a temporary div to work with the HTML
    const temp = document.createElement('div');
    temp.innerHTML = colorizedHtml;

    // Get the text content and find the position
    const textContent = temp.textContent || '';
    const matchIndex = textContent.toLowerCase().indexOf(query.toLowerCase());

    if (matchIndex === -1) return colorizedHtml;

    // Walk through the nodes and wrap the matching text
    let currentPos = 0;
    const matchEnd = matchIndex + query.length;

    function wrapTextNodes(node) {
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

                node.parentNode.replaceChild(fragment, node);
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

searchInput.focus();
`;
}
