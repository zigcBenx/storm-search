# Images Directory

## Required Files

### icon.png
- **Size**: 128x128 pixels (minimum)
- **Format**: PNG
- **Purpose**: Extension icon shown in VS Code marketplace
- **Recommended**: 256x256 or 512x512 for better quality

### demo.gif
- **Format**: GIF or MP4
- **Purpose**: Demo animation showing the extension in action
- **Recommended**:
  - Show opening the search with Ctrl+Shift+F
  - Type a search query
  - Navigate with arrow keys
  - Show the file preview updating
  - Open a file with Enter
  - Keep it under 10MB

### screenshot-search.png (optional)
- **Purpose**: Screenshot of the search interface
- Shows the split panel with results and preview

### screenshot-preview.png (optional)
- **Purpose**: Screenshot highlighting the syntax highlighting feature

## Creating the Icon

You can create a simple icon using:
- Online tools: https://www.canva.com or https://www.figma.com
- Icon generators: https://icon.kitchen/
- Or use an emoji: ⚡🔍🌩️

## Recording the Demo

Use these tools to record a demo:
- **Windows**: Xbox Game Bar (Win+G)
- **Mac**: QuickTime Player or CMD+Shift+5
- **Linux**: Peek, SimpleScreenRecorder
- **All**: OBS Studio (free)

Convert to GIF using:
- https://ezgif.com/
- https://www.screentogif.com/

## Note

Until you add these files, comment out the references in package.json and README.md to avoid packaging errors.
