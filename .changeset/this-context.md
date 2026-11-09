---
"@quartz-community/bases-page": minor
---

`this` works as in Obsidian (community PR #2). In a base embedded in a note, `this.<key>` and `this.note.<key>` are the note's properties (`this.status`, `this.note["file"]` for a property named `file`), `this.file` is its file, and `this` shows as a link to it. Opened as its own page, `this` is the `.base` file, without properties, and `file.hasLink(this.file)` finds the notes that embed the base. Several bases on one page are independent: a note with embedded bases and an inline ` ```base ` block showed the inline block in place of the first embed, and "View not found" for the next one. **Changed, as in Obsidian:** `file.folder` of a file at the root of the vault is `/` (it was empty); `file.inFolder("/")` and `file.inFolder("")` still match every file.
