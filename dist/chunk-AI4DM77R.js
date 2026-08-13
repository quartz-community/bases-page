import { createRequire } from 'module';
import { viewRegistry, registerCustomViews } from './chunk-2AUMER56.js';
import { u, evaluate, evaluateFilter, resolvePropertyValue, S, transformLink, slugifyPath } from './chunk-X2AZ5GOJ.js';

createRequire(import.meta.url);

// src/components/ViewSelector.tsx
function ViewSelector({ views, activeIndex }) {
  if (views.length <= 1) return null;
  return /* @__PURE__ */ u("div", { class: "bases-view-tabs", role: "tablist", children: views.map((view, index) => /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      class: index === activeIndex ? "is-active" : "",
      "data-view-index": index,
      children: view.name ?? view.type
    }
  )) });
}

// src/resolver.ts
function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === "string");
}
function getFilePath(fileData, slug) {
  if (typeof fileData.relativePath === "string") return fileData.relativePath;
  if (typeof fileData.filePath === "string") return fileData.filePath;
  return slug ? `${slug}.md` : "";
}
function getFileName(path) {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}
function getBaseName(path) {
  const fileName = getFileName(path);
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return void 0;
}
function buildFileProperties(fileData, slug, frontmatter) {
  const filePath = getFilePath(fileData, slug);
  const baseName = filePath ? getBaseName(filePath) : getBaseName(slug);
  const name = baseName || slug.split("/").pop() || "Untitled";
  const basename = baseName || slug.split("/").pop() || "Untitled";
  const lastSlash = filePath.lastIndexOf("/");
  const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot >= 0 ? filePath.slice(lastDot + 1) : "";
  const tags = normalizeStringArray(frontmatter.tags);
  const links = normalizeStringArray(fileData.links ?? fileData.outgoingLinks);
  const embeds = normalizeStringArray(fileData.embeds);
  const dates = fileData.dates;
  const ctime = toDate(dates?.created);
  const mtime = toDate(dates?.modified);
  return {
    name,
    basename,
    path: filePath,
    folder,
    ext,
    tags,
    links,
    embeds,
    created: ctime?.toISOString(),
    modified: mtime?.toISOString(),
    ctime,
    mtime
  };
}
function compareSort(a, b) {
  if (a === b) return 0;
  if (a === void 0 || a === null) return 1;
  if (b === void 0 || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const dateA = typeof a === "string" ? Date.parse(a) : NaN;
  const dateB = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  return String(a).localeCompare(String(b));
}
function buildSortKeys(view) {
  if (view?.sort && view.sort.length > 0) return view.sort;
  if (view?.groupBy?.property) {
    return [{ property: view.groupBy.property, direction: view.groupBy.direction ?? "ASC" }];
  }
  if (view?.order && view.order.length > 0) {
    return view.order.map((property) => ({ property, direction: "ASC" }));
  }
  return [];
}
function sortEntries(entries, view) {
  const sortKeys = buildSortKeys(view);
  if (sortKeys.length === 0) return entries;
  return [...entries].sort((left, right) => {
    for (const key of sortKeys) {
      const sign = key.direction === "DESC" ? -1 : 1;
      const leftValue = resolvePropertyValue(key.property, {
        note: left.properties,
        file: left.fileProperties,
        formula: left.formulaValues
      });
      const rightValue = resolvePropertyValue(key.property, {
        note: right.properties,
        file: right.fileProperties,
        formula: right.formulaValues
      });
      const cmp = compareSort(leftValue, rightValue);
      if (cmp !== 0) return sign * cmp;
    }
    return 0;
  });
}
function resolveBasesEntries(basesData, allFiles, view, selfContext) {
  const entries = [];
  const formulas = basesData.formulas ?? {};
  const fileLookup = /* @__PURE__ */ new Map();
  for (const fd of allFiles) {
    if (fd.unlisted === true) continue;
    const fdSlug = typeof fd.slug === "string" ? fd.slug : "";
    if (!fdSlug) continue;
    const fdPath = getFilePath(fd, fdSlug);
    const fm = fd.frontmatter ?? {};
    const fp = buildFileProperties(fd, fdSlug, fm);
    const fileValue = { ...fp, properties: fm };
    fileLookup.set(fdPath, fileValue);
    const withoutExt = fdPath.replace(/\.md$/, "");
    if (withoutExt !== fdPath) fileLookup.set(withoutExt, fileValue);
    if (fdSlug && !fileLookup.has(fdSlug)) {
      fileLookup.set(fdSlug, fileValue);
    }
    const base = getBaseName(fdPath);
    if (base && !fileLookup.has(base)) {
      fileLookup.set(base, fileValue);
    }
  }
  for (const fileData of allFiles) {
    if (fileData.unlisted === true) continue;
    const slug = typeof fileData.slug === "string" ? fileData.slug : "";
    if (!slug) continue;
    const filePath = typeof fileData.filePath === "string" ? fileData.filePath : "";
    if (filePath.endsWith(".base") || slug.endsWith(".base")) continue;
    const frontmatter = fileData.frontmatter ?? {};
    const fileProperties = buildFileProperties(fileData, slug, frontmatter);
    const context = {
      note: frontmatter,
      file: { ...fileProperties, properties: frontmatter },
      formula: {},
      self: selfContext,
      _fileLookup: fileLookup
    };
    for (const [name, expr] of Object.entries(formulas)) {
      context.formula[name] = evaluate(expr, context);
    }
    if (!evaluateFilter(basesData.filters, context)) continue;
    if (view?.filters && !evaluateFilter(view.filters, context)) continue;
    const title = typeof frontmatter.title === "string" ? frontmatter.title : fileProperties.basename || slug.split("/").pop() || "Untitled";
    entries.push({
      slug,
      title,
      properties: frontmatter,
      fileProperties,
      formulaValues: context.formula
    });
  }
  const total = entries.length;
  const sorted = sortEntries(entries, view);
  const limited = view?.limit ? sorted.slice(0, view.limit) : sorted;
  return { entries: limited, total };
}

// src/i18n/locales/en-US.ts
var en_US_default = {
  components: {
    bases: {
      title: "Base",
      noData: "No data found.",
      noViews: "No views defined.",
      mapPlaceholder: "Map view is not available in static builds.",
      allNotes: "All notes",
      allEntries: "All entries",
      galleryView: "Gallery",
      boardView: "Board",
      noImage: "No image available",
      uncategorized: "Uncategorized",
      showingCount: "Showing {count} of {total} entries"
    }
  }
};

// src/i18n/index.ts
var locales = {
  "en-US": en_US_default
};
function i18n(locale) {
  return locales[locale] || en_US_default;
}

// src/components/shared/links.tsx
var WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
var MDLINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
var URL_RE = /https?:\/\/[^\s<>]+/g;
function renderTextWithLinks(text, ctx) {
  const segments = [];
  const transformOpts = {
    strategy: ctx.linkResolution,
    allSlugs: ctx.allSlugs
  };
  for (const match of text.matchAll(WIKILINK_RE)) {
    const target = match[1] ?? "";
    const display = match[2] ?? target;
    const href = transformLink(ctx.slug, target, transformOpts);
    segments.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      node: /* @__PURE__ */ u("a", { href, class: "internal internal-link", children: display })
    });
  }
  for (const match of text.matchAll(MDLINK_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const overlaps = segments.some((segment) => start < segment.end && end > segment.start);
    if (overlaps) continue;
    const display = match[1] ?? "";
    const href = match[2] ?? "";
    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    const resolvedHref = isExternal ? href : String(transformLink(ctx.slug, href, transformOpts));
    segments.push({
      start,
      end,
      node: /* @__PURE__ */ u(
        "a",
        {
          href: resolvedHref,
          class: isExternal ? "external external-link" : "internal internal-link",
          ...isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {},
          children: display || href
        }
      )
    });
  }
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const overlaps = segments.some((segment) => start < segment.end && end > segment.start);
    if (overlaps) continue;
    segments.push({
      start,
      end,
      node: /* @__PURE__ */ u("a", { href: match[0], class: "external external-link", target: "_blank", rel: "noopener noreferrer", children: match[0] })
    });
  }
  if (segments.length === 0) return [text];
  segments.sort((a, b) => a.start - b.start);
  const result = [];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.start > cursor) {
      result.push(text.slice(cursor, segment.start));
    }
    result.push(segment.node);
    cursor = segment.end;
  }
  if (cursor < text.length) {
    result.push(text.slice(cursor));
  }
  return result;
}

