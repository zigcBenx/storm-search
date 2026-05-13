const assert = require('node:assert/strict');
const { createSearchPattern, findPatternMatches } = require('../out/searchPattern');

function collectMatches(text, query, isRegex) {
  const pattern = createSearchPattern(query, isRegex);
  return findPatternMatches(text, pattern).map((match) => ({
    index: match.index,
    length: match.length,
  }));
}

assert.deepEqual(
  collectMatches('Hello hello', 'hello', false),
  [
    { index: 0, length: 5 },
    { index: 6, length: 5 },
  ],
  'literal search remains case-insensitive'
);

assert.deepEqual(
  collectMatches('foo1 foo22 foo', 'foo\\d+', true),
  [
    { index: 0, length: 4 },
    { index: 5, length: 5 },
  ],
  'regex search matches dynamic patterns'
);

assert.deepEqual(
  collectMatches('foo.* foo42', 'foo.*', false),
  [
    { index: 0, length: 5 },
  ],
  'literal search escapes regex metacharacters'
);

assert.equal(
  createSearchPattern('[', true),
  null,
  'invalid regex input is treated as an unsearchable pattern'
);

assert.deepEqual(
  collectMatches('abc', '^', true),
  [],
  'zero-length regex matches are ignored to avoid infinite result loops'
);

console.log('searchPattern tests passed');
