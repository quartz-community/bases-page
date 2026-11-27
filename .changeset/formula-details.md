---
"@quartz-community/bases-page": patch
---

Smaller formula differences from Obsidian fixed: `date.millisecond`; `1 / 0` is Infinity (shown as ∞) and `5 % 0` NaN instead of 0; `title()` lowercases the rest of each word; `[1] + [2]` concatenates and `"a" + [1, 2]` is `a1, 2`; `sum()`, `mean()`, `min()` and `max()` skip text, also numeric text; no string contains `""`; `unique()` removes equal dates; `number("12abc")` is 12, `number("0x10")` 0 and `number("")` an error.
