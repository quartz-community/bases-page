---
"@quartz-community/bases-page": patch
---

A `.base` page carries the `.base` file's paths (`filePath`, `relativePath`) instead of a synthetic `<slug>.md`, like canvas pages. With Quartz 5.1, which runs the site's publish filters on these pages, explicit-publish can tell it is a file without frontmatter and publishes it only when a published note links to it (#11); the content index lists its real path.
