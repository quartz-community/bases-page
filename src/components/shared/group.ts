import type { BasesEntry, BasesView } from "../../types";
import { formatValue, isEmptyValue, resolveEntryPropertyValue } from "./cell";

export interface EntryGroup {
  /** The group's value as shown; the "None" label for entries without a value */
  label: string;
  /** Whether this is the group of entries without a value */
  isEmpty: boolean;
  /** The group's value (its first entry's), for showing it as a cell does */
  value?: unknown;
  entries: BasesEntry[];
}

/**
 * A view's entries grouped by `groupBy`, as Obsidian groups them. Entries arrive sorted by the
 * group property (see the resolver), so groups keep that order. The group without a value is
 * labelled `noneLabel` and comes last (first in a kanban view: `emptyFirst`). With
 * `groupOrder`, only the listed groups are shown, in that order; `null` there is the group
 * without a value.
 *
 * Returns null when the view isn't grouped.
 */
export function groupViewEntries(
  entries: BasesEntry[],
  view: BasesView,
  noneLabel: string,
  options: { property?: string; emptyFirst?: boolean } = {},
): EntryGroup[] | null {
  const property = options.property ?? view.groupBy?.property;
  if (!property) return null;

  const groups = new Map<string, EntryGroup>();
  let empty: EntryGroup | undefined;
  for (const entry of entries) {
    const value = resolveEntryPropertyValue(property, entry);
    const label = isEmptyValue(value) ? "" : formatValue(value);
    if (!label) {
      empty ??= { label: noneLabel, isEmpty: true, entries: [] };
      empty.entries.push(entry);
      continue;
    }
    const group = groups.get(label) ?? { label, isEmpty: false, value, entries: [] };
    group.entries.push(entry);
    groups.set(label, group);
  }

  const order = groupOrder(view);
  if (order) {
    return order
      .map((wanted) => (wanted === null ? empty : groups.get(wanted)))
      .filter((group): group is EntryGroup => group !== undefined);
  }
  const listed = [...groups.values()];
  if (!empty) return listed;
  return options.emptyFirst ? [empty, ...listed] : [...listed, empty];
}

/** `groupOrder:` as group labels (null: the group without a value), if the view has one. */
function groupOrder(view: BasesView): (string | null)[] | undefined {
  const raw = (view as { groupOrder?: unknown }).groupOrder;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((item) =>
    item === null || item === undefined || item === "" ? null : formatValue(item),
  );
}
