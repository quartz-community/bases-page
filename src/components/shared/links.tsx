import type { ComponentChild } from "preact";
import type { FullSlug } from "@quartz-community/types";

import { transformLink } from "@quartz-community/utils";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
// A text value that is just a URL is a link (Obsidian detects URL properties); URLs inside
// longer text and Markdown links (`[x](url)`) stay text, as in Obsidian's Bases.
const WHOLE_URL_RE = /^https?:\/\/[^\s<>]+$/;

type RenderCtx = {
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
};

/** How Obsidian shows a link without alias: `note > Heading` for `[[note#Heading]]`. */
export function linkDisplay(target: string): string {
  const hash = target.indexOf("#");
  if (hash < 0) return target;
  const file = target.slice(0, hash);
  const sub = target
    .slice(hash + 1)
    .split("#")
    .filter(Boolean)
    .join(" > ");
  return file ? `${file} > ${sub}` : sub;
}

/** Whether an internal href (as transformLink returns it) points at a page of the site. */
export function isResolvedLink(href: string, ctx: RenderCtx): boolean {
  if (ctx.allSlugs.length === 0) return true;
  let path: string;
  try {
    path = decodeURIComponent(
      new URL(href, `https://base.com/${ctx.slug.replace(/^\/+/, "")}`).pathname,
    );
  } catch {
    return true;
  }
  let slug = path.replace(/^\/+/, "");
  if (slug === "" || slug.endsWith("/")) slug += "index";
  return ctx.allSlugs.some(
    (candidate) => candidate === slug || candidate === `${slug}/index` || `${candidate}/` === slug,
  );
}

export function renderInternalLink(
  target: string,
  display: string | undefined,
  ctx: RenderCtx,
): ComponentChild {
  const href = transformLink(ctx.slug as FullSlug, target, {
    strategy: ctx.linkResolution,
    allSlugs: ctx.allSlugs as FullSlug[],
  });
  const resolved = isResolvedLink(String(href), ctx);
  return (
    <a href={href} class={`internal internal-link${resolved ? "" : " broken"}`}>
      {display ?? linkDisplay(target)}
    </a>
  );
}

export function renderExternalLink(href: string, display?: string): ComponentChild {
  return (
    <a href={href} class="external external-link" target="_blank" rel="noopener noreferrer">
      {display || href}
    </a>
  );
}

export function renderTextWithLinks(text: string, ctx: RenderCtx): ComponentChild[] {
  if (WHOLE_URL_RE.test(text.trim())) return [renderExternalLink(text.trim())];
  const segments: { start: number; end: number; node: ComponentChild }[] = [];
  for (const match of text.matchAll(WIKILINK_RE)) {
    const target = (match[1] ?? "").trim();
    segments.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      node: renderInternalLink(target, match[2], ctx),
    });
  }

  if (segments.length === 0) return [text];

  const result: ComponentChild[] = [];
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
