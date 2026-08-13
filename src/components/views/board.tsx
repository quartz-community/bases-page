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
}) => {
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property ?? view.boardProperty;
  const columns = getColumns(view, basesData, entries).filter((column) => column !== groupProperty);
  const groups = new Map<string, { label: string; entries: typeof entries }>();
  const emptyLabel = groupProperty ? localeStrings.uncategorized : localeStrings.allEntries;
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };

  for (const entry of entries) {
    const rawValue = groupProperty ? resolveEntryPropertyValue(groupProperty, entry) : undefined;
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

  return (
    <div class="bases-board-wrapper">
      {entries.length < total && (
        <div class="bases-view-meta">
          {formatMessage(localeStrings.showingCount, {
            count: entries.length,
            total,
          })}
        </div>
      )}
      <div class="bases-board">
        {Array.from(groups.values()).map((group) => (
          <div class="bases-board-column">
            <div class="bases-board-column-header">
              <span>{group.label}</span>
              <span class="bases-board-count">{group.entries.length}</span>
            </div>
            <div class="bases-board-column-body">
              {group.entries.map((entry) => {
                const ctx = { slug, allSlugs, linkResolution };
                return (
                  <div class="bases-board-card">
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
                                {renderCellValue(value, ctx)}
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

export { BoardView };
