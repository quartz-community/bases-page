import { parse } from "yaml";

/**
 * Tags as Obsidian's Bases sees them. Quartz keeps a note's tags slugged and lower-cased in
 * `frontmatter.tags`, with the inline tags merged in; Bases needs them as written:
 *
 * - `file.tags`: inline tags first (in order), then the frontmatter tags, each with `#`, original
 *   case, duplicates removed case-sensitively; a frontmatter value that is not a valid tag
 *   (`"a, b"`) is left out.
 * - `tags` (the property): the frontmatter tags only, each with `#`; a string is one tag.
 */
export interface NoteTags {
  file: string[];
  /** undefined when the note has no `tags` property */
  note?: string[];
}

const TAG_BODY = "[\\p{L}\\p{N}\\p{M}_\\-/]+";
const VALID_TAG_RE = new RegExp(`^#?${TAG_BODY}$`, "u");
const INLINE_TAG_RE = new RegExp(`(?<=^|\\s)#(${TAG_BODY})`, "gu");

function isValidTag(tag: string): boolean {
  return VALID_TAG_RE.test(tag) && !/^#?[\d/]+$/.test(tag);
}

export function withHash(tag: string): string {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

function splitFrontmatter(source: string): { yaml?: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) return { body: source };
  return { yaml: match[1] ?? "", body: source.slice(match[0].length) };
}

function frontmatterTags(yaml: string): string[] | undefined {
  let data: unknown;
  try {
    data = parse(yaml, { schema: "failsafe" });
  } catch {
    return undefined;
  }
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const raw = record.tags ?? record.tag;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => withHash(value.trim()));
}

// Code and comments don't hold tags.
function stripNonProse(body: string): string {
  return body
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/%%[\s\S]*?%%/g, " ");
}

function inlineTags(body: string): string[] {
  const tags: string[] = [];
  for (const match of stripNonProse(body).matchAll(INLINE_TAG_RE)) {
    const tag = `#${match[1] ?? ""}`;
    if (isValidTag(tag)) tags.push(tag);
  }
  return tags;
}

/** Reads a note's tags, as written, from its Markdown source. */
export function extractNoteTags(source: string): NoteTags {
  const { yaml, body } = splitFrontmatter(source);
  const note = yaml === undefined ? undefined : frontmatterTags(yaml);
  const file = [...new Set([...inlineTags(body), ...(note ?? []).filter(isValidTag)])];
  return { file, note };
}

/** Whether `tag` is `query` or one of its nested tags (`a/b` matches `a/b/c`), ignoring case and `#`. */
export function tagMatches(tag: string, query: string): boolean {
  const t = tag.replace(/^#/, "").toLowerCase();
  const q = query.trim().replace(/^#/, "").replace(/\/+$/, "").toLowerCase();
  if (!q) return false;
  return t === q || t.startsWith(`${q}/`);
}
