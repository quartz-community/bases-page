import { h } from "preact";
import type { ComponentChild } from "preact";
import { createRequire as createModuleRequire } from "module";

type IconNode = [string, Record<string, string | number>][];
type LucideIcon = { name: string; node: IconNode };

let icons: Map<string, LucideIcon> | null | undefined;

/** Lucide's icons by name (and alias), loaded on first use: only icon() needs them. */
function lucideIcons(): Map<string, LucideIcon> | null {
  if (icons !== undefined) return icons;
  try {
    const load = createModuleRequire(import.meta.url);
    const lucide = load("@lucide/icons") as Record<string, unknown> & {
      icons?: Record<string, LucideIcon>;
    };
    icons = new Map();
    for (const icon of Object.values(lucide.icons ?? {})) icons.set(icon.name, icon);
    // aliases (e.g. home → house) are exported under their PascalCase names
    for (const [key, value] of Object.entries(lucide)) {
      const icon = value as LucideIcon | undefined;
      if (!icon || typeof icon !== "object" || !Array.isArray(icon.node)) continue;
      const alias = key
        .replace(/Icon$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Za-z])([0-9])/g, "$1-$2")
        .toLowerCase();
      if (!icons.has(alias)) icons.set(alias, icon);
    }
  } catch {
    icons = null;
  }
  return icons;
}

/**
 * `icon("star")` as Obsidian shows it: the Lucide icon of that name (`lucide-star` works too),
 * drawn in the text colour. An unknown name shows nothing.
 */
export function renderIcon(name: string): ComponentChild {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/^lucide-/, "");
  const icon = lucideIcons()?.get(key);
  if (!icon) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={`bases-icon lucide lucide-${icon.name}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {icon.node.map(([tag, attrs]) => {
        const { key: _key, ...rest } = attrs;
        return h(tag, rest);
      })}
    </svg>
  );
}
