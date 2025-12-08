import * as test from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { parseMarkdown, buildEntityIndex } from '../parser.js';

const { describe, it } = test;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('parseMarkdown', () => {
  
  it('should parse entity declarations', () => {
    const content = `# !Planet Earth
entityType: Planet
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.strictEqual(result.entities.length, 1);
    assert.strictEqual(result.entities[0].entityId, 'Planet Earth');
    assert.strictEqual(result.entities[0].entityType, 'Planet');
    assert.strictEqual(result.entities[0]._source.documentId, 'test.md');
  });
  
  it('should parse key/value pairs with colon syntax', () => {
    const content = `# !Test Entity
key1: value1
key2: value2
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.strictEqual(result.entities[0].properties['key1'], 'value1');
    assert.strictEqual(result.entities[0].properties['key2'], 'value2');
  });
  
  it('should parse key/value pairs with dash syntax', () => {
    const content = `# !Test Entity
population - 5000
status - active
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.strictEqual(result.entities[0].properties['population'], '5000');
    assert.strictEqual(result.entities[0].properties['status'], 'active');
  });
  
  it('should parse multi-line values', () => {
    const content = `# !Test Entity
description:
This is line 1
This is line 2
nextKey: value
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.strictEqual(result.entities[0].properties['description'], 'This is line 1\nThis is line 2');
    assert.strictEqual(result.entities[0].properties['nextKey'], 'value');
  });
  
  it('should treat headings without ! as keys', () => {
    const content = `# !Planet Earth
entityType: Planet
## Oceans
The oceans are vast bodies of water.
They cover most of the planet.
## !London
A city
`;
    const result = parseMarkdown(content, 'test.md');
    
    // Planet Earth should have Oceans as a key
    const earth = result.entities.find(e => e.entityId === 'Planet Earth');
    assert.ok(earth);
    assert.ok(earth!.properties['Oceans']);
    assert.ok(earth!.properties['Oceans'].includes('The oceans are vast'));
    
    // London should be a separate entity
    const london = result.entities.find(e => e.entityId === 'London');
    assert.ok(london);
  });
  
  it('should handle entity scope correctly', () => {
    const content = `# !Planet Earth
## !London
london text
## !Paris
paris text
# !Planet Venus
venus text
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.strictEqual(result.entities.length, 4);
    
    const earth = result.entities.find(e => e.entityId === 'Planet Earth');
    const london = result.entities.find(e => e.entityId === 'London');
    const paris = result.entities.find(e => e.entityId === 'Paris');
    const venus = result.entities.find(e => e.entityId === 'Planet Venus');
    
    // Verify entities exist
    assert.ok(earth);
    assert.ok(london);
    assert.ok(paris);
    assert.ok(venus);
    
    // Verify heading levels
    assert.strictEqual(earth!.headingLevel, 1);
    assert.strictEqual(london!.headingLevel, 2);
    assert.strictEqual(paris!.headingLevel, 2);
    assert.strictEqual(venus!.headingLevel, 1);
  });
  
  it('should ignore duplicate keys in same entity', () => {
    const content = `# !Test Entity
key1: first value
key1: second value
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.strictEqual(result.entities[0].properties['key1'], 'first value');
  });
  
  it('should not treat URLs as keys', () => {
    const content = `# !Test Entity
Check out https://example.com for more info
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.ok(!result.entities[0].properties['https']);
    assert.ok(result.entities[0].textContent.some(t => t.includes('https://example.com')));
  });
  
  it('should collect text content', () => {
    const content = `# !Test Entity
This is some text.
More text here.
key1: value1
And more text after.
`;
    const result = parseMarkdown(content, 'test.md');
    
    assert.ok(result.entities[0].textContent.some(t => t.includes('This is some text')));
    assert.ok(result.entities[0].textContent.some(t => t.includes('More text here')));
    assert.ok(result.entities[0].textContent.some(t => t.includes('And more text after')));
  });
  
  it('should parse the planets fixture file', () => {
    // Go up from dist/tests to project root, then into src/tests/fixtures
    const fixturePath = path.join(__dirname, '..', '..', 'src', 'tests', 'fixtures', 'planets.md');
    const content = fs.readFileSync(fixturePath, 'utf-8');
    const result = parseMarkdown(content, 'planets.md');
    
    // Should find 4 entities: Planet Earth, London, Cotswolds, Planet Venus
    assert.strictEqual(result.entities.length, 4);
    
    const earth = result.entities.find(e => e.entityId === 'Planet Earth');
    const london = result.entities.find(e => e.entityId === 'London');
    const cotswolds = result.entities.find(e => e.entityId === 'Cotswolds');
    const venus = result.entities.find(e => e.entityId === 'Planet Venus');
    
    assert.ok(earth);
    assert.ok(london);
    assert.ok(cotswolds);
    assert.ok(venus);
    
    // Check Earth properties
    assert.strictEqual(earth!.entityType, 'Planet');
    assert.strictEqual(earth!.properties['weather'], 'temperate with occasional storms');
    assert.ok(earth!.properties['Oceans']); // Heading-key
    
    // Check London properties
    assert.strictEqual(london!.properties['weather'], 'foggy');
    assert.ok(london!.properties['description']);
    
    // Check Cotswolds properties (dash syntax)
    assert.strictEqual(cotswolds!.properties['population'], '500000');
    
    // Check Venus properties
    assert.strictEqual(venus!.entityType, 'Planet');
    assert.strictEqual(venus!.properties['atmosphere'], 'carbon dioxide');
  });
});

describe('buildEntityIndex', () => {
  
  it('should build index from multiple parse results', () => {
    const result1 = parseMarkdown(`# !Entity1\nkey: val`, 'doc1.md');
    const result2 = parseMarkdown(`# !Entity2\nkey: val`, 'doc2.md');
    
    const index = buildEntityIndex([result1, result2]);
    
    assert.strictEqual(index.size, 2);
    assert.ok(index.has('Entity1'));
    assert.ok(index.has('Entity2'));
    assert.strictEqual(index.get('Entity1')?._source.documentId, 'doc1.md');
    assert.strictEqual(index.get('Entity2')?._source.documentId, 'doc2.md');
  });
});
