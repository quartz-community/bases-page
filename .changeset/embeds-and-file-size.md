---
"@quartz-community/bases-page": minor
---

A base transclusion that has no `![[…]]` in the note's source (e.g. a Markdown-form embed, `![](Demo.base)`) no longer shifts the views of the base embeds after it: each transclusion is paired with the `![[…]]` that has the same path and view (#39).

`file.size` is the file's size in bytes, as in Obsidian (#40).
