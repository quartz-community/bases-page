import type { FullSlug } from "@quartz-community/types";
import { transformLink } from "@quartz-community/utils";
import { URL_SCHEME_RE } from "../../compiler/values";

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}){1,2}$/i;
const WIKILINK_RE = /^\[\[(.+?)(?:\|.*)?\]\]$/;

export interface ResolveImageOpts {
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
}

/**
 * An image property's (or image()'s) value as an image URL: a URL as is, a hex colour as a
 * colour, and a wikilink or vault path resolved to the file's page URL.
 */
export function resolveImageSrc(
  raw: string,
  opts: ResolveImageOpts,
): { src: string; isColor: boolean } {
  if (!raw) return { src: "", isColor: false };

  if (HEX_COLOR_RE.test(raw)) {
    return { src: raw, isColor: true };
  }

  const wikiMatch = WIKILINK_RE.exec(raw);
  const target = wikiMatch?.[1]?.trim() ?? raw;
  // a URL (or an absolute or data: path) as is; anything else is a file in the vault, e.g.
  // image("attachments/cover.png") or a property holding `attachments/cover.png`
  if (!wikiMatch && (URL_SCHEME_RE.test(raw) || raw.startsWith("/"))) {
    return { src: raw, isColor: false };
  }
  const resolved = transformLink(opts.slug as FullSlug, target, {
    strategy: opts.linkResolution,
    allSlugs: opts.allSlugs as FullSlug[],
  });
  return { src: String(resolved), isColor: false };
}
