---
"@quartz-community/bases-page": patch
---

`this.file.hasProperty()` checks the embedding note's properties (it checked each entry's), `file(path)` is the vault's file with its tags, links and properties, and an empty list counts as false (in `if()`, `!`, `isTruthy()`, `&&`/`||` and filters), as in Obsidian.
