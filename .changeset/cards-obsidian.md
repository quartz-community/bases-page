---
"@quartz-community/bases-page": minor
---

Cards render like Obsidian's. `imageAspectRatio` is height / width, as in Obsidian (0.5 is a wide cover, 2 a tall one; default 1); it was applied inverted (bases-page#3, community PR #4). The cover is a background box the width of the card, so a theme's `img` margins or radius can't shift it, `imageFit: contain` fits the image inside it, and when the view has an `image` property, cards without an image get an empty cover of the same size. A card is no longer a link wrapped around other links, which split each card into two grid items (bases-page#10): the file name links to the note and that link covers the whole card, while links in properties open their own targets. Cards show the properties in `order` with their labels (empty values as `—`), and the file name only when `file.name` is in `order`; `order: []` shows just the cover. Cards use `file.name` as their title, as Obsidian does. Gallery thumbnails also ignore theme `img` margins.
