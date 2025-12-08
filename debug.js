import fs from 'fs';

const HEADING_KEY_PATTERN = /^(#{1,6})\s*([^!].*)$/;

const content = fs.readFileSync('src/tests/fixtures/planets.md', 'utf-8');
const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const lines = normalizedContent.split('\n');

console.log('Testing HEADING_KEY_PATTERN:');
lines.forEach((line, i) => {
  const match = line.match(HEADING_KEY_PATTERN);
  if (match) {
    console.log(`Line ${i+1}: HEADING KEY:`, match[2]);
  }
});
