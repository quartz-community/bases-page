---
"@quartz-community/bases-page": patch
---

Mixed values sort as in Obsidian: two numbers, dates or durations compare by value, anything else as text (so `[true, 5, "b", date("2024-01-01")].sort()` is 5, 2024-01-01, b, true), which also sets the order of groups. `sum()`, `mean()`, `min()` and `max()` skip booleans like text and are empty without numbers; the global `min()`/`max()` reject booleans and dates. `number("abc")` and `number([1])` are errors, `number(date)` gives epoch milliseconds, and a formula loop shows Obsidian's "Infinite loop detected in formula".
