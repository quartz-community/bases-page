# Changelog

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
