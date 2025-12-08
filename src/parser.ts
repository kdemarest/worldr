import { Entity, ParseResult } from './types.js';

/**
 * Parse result including per-line entity stack scopes
 */
export interface ParseResultWithScopes extends ParseResult {
  /** Entity stack (outermost -> innermost) for each line (0-based index) */
  lineScopes: string[][];
}

/**
 * Regex patterns for parsing markdown entities
 */

// Unified heading pattern: captures hashes, whitespace, optional !, and content
// Group 1: #{1,6} (heading level)
// Group 2: whitespace after #
// Group 3: optional ! (entity marker)
// Group 4: the rest (entity name or key name)
const HEADING_PATTERN = /^(#{1,6})(\s+)(!)?(.*)$/;

// Matches bullet/numbered entity: "- !Entity", "* !Entity", "1. !Entity"
const BULLET_ENTITY_PATTERN = /^(\s*[-*]|\s*\d+\.)\s*!(.+)$/;

// Matches key with colon: optional markdown prefix, key (no spaces), colon, optional value
// Examples: "weather: foggy", "- status: active", "* count: 5"
const COLON_KEY_PATTERN = /^(\s*[-*]|\s*\d+\.)?\s*(\S+):(.*)$/;

// Matches key with dash separator: key (no spaces), space-dash-space, optional value
// Examples: "weather - foggy", "status - active"
const DASH_KEY_PATTERN = /^(\s*[-*]|\s*\d+\.)?\s*(\S+)\s+-\s+(.*)$/;

// Matches bolded key with em-dash or regular dash: **Key** — value or **Key** - value
// Examples: "**Napoleon's Return** — He came back", "**Status** - active"
// Group 1: the key (inside the **)
// Group 2: the value (after the dash)
const BOLD_KEY_PATTERN = /^\s*\*\*([^*]+)\*\*\s*[—-]\s*(.*)$/;

/**
 * Parse a heading line - returns entity info, key info, or null
 */
function parseHeading(line: string): { 
  type: 'entity' | 'key'; 
  headingLevel: number; 
  name: string;
} | null {
  const match = line.match(HEADING_PATTERN);
  if (!match) return null;
  
  const headingLevel = match[1].length;
  const hasExclamation = match[3] === '!';
  const content = match[4].trim();
  
  if (!content) return null;
  
  // Remove trailing colon from key names
  const name = content.endsWith(':') ? content.slice(0, -1).trim() : content;
  
  return {
    type: hasExclamation ? 'entity' : 'key',
    headingLevel,
    name
  };
}

/**
 * Check if a line is a bullet/numbered entity declaration
 */
function parseBulletEntity(line: string): { name: string } | null {
  const match = line.match(BULLET_ENTITY_PATTERN);
  if (!match) return null;
  return { name: match[2].trim() };
}

/**
 * Check if a line defines a key/value pair (colon, dash, or bold syntax)
 */
function parseKeyValue(line: string): { key: string; value: string; isMultiLine: boolean } | null {
  // Try bold key syntax first: **Key** — value
  let match = line.match(BOLD_KEY_PATTERN);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    return { key, value, isMultiLine: value === '' };
  }
  
  // Try colon syntax
  match = line.match(COLON_KEY_PATTERN);
  if (match) {
    const key = match[2];
    const value = match[3].trim();
    return { key, value, isMultiLine: value === '' };
  }
  
  // Try dash syntax
  match = line.match(DASH_KEY_PATTERN);
  if (match) {
    const key = match[2];
    const value = match[3].trim();
    return { key, value, isMultiLine: value === '' };
  }
  
  return null;
}

/**
 * Check if URL pattern (to avoid false key detection)
 */
function isUrl(line: string): boolean {
  return /https?:\/\//.test(line);
}

/**
 * Parse a markdown document and extract entities.
 */
