---
"@quartz-community/bases-page": minor
---

`file.name` includes the file's extension, as in Obsidian: `Note.md`, `Plan.canvas`. Use `file.basename` for the name without it. Filters, formulas and sorting that compare `file.name` (`file.name == "Plan.canvas"`, `file.name.endsWith(".canvas")`) now give the same results as in Obsidian. **Changed:** a filter written for the old value, such as `file.name == "Note"`, needs `file.basename` instead. Tables still show the name without the extension as the link to each file.
