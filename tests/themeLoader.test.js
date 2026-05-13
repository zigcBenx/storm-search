const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadThemeFile } = require('../out/themeLoader');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storm-search-theme-'));
const themePath = path.join(dir, 'theme.jsonc');
fs.writeFileSync(themePath, `{
  // JSONC comments are valid in VS Code theme files.
  "name": "Commented Theme",
  "colors": {
    "editor.foreground": "#eeeeee",
    "editor.background": "#101010",
  },
  "tokenColors": [
    {
      "scope": "keyword",
      "settings": {
        "foreground": "#ff00ff",
      },
    },
  ],
}`);

const theme = loadThemeFile(themePath);

assert.equal(theme.name, 'Commented Theme');
assert.equal(theme.colors['editor.foreground'], '#eeeeee');
assert.equal(theme.tokenColors[0].settings.foreground, '#ff00ff');

fs.rmSync(dir, { recursive: true, force: true });
console.log('themeLoader tests passed');
