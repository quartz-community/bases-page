# @quartz-community/bases-page

A page type and component plugin for Quartz v5 that renders Obsidian Bases (.base files) as database-like filtered views. This plugin (v0.2.0) provides a powerful way to visualize and interact with your Obsidian data in a structured format.

## Installation

```bash
npx quartz plugin add github:quartz-community/bases-page
```

## Usage

Enable the plugin in your Quartz configuration:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/bases-page
    enabled: true
```

## Interaction with `unlisted` pages

`bases-page` respects the `file.data.unlisted` convention. Pages marked `unlisted: true` (by `@quartz-community/unlisted-pages`, or by `@quartz-community/encrypted-pages` via `unlistWhenEncrypted: true` or per-page `unlisted: true` / `stealth: true`) are excluded from every rendered base view — table, list, board, cards, gallery, and any custom view registered via `viewRegistry`. Both the main entry loop and the internal `fileLookup` used by `.asFile()` method resolution skip unlisted pages, so they cannot be dereferenced from formulas on visible pages either.

> [!note]
> Base views are **server-side rendered** HTML baked at build time. They do not update client-side after a visitor successfully decrypts an encrypted page. Graph, explorer, and search all re-hydrate from the patched in-memory content index after decryption and show newly-unlocked pages for the rest of the browser session — base views do not, because they were materialized at build time with unlisted pages already excluded. A visitor who decrypts a revealable encrypted page will see it appear in graph, explorer, and search, but **not** in any base view on the site, until the site is rebuilt with that page listed. This is the same structural limitation that applies to backlinks, recent notes, folder listings, and tag listings.

### TypeScript Override

For advanced use cases (e.g. custom view renderers), you can override in TypeScript:

```ts title="quartz.ts (override)"
import * as ExternalPlugin from "./.quartz/plugins";

ExternalPlugin.BasesPage({
  linkResolution: "shortest",
  customViews: {
    myView: ({
      entries,
      view,
      basesData,
      total,
      locale,
      slug,
      allSlugs,
      linkResolution,
      options,
    }) => {
      // return JSX
    },
  },
});
```

## Built-in Views

- **Table**: Sortable columns with automatic type rendering for strings, numbers, booleans, arrays, and links. Supports custom column widths and row heights.
- **List**: A compact list view displaying metadata chips for each entry.
- **Cards**: A card-based layout with support for an optional image property and configurable card size or aspect ratio.
- **Gallery**: An image-focused grid layout designed for visual content with configurable card sizes.
- **Board**: A Kanban-style board that groups entries by a specific property (using boardProperty or groupBy), creating columns for each group value.

## Features

- Multiple views per .base file (switchable tabs)
- Recursive filter trees (and/or/not)
- Formulas (computed properties via expression engine)
- Summaries (column aggregations: Count, Average, Min, Max, Sum, Range, Median, Stddev, Earliest, Latest, Checked, Unchecked, Empty, Filled, Unique)
- Property display configuration
- Wikilink and Markdown link rendering
- Sort and grouping

## Expression Engine

The expression engine follows a pipeline of source, lexer, Pratt parser, AST, bytecode compiler, and stack interpreter.

### Supported Types

- Strings
- Numbers
- Booleans
- Null
- Lists

### Operators

- **Arithmetic**: +, -, \*, /
- **Comparison**: ==, !=, >, <, >=, <=
- **Logical**: and / &&, or / ||, not / !

### Property Access

- `note.property`: Access a property on the current note.
- `file.name`: The name of the file, as in Obsidian: without the extension for Markdown notes (`Note`), with it for other files (`Plan.canvas`).
- `file.basename`: The name without the extension.
- `file.fullname`: The name with the extension (`Note.md`).
- `file.path`: The full path of the file.
- `file.folder`: The folder containing the file.
- `file.ext`: The file extension.
- `file.tags`: A list of tags associated with the file.
- `file.links`: A list of links in the file.
- `file.created`: The creation date of the file.
- `file.modified`: The last modification date of the file.
- `formula.name`: Access the result of another formula.

### Built-in Global Functions

- `if(condition, then, else)`
- `contains(container, item)`
- `date(string)`
- `duration(string)`
- `now()`
- `today()`
- `number(value)`
- `min(a, b, ...)`
- `max(a, b, ...)`
- `list(value)`
- `link(path, display?)`
- `image(url)`
- `icon(name)`
- `html(string)`
- `escapeHTML(string)`
- `file(path)`

### Method Functions

**Strings**

- `contains(substring)`
- `startsWith(prefix)`
- `endsWith(suffix)`
- `lower()`
- `upper()`
- `trim()`
- `replace(pattern, replacement)`
- `slice(start, end?)`
- `isEmpty()`
- `repeat(count)`
- `reverse()`

**Numbers**

- `toFixed(digits)`
- `round()`
- `floor()`
- `ceil()`
- `abs()`

**Dates**

- `format(formatString)`
- `year()`
- `month()`
- `day()`
- `time()`
- `relative()`
- `isEmpty()`

**Lists**

- `sum()`
- `mean()`
- `count()`
- `min()`
- `max()`
- `round()`

**File**

- `hasTag(tag)`
- `hasLink(link)`
- `inFolder(folder)`
- `hasProperty(property)`

## Extending with Custom Views

Community extensions can register custom view types using the view registry.

### Registering a View

```typescript
import { viewRegistry } from "@quartz-community/bases-page/registry";

