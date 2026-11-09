# Changelog

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
