import * as test from 'node:test';
import * as assert from 'node:assert';
import { renderMarkdown } from '../renderer.js';
import { Entity } from '../types.js';

test.describe('renderMarkdown cross-linking', () => {
  const mockEntity: Entity = {
    entityId: 'Congress of Vienna',
    _source: { documentId: 'World Order.md', startLine: 1, endLine: 1 },
    ancestors: [],
    headingLevel: 2,
    properties: {},
    textContent: []
  };
  const viennaEntity: Entity = {
    entityId: 'Vienna',
    _source: { documentId: 'World Order.md', startLine: 2, endLine: 2 },
    ancestors: [],
    headingLevel: 2,
    properties: {},
    textContent: []
  };
  const entityIndex = new Map<string, Entity>([[mockEntity.entityId, mockEntity]]);
  const entityIndexWithOverlap = new Map<string, Entity>([
    [mockEntity.entityId, mockEntity],
    [viennaEntity.entityId, viennaEntity]
  ]);

  test.it('should not link entity name inside its own heading', () => {
    const markdown = '## Congress of Vienna\n\nContent here';
    const { html } = renderMarkdown(markdown, { entityIndex });
    assert.ok(html.includes('<h2>Congress of Vienna</h2>'));
    assert.ok(!html.includes('<h2><a'));
  });

  test.it('should link entity name when not excluded and not in heading', () => {
    const markdown = 'The Congress of Vienna convened.';
    const { html } = renderMarkdown(markdown, { entityIndex });
    assert.ok(html.includes('class="entity-link"'));
  });

  test.it('should suppress self and ancestor linking when excluded', () => {
    const markdown = 'The Congress of Vienna convened.';
    const { html } = renderMarkdown(markdown, { entityIndex, excludeEntityIds: ['Congress of Vienna'] });
    assert.ok(!html.includes('class="entity-link"'));
  });

  test.it('should use line scopes to suppress linking within entity context', () => {
    const markdown = 'The Congress of Vienna convened.';
    const { html } = renderMarkdown(markdown, {
      entityIndex,
      lineScopes: [['Congress of Vienna']]
    });
    assert.ok(!html.includes('class="entity-link"'));
  });

  test.it('should not nest anchors when names overlap', () => {
    const markdown = 'The Congress of Vienna met in Vienna.';
    const { html } = renderMarkdown(markdown, { entityIndex: entityIndexWithOverlap });
    const matches = html.match(/class="entity-link"/g) ?? [];
    assert.strictEqual(matches.length, 2);
    assert.ok(html.includes('data-entity-id="Congress of Vienna"'));
    assert.ok(html.includes('data-entity-id="Vienna"'));
    assert.ok(!html.includes('<a href="#" class="entity-link" data-entity-id="Vienna"><a'));
  });
});
