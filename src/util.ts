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