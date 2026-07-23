import type { ComponentChild } from "preact";

// Re-export needed types from @quartz-community/types
export type {
  BuildCtx,
  FullSlug,
  FilePath,
  ProcessedContent,
  QuartzPluginData,
  PageMatcher,
  PageGenerator,
  VirtualPage,
  QuartzPageTypePlugin,
  QuartzPageTypePluginInstance,
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
  GlobalConfiguration,
} from "@quartz-community/types";

// === View Registry Types ===

/** Props passed to every view renderer */
export interface ViewRendererProps {
  entries: BasesEntry[];
  view: BasesView;
  basesData: BasesData;
  total: number;
  locale: string;
  /** Slug of the page rendering this view (for resolving relative paths) */
  slug: string;
  /** All known slugs in the site (for `transformLink` with `shortest` strategy) */
  allSlugs: string[];
  /** Link resolution strategy ("absolute" | "relative" | "shortest"). Passed from plugin options. */
  linkResolution: "absolute" | "relative" | "shortest";
  /** Plugin-level options from the view type registration, if any. */
  options?: Record<string, unknown>;
}

/** View renderer function signature */
export type ViewRenderer = (props: ViewRendererProps) => ComponentChild;

/** Registration record for a view type */
export interface ViewTypeRegistration {
  /** Unique view type identifier, e.g. "table", "board", "my-custom-view" */
  id: string;
  /** Human-readable display name shown in the view selector */
  name: string;
  /** Optional Lucide icon name */
  icon?: string;
  /** The render function producing Preact JSX */
  render: ViewRenderer;
  /**
   * Optional CSS string injected once per page when this view type is active.
   * Deduplicated by view type ID — only injected once even if multiple views
   * of the same type appear on the page.
   */
  css?: string;
  /**
   * Optional client-side script injected once per page when this view type is
   * active. Runs after the DOM is loaded, following the same lifecycle as
   * `QuartzComponent.afterDOMLoaded`. Deduplicated by view type ID.
   */
  afterDOMLoaded?: string;
  /**
   * Optional user-supplied configuration for this view type. Community plugins
   * can use this to accept plugin-level options (e.g. feature flags, CDN URLs)
   * that are set once at registration time and passed through to every render
   * invocation via `ViewRendererProps.options`.
   */
  options?: Record<string, unknown>;
}

// === Plugin Options ===

/** Plugin options for BasesPage */
export interface BasesPageOptions {
  /** Default view type when none specified. Default: "table" */
  defaultViewType?: string;
  /**
   * Custom view renderers passed via TS config override.
   * Keys are view type IDs. These are registered into the ViewRegistry
   * at plugin init time, alongside (or overriding) built-in views.
   */
  customViews?: Record<string, ViewRenderer>;
  /**
   * How to resolve internal links in view renderers. Should match the
   * `markdownLinkResolution` setting of the crawl-links plugin.
   * Default: "shortest"
   */
  linkResolution?: "absolute" | "relative" | "shortest";
}

// === Sort & Filter Types ===

/** Sort direction */
export type SortDirection = "ASC" | "DESC";

/** Sort entry — one column + direction pair */
export interface SortEntry {
  property: string;
  direction?: SortDirection;
}

/** Filter tree node — recursive and/or/not structure matching Obsidian spec */
export type FilterNode =
  string | { and: FilterNode[] } | { or: FilterNode[] } | { not: FilterNode[] };

/** Group-by configuration */
export interface GroupBy {
  property: string;
  direction?: SortDirection;
}

/** Summary type — built-in aggregation functions + extensible string for custom */
export type SummaryType =
  | "Count"
  | "Average"
  | "Min"
  | "Max"
  | "Sum"
  | "Range"
  | "Median"
  | "Stddev"
  | "Earliest"
  | "Latest"
  | "Checked"
  | "Unchecked"
  | "Empty"
  | "Filled"
  | "Unique"
  | string;

/** Property display configuration */
export interface PropertyConfig {
  displayName?: string;
}

// === View Definition ===

/** View definition from .base file YAML — matches full Obsidian spec */
export interface BasesView {
  /** View type identifier */
  type: string;
  /** Display name for this view (shown in view selector tab) */
  name?: string;
  /** Maximum number of entries to display */
  limit?: number;
  /** Group entries by a property */
  groupBy?: GroupBy;
  /** View-specific filters (merged with global filters at resolve time) */
  filters?: FilterNode;
  /** Sort order — list of property paths in priority order */
  order?: string[];
  /** Multi-key sort with explicit direction per column */
  sort?: SortEntry[];
  /** Per-property summary aggregations */
  summaries?: Record<string, SummaryType>;

  // -- Table-specific --
  /** Column widths in pixels, keyed by property path */
  columnSize?: Record<string, number>;
  /** Row height in pixels */
  rowHeight?: number;

  // -- Cards / Gallery specific --
  /** Property name containing the image URL/path */
  image?: string;
  /** Card width (unitless ratio or pixels depending on renderer) */
  cardSize?: number;
  /** Image aspect ratio (width:height, e.g. 1 for square). Obsidian spec field. */
  imageAspectRatio?: number;
  /** Image fit mode: "cover" (crop to fill) or "contain" (scale to fit). Default: "cover". */
  imageFit?: "cover" | "contain";
  /**
   * @deprecated Use imageAspectRatio instead. Kept for backwards compatibility.
   */
  cardAspect?: number;

  // -- Calendar specific --
  /** Property path for the date field */
  date?: string;
  /** Alias for date */
  dateField?: string;
  /** Alias for date */
  dateProperty?: string;

  // -- Board specific --
  /** Property to group board columns by (if not using groupBy) */
  boardProperty?: string;

  /** Escape hatch for future/unknown view-specific fields */
  [key: string]: unknown;
}

// === Top-Level .base File Structure ===

/** Parsed .base file data — top-level YAML structure */
export interface BasesData {
  /** Global filters applied to all views */
  filters?: FilterNode;
  /** Formula definitions — keys are formula names, values are expressions */
  formulas?: Record<string, string>;
  /** Property display configuration */
  properties?: Record<string, PropertyConfig>;
  /** Global summary configuration */
  summaries?: Record<string, string>;
  /** View definitions — each entry defines one tab/view */
  views?: BasesView[];
}

// === Resolved Entry ===

/** Resolved entry — a single note that matched the base query */
export interface BasesEntry {
  /** The note's slug (URL path) */
  slug: string;
  /** Display title */
  title: string;
  /** All frontmatter properties (raw) */
  properties: Record<string, unknown>;
  /** File metadata properties */
  fileProperties: {
    name: string;
    basename: string;
    path: string;
    folder: string;
    ext: string;
    tags: string[];
    links: string[];
    embeds?: string[];
    created?: string | Date;
    modified?: string | Date;
    ctime?: Date;
    mtime?: Date;
    size?: number;
  };
  /** Computed formula values */
  formulaValues: Record<string, unknown>;
}
