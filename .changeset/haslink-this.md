---
"@quartz-community/bases-page": patch
---

`file.hasLink(this)` in a base embedded in a note lists the notes that link to it, as in Obsidian. `hasLink` now accepts `this`, a file (`this.file`), a link (`link("Alice")`, `"[[Alice]]"`) or a path, and a link to one of the file's headings or blocks counts as a link to the file (#23).
