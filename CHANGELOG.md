# Changelog

## 1.3.0

### Minor Changes

- 939bb1e: Requires Quartz 5.1 (`quartz.quartzVersion: ">=5.1.0"`): its `.base` pages rely on Quartz 5.1's filters on file-backed virtual pages and `file.data.referencedBy`. On an older Quartz the build warns, and fails in CI; update Quartz with `npx quartz upgrade`.

## 1.2.1

### Patch Changes

- a87902e: A list holding a file's plain path (`refs: ["Templates.base"]`) contains that file: `refs.contains(this)` is true, as in Obsidian.

## 1.2.0

### Minor Changes

- cd69acf: Cards render like Obsidian's. `imageAspectRatio` is height / width, as in Obsidian (0.5 is a wide cover, 2 a tall one; default 1); it was applied inverted (bases-page#3, community PR #4). The cover is a background box the width of the card, so a theme's `img` margins or radius can't shift it, `imageFit: contain` fits the image inside it, and when the view has an `image` property, cards without an image get an empty cover of the same size. A card is no longer a link wrapped around other links, which split each card into two grid items (bases-page#10): the file name links to the note and that link covers the whole card, while links in properties open their own targets. Cards show the properties in `order` with their labels (empty values as `—`), and the file name only when `file.name` is in `order`; `order: []` shows just the cover. Cards use `file.name` as their title, as Obsidian does. Gallery thumbnails also ignore theme `img` margins.
- 078ec68: Dates follow Obsidian and the site's locale (bases-page#8). Date values show as Obsidian shows them, moment's `L` for dates and `L LT` for datetimes, in Quartz's `configuration.locale` (`03/05/2024 2:30 PM` for en-US, `05.03.2024 14:30` for de-DE, `2024/03/05` for zh-CN), instead of JSON such as `"2024-03-05T00:00:00.000Z"`; date properties (`due: 2024-03-05`) display the same way. `.format()` uses the locale's month and day names and supports moment's `L`, `LL`, `LLL`, `LT`, `Do`, `dddd`, `[escaped]` and the other common tokens; `.relative()` gives moment's `3 years ago` / `vor 3 Jahren`. On date properties `.year`, `.month`, `.format()`, `.relative()`, `.date()`, `.time()` and comparisons with dates work. **Changed, as in Obsidian:** `date()` reads only ISO-style strings (`2024-03-05`, `2024-03-05 14:30`, `2024-03-05T14:30:00Z`) and `20240305`, in local time; other strings (`05/03/2024`, `March 5, 2024`, `2024/03/05`) give an empty value instead of a guess by the JavaScript `Date` parser, which read `05/03/2024` as May 3. `date(<number>)` is an error, and `.date()` returns a date (shown as a date) rather than text.
- 1c33a45: A base opens on its first view, as in Obsidian, both as a page and embedded; it used to open on the first table view. The `defaultViewType` option no longer defaults to `"table"`: set it to prefer a view type. An embed such as `![[Tasks.base#Open tasks]]` matches the view name as written, case-sensitively as Obsidian does (names with punctuation, e.g. `ratio-0.5`, now work), and a missing view shows Obsidian's message `View "Nope" not found` with the name as written. A `.base` page now links only to the notes its views show, each view with its own filters (community PR #7); it linked to every note when the filters were on the views, and so appeared in every note's backlinks.
- e0216bf: Durations work as in Obsidian (bases-page#15). Subtracting two dates gives a duration, shown like Obsidian shows it (`9 days`, `an hour`, `a month`, without a sign), instead of a number of milliseconds. Its fields `.days`, `.hours`, `.minutes`, `.seconds`, `.milliseconds`, `.weeks` are fractional and keep the sign (`(b - a).days.round()`); `.months` and `.years` count calendar months from today. `duration("1 week")`, `date + "1d"`, `date - duration("1M")` and `date + (a - b)` work; `duration * 2` and `duration / 2` stay durations; durations compare with durations, with duration strings (`> "1w"`) and with milliseconds. **Changed, as in Obsidian:** `duration()` accepts one whole number and one unit (`1d`, `2 weeks`, `90 seconds`; not `1y 2M` or `1.5h`); `2 * duration`, `date + 1`, `number(duration)` and `duration.round()` are errors, and a formula's error is shown in its cell instead of an empty value; date-only strings in `date()` are local midnight like datetimes (they were UTC midnight, which put `date("2024-03-10 12:30") - date("2024-03-01")` an hour off). Date properties such as `due: 2024-03-05` are dates in formulas, so `today() - due` works.
- 4c73661: `link()` and links as in Obsidian. Any URL scheme makes `link()` an external link with that exact href (`mailto:`, `obsidian://`, `ftp://` …, not only `http(s)` as in community PR #17); other targets are links to notes. A link to a heading shows `Note > Heading` instead of `Note#Heading`. Links to notes that don't exist get Quartz's `broken` class. `file.asLink()` links to the file's full path and shows it as Obsidian does (`folder/Note.md`). **Changed, as in Obsidian:** a text value holding a Markdown link (`[x](https://…)`) or a URL inside longer text is shown as text; a value that is just a URL is still a link.
- e35cdbc: Tags work as in Obsidian (bases-page#9). `file.tags.contains("a/b")`, `contains(file.tags, …)`, `containsAny`/`containsAll` and `file.hasTag("a/b")` match the tag and its nested tags (`a/b/c`), by whole segments (`CC` does not match `CCX`), ignoring case and a leading `#`. `file.hasTag("x", "y")` is true when the note has any of the tags (it was all of them). **Changed, as in Obsidian:** `file.tags` lists the tags as written, with `#` and their original case (`#Src/OSE/cc`), inline tags first; the `tags` property holds only the frontmatter tags (inline tags no longer leak into it), and a frontmatter string such as `"a, b"` is one tag, not two.
- 9d0ae43: More details as in Obsidian. `"text".contains()`, `containsAny()` and `containsAll()` on text ignore case (`"ABC".contains("b")` is true); `startsWith`, `endsWith` and `contains` on lists stay case-sensitive (a list no longer matches `"ab"` against `"Ab"`; paths such as `people/Alice` still match however they're cased). Calling a function or method that doesn't exist shows Obsidian's error in the cell (`Cannot find function "x" on type String`) instead of an empty value. `null.isType("null")` is true, and `<`, `>`, `<=`, `>=` against an empty value are empty (not `false`). `file.file` is the file value. An object (such as `this.note`) shows its values as text. `.base` files are listed in bases like other files, as in Obsidian (a base without filters lists them). Empty values are blank in tables, as in Obsidian, instead of `—` (cards still show `—`).
- 331eb72: Tags in tables, lists, cards and boards link to their tag pages (community PR #18), the static equivalent of Obsidian's tag pills: `tags`, `note.tags` and `file.tags` columns, and tag values returned by formulas (`file.tags[0]`), show each tag without `#` and in its original case. Without tag pages (the tag-page plugin disabled), or for a value that is not a valid tag, a tag is plain text.
- ce9f2a2: `this` works as in Obsidian (community PR #2). In a base embedded in a note, `this.<key>` and `this.note.<key>` are the note's properties (`this.status`, `this.note["file"]` for a property named `file`), `this.file` is its file, and `this` shows as a link to it. Opened as its own page, `this` is the `.base` file, without properties, and `file.hasLink(this.file)` finds the notes that embed the base. Several bases on one page are independent: a note with embedded bases and an inline ` ```base ` block showed the inline block in place of the first embed, and "View not found" for the next one. **Changed, as in Obsidian:** `file.folder` of a file at the root of the vault is `/` (it was empty); `file.inFolder("/")` and `file.inFolder("")` still match every file.

### Patch Changes

- e6bd7b5: `file.name` of a Markdown note has no extension again, as in Obsidian: `Note`, not `Note.md`. bases-page 1.1.0 made `file.name` include the extension for every file; for Markdown notes that change is **reverted**, because Obsidian gives `file.name == "Note"` (checked in Obsidian 1.12.7 and 1.15.0). Filters such as `file.name == "Note"` match again; filters written for 1.1.x as `file.name == "Note.md"` match nothing, as in Obsidian. Other files keep their extension in `file.name` (`Plan.canvas`, `Tasks.base`), so 1.1's behaviour for them stays. Notes such as `Drawing.excalidraw.md` are Markdown: their `file.name` is `Drawing.excalidraw`. The new `file.fullname` always has the extension (`Note.md`). Tables and lists show `file.name` as Obsidian does, e.g. `Plan.canvas` for a canvas.
- 68ec1ec: Stop bundling `preact` and the other `SINGLETON_EXTERNALS`. tsup checks `noExternal` first, so `noExternal: [/.*/]` overrode them, and views rendered with a second copy of Preact that breaks other plugins' hooks.
- 7395868: `link()` with an external URL (e.g. `link("https://" + subdomain, subdomain)`) renders an external link with that URL, instead of a wikilink that was resolved as an internal page.

## 1.1.2

### Patch Changes

- e0be3b5: A `.base` page carries the `.base` file's paths (`filePath`, `relativePath`) instead of a synthetic `<slug>.md`, like canvas pages. With Quartz 5.1, which runs the site's publish filters on these pages, explicit-publish can tell it is a file without frontmatter and publishes it only when a published note links to it (#11); the content index lists its real path.

## 1.1.1

### Patch Changes

- 7156986: `file.hasLink(this)` in a base embedded in a note lists the notes that link to it, as in Obsidian. `hasLink` now accepts `this`, a file (`this.file`), a link (`link("Alice")`, `"[[Alice]]"`) or a path, and a link to one of the file's headings or blocks counts as a link to the file (#23).

## 1.1.0

### Minor Changes

- 6ee2eda: `file.name` includes the file's extension, as in Obsidian: `Note.md`, `Plan.canvas`. Use `file.basename` for the name without it. Filters, formulas and sorting that compare `file.name` (`file.name == "Plan.canvas"`, `file.name.endsWith(".canvas")`) now give the same results as in Obsidian. **Changed:** a filter written for the old value, such as `file.name == "Note"`, needs `file.basename` instead. Tables still show the name without the extension as the link to each file.

### Patch Changes

- 3e6b70b: Resolve wikilink-valued strings (`[[note]]`, `[[note|alias]]`, `[[note#heading]]`) the way Obsidian does, so link-valued frontmatter such as `location: "[[note]]"` works in `asFile()`, `link()` and `list.contains(this)`. Like Obsidian, `link()` keeps a wikilink's `#heading` but not its alias, so the link text is the note's name.
- 9cda99f: Fix `this` in bases embedded in notes and stop listing Quartz's generated pages as notes:

  - `this.file` is now the full file of the note the base is embedded in, so `this.file.asLink()` works. Filters such as `file.links.contains(this.file.asLink())` and `authors.contains(this.file.asLink())` match the notes that link to the embedding note, and a link property matches whether it holds one link or a list of links. `contains()` with a missing value no longer matches every note.
  - `file.inFolder(this.file.folder)` in a note at the content root now matches every note, as in Obsidian. `inFolder("")` and `inFolder("/")` both mean the root.
  - Pages that Quartz generates, such as the 404 page, tag pages, the tags index and folder listings, no longer appear as notes in base views.

- 584d465: Bundles `@quartz-community/utils` 1.1.0: a short wikilink to an Obsidian folder note (`[[Topic]]` for `Topic/Topic.md`) reaches the folder page, and anchors to headings use the same slug as heading ids. `github-slugger` is no longer a dependency of this plugin.

## 1.0.1

### Patch Changes

- 968fa70: Releases are published from GitHub Actions with npm trusted publishing, so each version on npm now carries provenance linking it to the commit and workflow that built it. No changes to the package itself.

## 1.0.0

### Major Changes

- Stable 1.0 release. All `@quartz-community/*` dependencies now use `^1.0.0` ranges.

  Pre-1.0 caret ranges pinned the minor version (`^0.2.1` means `>=0.2.1 <0.3.0`), so
  published fixes to shared packages could never be resolved by dependents. Moving the
  ecosystem to 1.0 makes caret ranges behave conventionally.

## 0.2.2

### Patch Changes

- 0728d19: Fix transclusion of base views with spaces in the name. The OFM plugin slugifies the fragment (e.g., `French Philosophers` → `french-philosophers`) but the view lookup expected the original name. View matching now normalizes both sides by lowercasing and replacing spaces with hyphens.

## 0.2.1

### Patch Changes

- 2858f17: Fix mixed-case tags not matching in bases filters. Tags are slugified during content processing but the filter comparison did not normalize case, causing `file.tags.contains("My-Tag")` to fail when the stored tag was `"my-tag"`.

  Add `MMM` (abbreviated month name) and `MMMM` (full month name) tokens to the date `format()` function. Previously these tokens were not recognized, causing `file.ctime.format("MMM")` to return the raw token string instead of month names like "Jan" or "January".

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `options` field on `ViewTypeRegistration` — community plugins can pass user-supplied configuration (e.g. feature flags) that gets forwarded to every render invocation via `ViewRendererProps.options`.
- `options` field on `ViewRendererProps` — view renderers receive registration-time options as `Record<string, unknown>`.
- `slug`, `allSlugs`, and `linkResolution` fields on `ViewRendererProps` — view renderers can now resolve internal links correctly.
- `css` and `afterDOMLoaded` fields on `ViewTypeRegistration` — community view types can inject per-page styles and client-side scripts.
- `linkResolution` plugin option (`"absolute" | "relative" | "shortest"`) — controls how internal links are resolved in view renderers, matching the crawl-links plugin setting.

### Fixed

- Added `yaml` and `unist-util-visit` to devDependencies (were listed as peer dependencies but missing from devDependencies, causing `tsc --noEmit` failures).
- Respect the `file.data.unlisted` convention in `resolveBasesEntries`. Pages marked `unlisted: true` are now excluded from every rendered base view (table, list, board, cards, gallery, and any custom view registered via `viewRegistry`), regardless of whether the base's filter expression would otherwise match them. Fixes a privacy leak where encrypted-unlisted and plain-unlisted pages showed up in base views built from queries like `file.ext == "md"` that matched the entire content directory. Both the main entry loop and the internal `fileLookup` used by `.asFile()` method resolution are filtered, so unlisted pages also cannot be dereferenced from formulas on visible pages. The convention is the same one respected by `content-index`, `search`, `backlinks`, `recent-notes`, `folder-page`, and `tag-page`, and is written by `@quartz-community/unlisted-pages` and `@quartz-community/encrypted-pages` (when `unlistWhenEncrypted` or per-page `unlisted: true`/`stealth: true` is set).

## [0.2.0]

### Added

- Initial Quartz community plugin template.
