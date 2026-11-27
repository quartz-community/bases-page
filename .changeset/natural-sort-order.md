---
"@quartz-community/bases-page": patch
---

Sort text as Obsidian does: naturally ("Chapter 2" before "Chapter 10"), ignoring case, and never read arbitrary text as a date. This changes the default file-name order, sorted columns and group order wherever names or values contain numbers. Values of different types no longer interleave, and entries without a value stay last when sorting descending too (they used to come first). `list.sort()` follows the same order.
