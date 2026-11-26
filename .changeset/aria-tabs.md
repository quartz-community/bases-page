---
"@quartz-community/bases-page": patch
---

View tabs follow the WAI-ARIA tabs pattern: each tab controls its view (`aria-controls`, `role="tabpanel"` labelled by the tab), only the selected tab is in the tab order, and Left/Right (wrapping), Home and End move between tabs. Ids are unique on the page with several bases, also when the same note or base is on it twice.

Bundles `@quartz-community/utils` 1.3.1.
