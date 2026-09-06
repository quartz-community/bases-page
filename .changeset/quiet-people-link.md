---
"@quartz-community/bases-page": patch
---

Fix `this.file.asLink()` in embedded and standalone bases by constructing a complete self-context file value. Resolve full-path links against short and aliased author wikilinks and outgoing-link slugs when evaluating `contains()`.
