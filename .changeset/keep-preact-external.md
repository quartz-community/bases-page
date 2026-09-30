---
"@quartz-community/bases-page": patch
---

Stop bundling `preact` and the other `SINGLETON_EXTERNALS`. tsup checks `noExternal` first, so `noExternal: [/.*/]` overrode them, and views rendered with a second copy of Preact that breaks other plugins' hooks.
