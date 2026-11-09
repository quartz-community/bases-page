---
"@quartz-community/bases-page": minor
---

More details as in Obsidian. `"text".contains()`, `containsAny()` and `containsAll()` on text ignore case (`"ABC".contains("b")` is true); `startsWith`, `endsWith` and `contains` on lists stay case-sensitive (a list no longer matches `"ab"` against `"Ab"`; paths such as `people/Alice` still match however they're cased). Calling a function or method that doesn't exist shows Obsidian's error in the cell (`Cannot find function "x" on type String`) instead of an empty value. `null.isType("null")` is true, and `<`, `>`, `<=`, `>=` against an empty value are empty (not `false`). `file.file` is the file value. An object (such as `this.note`) shows its values as text. `.base` files are listed in bases like other files, as in Obsidian (a base without filters lists them). Empty values are blank in tables, as in Obsidian, instead of `—` (cards still show `—`).
