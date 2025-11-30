# Storm Search

> PhpStorm-inspired global search for VS Code with split-panel preview and syntax highlighting

[Install on the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Benxlabs.storm-search)

[![OpenPledge](https://raw.githubusercontent.com/zigcBenx/weather-app/ff8ab3b35353253e3c65d2bd9f926fcf229f92c1/ablblbl(4).svg)](https://app.openpledge.io/repositories/zigcBenx/storm-search)

![Demo](images/demo.gif)

## Features

### Split Panel Interface
Inspired by PhpStorm's search experience, this extension provides a dual-panel view:
- **Left Panel**: Search results grouped by file
- **Right Panel**: Full file preview with syntax highlighting
- Preview files before opening them

### Keyboard-First Workflow
- `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac) - Open search (customizable)
- `↑` / `↓` - Navigate through results (works while typing!)
- `Enter` - Open file and close search
- `Ctrl+Enter` / `Cmd+Enter` - Open in new tab, keep search open
- `Shift+Enter` - Open in split view, keep search open
- `Esc` - Close search
- Start typing anywhere to focus search input

### Advanced Interaction
- **Double-click** - Open file and close search
- **Ctrl+Double-click** / **Cmd+Double-click** - Open in new tab, keep search open
- **Shift+Double-click** - Open in split view, keep search open
- **Context Menu** - Right-click folders in Explorer to search within that directory
- **Selected Text** - Automatically pre-fills search with selected text when opening

### Smart Search Features
- **File Mask Filter** - Filter by file types (e.g., `*.ts, *.js`)
- **Directory Scope** - Search within specific folders (supports comma-separated paths)
- **Respect VS Code Settings** - Uses your `files.exclude` and `search.exclude` settings
- Live file preview with syntax highlighting while browsing results
- Match highlighting in both result list and preview
- File icons from your current VS Code theme
- File size limits to handle large codebases
- Debounced search for responsive typing experience

## Screenshot

![File Preview with Highlighting](images/screenshot-preview.png)

## Installation

![How to Install](images/how-to-install.gif)

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Benxlabs.storm-search) or search for "Storm Search" in the VS Code extensions panel.

## Usage

### Basic Search
1. Press `Ctrl+Shift+F` (Windows/Linux) or `Cmd+Shift+F` (Mac)
2. Type your search query
3. Use arrow keys to navigate results (even while typing!)
4. Press `Enter` to open the file at the exact match location
5. Press `Esc` to close

### Advanced Features

**File Type Filtering:**
- Click the filter icon (🔽) next to the search input
- Enter file patterns like `*.ts, *.js` to search only in specific file types
- Combine with directory scoping for precise searches

**Directory Scoping:**
- Click "Directory" scope button
- Enter folder paths separated by commas (e.g., `src, tests`)
- Or use the folder browse button to select a directory
- Or right-click a folder in Explorer and select "Storm Search: Search in Folder"

**Opening Files:**
- `Enter` - Open and close search
- `Ctrl+Enter` / `Cmd+Enter` - Open in new tab, keep search open
- `Shift+Enter` - Open in split view, keep search open
- Same modifiers work with double-click!

**Keyboard Navigation:**
- Arrow keys work while typing in search input
- Start typing anywhere to automatically focus the search box
- Navigate and open files without touching the mouse

The search respects your VS Code `files.exclude` and `search.exclude` settings.


## Support

*Support this project by pledging to issues on [OpenPledge](https://app.openpledge.io/repositories/zigcBenx/storm-search) - fund features and bug fixes you care about*
