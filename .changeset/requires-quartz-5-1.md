---
"@quartz-community/bases-page": minor
---

Requires Quartz 5.1 (`quartz.quartzVersion: ">=5.1.0"`): its `.base` pages rely on Quartz 5.1's filters on file-backed virtual pages and `file.data.referencedBy`. On an older Quartz the build warns, and fails in CI; update Quartz with `npx quartz upgrade`.
