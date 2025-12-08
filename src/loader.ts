import * as fs from 'node:fs';
import * as path from 'node:path';
import { Entity, EntityIndex } from './types.js';
import { parseMarkdown, buildEntityIndex, ParseResultWithScopes } from './parser.js';

/**
 * Options for loading content files
 */
export interface LoadOptions {
  /** Directory to scan for .md files */
  contentDir: string;
  /** Whether to include _*.md metadata files (default: false) */
  includeMetadata?: boolean;
}

/**
 * Result of loading all content files
 */
export interface LoadResult {
  /** All parse results from each file */
  parseResults: ParseResultWithScopes[];
  /** Quick lookup of parse results by document ID */
  parseResultMap: Map<string, ParseResultWithScopes>;
  /** Combined entity index */
  entityIndex: EntityIndex;
  /** Raw content of all files for text search */
  corpus: Map<string, string>;
  /** Any errors encountered during loading */
  errors: string[];
}

/**
 * Check if a filename is a metadata file (starts with _)
 */
function isMetadataFile(filename: string): boolean {
  return path.basename(filename).startsWith('_');
}

/**
 * Find all markdown files in a directory (non-recursive)
 */
function findMarkdownFiles(dir: string, includeMetadata: boolean): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (includeMetadata || !isMetadataFile(entry.name)) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
  } catch (err) {
    // Directory doesn't exist or isn't readable
  }
  
  return files;
}

/**
 * Load and parse all markdown content files from a directory
 */
export function loadContent(options: LoadOptions): LoadResult {
  const { contentDir, includeMetadata = false } = options;
  
  const parseResults: ParseResultWithScopes[] = [];
  const parseResultMap = new Map<string, ParseResultWithScopes>();
  const corpus = new Map<string, string>();
  const errors: string[] = [];
  
  const files = findMarkdownFiles(contentDir, includeMetadata);
  
  for (const filePath of files) {
    const documentId = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      corpus.set(documentId, content);
      
      const result = parseMarkdown(content, documentId);
      parseResults.push(result);
      parseResultMap.set(documentId, result);
      
      // Collect any parsing warnings
      for (const warning of result.warnings) {
        errors.push(`${documentId}: ${warning}`);
      }
    } catch (err) {
      errors.push(`Failed to read ${documentId}: ${err}`);
    }
  }
  
  const entityIndex = buildEntityIndex(parseResults);
  
  return {
    parseResults,
    parseResultMap,
    entityIndex,
    corpus,
    errors
  };
}


/**
 * Text search options
 */
export interface SearchOptions {
  /** Filter results by entityType */
  entityType?: string;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * A search result with context
 */
export interface SearchResult {
  /** The entity containing the match */
  entity: Entity;
  /** The matching text snippet */
  snippet: string;
  /** Relevance score (lower = better match) */
  score: number;
  /** Type of match: 'heading', 'bullet', 'text' */
  matchType: 'heading' | 'bullet' | 'text';
}

/**
 * Search the corpus for text matches
 * Results are sorted by: heading matches first, then bullets, then text
 */
export function searchContent(
  query: string,
  entityIndex: EntityIndex,
  corpus: Map<string, string>,
  options: SearchOptions = {}
): SearchResult[] {
  const { entityType, limit } = options;
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  
  // Search through each entity
  for (const entity of entityIndex.values()) {
    // Filter by entityType if specified
    if (entityType && entity.entityType !== entityType) {
      continue;
    }
    
    // Check entity name
    if (entity.entityId.toLowerCase().includes(queryLower)) {
      results.push({
        entity,
        snippet: entity.entityId,
        score: 0, // Best score for heading/name matches
        matchType: 'heading'
      });
      continue; // Don't add duplicate results for same entity
    }
    
    // Check properties (keys are like sub-headings)
    let found = false;
    for (const [key, value] of Object.entries(entity.properties)) {
      if (key.toLowerCase().includes(queryLower)) {
        results.push({
          entity,
          snippet: `${key}: ${value.slice(0, 100)}${value.length > 100 ? '...' : ''}`,
          score: 1,
          matchType: 'heading'
        });
        found = true;
        break;
      }
      if (value.toLowerCase().includes(queryLower)) {
        // Find the matching line for context
        const lines = value.split('\n');
        const matchingLine = lines.find(l => l.toLowerCase().includes(queryLower)) || value.slice(0, 100);
        results.push({
          entity,
          snippet: `${key}: ${matchingLine.slice(0, 100)}${matchingLine.length > 100 ? '...' : ''}`,
          score: 2,
          matchType: 'text'
        });
        found = true;
        break;
      }
    }
    if (found) continue;
    
    // Check text content
    for (const line of entity.textContent) {
      if (line.toLowerCase().includes(queryLower)) {
        const isBullet = /^\s*[-*]/.test(line) || /^\s*\d+\./.test(line);
        results.push({
          entity,
          snippet: line.slice(0, 100) + (line.length > 100 ? '...' : ''),
          score: isBullet ? 1 : 2,
          matchType: isBullet ? 'bullet' : 'text'
        });
        break;
      }
    }
  }
  
  // Sort by score (heading < bullet < text)
  results.sort((a, b) => a.score - b.score);
  
  // Apply limit
  if (limit && results.length > limit) {
    return results.slice(0, limit);
  }
  
  return results;
}
