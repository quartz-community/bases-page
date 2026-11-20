---
"@quartz-community/bases-page": minor
---

More formulas work as in Obsidian:

- `html()` renders its HTML, `image()` shows the image (a URL, or a file in the vault such as `image("attachments/cover.png")`), and `icon()` shows the Lucide icon, instead of showing them as text.
- Regular expressions: `/pattern/flags` literals, `/re/.matches(text)`, `replace(/re/g, "$1")` and `split(/re/)`.
- `split(separator, n)` returns at most `n` parts, and `random()` exists.
- `link(…).linksTo(file)` works.
- `file.backlinks` lists the notes that link to the note, `file.links` no longer lists the note's tags, and `file.links`, `file.backlinks` and `file.embeds` columns show the linked notes by name.
- `file.properties` (and the `note` properties) hold the frontmatter as written, without the `title` and dates Quartz adds.

An image property holding a vault path (`attachments/cover.png`) resolves like a link on every page, not relative to the page.
