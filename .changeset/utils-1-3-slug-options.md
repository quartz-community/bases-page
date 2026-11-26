---
"@quartz-community/bases-page": patch
---

Bundles `@quartz-community/utils` 1.3, so `configuration.slugs.stripDiacritics` (Quartz 5.3) also applies to links and tag links in base views, and file functions that compare paths (`file.inFolder`, `file.hasLink`, …). Before, the plugin bundled an older utils that ignored the option, and its slugs kept their diacritics.
