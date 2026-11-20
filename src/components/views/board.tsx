import type { ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import {
  formatValue,
  getColumnLabel,
  getColumns,
  isEmptyValue,
  renderCellValue,
  resolveEntryPropertyValue,
} from "../shared/cell";
import { transformLink } from "@quartz-community/utils";
import { groupViewEntries } from "../shared/group";
import { resolveImageSrc } from "../shared/image";
import { coverAspectRatio, cssUrl } from "./cards";

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

const BoardView: ViewRenderer = ({
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
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property ?? view.boardProperty;
  const columns = getColumns(view, basesData, entries).filter((column) => column !== groupProperty);
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };
  // as in Obsidian's kanban: a column per group, the one without a value ("None") first
  const groups = groupViewEntries(entries, view, localeStrings.uncategorized, {
    property: groupProperty,
    emptyFirst: true,
  }) ?? [{ label: localeStrings.allEntries, isEmpty: false, entries }];
  const columnWidth =
    typeof view.columnWidth === "number" && view.columnWidth > 0 ? view.columnWidth : undefined;
  const columnStyle = columnWidth
    ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` }
    : undefined;
  // kanban card covers, as in the cards view
  const imageProperty = typeof view.image === "string" && view.image ? view.image : undefined;
  const imageFit = view.imageFit === "contain" ? "contain" : "cover";
  const aspectRatio = `1 / ${coverAspectRatio(view)}`;

  const renderCover = (entry: (typeof entries)[number]) => {
    const value = resolveEntryPropertyValue(imageProperty!, entry);
    const { src, isColor } = resolveImageSrc(value ? String(value) : "", {
      slug,
      allSlugs,
      linkResolution,
    });
    const style: Record<string, string> = { aspectRatio };
    if (src && isColor) style.backgroundColor = src;
    else if (src) {
      style.backgroundImage = cssUrl(src);
      style.backgroundSize = imageFit;
    }
    return <div class="bases-board-card-cover" style={style} />;
  };

  return (
    <div class="bases-board-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <div class="bases-board">
        {groups.map((group) => (
          <div class="bases-board-column" style={columnStyle}>
            <div class="bases-board-column-header">
              <span>{group.label}</span>
              <span class="bases-board-count">{group.entries.length}</span>
            </div>
            <div class="bases-board-column-body">
              {group.entries.map((entry) => {
                const ctx = { slug, allSlugs, linkResolution, locale, tagPages };
                return (
                  <div class="bases-board-card">
                    {imageProperty && renderCover(entry)}
                    <a
                      href={transformLink(slug as FullSlug, entry.slug, transformOpts)}
                      class="internal internal-link"
                      data-slug={entry.slug}
                    >
                      {entry.title}
                    </a>
                    {columns.length > 0 && (
                      <div class="bases-board-card-meta">
                        {columns.map((column) => {
                          const value = resolveEntryPropertyValue(column, entry);
                          if (isEmptyValue(value)) return null;
                          return (
                            <div class="bases-board-card-row">
                              <span class="bases-board-card-label">
                                {getColumnLabel(column, basesData)}
                              </span>
                              <span class="bases-board-card-value">
                                {renderCellValue(value, ctx, column)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const boardViewRegistration: ViewTypeRegistration = {
  id: "board",
  name: "Board",
  icon: "columns",
  render: BoardView,
};

/** Obsidian's kanban view (1.14+): our board, with Obsidian's options. */
export const kanbanViewRegistration: ViewTypeRegistration = {
  id: "kanban",
  name: "Kanban",
  icon: "square-kanban",
  render: BoardView,
};

export { BoardView };