export function parseMarkdown(content: string, documentId: string): ParseResultWithScopes {
  // Normalize line endings (handle Windows \r\n)
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const entities: Entity[] = [];
  const warnings: string[] = [];
  const lineScopes: string[][] = new Array(lines.length);
  
  // DEBUG: Cheesy overrides for testing - treat certain headings as entities
  const debugHeader1AlwaysEntity = true;  // All # headings are entities
  const debugHeader3AlwaysEntity = documentId === 'Individuals.md';  // ### headings in Individuals.md
  
  // Stack to track entity scope by heading level
  // Index = heading level (1-6), value = entity being built at that level
  const entityStack: (Entity | null)[] = [null, null, null, null, null, null, null];
  
  let currentEntity: Entity | null = null;
  let collectingMultiLineValue = false;
  let multiLineKey = '';
  let multiLineValue: string[] = [];
  let currentScope: string[] = [];
  let scopeDirty = true;

  function snapshotScope(): void {
    const scope: string[] = [];
    for (let level = 1; level <= 6; level++) {
      const entity = entityStack[level];
      if (entity) {
        scope.push(entity.entityId);
      }
    }
    currentScope = scope;
    scopeDirty = false;
  }
  
  function finalizeMultiLineValue() {
    if (collectingMultiLineValue && currentEntity && multiLineKey) {
      if (!currentEntity.properties[multiLineKey]) {
        currentEntity.properties[multiLineKey] = multiLineValue.join('\n').trim();
      }
    }
    collectingMultiLineValue = false;
    multiLineKey = '';
    multiLineValue = [];
  }
  
  function finalizeEntity(entity: Entity, endLine: number) {
    entity._source.endLine = endLine;
    // Extract entityType from properties if present
    if (entity.properties['entityType']) {
      entity.entityType = entity.properties['entityType'];
    }
    entities.push(entity);
  }
  
  function closeEntitiesAtLevel(headingLevel: number, lineNum: number) {
    // Close any entities at the same level or deeper (higher heading numbers)
    // A level 2 heading closes level 2, 3, 4, 5, 6 entities but NOT level 1
    for (let level = 6; level >= headingLevel; level--) {
      const entity = entityStack[level];
      if (entity) {
        finalizeEntity(entity, lineNum - 1);
        entityStack[level] = null;
      }
    }
    // Update currentEntity to the deepest remaining entity
    currentEntity = null;
    for (let level = headingLevel - 1; level >= 1; level--) {
      if (entityStack[level]) {
        currentEntity = entityStack[level];
        break;
      }
    }
    scopeDirty = true;
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // First, check for headings (unified pattern handles both entities and keys)
    const heading = parseHeading(line);
    if (heading) {
      finalizeMultiLineValue();
      
      // DEBUG: Override type based on debug flags
      let effectiveType = heading.type;
      if (debugHeader1AlwaysEntity && heading.headingLevel === 1) {
        effectiveType = 'entity';
      }
      if (debugHeader3AlwaysEntity && heading.headingLevel === 3) {
        effectiveType = 'entity';
      }
      
      if (effectiveType === 'entity') {
        // Entity declaration
        const effectiveLevel = heading.headingLevel;
        
        // Close entities at same or deeper level only
        closeEntitiesAtLevel(effectiveLevel, lineNum);
        
        // Determine ancestor chain (outermost first)
        const ancestors: string[] = [];
        for (let level = 1; level < effectiveLevel; level++) {
          const ancestor = entityStack[level];
          if (ancestor) {
            ancestors.push(ancestor.entityId);
          }
        }
        
        // Create new entity
        const newEntity: Entity = {
          entityId: heading.name,
          _source: {
            documentId,
            startLine: lineNum,
            endLine: lineNum
          },
          ancestors,
          headingLevel: effectiveLevel,
          properties: {},
          textContent: []
        };
        
        entityStack[effectiveLevel] = newEntity;
        currentEntity = newEntity;
        scopeDirty = true;
      } else {
        // Heading-key: becomes a property of the parent entity
        const { name: key, headingLevel } = heading;
        
        // Find the owning entity (entity at shallower level than this heading)
        let owningEntity: Entity | null = null;
        for (let level = headingLevel - 1; level >= 1; level--) {
          if (entityStack[level]) {
            owningEntity = entityStack[level];
            break;
          }
        }
        
        // Close any entities at same level or deeper (this heading ends them)
        closeEntitiesAtLevel(headingLevel, lineNum);
        
        if (owningEntity && !owningEntity.properties[key]) {
          // Start multi-line value collection for this heading-key
          collectingMultiLineValue = true;
          multiLineKey = key;
          multiLineValue = [];
          currentEntity = owningEntity;
        }
      }
      continue;
    }
    
    // Check for bullet/numbered entity declaration
    const bulletEntity = parseBulletEntity(line);
    if (bulletEntity) {
      finalizeMultiLineValue();
      
      // Treat bullet entities as level 1
      closeEntitiesAtLevel(1, lineNum);
      
      const newEntity: Entity = {
        entityId: bulletEntity.name,
        _source: {
          documentId,
          startLine: lineNum,
          endLine: lineNum
        },
        ancestors: [],
        headingLevel: 1,
        properties: {},
        textContent: []
      };
      
      entityStack[1] = newEntity;
      currentEntity = newEntity;
      scopeDirty = true;
      continue;
    }
    
    // Skip URL lines for key detection
    if (!isUrl(line)) {
      // Check for key/value pair
      const keyValue = parseKeyValue(line);
      if (keyValue) {
        finalizeMultiLineValue();
        
        const { key, value, isMultiLine } = keyValue;
        
        if (currentEntity) {
          if (!currentEntity.properties[key]) {
            if (isMultiLine) {
              collectingMultiLineValue = true;
              multiLineKey = key;
              multiLineValue = [];
            } else {
              currentEntity.properties[key] = value;
            }
          }
        }
        continue;
      }
    }
    
    // Regular text line
    if (collectingMultiLineValue) {
      multiLineValue.push(line);
    } else if (currentEntity) {
      currentEntity.textContent.push(line);
    }
    if (scopeDirty) {
      snapshotScope();
    }
    lineScopes[i] = currentScope;
  }
  
  // Finalize any remaining multi-line value
  finalizeMultiLineValue();
  
  // Close all remaining open entities
  for (let level = 6; level >= 1; level--) {
    const entity = entityStack[level];
    if (entity) {
      finalizeEntity(entity, lines.length);
    }
  }
  
  return { documentId, entities, warnings, lineScopes };
}

/**
 * Build an entity index from multiple parse results.
 */
export function buildEntityIndex(results: ParseResult[]): Map<string, Entity> {
  const index = new Map<string, Entity>();
  
  for (const result of results) {
    for (const entity of result.entities) {
      if (index.has(entity.entityId)) {
        // Duplicate entity ID - keep first occurrence
        console.warn(`Duplicate entity ID: ${entity.entityId} in ${entity._source.documentId}`);
      } else {
        index.set(entity.entityId, entity);
      }
    }
  }
  
  return index;
}
