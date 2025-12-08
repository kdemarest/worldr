We are building a web-enabled TTRPG, as well as the schema and typescript-based app(s) used to develop it.

# File Types
_*.md are metadata that describe data organization
*.md are content

# Layout
* _toc.md defines the content file layout
* content goes in one .md file per top-level heading in toc.md
* A second level ## heading in toc.md is typically a first level heading in the respective .md file

# Data Authority
* The .md files are the authoritative source of data

# Special Markdown Rules
In these markdown files, all carriage returns are to be respected. That is, no matter what rules markdown typically uses, in these files \n starts a new paragraph. \n also always terminates every # header, * bullet, - bullet, or 1. enumerated list.

Completely blank (or whitespace only) lines are for human readbility of the raw markdown file, and have no additional meaning.

# Parsing Entities
Any md file may define an "entity" at any time. Entity data is flat, that is, all they key/value found under it, at any heading level, just become keys inside the current entity.

## Entity
An entity is exclamation point followed by any text, including white space, and a carriage return; for example "!My New Entity".

The exclamation may be preceeded by white space or header mark down such a #, -, * or 1 (which may also be followed by white space before the !)

### Entity Fields
* entityId - not only is the entity's name a key, it is also duplicated for coding convenience inside the entity as the required field entityId.

* entityType - An optional field for human convenience, this may be:
Individual, Species, Planet, Item, Place, and more to be defined.

* documentId - required, so that links know which document the entity came from.

For example
"My New Entity": {
    entityId: "My New Entity",
    entityType: "Planet",
    documentId: "planets.md",
    arbitraryKey1: "some value",
    arbitraryKey2: "some other value",
},
"next entity": { ... },

## Entity Parsing Scope
The entity continues until another entity is declared at the same or shallower heading. To be clear, a heading2 !entity declaration does NOT end when a heading3 or heading4 is encountered. Only when a heading 2 or heading1 is encountered.

## Entity Arbitrary Key/Value Pairs
In addition to entityId and documentId, any entity can contain arbitrary key/value pairs within their Entity Scope. Key/value pairs always belong to the most proximate "type" above them.

### Keys
KeyStart, followed by text without interior whitespace, followed by a KeyEnd, defines a key. KeyStart is the beginning of a line, plus any markdown such as -, * or 1, plus any white space. KeyEnd is a colon, or whitespace dash whitespace.

Also, any heading that does not meet the definition of an entity start, is a key within the current entity, whether followed by a colon or not.

Repeats of a key name in the same entity are ignored.

### Values
The value may come in one of two forms:
1) same-line value is text following the colon, ending in \n.
2) multi-line value when nothing but whitespace follows the colon. The value is all following text until the next header or key.

## Example of Entities with key/value pairs
for example:
```
# !Planet Earth
entityType: Planet
weather: temperate with occasional storms
some text, part of the entity planet earth
## !London
this text is part of "London"
weather: foggy
description:
this is the value for the key "description" which exists within the entity "London"
## Oceans
this is not an entity, but by definition it is creating the key "Oceans" within the entity "Planet Earth". heading ended "London" and starts this multi-line key/value pair "Oceans" within "Earth".
## !Cotswolds
this text is part of the new entity "Cotswolds".
# !Planet Venus
the Planet Earth entity ended when heading level 1 Venus was parsed. Note that, above, London and Cotswolds do still appear as headings under Planet Earth, and they are also indexed as Entities in their own right.
```

# App
The canonical display of all this data will be in a web browser. We'll use typescript, express and lit-html.

## Features
* Left panel "Index" works like gmail or chatgpt's left panel. Hit an icon up top to expand or retract it. Contains a table of contents based on headings.
* Main panel "Content" shows content rendered as markdown. Clicking in the index scrolls to the content selected.
* Automatic wiki style cross-linking. See below.
* Back button: works like a browser back button, moving to the text position prior to clicking the last <a> or Index panel anchor.
* Top of screen text search lives above the "Content" panel. When the Index is visible the text search continues to be visible because it is above the Content.

# Content Rendering
All text is rendered as markdown verbatim as written.

## Cross Linking
When any entity name appears in text, an <a> is made for it, and clicking it jumps to the entity (and by implication the document) referenced.
* Matches are whole word boundaries: "Londoner" does not match "London"
* Longer names take precedence over shorter names, eg, "Planet Earth" matches instead of "Earth"
* Case insensitive
* An entities own text never links to itself, but it may link to other entities that happen to be declared within it.

# Text Search
All text in the md files will be text searchable. Search results will sort by the heading level, then bullets, then other text. Filtering will be supported with loose key/value pairs and db indexes.

# Schema
Schemas in this project are more like data patterns, used to help flesh out important data for a data type. They are not meant to constrain. More often if, for example, a monster lacks a "powerLevel", the schema is used to notice that and help fill it in.

We will develop the schema.json file over time.

# Indexing
Early on we'll just pull the entire md corpus into memory and search it. As we do that, we'll also parse and create indexes by type pointing into the text.

