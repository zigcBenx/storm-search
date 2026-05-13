import fs from 'fs';

export function stripJsonComments(json: string): string {
    let result = '';
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < json.length; i++) {
        const current = json[i];
        const next = json[i + 1];

        if (inString) {
            result += current;
            if (isEscaped) {
                isEscaped = false;
            } else if (current === '\\') {
                isEscaped = true;
            } else if (current === '"') {
                inString = false;
            }
            continue;
        }

        if (current === '"') {
            inString = true;
            result += current;
            continue;
        }

        if (current === '/' && next === '/') {
            while (i < json.length && json[i] !== '\n') {
                i++;
            }
            result += '\n';
            continue;
        }

        if (current === '/' && next === '*') {
            i += 2;
            while (i < json.length && !(json[i] === '*' && json[i + 1] === '/')) {
                i++;
            }
            i++;
            continue;
        }

        result += current;
    }

    return result;
}

export function removeTrailingCommas(json: string): string {
    return json.replace(/,\s*([}\]])/g, '$1');
}

export function loadThemeFile(themePath: string): any {
    try {
        return require(themePath);
    } catch {
        const themeContent = fs.readFileSync(themePath, 'utf8');
        return JSON.parse(removeTrailingCommas(stripJsonComments(themeContent)));
    }
}
