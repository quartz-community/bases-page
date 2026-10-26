---
"@quartz-community/bases-page": patch
---

`link()` with an external URL (e.g. `link("https://" + subdomain, subdomain)`) now produces a markdown link, which renders as an external link, instead of a wikilink that was resolved as an internal page.
