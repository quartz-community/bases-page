import type { ComponentChild } from "preact";
import type { BasesEntry, ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import { groupViewEntries } from "../shared/group";
import {
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

const ListView: ViewRenderer = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
  tagPages,
  propertyLabels,
}) => {
  const columns = getColumns(view, basesData, entries);
  const localeStrings = i18n(locale).components.bases;
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };
  const ctx = { slug, allSlugs, linkResolution, locale, tagPages };
  // as in Obsidian: markers bullet (default), number or none; separator ", "; indentProperties
  // puts the properties after the first on their own lines, under it
  const markers = view.markers === "number" || view.markers === "none" ? view.markers : "bullet";
  const separator = typeof view.separator === "string" ? view.separator : ", ";
  const indent = view.indentProperties === true;
  const primaryColumn = columns[0] ?? "file.name";
  const secondaryColumns = columns.slice(1);
  const groups = groupViewEntries(entries, view, localeStrings.uncategorized);
  const groupProperty = view.groupBy?.property;

  const marker = (position: number, kind = markers) =>
    kind === "number" ? (
      <span class="list-number">{position}.</span>
    ) : kind === "bullet" ? (
      <span class="list-bullet">-</span>
    ) : null;

  const renderItem = (entry: BasesEntry, position: number) => {
    const primaryValue: ComponentChild =
      primaryColumn === "file.name" ? (
        <a
          href={transformLink(slug as FullSlug, entry.slug, transformOpts)}
          class="internal internal-link"
          data-slug={entry.slug}
        >
          {entry.fileProperties.name || entry.title}
        </a>
      ) : (
        renderCellValue(resolveEntryPropertyValue(primaryColumn, entry), ctx, primaryColumn)
      );

    const secondaryValues: ComponentChild[] = [];
    for (const column of secondaryColumns) {
      const value = resolveEntryPropertyValue(column, entry);
      if (isEmptyValue(value)) continue;
      secondaryValues.push(
        <span class="bases-rendered-value">{renderCellValue(value, ctx, column)}</span>,
      );
    }

    return (
      <div class="bases-list-item">
        <div class="bases-list-item-properties">
          <span class="bases-list-property">
            {marker(position)}
            <span class="bases-rendered-value">{primaryValue}</span>
          </span>
          {!indent &&
            secondaryValues.map((value) => (
              <>
                <span class="bases-list-separator">{separator}</span>
                <span class="bases-list-property">{value}</span>
              </>
            ))}
        </div>
        {indent && secondaryValues.length > 0 && (
          <div class="bases-list-item-properties nested">
            {secondaryValues.map((value) => (
              <span class="bases-list-property">
                {marker(1, markers === "none" ? "none" : "bullet")}
                {value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div class="bases-list-wrapper" data-markers={markers}>
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      {groups ? (
        groups.map((group) => (
          <div class="bases-list-group">
            <div class="bases-group-heading">
              {groupProperty && (
                <span class="bases-group-property">
                  {getColumnLabel(groupProperty, basesData, propertyLabels)}
                </span>
              )}
              <span class="bases-group-value">{group.label}</span>
            </div>
            <div class="bases-list-group-list">
              {group.entries.map((entry, index) => renderItem(entry, index + 1))}
            </div>
          </div>
        ))
      ) : (
        <div class="bases-list-group">
          <div class="bases-list-group-list">
            {entries.map((entry, index) => renderItem(entry, index + 1))}
          </div>
        </div>
      )}
    </div>
  );
};

export const listViewRegistration: ViewTypeRegistration = {
  id: "list",
  name: "List",
  icon: "list",
  render: ListView,
};

export { ListView };
