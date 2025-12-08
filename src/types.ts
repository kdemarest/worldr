/**
 * Source location information for an entity.
 * This is a reserved field - user content cannot override it.
 */
export interface EntitySource {
  /** The source markdown file */
  documentId: string;
  
  /** Line number where the entity starts (1-based) */
  startLine: number;
  
  /** Line number where the entity ends (1-based, inclusive) */
  endLine: number;
}

/**
 * Represents a parsed entity from markdown content.
 */
export interface Entity {
  /** The entity's name, extracted from the !declaration */
  entityId: string;
  
  /** Source location - reserved field, cannot be overridden by content */
  _source: EntitySource;
  
  /** Ancestor entity IDs, from outermost to parent (used for link suppression) */
  ancestors: string[];
  
  /** Optional human-friendly type classification */
  entityType?: string;
  
  /** The heading level where this entity was declared (1-6) */
  headingLevel: number;
  
  /** Arbitrary key/value pairs parsed from the entity scope */
  properties: Record<string, string>;
  
  /** Raw text content belonging to this entity (non-key/value lines) */
  textContent: string[];
}

/**
 * Result of parsing a markdown document.
 */
export interface ParseResult {
  /** The document filename */
  documentId: string;
  
  /** All entities found in the document */
  entities: Entity[];
  
  /** Any parsing warnings or issues */
  warnings: string[];
}

/**
 * The full index of all entities across all documents.
 */
export type EntityIndex = Map<string, Entity>;
