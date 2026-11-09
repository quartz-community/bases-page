---
"@quartz-community/bases-page": patch
---

Resolve wikilink-valued strings (`[[note]]`, `[[note|alias]]`, `[[note#heading]]`) the way Obsidian does, so link-valued frontmatter such as `location: "[[note]]"` works in `asFile()`, `link()` and `list.contains(this)`. Like Obsidian, `link()` keeps a wikilink's `#heading` but not its alias, so the link text is the note's name.
