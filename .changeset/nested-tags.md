---
"@quartz-community/bases-page": minor
---

Tags work as in Obsidian (bases-page#9). `file.tags.contains("a/b")`, `contains(file.tags, …)`, `containsAny`/`containsAll` and `file.hasTag("a/b")` match the tag and its nested tags (`a/b/c`), by whole segments (`CC` does not match `CCX`), ignoring case and a leading `#`. `file.hasTag("x", "y")` is true when the note has any of the tags (it was all of them). **Changed, as in Obsidian:** `file.tags` lists the tags as written, with `#` and their original case (`#Src/OSE/cc`), inline tags first; the `tags` property holds only the frontmatter tags (inline tags no longer leak into it), and a frontmatter string such as `"a, b"` is one tag, not two.
