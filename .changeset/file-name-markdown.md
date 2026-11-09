---
"@quartz-community/bases-page": patch
---

`file.name` of a Markdown note has no extension again, as in Obsidian: `Note`, not `Note.md`. bases-page 1.1.0 made `file.name` include the extension for every file; for Markdown notes that change is **reverted**, because Obsidian gives `file.name == "Note"` (checked in Obsidian 1.12.7 and 1.15.0). Filters such as `file.name == "Note"` match again; filters written for 1.1.x as `file.name == "Note.md"` match nothing, as in Obsidian. Other files keep their extension in `file.name` (`Plan.canvas`, `Tasks.base`), so 1.1's behaviour for them stays. Notes such as `Drawing.excalidraw.md` are Markdown: their `file.name` is `Drawing.excalidraw`. The new `file.fullname` always has the extension (`Note.md`). Tables and lists show `file.name` as Obsidian does, e.g. `Plan.canvas` for a canvas.
