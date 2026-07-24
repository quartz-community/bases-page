---
"@quartz-community/bases-page": patch
---

Fix transclusion of base views with spaces in the name. The OFM plugin slugifies the fragment (e.g., `French Philosophers` → `french-philosophers`) but the view lookup expected the original name. View matching now normalizes both sides by lowercasing and replacing spaces with hyphens.
