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
  const aliasEntity: Entity = {
    entityId: 'Richard Bean Gilroy',
    _source: { documentId: 'S1E1 - Recruits.md', startLine: 1, endLine: 1 },
    ancestors: [],
    headingLevel: 2,
    properties: {
      aka: 'Bean, Big Dog, happy'
    },
    textContent: []
  };
  const entityIndexWithAlias = new Map<string, Entity>([
    [aliasEntity.entityId, aliasEntity]
  ]);
  const trickyEntity: Entity = {
    entityId: 'Order of "Light" & Shadow <Prime>',
    _source: { documentId: 'World Order.md', startLine: 3, endLine: 3 },
    ancestors: [],
    headingLevel: 2,
    properties: {},
    textContent: []
  };
  const entityIndexWithEscapes = new Map<string, Entity>([
    [trickyEntity.entityId, trickyEntity]
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

  test.it('should link aka aliases with case-sensitive matching', () => {
    const markdown = 'Bean and Big Dog spoke with happy.';
    const { html } = renderMarkdown(markdown, { entityIndex: entityIndexWithAlias });
    const matches = html.match(/data-entity-id="Richard Bean Gilroy"/g) ?? [];
    assert.strictEqual(matches.length, 3);
  });

  test.it('should not link aka aliases when casing differs', () => {
    const markdown = 'bean met big dog and Happy.';
    const { html } = renderMarkdown(markdown, { entityIndex: entityIndexWithAlias });
    assert.strictEqual(html.match(/entity-link/g)?.length ?? 0, 0);
  });

  test.it('should escape entity ids for html attributes', () => {
    const markdown = 'The Order of "Light" & Shadow <Prime> convened.';
    const { html } = renderMarkdown(markdown, { entityIndex: entityIndexWithEscapes });
    assert.ok(html.includes('data-entity-id="Order of &quot;Light&quot; &amp; Shadow &lt;Prime&gt;"'));
  });
});