viewRegistry.register({
  id: "my-custom-view",
  name: "My Custom View",
  icon: "star",
  render: (props) => {
    const { entries, view, basesData, total, locale, slug, allSlugs, linkResolution, options } =
      props;
    // Return your React/Preact component
  },
  css: `.my-custom-view { color: red; }`,
  afterDOMLoaded: `console.log("My custom view loaded");`,
  options: { enableFeatureX: true },
});
```

### Interfaces

**ViewTypeRegistration**

```typescript
interface ViewTypeRegistration {
  id: string;
  name: string;
  icon?: string;
  render: ViewRenderer;
  css?: string;
  afterDOMLoaded?: string;
  options?: Record<string, unknown>;
}
```

**ViewRendererProps**

```typescript
interface ViewRendererProps {
  entries: BasesEntry[];
  view: BasesView;
  basesData: BasesData;
  total: number;
  locale: string;
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
  options?: Record<string, unknown>;
}
```

### Passing Options to a Custom View

Community plugins can use the `options` field to accept configuration at registration time. This is useful for feature flags, API keys, or other plugin-level settings.

```typescript
import { viewRegistry } from "@quartz-community/bases-page/registry";
import type { LeafletMapPluginOptions } from "./types";

const defaultOptions: LeafletMapPluginOptions = {
  enableCopyTool: false,
};

export function registerLeafletMap(userOpts?: Partial<LeafletMapPluginOptions>): void {
  const opts = { ...defaultOptions, ...userOpts };
  viewRegistry.register({
    ...leafletMapViewRegistration,
    options: opts,
  });
}
```

In the renderer, these options are available via `props.options` and should be cast to the plugin's options type.

## Compiler API

The expression engine is available as a public API for advanced usage. Import from `@quartz-community/bases-page/compiler`.

```typescript
import {
  compile,
  evaluate,
  evaluateFilter,
  resolvePropertyValue,
} from "@quartz-community/bases-page/compiler";

// Compile an expression to bytecode
const compiled = compile("note.price * 1.2");

// Evaluate an expression in a context
const result = evaluate("note.price * 1.2", context);

// Evaluate a filter node
const isMatch = evaluateFilter(filterNode, context);

// Resolve a property path
const value = resolvePropertyValue("file.name", context);
```

### EvalContext Shape

```typescript
interface EvalContext {
  note: Record<string, unknown>;
  file: {
    name: string;
    path: string;
    folder: string;
    ext: string;
    tags: string[];
    links: string[];
    created?: string;
    modified?: string;
  };
  formula: Record<string, unknown>;
}
```

## Package Exports

- `.`: Main plugin entry (BasesPage, BasesBody, viewRegistry, registerCustomViews, compiler API, types)
- `./types`: All type definitions
- `./components`: React/Preact components (BasesBody, ViewSelector)
- `./registry`: View registry singleton and registerCustomViews helper
- `./compiler`: Expression engine (compile, evaluate, evaluateFilter, resolvePropertyValue)

## Configuration Options

| Option            | Type                                     | Default      | Description                                                                                         |
| :---------------- | :--------------------------------------- | :----------- | :-------------------------------------------------------------------------------------------------- |
| `defaultViewType` | `string`                                 | unset        | Open bases on their first view of this type. Unset, a base opens on its first view, as in Obsidian. |
| `linkResolution`  | `"absolute" \| "relative" \| "shortest"` | `"shortest"` | How to resolve internal links in view renderers. Should match your crawl-links plugin setting.      |
| `customViews`     | `Record<string, ViewRenderer>`           | `{}`         | Custom view renderers provided via TypeScript override.                                             |

## License

MIT
