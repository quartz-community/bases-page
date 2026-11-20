---
"@quartz-community/bases-page": minor
---

Summaries match Obsidian. Custom summaries (a formula under the base's top-level `summaries:`, made with **Add summary**) are evaluated instead of showing only their name; their formulas see the column's values as `values`. Each summary cell shows the summary's name before its value, a grouped table has a summary row under each group's heading, and the built-in summaries give Obsidian's values: `Average` counts empty values, numbers are rounded to 2 decimals, `Earliest`, `Latest` and a date `Range` work, and a summary with nothing to summarise, or an unknown name, shows "Empty".

Formulas get `reduce(expression, initial)` with `acc`, and `index` in `map`, `filter` and the other list methods; `mean()` counts empty values, as in Obsidian.

Entries of a view without a `sort` are in file name order, as in Obsidian, instead of being sorted by their columns (`order`).
