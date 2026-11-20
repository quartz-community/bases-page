---
"@quartz-community/bases-page": minor
---

Views and grouping match Obsidian:

- `type: kanban` (Obsidian 1.14+) renders as a board, with its `columnWidth` and card covers from `image` (`imageFit`, `imageAspectRatio`).
- `groupOrder` shows only the listed groups, in that order (`null` is the group without a value).
- The group of entries without a value is labelled "None" and comes last (first in a kanban view).
- List and cards views show a heading per group when the view has `groupBy`.
- List views follow `markers` (`bullet`, `number`, `none`), `separator` and `indentProperties`.
- A table's `rowHeight` (`medium`, `tall`, `extra`) gives Obsidian's row heights.
