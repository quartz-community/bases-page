---
"@quartz-community/bases-page": minor
---

`link()` and links as in Obsidian. Any URL scheme makes `link()` an external link with that exact href (`mailto:`, `obsidian://`, `ftp://` …, not only `http(s)` as in community PR #17); other targets are links to notes. A link to a heading shows `Note > Heading` instead of `Note#Heading`. Links to notes that don't exist get Quartz's `broken` class. `file.asLink()` links to the file's full path and shows it as Obsidian does (`folder/Note.md`). **Changed, as in Obsidian:** a text value holding a Markdown link (`[x](https://…)`) or a URL inside longer text is shown as text; a value that is just a URL is still a link.
