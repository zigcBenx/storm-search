export function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Simple glob pattern matcher for file paths
 * Supports * (match anything except /) and ** (match anything including /)
 */
export function matchGlob(pattern: string, path: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .split('/')
    .map((segment) => {
      if (segment === '**') {
        // ** matches any number of directories
        return '.*';
      } else {
        // Escape special regex chars except * and ?
        let escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        // Replace glob wildcards with regex equivalents
        escaped = escaped.replace(/\*/g, '[^/]*');
        escaped = escaped.replace(/\?/g, '[^/]');
        return escaped;
      }
    })
    .join('/');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export interface GitIgnoreRule {
  pattern: string;
  negated: boolean;
  directoryOnly: boolean;
  anchored: boolean;
  hasSlash: boolean;
}

export function parseGitIgnore(content: string): GitIgnoreRule[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      let pattern = line;
      const negated = pattern.startsWith('!');
      if (negated) {
        pattern = pattern.slice(1).trim();
      }

      if (pattern.startsWith('\\#') || pattern.startsWith('\\!')) {
        pattern = pattern.slice(1);
      }

      const anchored = pattern.startsWith('/');
      const directoryOnly = pattern.endsWith('/');
      pattern = pattern.replace(/^\/+/, '').replace(/\/+$/, '');

      return {
        pattern,
        negated,
        directoryOnly,
        anchored,
        hasSlash: pattern.includes('/')
      };
    })
    .filter((rule) => rule.pattern.length > 0);
}

export function isPathIgnoredByGitIgnore(path: string, rules: GitIgnoreRule[]): boolean {
  const normalizedPath = normalizePath(path);
  let ignored = false;

  for (const rule of rules) {
    if (matchesGitIgnoreRule(normalizedPath, rule)) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}

function matchesGitIgnoreRule(path: string, rule: GitIgnoreRule): boolean {
  if (rule.anchored || rule.hasSlash) {
    const candidates = rule.directoryOnly
      ? getDirectoryPrefixes(path)
      : [path, ...getDirectoryPrefixes(path)];

    return candidates.some((candidate) => matchGitIgnoreGlob(rule.pattern, candidate));
  }

  if (!rule.directoryOnly) {
    return path
      .split('/')
      .some((segment) => matchGitIgnoreGlob(rule.pattern, segment));
  }

  return getDirectoryPrefixes(path)
    .flatMap((directory) => directory.split('/'))
    .some((segment) => matchGitIgnoreGlob(rule.pattern, segment));
}

function getDirectoryPrefixes(path: string): string[] {
  const segments = path.split('/');
  const directories: string[] = [];

  for (let index = 1; index < segments.length; index++) {
    directories.push(segments.slice(0, index).join('/'));
  }

  return directories;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function matchGitIgnoreGlob(pattern: string, path: string): boolean {
  const regex = new RegExp(`^${globToRegex(pattern)}$`);
  return regex.test(path);
}

function globToRegex(pattern: string): string {
  let regex = '';

  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];

    if (char === '*' && nextChar === '*') {
      regex += '.*';
      index++;
    } else if (char === '*') {
      regex += '[^/]*';
    } else if (char === '?') {
      regex += '[^/]';
    } else {
      regex += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  return regex;
}
