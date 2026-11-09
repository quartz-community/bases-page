import type { BasesView } from "./types";

/**
 * The view a base opens on: as in Obsidian, the first view in the file. A site can prefer a
 * view type with the `defaultViewType` option.
 */
export function initialViewIndex(views: BasesView[], defaultViewType?: string): number {
  if (!defaultViewType) return 0;
  return Math.max(
    0,
    views.findIndex((view) => view.type === defaultViewType),
  );
}

const slugName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

/**
 * The view an embed such as `![[Tasks.base#Open]]` names. As in Obsidian the name matches
 * exactly (case-sensitively). When only the slugged anchor is known (`#open`), views are
 * matched by slug.
 */
export function findEmbeddedView(
  views: BasesView[],
  name: string,
  exact: boolean,
): BasesView | undefined {
  if (exact) return views.find((view) => view.name === name);
  return views.find((view) => view.name !== undefined && slugName(view.name) === slugName(name));
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
