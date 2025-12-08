import { marked } from 'marked';
import { EntityIndex } from './types.js';
import { ParseResultWithScopes } from './parser.js';

/**
 * Options for rendering markdown
 */
export interface RenderOptions {
  /** Entity index for cross-linking */
  entityIndex?: EntityIndex;
  /** Entity IDs to suppress linking (self + ancestors) */
  excludeEntityIds?: string[];
  /** Disable cross-linking (for testing or performance) */
  disableCrossLinking?: boolean;
  /** Entity scope stack for each line (matches markdown lines) */
  lineScopes?: string[][];
  /** Offset to apply when mapping markdown lines to lineScopes */
  lineScopeOffset?: number;
}

/**
 * Result of rendering markdown
 */
export interface RenderResult {
  /** The rendered HTML */
  html: string;
  /** Table of contents extracted from headings */
  toc: TocEntry[];
}

/**
 * A table of contents entry
 */
export interface TocEntry {
  /** Heading level (1-6) */
  level: number;
  /** Heading text */
  text: string;
  /** Slug for anchor linking */
  slug: string;
}

/**
 * Generate a URL-safe slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Collapse multiple hyphens
    .trim();
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface EntityPattern {
  entityId: string;
  regex: RegExp;
}

const ANCHOR_SEGMENT_PATTERN = /(<a [^>]+>.*?<\/a>)/gi;

function replaceOutsideAnchors(
  line: string,
  pattern: RegExp,
  replacer: (match: string) => string
): string {
  const segments = line.split(ANCHOR_SEGMENT_PATTERN);
  return segments.map(segment => {
    if (segment.startsWith('<a ') && segment.includes('</a>')) {
      return segment;
    }
    return segment.replace(pattern, replacer);
  }).join('');
}

function buildEntityPatterns(entityIndex: EntityIndex): EntityPattern[] {
  return Array.from(entityIndex.keys())
    .sort((a, b) => b.length - a.length)
    .map(name => ({
      entityId: name,
      regex: new RegExp(
        `(?<![\\w-])${escapeRegex(name)}(?![\\w-])`,
        'gi'
      )
    }));
}

function linkLine(
  line: string,
  patterns: EntityPattern[],
  excludedIds: Set<string>
): string {
  let result = line;
  for (const { entityId, regex } of patterns) {
    if (excludedIds.has(entityId)) {
      continue;
    }
    regex.lastIndex = 0;
    result = replaceOutsideAnchors(result, regex, match => (
      `<a href="#" class="entity-link" data-entity-id="${entityId}">${match}</a>`
    ));
  }
  return result;
}

function linkMarkdownContent(markdown: string, options: RenderOptions): string {
  if (!options.entityIndex) {
    return markdown;
  }
  const patterns = buildEntityPatterns(options.entityIndex);
  if (patterns.length === 0) {
    return markdown;
  }
  const lines = markdown.split('\n');
  const baseExcluded = options.excludeEntityIds ? new Set(options.excludeEntityIds) : new Set<string>();
  const offset = options.lineScopeOffset ?? 0;
  const scopes = options.lineScopes;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const lineExcluded = new Set(baseExcluded);
    const scope = scopes?.[i + offset];
    if (scope) {
      for (const entityId of scope) {
        lineExcluded.add(entityId);
      }
    }
    lines[i] = linkLine(lines[i], patterns, lineExcluded);
  }
  return lines.join('\n');
}

/**
 * Create a configured marked instance
 */
function createMarkedInstance(): typeof marked {
  // Configure marked options
  marked.setOptions({
    gfm: true,        // GitHub Flavored Markdown
    breaks: true,    // Convert \n to <br>
  });
  
  return marked;
}

/**
 * Extract table of contents from markdown content
 */
export function extractToc(markdown: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    
    // Skip entity declarations (headings with !)
    if (text.startsWith('!')) {
      // Include entity headings but strip the !
      toc.push({
        level,
        text: text.slice(1).trim(),
        slug: slugify(text.slice(1).trim())
      });
    } else {
      toc.push({
        level,
        text,
        slug: slugify(text)
      });
    }
  }
  
  return toc;
}

/**
 * Render markdown to HTML with optional cross-linking
 */
export function renderMarkdown(markdown: string, options: RenderOptions = {}): RenderResult {
  const markedInstance = createMarkedInstance();
  
  // Extract TOC before any transformations
  const toc = extractToc(markdown);
  
  // Pre-process: strip the ! from entity declaration headings
  // Per _design.md, "!EntityName" declares an entity, but shouldn't render with !
  let preprocessed = markdown.replace(
    /^(#{1,6}\s+)!(.+)$/gm,
    '$1$2'
  );
  
  // Pre-process: ensure **BoldKey** — value patterns render as separate paragraphs
  // This handles cases where multiple bold-key entries are on separate lines but
  // markdown might combine them into one paragraph
  preprocessed = preprocessed.replace(
    /(\S.*)(\n)(\s*\*\*[^*]+\*\*\s*[—-])/g,
    '$1\n\n$3'
  );
  
  if (options.entityIndex && !options.disableCrossLinking) {
    preprocessed = linkMarkdownContent(preprocessed, options);
  }
  
  // Render markdown to HTML
  let html = markedInstance.parse(preprocessed) as string;
  
  return { html, toc };
}

/**
 * Render a single document by ID
 */
export function renderDocument(
  documentId: string, 
  corpus: Map<string, string>,
  options: RenderOptions = {},
  parseResult?: ParseResultWithScopes
): RenderResult | null {
  const content = corpus.get(documentId);
  
  if (!content) {
    return null;
  }
  
  return renderMarkdown(content, {
    ...options,
    lineScopes: parseResult?.lineScopes,
    lineScopeOffset: 0
  });
}
