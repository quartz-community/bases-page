---
"@quartz-community/bases-page": patch
---

Links in bases follow the site's `configuration.links`, like the note's own links: external links get the external-link icon (`externalLinkIcon`) and open in a new tab only with `openLinksInNewTab`, images load lazily only with `lazyLoad`, and links to notes from properties get `data-slug` (popovers and SPA navigation). This applies to embedded bases and to `.base` pages.
