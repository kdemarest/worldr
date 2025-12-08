import { Router, Request, Response } from 'express';
import { LoadResult, searchContent, SearchOptions } from '../loader.js';
import { Entity } from '../types.js';
import { renderDocument, renderMarkdown } from '../renderer.js';

/**
 * Create API routes for entity access
 */
export function createApiRoutes(data: LoadResult): Router {
  const router = Router();
  
  /**
   * GET /api/entities
   * List all entities, optionally filtered by type
   * Query params: ?type=Person&limit=10
   */
  router.get('/entities', (req: Request, res: Response) => {
    const { type, limit } = req.query;
    
    let entities = Array.from(data.entityIndex.values());
    
    // Filter by type if specified
    if (type && typeof type === 'string') {
      entities = entities.filter(e => e.entityType === type);
    }
    
    // Apply limit
    if (limit && typeof limit === 'string') {
      const n = parseInt(limit, 10);
      if (!isNaN(n) && n > 0) {
        entities = entities.slice(0, n);
      }
    }
    
    // Return simplified entity list
    const result = entities.map(e => ({
      entityId: e.entityId,
      entityType: e.entityType,
      documentId: e._source.documentId
    }));
    
    res.json(result);
  });
  
  /**
   * GET /api/entity/:id
   * Get a single entity by ID
   */
  router.get('/entity/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const entity = data.entityIndex.get(id);
    
    if (!entity) {
      res.status(404).json({ error: `Entity not found: ${id}` });
      return;
    }
    
    res.json(entity);
  });
  
  /**
   * GET /api/search
   * Search for text across all entities
   * Query params: ?q=dragon&type=Monster&limit=20
   */
  router.get('/search', (req: Request, res: Response) => {
    const { q, type, limit } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }
    
    const options: SearchOptions = {};
    
    if (type && typeof type === 'string') {
      options.entityType = type;
    }
    
    if (limit && typeof limit === 'string') {
      const n = parseInt(limit, 10);
      if (!isNaN(n) && n > 0) {
        options.limit = n;
      }
    }
    
    const results = searchContent(q, data.entityIndex, data.corpus, options);
    
    // Return search results with entity references
    const response = results.map(r => ({
      entityId: r.entity.entityId,
      entityType: r.entity.entityType,
      documentId: r.entity._source.documentId,
      snippet: r.snippet,
      matchType: r.matchType
    }));
    
    res.json(response);
  });
  
  /**
   * GET /api/documents
   * List all loaded documents
   */
  router.get('/documents', (_req: Request, res: Response) => {
    const documents = Array.from(data.corpus.keys());
    res.json(documents);
  });
  
  /**
   * GET /api/document/:id
   * Get raw markdown content of a document
   */
  router.get('/document/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const content = data.corpus.get(id);
    
    if (!content) {
      res.status(404).json({ error: `Document not found: ${id}` });
      return;
    }
    
    res.type('text/markdown').send(content);
  });
  
  /**
   * GET /api/types
   * List all unique entity types
   */
  router.get('/types', (_req: Request, res: Response) => {
    const types = new Set<string>();
    
    for (const entity of data.entityIndex.values()) {
      if (entity.entityType) {
        types.add(entity.entityType);
      }
    }
    
    res.json(Array.from(types).sort());
  });
  
  /**
   * GET /api/render/:id
   * Render a document as HTML
   */
  router.get('/render/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const parseResult = data.parseResultMap.get(id);
    
    const result = renderDocument(id, data.corpus, {
      entityIndex: data.entityIndex
    }, parseResult);
    
    if (!result) {
      res.status(404).json({ error: `Document not found: ${id}` });
      return;
    }
    
    res.json(result);
  });
  
  /**
   * GET /api/render-entity/:id
   * Render an entity's content as HTML by slicing original markdown source
   */
  router.get('/render-entity/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const entity = data.entityIndex.get(id);
    
    if (!entity) {
      res.status(404).json({ error: `Entity not found: ${id}` });
      return;
    }
    
    // Get the source markdown from the corpus
    const docContent = data.corpus.get(entity._source.documentId);
    if (!docContent) {
      res.status(404).json({ error: `Source document not found: ${entity._source.documentId}` });
      return;
    }
    
    // Slice the original markdown using _source line numbers
    const lines = docContent.split('\n');
    const markdown = lines.slice(entity._source.startLine - 1, entity._source.endLine).join('\n');
    
    const parseResult = data.parseResultMap.get(entity._source.documentId);
    const lineScopeOffset = entity._source.startLine - 1;
    const result = renderMarkdown(markdown, {
      entityIndex: data.entityIndex,
      excludeEntityIds: [entity.entityId, ...entity.ancestors],
      lineScopes: parseResult?.lineScopes,
      lineScopeOffset
    });
    
    res.json({
      ...result,
      entity: {
        entityId: entity.entityId,
        entityType: entity.entityType,
        documentId: entity._source.documentId
      }
    });
  });
  
  return router;
}
