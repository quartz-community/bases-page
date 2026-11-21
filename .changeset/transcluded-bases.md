---
"@quartz-community/bases-page": patch
---

A base inside a transcluded note (an inline ` ```base ` block or a `![[….base]]` embed) renders that note's own base, with `this` being that note as in Obsidian, instead of the host page's base with the same position (or nothing when the host has none).
