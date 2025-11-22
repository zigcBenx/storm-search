# ⚡ Storm Search

> Lightning-fast PhpStorm-style global search for VS Code with split-panel preview and syntax highlighting

![Demo](images/demo.gif)

## ✨ Features

### 🚀 Blazing Fast Search
Search across your entire workspace in milliseconds with smart exclusions for build folders and dependencies.

### 📱 Split Panel Interface
- **Left Panel**: All search results grouped by file
- **Right Panel**: Full file preview with syntax highlighting
- See your code before you open it!

### ⌨️ Keyboard-First Workflow
- `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac) - Open search
- `↑` / `↓` - Navigate through results
- `Enter` - Open file at matched line
- `Esc` - Close search

### 🧠 Smart Features
- **Auto-excludes** node_modules, .git, build folders, and other noise
- **Instant preview** - See full file content while browsing results
- **Match highlighting** - Your search term is highlighted in both panels
- **File size limits** - Skips large files for optimal performance
- **Debounced search** - Results appear as you type with intelligent throttling

## 📸 Screenshot

![File Preview with Highlighting](images/screenshot-preview.png)

## 🎯 Usage

1. Press `Ctrl+Shift+F` (Windows/Linux) or `Cmd+Shift+F` (Mac)
2. Type your search query
3. Use arrow keys to navigate results
4. Press `Enter` to open the file at the exact match location
5. Press `Esc` to close

**Pro Tip:** The search automatically ignores common build folders like `node_modules`, `.next`, `dist`, etc.