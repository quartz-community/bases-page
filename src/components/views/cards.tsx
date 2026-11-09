import type { ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import {
  getColumnLabel,
  isEmptyValue,
  renderCellValue,
  resolveEntryPropertyValue,
} from "../shared/cell";
import { transformLink } from "@quartz-community/utils";

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}){1,2}$/i;
const WIKILINK_RE = /^\[\[(.+?)(?:\|.*)?\]\]$/;

export interface ResolveImageOpts {
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
}

export function resolveImageSrc(
  raw: string,
  opts: ResolveImageOpts,
): { src: string; isColor: boolean } {
  if (!raw) return { src: "", isColor: false };

  if (HEX_COLOR_RE.test(raw)) {
    return { src: raw, isColor: true };
  }

  const wikiMatch = WIKILINK_RE.exec(raw);
  if (wikiMatch?.[1]) {
    const target = wikiMatch[1].trim();
    const resolved = transformLink(opts.slug as FullSlug, target, {
      strategy: opts.linkResolution,
      allSlugs: opts.allSlugs as FullSlug[],
    });
    return { src: String(resolved), isColor: false };
  }

  return { src: raw, isColor: false };
}

/** Obsidian's `imageAspectRatio` is height / width (0.5 is a wide cover); the default is 1. */
export function coverAspectRatio(view: {
  imageAspectRatio?: unknown;
  cardAspect?: unknown;
}): number {
  const raw = view.imageAspectRatio ?? view.cardAspect;
  const ratio = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function cssUrl(src: string): string {
  return `url("${src.replace(/["\\\n]/g, (ch) => `\\${ch === "\n" ? "a " : ch}`)}")`;
}

/**
 * Cards as Obsidian renders them: a card is a box (not a link) holding a cover and the
 * properties in `order`. The file name links to the note, and that link is stretched over the
 * whole card, so clicking anywhere opens the note while links inside properties stay their own
 * links (bases-page#10: a card can't be an <a> around other links).
 */
const CardsView: ViewRenderer = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
  tagPages,
}) => {
  const imageProperty = typeof view.image === "string" && view.image ? view.image : undefined;
  const columns = (view.order ?? ["file.name"]).filter((column) => column !== imageProperty);
  const localeStrings = i18n(locale).components.bases;
  const cardSize = view.cardSize;
  // CSS aspect-ratio is width / height
  const aspectRatio = `1 / ${coverAspectRatio(view)}`;
  const imageFit = view.imageFit === "contain" ? "contain" : "cover";
  const gridStyle =
    typeof cardSize === "number" && cardSize > 0
      ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardSize}px, 100%), 1fr))` }
      : undefined;
  const imageOpts: ResolveImageOpts = { slug, allSlugs, linkResolution };
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };

  return (
    <div class="bases-cards-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <div class="bases-cards" style={gridStyle}>
        {entries.map((entry) => {
          const ctx = { slug, allSlugs, linkResolution, locale, tagPages };
          const imageValue = imageProperty
            ? resolveEntryPropertyValue(imageProperty, entry)
            : undefined;
          const rawImage = imageValue ? String(imageValue) : "";
          const { src: imageSrc, isColor } = resolveImageSrc(rawImage, imageOpts);
          const href = transformLink(slug as FullSlug, entry.slug, transformOpts);
          const name = entry.fileProperties.name || entry.title;
          const hasTitle = columns.includes("file.name");
          // A view with an image property gives every card a cover, empty if the note has no image
          const coverStyle: Record<string, string> = { aspectRatio };
          if (imageSrc && isColor) coverStyle.backgroundColor = imageSrc;
          else if (imageSrc) {
            coverStyle.backgroundImage = cssUrl(imageSrc);
            coverStyle.backgroundSize = imageFit;
          }
          return (
            <div class="bases-card" data-slug={entry.slug}>
              {imageProperty && (
                <div
                  class={`bases-card-cover${imageSrc ? "" : " is-empty"}`}
                  style={coverStyle}
                  role={imageSrc && !isColor ? "img" : undefined}
                  aria-label={imageSrc && !isColor ? name : undefined}
                />
              )}
              {!hasTitle && (
                <a
                  href={href}
                  class="internal bases-card-link"
                  data-slug={entry.slug}
                  aria-label={name}
                />
              )}
              <div class="bases-card-body">
                {columns.map((column) => {
                  if (column === "file.name") {
                    return (
                      <a
                        href={href}
                        class="internal bases-card-title bases-card-link"
                        data-slug={entry.slug}
                      >
                        {name}
                      </a>
                    );
                  }
                  const value = resolveEntryPropertyValue(column, entry);
                  return (
                    <div class="bases-card-row" data-property={column}>
                      <span class="bases-card-label">{getColumnLabel(column, basesData)}</span>
                      <span class="bases-card-value">
                        {isEmptyValue(value) ? (
                          <span class="bases-empty-value">—</span>
                        ) : (
                          renderCellValue(value, ctx, column)
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const cardsViewRegistration: ViewTypeRegistration = {
  id: "cards",
  name: "Cards",
  icon: "layout-grid",
  render: CardsView,
};

export { CardsView };
