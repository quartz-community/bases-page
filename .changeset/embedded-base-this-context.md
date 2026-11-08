---
"@quartz-community/bases-page": patch
---

Fix `this` in bases embedded in notes and stop listing Quartz's generated pages as notes:

- `this.file` is now the full file of the note the base is embedded in, so `this.file.asLink()` works. Filters such as `file.links.contains(this.file.asLink())` and `authors.contains(this.file.asLink())` match the notes that link to the embedding note, and a link property matches whether it holds one link or a list of links. `contains()` with a missing value no longer matches every note.
- `file.inFolder(this.file.folder)` in a note at the content root now matches every note, as in Obsidian. `inFolder("")` and `inFolder("/")` both mean the root.
- Pages that Quartz generates, such as the 404 page, tag pages, the tags index and folder listings, no longer appear as notes in base views.
