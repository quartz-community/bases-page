/**
 * Whether the site generates tag pages, so a tag can link to `tags/<tag>` (the check the
 * obsidian-flavored-markdown plugin makes for inline tags).
 */
export function siteHasTagPages(ctx: unknown): boolean | undefined {
  const cfg = (ctx as { cfg?: { plugins?: Record<string, unknown> } } | undefined)?.cfg;
  if (!cfg?.plugins) return undefined;
  const plugins = cfg.plugins as Partial<Record<string, Array<{ name?: string }>>>;
  return [...(plugins.pageTypes ?? []), ...(plugins.emitters ?? [])].some(
    (plugin) => plugin?.name === "TagPage",
  );
}
