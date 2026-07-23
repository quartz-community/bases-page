---
"@quartz-community/bases-page": patch
---

Fix mixed-case tags not matching in bases filters. Tags are slugified during content processing but the filter comparison did not normalize case, causing `file.tags.contains("My-Tag")` to fail when the stored tag was `"my-tag"`.

Add `MMM` (abbreviated month name) and `MMMM` (full month name) tokens to the date `format()` function. Previously these tokens were not recognized, causing `file.ctime.format("MMM")` to return the raw token string instead of month names like "Jan" or "January".
