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

# Flat Data
To the extent possible, all data is flat. Any indexable data has a special key called "type". Type may be
Individual, Species, Planet, Object, Place, and more to be defined.

# Structure
Any md file may define any type of data at any time.

Headings in a file will use a Rule to assign an implicit key to each heading level of the file. For example, in planets.md, {heading1Type: "planet"} means that, by implication, and time you see # Something that thing gets {type: "Planet"} in its data.

Any line that does not start with markdown (*, - or #) and also contains a colon after text, is considered a key/value pair suitable for indexing.

If the line after the : is nothing but whitespace, then the entire content until the next key is considered the value.

# Text Search
All text in the md files will be searchable. Search results will sort by the heading level, then bullets, then other text. Filtering will be supported with loose key/value pairs and db indexes.

# Schema
Schemas in this project are used to help flesh out important data for a data type. They are not meant to constrain. More often if, for example, a monster lacks a "powerLevel", the schema is used to notice that and help fill it in.

We will develop the schema.json file over time.

# Indexing
Early on we'll just pull the entire md corpus into memory and search it. As we do that, we'll also parse and create indexes by type pointing into the text.

# App
The canonical display of all this data will be in a web browser. We'll use typescript, express and lit-html.

## Features
* Left panel (retractable) shows table fo contents
* Main panel shows content
* Automatic wiki style cross-linking
* Back button
* Favorites list
* Top of screen text search with filtering by type
