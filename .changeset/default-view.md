---
"@quartz-community/bases-page": minor
---

A base opens on its first view, as in Obsidian, both as a page and embedded; it used to open on the first table view. The `defaultViewType` option no longer defaults to `"table"`: set it to prefer a view type. An embed such as `![[Tasks.base#Open tasks]]` matches the view name as written, case-sensitively as Obsidian does (names with punctuation, e.g. `ratio-0.5`, now work), and a missing view shows Obsidian's message `View "Nope" not found` with the name as written. A `.base` page now links only to the notes its views show, each view with its own filters (community PR #7); it linked to every note when the filters were on the views, and so appeared in every note's backlinks.
