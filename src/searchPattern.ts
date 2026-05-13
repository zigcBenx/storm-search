import { escapeRegExp } from './util';

export type SearchPattern = {
    expression: RegExp;
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
        return {
            expression: new RegExp(isRegex ? query : escapeRegExp(query), 'gi')
        };
    } catch {
        return null;
    }
}

export function findPatternMatches(text: string, pattern: SearchPattern): PatternMatch[] {
    const matches: PatternMatch[] = [];
    pattern.expression.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.expression.exec(text)) !== null) {
        if (match[0].length === 0) {
            pattern.expression.lastIndex++;
            continue;
        }

        matches.push({
            index: match.index,
            length: match[0].length
        });
    }

    return matches;
}
