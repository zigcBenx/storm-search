import { escapeRegExp } from './util';

export type SearchPattern = {
    source: string;
    flags: string;
};

export type PatternMatch = {
    index: number;
    length: number;
};

export function createSearchPattern(query: string, isRegex: boolean): SearchPattern | null {
    if (!query) {
        return null;
    }

    try {
        const source = isRegex ? query : escapeRegExp(query);
        const flags = 'gi';
        new RegExp(source, flags);

        return {
            source,
            flags
        };
    } catch {
        return null;
    }
}

export function findPatternMatches(text: string, pattern: SearchPattern): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const expression = new RegExp(pattern.source, pattern.flags);

    let match: RegExpExecArray | null;
    while ((match = expression.exec(text)) !== null) {
        if (match[0].length === 0) {
            expression.lastIndex++;
            continue;
        }

        matches.push({
            index: match.index,
            length: match[0].length
        });
    }

    return matches;
}
