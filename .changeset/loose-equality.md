---
"@quartz-community/bases-page": patch
---

`==` and `!=` compare as in Obsidian: a missing property equals `null` (so `status == null` finds notes without a status, and `status != null` no longer keeps them), a number equals the same number as text or a boolean (`"5" == 5`, `1 == true`), and lists are equal when their items are. `list.contains()` matches the same way (`[1, 2].contains("1")`). Two strings compare as text with `<` and `>` (`"10" > "9"` is false).