// src/components/shared/cell.tsx
function isFileValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return typeof record.name === "string" && typeof record.basename === "string" && typeof record.path === "string" && typeof record.folder === "string" && typeof record.ext === "string";
}
function formatValue(value) {
  if (value === void 0 || value === null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function renderCellValue(value, ctx) {
  if (value === null || value === void 0) {
    return /* @__PURE__ */ u("span", { class: "bases-empty", children: "\u2014" });
  }
  if (typeof value === "boolean") {
    return /* @__PURE__ */ u("input", { type: "checkbox", checked: value, disabled: true });
  }
  if (typeof value === "number") {
    return /* @__PURE__ */ u("span", { class: "bases-number", children: value });
  }
  if (typeof value === "string") {
    const parts = renderTextWithLinks(value, ctx);
    return /* @__PURE__ */ u("span", { class: "bases-text", children: parts });
  }
  if (Array.isArray(value)) {
    const items = value.map((item, index) => /* @__PURE__ */ u(S, { children: [
      index > 0 && /* @__PURE__ */ u("span", { class: "bases-separator", children: ", " }),
      renderCellValue(item, ctx)
    ] }));
    return /* @__PURE__ */ u("span", { class: "bases-list", children: items });
  }
  if (typeof value === "object") {
    if (isFileValue(value)) {
      const href = transformLink(
        ctx.slug,
        slugifyPath(value.path.replace(/\.md$/, "")),
        {
          strategy: ctx.linkResolution,
          allSlugs: ctx.allSlugs
        }
      );
      return /* @__PURE__ */ u("a", { href, class: "internal internal-link", children: value.basename });
    }
    return /* @__PURE__ */ u("code", { children: JSON.stringify(value) });
  }
  return String(value);
}
function isEmptyValue(value) {
  if (value === void 0 || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
function getColumnLabel(column, basesData) {
  const config = basesData.properties?.[column];
  if (config?.displayName) return config.displayName;
  const segment = column.split(".").pop() ?? column;
  return segment.split("_").map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join(" ");
}
function getColumns(view, basesData, entries) {
  if (view.order && view.order.length > 0) return view.order;
  const columns = /* @__PURE__ */ new Set();
  columns.add("file.name");
  const propertyKeys = basesData.properties ? Object.keys(basesData.properties) : [];
  if (propertyKeys.length > 0) {
    propertyKeys.forEach((key) => {
      columns.add(key);
    });
  } else if (entries.length > 0) {
    const firstEntry = entries[0];
    if (firstEntry) {
      Object.keys(firstEntry.properties).forEach((key) => {
        columns.add(key);
      });
    }
  }
  return Array.from(columns);
}
function getNestedValue(value, path) {
  let current = value;
  for (const segment of path) {
    if (segment === "") continue;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) return void 0;
      current = current[index];
      continue;
    }
    if (current && typeof current === "object") {
      const record = current;
      current = record[segment];
      continue;
    }
    return void 0;
  }
  return current;
}
function resolveEntryPropertyValue(column, entry) {
  if (column.startsWith("note.")) {
    return getNestedValue(entry.properties, column.slice(5).split("."));
  }
  if (column.startsWith("file.")) {
    return getNestedValue(entry.fileProperties, column.slice(5).split("."));
  }
  if (column.startsWith("formula.")) {
    return getNestedValue(entry.formulaValues, column.slice(8).split("."));
  }
  return getNestedValue(entry.properties, column.split("."));
}

// src/components/views/board.tsx
function formatMessage(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var BoardView = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution
}) => {
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property ?? view.boardProperty;
  const columns = getColumns(view, basesData, entries).filter((column) => column !== groupProperty);
  const groups = /* @__PURE__ */ new Map();
  const emptyLabel = groupProperty ? localeStrings.uncategorized : localeStrings.allEntries;
  const transformOpts = { strategy: linkResolution, allSlugs };
  for (const entry of entries) {
    const rawValue = groupProperty ? resolveEntryPropertyValue(groupProperty, entry) : void 0;
    const label = isEmptyValue(rawValue) ? emptyLabel : formatValue(rawValue);
    const key = label || emptyLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(key, { label: key, entries: [entry] });
    }
  }
  if (groups.size === 0) {
    groups.set(localeStrings.allEntries, { label: localeStrings.allEntries, entries });
  }
  return /* @__PURE__ */ u("div", { class: "bases-board-wrapper", children: [
    /* @__PURE__ */ u("div", { class: "bases-view-meta", children: formatMessage(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ u("div", { class: "bases-board", children: Array.from(groups.values()).map((group) => /* @__PURE__ */ u("div", { class: "bases-board-column", children: [
      /* @__PURE__ */ u("div", { class: "bases-board-column-header", children: [
        /* @__PURE__ */ u("span", { children: group.label }),
        /* @__PURE__ */ u("span", { class: "bases-board-count", children: group.entries.length })
      ] }),
      /* @__PURE__ */ u("div", { class: "bases-board-column-body", children: group.entries.map((entry) => {
        const ctx = { slug, allSlugs, linkResolution };
        return /* @__PURE__ */ u("div", { class: "bases-board-card", children: [
          /* @__PURE__ */ u(
            "a",
            {
              href: transformLink(slug, entry.slug, transformOpts),
              class: "internal internal-link",
              "data-slug": entry.slug,
              children: entry.title
            }
          ),
          columns.length > 0 && /* @__PURE__ */ u("div", { class: "bases-board-card-meta", children: columns.map((column) => {
            const value = resolveEntryPropertyValue(column, entry);
            if (isEmptyValue(value)) return null;
            return /* @__PURE__ */ u("div", { class: "bases-board-card-row", children: [
              /* @__PURE__ */ u("span", { class: "bases-board-card-label", children: getColumnLabel(column, basesData) }),
              /* @__PURE__ */ u("span", { class: "bases-board-card-value", children: renderCellValue(value, ctx) })
            ] });
          }) })
        ] });
      }) })
    ] })) })
  ] });
};
var boardViewRegistration = {
  id: "board",
  name: "Board",
  icon: "columns",
  render: BoardView
};

// src/components/views/cards.tsx
function formatMessage2(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var HEX_COLOR_RE = /^#(?:[0-9a-f]{3}){1,2}$/i;
var WIKILINK_RE2 = /^\[\[(.+?)(?:\|.*)?\]\]$/;
function resolveImageSrc(raw, opts) {
  if (!raw) return { src: "", isColor: false };
  if (HEX_COLOR_RE.test(raw)) {
    return { src: raw, isColor: true };
  }
  const wikiMatch = WIKILINK_RE2.exec(raw);
  if (wikiMatch?.[1]) {
    const target = wikiMatch[1].trim();
    const resolved = transformLink(opts.slug, target, {
      strategy: opts.linkResolution,
      allSlugs: opts.allSlugs
    });
    return { src: String(resolved), isColor: false };
  }
  return { src: raw, isColor: false };
}
var CardsView = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution
}) => {
  const imageProperty = typeof view.image === "string" ? view.image : void 0;
  const cardMetaColumns = view.order && view.order.length > 0 ? view.order.filter((column) => column !== imageProperty && column !== "file.name") : [];
  const localeStrings = i18n(locale).components.bases;
  const cardSize = view.cardSize;
  const rawAspectRatio = view.imageAspectRatio ?? view.cardAspect;
  const aspectRatio = typeof rawAspectRatio === "number" && rawAspectRatio > 0 ? 1 / rawAspectRatio : rawAspectRatio;
  const imageFit = view.imageFit === "contain" ? "contain" : "cover";
  const gridStyle = typeof cardSize === "number" && cardSize > 0 ? { gridTemplateColumns: `repeat(auto-fit, minmax(${cardSize}px, 1fr))` } : void 0;
  const imageOpts = { slug, allSlugs, linkResolution };
  const transformOpts = { strategy: linkResolution, allSlugs };
  return /* @__PURE__ */ u("div", { class: "bases-cards-wrapper", children: [
    entries.length < total && /* @__PURE__ */ u("div", { class: "bases-view-meta", children: formatMessage2(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ u("div", { class: "bases-cards", style: gridStyle, children: entries.map((entry) => {
      const ctx = { slug, allSlugs, linkResolution };
      const imageValue = imageProperty ? resolveEntryPropertyValue(imageProperty, entry) : void 0;
      const rawImage = imageValue ? String(imageValue) : "";
      const { src: imageSrc, isColor } = resolveImageSrc(rawImage, imageOpts);
      const imageAspect = typeof aspectRatio === "number" && aspectRatio > 0 ? { aspectRatio: String(aspectRatio) } : void 0;
      const href = transformLink(slug, entry.slug, transformOpts);
      return /* @__PURE__ */ u("a", { href, class: "internal internal-link bases-card", "data-slug": entry.slug, children: [
        imageSrc && !isColor && /* @__PURE__ */ u("div", { class: "bases-card-image", style: imageAspect, children: /* @__PURE__ */ u(
          "img",
          {
            src: imageSrc,
            alt: entry.title,
            loading: "lazy",
            style: { objectFit: imageFit }
          }
        ) }),
        imageSrc && isColor && /* @__PURE__ */ u(
          "div",
          {
            class: "bases-card-image bases-card-color",
            style: { ...imageAspect, backgroundColor: imageSrc }
          }
        ),
        /* @__PURE__ */ u("div", { class: "bases-card-body", children: [
          /* @__PURE__ */ u("span", { class: "bases-card-title", children: entry.title }),
          /* @__PURE__ */ u("div", { class: "bases-card-meta", children: cardMetaColumns.map((column) => {
            const value = resolveEntryPropertyValue(column, entry);
            if (isEmptyValue(value)) return null;
            return /* @__PURE__ */ u("div", { class: "bases-card-row", title: getColumnLabel(column, basesData), children: /* @__PURE__ */ u("span", { class: "bases-card-value", children: renderCellValue(value, ctx) }) });
          }) })
        ] })
      ] });
    }) })
  ] });
};
var cardsViewRegistration = {
  id: "cards",
  name: "Cards",
  icon: "layout-grid",
  render: CardsView
};

// src/components/views/gallery.tsx
function formatMessage3(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var GalleryView = ({
  entries,
  view,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution
}) => {
  const imageProperty = typeof view.image === "string" ? view.image : void 0;
  const localeStrings = i18n(locale).components.bases;
  const columns = typeof view.cardSize === "number" && view.cardSize > 0 ? Math.round(view.cardSize) : 3;
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  const imageOpts = { slug, allSlugs, linkResolution };
  const transformOpts = { strategy: linkResolution, allSlugs };
  return /* @__PURE__ */ u("div", { class: "bases-gallery-wrapper", children: [
    /* @__PURE__ */ u("div", { class: "bases-view-meta", children: formatMessage3(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ u("div", { class: "bases-gallery", style: gridStyle, children: entries.map((entry) => {
      const imageValue = imageProperty ? resolveEntryPropertyValue(imageProperty, entry) : void 0;
      const rawImage = imageValue ? String(imageValue) : "";
      const { src: imageSrc, isColor } = resolveImageSrc(rawImage, imageOpts);
      return /* @__PURE__ */ u("div", { class: "bases-gallery-item", children: [
        /* @__PURE__ */ u("div", { class: "bases-gallery-image", children: imageSrc && !isColor ? /* @__PURE__ */ u("img", { src: imageSrc, alt: entry.title, loading: "lazy" }) : imageSrc && isColor ? /* @__PURE__ */ u("span", { class: "bases-gallery-placeholder", style: { background: imageSrc } }) : /* @__PURE__ */ u(
          "span",
          {
            class: "bases-gallery-placeholder",
            role: "img",
            "aria-label": localeStrings.noImage
          }
        ) }),
        /* @__PURE__ */ u("div", { class: "bases-gallery-title", children: /* @__PURE__ */ u(
          "a",
          {
            href: transformLink(slug, entry.slug, transformOpts),
            class: "internal internal-link",
            "data-slug": entry.slug,
            children: entry.title
          }
        ) })
      ] });
    }) })
  ] });
};
var galleryViewRegistration = {
  id: "gallery",
  name: "Gallery",
  icon: "image",
  render: GalleryView
};

// src/components/views/list.tsx
function formatMessage4(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var ListView = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution
}) => {
  const columns = getColumns(view, basesData, entries);
  const localeStrings = i18n(locale).components.bases;
  const transformOpts = { strategy: linkResolution, allSlugs };
  return /* @__PURE__ */ u("div", { class: "bases-list-wrapper", children: [
    /* @__PURE__ */ u("div", { class: "bases-view-meta", children: formatMessage4(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ u("div", { class: "bases-list-group", children: /* @__PURE__ */ u("div", { class: "bases-list-group-list", children: entries.map((entry) => {
      const ctx = { slug, allSlugs, linkResolution };
      const primaryColumn = columns[0] ?? "file.name";
      const secondaryColumns = columns.slice(1);
      const primaryValue = primaryColumn === "file.name" ? /* @__PURE__ */ u(
        "a",
        {
          href: transformLink(slug, entry.slug, transformOpts),
          class: "internal internal-link",
          "data-slug": entry.slug,
          children: entry.title
        }
      ) : renderCellValue(resolveEntryPropertyValue(primaryColumn, entry), ctx);
      const secondaryItems = [];
      for (const column of secondaryColumns) {
        const value = resolveEntryPropertyValue(column, entry);
        if (isEmptyValue(value)) continue;
        secondaryItems.push(
          /* @__PURE__ */ u("span", { class: "bases-list-property", children: /* @__PURE__ */ u("span", { class: "bases-rendered-value", children: renderCellValue(value, ctx) }) })
        );
      }
      return /* @__PURE__ */ u("div", { class: "bases-list-item", children: /* @__PURE__ */ u("div", { class: "bases-list-item-properties", children: [
        /* @__PURE__ */ u("span", { class: "bases-list-property", children: [
          /* @__PURE__ */ u("span", { class: "list-bullet", children: "-" }),
          /* @__PURE__ */ u("span", { class: "bases-rendered-value", children: primaryValue })
        ] }),
        secondaryItems.map((item) => /* @__PURE__ */ u(S, { children: [
          /* @__PURE__ */ u("span", { class: "bases-list-separator", children: ", " }),
          item
        ] }))
      ] }) });
    }) }) })
  ] });
};
var listViewRegistration = {
  id: "list",
  name: "List",
  icon: "list",
  render: ListView
};

// src/components/shared/summary.tsx
function computeSummary(values, summary) {
  const nonEmpty = values.filter((value) => value !== void 0 && value !== null && value !== "");
  if (summary === "Empty") return String(values.length - nonEmpty.length);
  if (summary === "Filled") return String(nonEmpty.length);
  if (summary === "Checked") return String(values.filter((value) => value === true).length);
  if (summary === "Unchecked") return String(values.filter((value) => value === false).length);
  if (summary === "Unique") return String(new Set(values.map((value) => String(value))).size);
  const numeric = nonEmpty.map((value) => typeof value === "number" ? value : Number(value)).filter((value) => !Number.isNaN(value));
  if (numeric.length === 0) return summary;
  if (summary === "Sum") return String(numeric.reduce((acc, value) => acc + value, 0));
  if (summary === "Average")
    return String(numeric.reduce((acc, value) => acc + value, 0) / numeric.length);
  if (summary === "Min") return String(Math.min(...numeric));
  if (summary === "Max") return String(Math.max(...numeric));
  if (summary === "Range") return String(Math.max(...numeric) - Math.min(...numeric));
  if (summary === "Median") {
    const sorted = [...numeric].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const upper = sorted[mid] ?? 0;
    const lower = sorted[mid - 1] ?? upper;
    const median = sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
    return String(median);
  }
  if (summary === "Stddev") {
    const mean = numeric.reduce((acc, value) => acc + value, 0) / numeric.length;
    const variance = numeric.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / numeric.length;
    return String(Math.sqrt(variance));
  }
  return summary;
}

// src/components/views/table.tsx
function formatMessage5(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
function groupEntries(entries, groupProperty, emptyLabel) {
  if (!groupProperty) return null;
  const groups = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const rawValue = resolveEntryPropertyValue(groupProperty, entry);
    const label = isEmptyValue(rawValue) ? emptyLabel : formatValue(rawValue);
    const key = label || emptyLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return groups.size > 0 ? groups : null;
}
function renderRow(entry, columns, view, slug, allSlugs, linkResolution) {
  const transformOpts = { strategy: linkResolution, allSlugs };
  const ctx = { slug, allSlugs, linkResolution };
  return /* @__PURE__ */ u("tr", { children: columns.map((column) => {
    const value = resolveEntryPropertyValue(column, entry);
    const display = formatValue(value);
    const isPrimary = column === "file.name" || column === "title";
    const columnWidth = view.columnSize?.[column];
    const style = columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` } : void 0;
    return /* @__PURE__ */ u("td", { "data-value": display, style, children: isPrimary ? /* @__PURE__ */ u(
      "a",
      {
        href: transformLink(slug, entry.slug, transformOpts),
        class: "internal internal-link",
        "data-slug": entry.slug,
        children: display || entry.title
      }
    ) : renderCellValue(value, ctx) });
  }) });
}
var TableView = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution
}) => {
  const columns = getColumns(view, basesData, entries);
  const summaries = view.summaries ?? {};
  const hasSummary = Object.keys(summaries).length > 0;
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property;
  const groupPropertyLabel = groupProperty ? getColumnLabel(groupProperty, basesData) : "";
  const groups = groupEntries(entries, groupProperty, localeStrings.uncategorized);
  return /* @__PURE__ */ u("div", { class: "bases-table-wrapper", children: [
    /* @__PURE__ */ u("div", { class: "bases-view-meta", children: formatMessage5(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ u("table", { class: "bases-table", "data-view-type": "table", children: [
      /* @__PURE__ */ u("thead", { children: /* @__PURE__ */ u("tr", { children: columns.map((column) => {
        const columnWidth = view.columnSize?.[column];
        const style = columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` } : void 0;
        return /* @__PURE__ */ u("th", { "data-column": column, "data-sortable": "true", style, children: [
          /* @__PURE__ */ u("span", { class: "bases-table-header", children: getColumnLabel(column, basesData) }),
          /* @__PURE__ */ u("span", { class: "bases-table-header-sort", "aria-hidden": "true" })
        ] });
      }) }) }),
      /* @__PURE__ */ u("tbody", { children: groups ? Array.from(groups.entries()).map(([label, groupEntries2]) => /* @__PURE__ */ u(S, { children: [
        /* @__PURE__ */ u("tr", { class: "bases-table-group-header", children: /* @__PURE__ */ u("td", { colSpan: columns.length, children: [
          groupPropertyLabel && /* @__PURE__ */ u("span", { class: "bases-table-group-property", children: [
            groupPropertyLabel,
            " "
          ] }),
          /* @__PURE__ */ u("span", { class: "bases-table-group-label", children: label }),
          /* @__PURE__ */ u("span", { class: "bases-table-group-count", children: groupEntries2.length })
        ] }) }),
        groupEntries2.map(
          (entry) => renderRow(entry, columns, view, slug, allSlugs, linkResolution)
        )
      ] })) : entries.map(
        (entry) => renderRow(entry, columns, view, slug, allSlugs, linkResolution)
      ) }),
      hasSummary && /* @__PURE__ */ u("tfoot", { children: /* @__PURE__ */ u("tr", { class: "bases-summary-row", children: columns.map((column) => {
        const summary = summaries[column];
        if (!summary) return /* @__PURE__ */ u("td", {});
        const values = entries.map((entry) => resolveEntryPropertyValue(column, entry));
        return /* @__PURE__ */ u("td", { children: computeSummary(values, summary) });
      }) }) })
    ] })
  ] });
};
var tableViewRegistration = {
  id: "table",
  name: "Table",
  icon: "table",
  render: TableView
};

// src/components/views/index.ts
function registerBuiltinViews() {
  viewRegistry.register(tableViewRegistration);
  viewRegistry.register(listViewRegistration);
  viewRegistry.register(cardsViewRegistration);
  viewRegistry.register(galleryViewRegistration);
  viewRegistry.register(boardViewRegistration);
}

// src/components/styles/bases.scss
var bases_default = ".bases-page {\n  width: 100%;\n  max-width: 100%;\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  overflow: hidden;\n}\n\n.bases-view-tabs {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.bases-view-tabs button {\n  border: 1px solid var(--lightgray);\n  background: var(--light);\n  color: var(--darkgray);\n  padding: 6px 12px;\n  border-radius: 999px;\n  cursor: pointer;\n  font-size: 0.9rem;\n}\n.bases-view-tabs button.is-active {\n  background: var(--secondary);\n  color: var(--light);\n  border-color: var(--secondary);\n}\n\n.bases-view-container {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n\n.bases-view {\n  display: none;\n}\n.bases-view.is-active {\n  display: block;\n}\n\n.bases-view-meta {\n  font-size: 0.85rem;\n  color: var(--gray);\n  margin-bottom: 8px;\n}\n\n.bases-table-wrapper {\n  width: 100%;\n  overflow-x: auto;\n}\n\n.bases-table {\n  width: 100%;\n  border-collapse: collapse;\n  border: 1px solid var(--lightgray);\n  border-radius: 8px;\n  overflow: hidden;\n}\n.bases-table th,\n.bases-table td {\n  padding: 10px 12px;\n  text-align: left;\n  border-bottom: 1px solid var(--lightgray);\n  font-size: 0.9rem;\n}\n.bases-table thead th {\n  position: sticky;\n  top: 0;\n  background: var(--light);\n  color: var(--dark);\n  font-weight: 600;\n  cursor: pointer;\n}\n.bases-table td .bases-empty {\n  padding: 0;\n  border: 0;\n  background: none;\n  color: var(--gray);\n  display: inline;\n}\n.bases-table td code {\n  font-size: 0.85em;\n  padding: 0.1rem 0.3rem;\n  border-radius: 3px;\n  background: var(--highlight);\n  word-break: break-all;\n}\n.bases-table td .bases-list {\n  flex-direction: row;\n  flex-wrap: wrap;\n  gap: 4px;\n}\n.bases-table td input[type=checkbox] {\n  margin-inline: 0;\n}\n\n.bases-table-header-sort {\n  position: absolute;\n  right: 8px;\n  top: calc(50% - 4px);\n  display: inline-block;\n  width: 8px;\n  height: 8px;\n  margin-left: 6px;\n  border-right: 2px solid transparent;\n  border-bottom: 2px solid transparent;\n}\n\nth.is-sorted-asc .bases-table-header-sort {\n  border-right-color: var(--darkgray);\n  border-bottom-color: var(--darkgray);\n  transform: rotate(-45deg);\n}\n\nth.is-sorted-desc .bases-table-header-sort {\n  border-right-color: var(--darkgray);\n  border-bottom-color: var(--darkgray);\n  transform: rotate(135deg);\n}\n\n.bases-summary-row td {\n  background: var(--light);\n  font-weight: 600;\n  color: var(--darkgray);\n}\n\n.bases-table-group-header td {\n  background: var(--lightgray);\n  font-weight: 600;\n  padding: 8px 12px;\n  border-bottom: 2px solid var(--gray);\n}\n\n.bases-table-group-property {\n  color: var(--gray);\n  font-weight: 400;\n}\n\n.bases-table-group-label {\n  margin-right: 8px;\n}\n\n.bases-table-group-count {\n  background: var(--light);\n  color: var(--darkgray);\n  border-radius: 999px;\n  padding: 2px 8px;\n  font-size: 0.75rem;\n  font-weight: 400;\n}\n\n.bases-separator {\n  color: var(--gray);\n}\n\n.bases-number {\n  font-variant-numeric: tabular-nums;\n}\n\n.bases-list {\n  display: inline-flex;\n  flex-wrap: wrap;\n  gap: 4px;\n}\n\n.bases-list-group {\n  width: 100%;\n}\n\n.bases-list-group-list {\n  display: flex;\n  flex-direction: column;\n}\n\n.bases-list-item {\n  padding: 2px 0;\n}\n\n.bases-list-item-properties {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: 0;\n}\n\n.bases-list-property {\n  display: inline-flex;\n  align-items: baseline;\n  gap: 4px;\n}\n\n.list-bullet {\n  color: var(--darkgray);\n  user-select: none;\n}\n\n.bases-list-separator {\n  color: var(--gray);\n  margin-right: 4px;\n}\n\n.bases-rendered-value {\n  display: inline;\n}\n\n.bases-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));\n  gap: 16px;\n}\n\n.bases-card {\n  border: 1px solid var(--lightgray);\n  border-radius: 12px;\n  overflow: hidden;\n  background: var(--light);\n  display: flex;\n  flex-direction: column;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n  color: inherit;\n  text-decoration: none;\n  transition: box-shadow 0.15s ease;\n}\n.bases-card:hover {\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);\n}\n\na.internal.bases-card {\n  background-color: transparent;\n  padding: 0;\n  line-height: inherit;\n}\n\n.bases-card-image {\n  overflow: hidden;\n  background: var(--lightgray);\n}\n.bases-card-image img {\n  width: 100%;\n  height: 100%;\n  display: block;\n  object-fit: cover;\n  margin: 0;\n  border-radius: 0;\n}\n\n.bases-card-color {\n  min-height: 60px;\n}\n\n.bases-card-title {\n  font-weight: 600;\n  color: var(--dark);\n}\n\n.bases-card-body {\n  padding: 12px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.bases-card-meta {\n  display: grid;\n  gap: 4px;\n}\n\n.bases-card-row {\n  font-size: 0.8rem;\n  color: var(--darkgray);\n}\n\n.bases-map-placeholder {\n  padding: 24px;\n  border: 1px dashed var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n}\n\n.bases-map-message {\n  color: var(--darkgray);\n  margin-top: 12px;\n}\n\n.bases-empty {\n  padding: 24px;\n  text-align: center;\n  color: var(--darkgray);\n  border: 1px dashed var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n}\n\n.bases-gallery {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));\n  gap: 16px;\n}\n\n.bases-gallery-item {\n  position: relative;\n  border-radius: 12px;\n  overflow: hidden;\n  border: 1px solid var(--lightgray);\n  background: var(--light);\n}\n\n.bases-gallery-image {\n  aspect-ratio: 4/3;\n  overflow: hidden;\n  background: var(--lightgray);\n}\n\n.bases-gallery-image img,\n.bases-gallery-placeholder {\n  width: 100%;\n  height: 100%;\n  display: block;\n  object-fit: cover;\n  margin: 0;\n  border-radius: 0;\n}\n\n.bases-gallery-placeholder {\n  background: linear-gradient(135deg, var(--lightgray), var(--highlight));\n}\n\n.bases-gallery-title {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  padding: 10px 12px;\n  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 100%);\n  color: var(--light);\n  font-weight: 600;\n}\n\n.bases-gallery-title a {\n  color: inherit;\n}\n\n.bases-board {\n  display: flex;\n  gap: 16px;\n  overflow-x: auto;\n  padding-bottom: 4px;\n}\n\n.bases-board-column {\n  min-width: min(250px, 80vw);\n  flex-shrink: 0;\n  border: 1px solid var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n  display: flex;\n  flex-direction: column;\n}\n\n.bases-board-column-header {\n  position: sticky;\n  top: 0;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 10px 12px;\n  font-weight: 600;\n  background: var(--light);\n  border-bottom: 1px solid var(--lightgray);\n  border-radius: 12px 12px 0 0;\n  z-index: 1;\n}\n\n.bases-board-count {\n  background: var(--lightgray);\n  color: var(--darkgray);\n  border-radius: 999px;\n  padding: 2px 8px;\n  font-size: 0.75rem;\n}\n\n.bases-board-column-body {\n  padding: 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.bases-board-card {\n  border: 1px solid var(--lightgray);\n  border-radius: 10px;\n  background: var(--light);\n  padding: 10px 12px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);\n}\n\n.bases-board-card-meta {\n  display: grid;\n  gap: 4px;\n  font-size: 0.8rem;\n  color: var(--darkgray);\n}\n\n.bases-board-card-row {\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.bases-board-card-label {\n  color: var(--gray);\n}";

// src/components/scripts/bases.inline.ts
var bases_inline_default = `function f(e,s){let n=e.querySelectorAll(".bases-view-tabs button"),r=e.querySelectorAll(".bases-view");n.forEach(t=>{t.classList.toggle("is-active",t.dataset.viewIndex===String(s))}),r.forEach(t=>{t.classList.toggle("is-active",t.dataset.viewIndex===String(s))})}function p(e,s){let n=Number(e),r=Number(s);return!Number.isNaN(n)&&!Number.isNaN(r)?n-r:String(e).localeCompare(String(s))}function h(e,s,n){return e.length===0||(e.sort((r,t)=>{let i=r.children[s],o=t.children[s],c=i?.dataset?.value??i?.textContent??"",a=o?.dataset?.value??o?.textContent??"";return p(c,a)}),n==="desc"&&e.reverse()),e}function v(e,s,n){let r=e.querySelector("tbody");if(!r)return;let t=Array.from(r.querySelectorAll("tr"));if(n==="none"){let o=e._originalOrder;o&&o.forEach(c=>r.appendChild(c));return}if(e._originalOrder||(e._originalOrder=Array.from(t)),t.some(o=>o.classList.contains("bases-table-group-header"))){let o=[],c=null;for(let a of t)a.classList.contains("bases-table-group-header")?(c={header:a,rows:[]},o.push(c)):c?c.rows.push(a):(c={header:null,rows:[a]},o.push(c));for(let a of o)h(a.rows,s,n);for(let a of o)a.header&&r.appendChild(a.header),a.rows.forEach(l=>r.appendChild(l))}else h(t,s,n),t.forEach(o=>r.appendChild(o))}function b(e,s){e.querySelectorAll(".bases-table").forEach(r=>{let t=r.querySelectorAll("th[data-sortable='true']");t.forEach((i,o)=>{let c=()=>{let a=i.dataset.sortDirection||"none",l=a==="asc"?"desc":a==="desc"?"none":"asc";t.forEach(u=>{u!==i&&(u.dataset.sortDirection="none"),u.classList.remove("is-sorted-asc","is-sorted-desc")}),i.dataset.sortDirection=l,i.classList.toggle("is-sorted-asc",l==="asc"),i.classList.toggle("is-sorted-desc",l==="desc"),v(r,o,l)};i.addEventListener("click",c),s.push(()=>i.removeEventListener("click",c))})})}function g(e,s){let n=e.querySelectorAll(".bases-view-tabs button");if(n.length===0)return;let r=parseInt(e.dataset.initialView||"0",10);f(e,Number.isNaN(r)?0:r),n.forEach(t=>{let i=()=>{let o=parseInt(t.dataset.viewIndex||"0",10);f(e,Number.isNaN(o)?0:o)};t.addEventListener("click",i),s.push(()=>t.removeEventListener("click",i))})}function d(){let e=document.querySelectorAll(".bases-page");if(e.length===0)return;let s=[];e.forEach(n=>{g(n,s),b(n,s)}),window.addCleanup&&window.addCleanup(()=>{s.forEach(n=>{n()})})}document.addEventListener("nav",()=>{d()});document.addEventListener("render",()=>{d()});d();
`;

// src/components/BasesBody.tsx
var builtinViewsRegistered = false;
var BasesBody_default = ((opts) => {
  const Component = (props) => {
    const locale = props.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const fileData = props.fileData;
    const basesData = fileData.basesData;
    const basesOptions = fileData.basesOptions ?? opts;
    const basesSelfContext = fileData.basesSelfContext;
    const slug = props.fileData.slug ?? "";
    const rawSlugs = props.ctx?.allSlugs ?? [];
    const baseSlugs = new Set(rawSlugs.filter((s) => s.endsWith(".base")));
    const baseAliases = new Set([...baseSlugs].map((s) => s.replace(/\.base$/, "")));
    const allSlugs = rawSlugs.filter((s) => !baseSlugs.has(s) && !baseAliases.has(s));
    const linkResolution = basesOptions?.linkResolution ?? "shortest";
    if (!basesData) {
      return /* @__PURE__ */ u("div", { class: "bases-page bases-empty", children: localeStrings.noData });
    }
    const views = basesData.views ?? [];
    if (views.length === 0) {
      return /* @__PURE__ */ u("div", { class: "bases-page bases-empty", children: localeStrings.noViews });
    }
    const preferredType = basesOptions?.defaultViewType ?? "table";
    const initialIndex = Math.max(
      0,
      views.findIndex((view) => view.type === preferredType)
    );
    if (!builtinViewsRegistered) {
      registerBuiltinViews();
      builtinViewsRegistered = true;
    }
    if (basesOptions?.customViews) {
      registerCustomViews(basesOptions.customViews);
    }
    const activeTypes = new Set(views.map((v) => v.type));
    const viewCssChunks = [];
    for (const typeId of activeTypes) {
      const reg = viewRegistry.get(typeId);
      if (reg?.css) viewCssChunks.push(reg.css);
    }
    return /* @__PURE__ */ u("div", { class: "bases-page", "data-initial-view": initialIndex, children: [
      viewCssChunks.length > 0 && /* @__PURE__ */ u("style", { dangerouslySetInnerHTML: { __html: viewCssChunks.join("\n") } }),
      /* @__PURE__ */ u(ViewSelector, { views, activeIndex: initialIndex, locale }),
      /* @__PURE__ */ u("div", { class: "bases-view-container", children: views.map((view, index) => {
        const { entries, total } = resolveBasesEntries(
          basesData,
          props.allFiles,
          view,
          basesSelfContext
        );
        const registration = viewRegistry.get(view.type);
        const Renderer = registration?.render;
        return /* @__PURE__ */ u(
          "div",
          {
            class: `bases-view ${index === initialIndex ? "is-active" : ""}`,
            "data-view-index": index,
            "data-view-type": view.type,
            children: entries.length === 0 ? /* @__PURE__ */ u("div", { class: "bases-empty", children: localeStrings.noData }) : Renderer ? /* @__PURE__ */ u(
              Renderer,
              {
                entries,
                view,
                basesData,
                total,
                locale,
                slug,
                allSlugs,
                linkResolution,
                options: registration.options
              }
            ) : /* @__PURE__ */ u("div", { class: "bases-empty", children: [
              "Unknown view type: ",
              view.type
            ] })
          }
        );
      }) })
    ] });
  };
  Component.css = bases_default;
  const viewScripts = viewRegistry.getAll().map((reg) => reg.afterDOMLoaded).filter((s) => typeof s === "string" && s.length > 0);
  Component.afterDOMLoaded = [bases_inline_default, ...viewScripts];
  return Component;
});

export { BasesBody_default, ViewSelector, i18n, registerBuiltinViews, resolveBasesEntries };
//# sourceMappingURL=chunk-AI4DM77R.js.map
//# sourceMappingURL=chunk-AI4DM77R.js.map