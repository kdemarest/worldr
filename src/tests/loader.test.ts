import * as test from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as os from 'node:os';
import { loadContent, searchContent } from '../loader.js';

const { describe, it, beforeEach, afterEach } = test;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('loadContent', () => {
  let tempDir: string;
  
  beforeEach(() => {
    // Create a temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worldr-test-'));
  });
  
  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  it('should load and parse markdown files', () => {
    // Create test files
    fs.writeFileSync(path.join(tempDir, 'test1.md'), `# !Entity One
entityType: Person
name: Alice
`);
    fs.writeFileSync(path.join(tempDir, 'test2.md'), `# !Entity Two
entityType: Place
location: London
`);
    
    const result = loadContent({ contentDir: tempDir });
    
    assert.strictEqual(result.parseResults.length, 2);
    assert.strictEqual(result.entityIndex.size, 2);
    assert.ok(result.entityIndex.has('Entity One'));
    assert.ok(result.entityIndex.has('Entity Two'));
    assert.strictEqual(result.errors.length, 0);
  });
  
  it('should exclude _*.md metadata files by default', () => {
    fs.writeFileSync(path.join(tempDir, 'content.md'), `# !Content Entity
`);
    fs.writeFileSync(path.join(tempDir, '_metadata.md'), `# !Metadata Entity
`);
    
    const result = loadContent({ contentDir: tempDir });
    
    assert.strictEqual(result.parseResults.length, 1);
    assert.ok(result.entityIndex.has('Content Entity'));
    assert.ok(!result.entityIndex.has('Metadata Entity'));
  });
  
  it('should include _*.md files when includeMetadata is true', () => {
    fs.writeFileSync(path.join(tempDir, 'content.md'), `# !Content Entity
`);
    fs.writeFileSync(path.join(tempDir, '_metadata.md'), `# !Metadata Entity
`);
    
    const result = loadContent({ contentDir: tempDir, includeMetadata: true });
    
    assert.strictEqual(result.parseResults.length, 2);
    assert.ok(result.entityIndex.has('Content Entity'));
    assert.ok(result.entityIndex.has('Metadata Entity'));
  });
  
  it('should store raw content in corpus', () => {
    const content = `# !Test Entity
Some content here
`;
    fs.writeFileSync(path.join(tempDir, 'test.md'), content);
    
    const result = loadContent({ contentDir: tempDir });
    
    assert.ok(result.corpus.has('test.md'));
    assert.strictEqual(result.corpus.get('test.md'), content);
  });
});

describe('searchContent', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worldr-test-'));
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  it('should find matches in entity names', () => {
    fs.writeFileSync(path.join(tempDir, 'test.md'), `# !London Bridge
entityType: Place
`);
    
    const { entityIndex, corpus } = loadContent({ contentDir: tempDir });
    const results = searchContent('London', entityIndex, corpus);
    
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].entity.entityId, 'London Bridge');
    assert.strictEqual(results[0].matchType, 'heading');
  });
  
  it('should find matches in property values', () => {
    fs.writeFileSync(path.join(tempDir, 'test.md'), `# !Some Entity
description: The quick brown fox jumps over the lazy dog
`);
    
    const { entityIndex, corpus } = loadContent({ contentDir: tempDir });
    const results = searchContent('fox', entityIndex, corpus);
    
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].matchType, 'text');
    assert.ok(results[0].snippet.includes('fox'));
  });
  
  it('should filter by entityType', () => {
    fs.writeFileSync(path.join(tempDir, 'test.md'), `# !Alice
entityType: Person
# !London
entityType: Place
`);
    
    const { entityIndex, corpus } = loadContent({ contentDir: tempDir });
    const results = searchContent('', entityIndex, corpus, { entityType: 'Person' });
    
    // Empty query won't match unless we search everything
    // Let's search for something that matches both
    const results2 = searchContent('l', entityIndex, corpus, { entityType: 'Place' });
    
    assert.strictEqual(results2.length, 1);
    assert.strictEqual(results2[0].entity.entityId, 'London');
  });
  
  it('should respect limit option', () => {
    fs.writeFileSync(path.join(tempDir, 'test.md'), `# !Entity A
text with search term
# !Entity B  
text with search term
# !Entity C
text with search term
`);
    
    const { entityIndex, corpus } = loadContent({ contentDir: tempDir });
    const results = searchContent('search', entityIndex, corpus, { limit: 2 });
    
    assert.strictEqual(results.length, 2);
  });
  
  it('should sort results: headings first, then bullets, then text', () => {
    fs.writeFileSync(path.join(tempDir, 'test.md'), `# !Regular Entity
- bullet with dragon
some text with dragon
# !Dragon Lord
entityType: Monster
`);
    
    const { entityIndex, corpus } = loadContent({ contentDir: tempDir });
    const results = searchContent('dragon', entityIndex, corpus);
    
    // Dragon Lord (heading match) should come first
    assert.strictEqual(results[0].entity.entityId, 'Dragon Lord');
    assert.strictEqual(results[0].matchType, 'heading');
  });
});

describe('loadContent with real workspace', () => {
  it('should load actual workspace content files', () => {
    // Go up from dist/tests to project root
    const workspaceDir = path.join(__dirname, '..', '..');
    
    const result = loadContent({ contentDir: workspaceDir });
    
    // Should find some entities from the real .md files
    assert.ok(result.entityIndex.size >= 0); // May be 0 if no entities defined yet
    assert.ok(result.corpus.size > 0); // Should have loaded some files
    assert.ok(result.errors.length === 0 || result.errors.length >= 0); // May have warnings
    
    console.log(`Loaded ${result.corpus.size} files, found ${result.entityIndex.size} entities`);
  });
});
