import { describe, it, expect } from "vitest";
import type { Root as HTMLRoot } from "hast";
import { BasesTransformer } from "../src/transformer";
import { buildSelfContext, resolveBasesEntries } from "../src/resolver";
import type { QuartzPluginData } from "../src/types";

// Obsidian 1.15.0 (obsidian-bases-probe vault q9-this; community PR #2).
const host = {
  slug: "folder/host2",
  filePath: "folder/Host2.md",
  relativePath: "folder/Host2.md",
  frontmatter: {
    k: "host2val",
    num: 2,
    tags: ["h2tag"],
    file: "fm-file-key",
    note: "fm-note-key",
  },
} as unknown as QuartzPluginData;
const other = {
  slug: "other",
  filePath: "other.md",
  relativePath: "other.md",
  frontmatter: {},
} as unknown as QuartzPluginData;

const formula = (expression: string, self = buildSelfContext(host)) =>
  resolveBasesEntries({ formulas: { f: expression } }, [other], undefined, self).entries[0]
    ?.formulaValues.f;

describe("this in an embedded base", () => {
  it("this.<key> and this.note.<key> are the embedding note's properties", () => {
    expect(formula("this.k")).toBe("host2val");
    expect(formula("this.note.k")).toBe("host2val");
    expect(formula("this.num")).toBe(2);
    expect(formula('this.note["note"]')).toBe("fm-note-key");
    expect(formula('this.note["file"]')).toBe("fm-file-key");
  });

  it("this.file is the embedding note's file", () => {
    expect(formula("this.file.name")).toBe("Host2");
    expect(formula("this.file.path")).toBe("folder/Host2.md");
    expect(formula("this.file.folder")).toBe("folder");
    expect(formula("this.file.ext")).toBe("md");
    expect((formula('this["file"]') as { path: string }).path).toBe("folder/Host2.md");
    expect(formula("this.file.asLink()")).toBe("[[folder/Host2.md]]");
  });

  it("the root folder is /, as in Obsidian", () => {
    expect(formula("file.folder")).toBe("/");
    expect(formula('file.folder == "/"')).toBe(true);
  });

  it("opened directly, this is the .base file, without properties", () => {
    const self = {
      note: {},
      file: {
        name: "ThisProbe.base",
        basename: "ThisProbe",
        path: "ThisProbe.base",
        folder: "/",
        ext: "base",
        tags: [],
        links: [],
      },
    };
    expect(formula("this.file.name", self)).toBe("ThisProbe.base");
    expect(formula("this.k", self)).toBeUndefined();
    expect(formula("this.note", self)).toEqual({});
  });
});

function transclusion(url: string, block = ""): HTMLRoot["children"][number] {
  return {
    type: "element",
    tagName: "blockquote",
    properties: { className: ["transclude"], dataUrl: url, dataBlock: block },
    children: [],
  };
}

describe("several bases on one page (community PR #2)", () => {
  it("embeds and an inline base block each keep their own block", async () => {
    const { mkdtempSync, writeFileSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const dir = mkdtempSync(join(tmpdir(), "bases-this-"));
    writeFileSync(
      join(dir, "ThisProbe.base"),
      "views:\n  - type: table\n    name: First\n  - type: table\n    name: Second\n",
    );
    const plugin = BasesTransformer({});
    const ctx = { allFiles: ["ThisProbe.base"], argv: { directory: dir } } as never;
    const [embeds, inline] = plugin.htmlPlugins!(ctx) as Array<
      () => (tree: HTMLRoot, file: { data: Record<string, unknown>; value: string }) => void
    >;
    const tree: HTMLRoot = {
      type: "root",
      children: [
        transclusion("thisprobe.base"),
        transclusion("thisprobe.base", "#second"),
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-base"] },
              children: [{ type: "text", value: "views:\n  - type: list\n" }],
            },
          ],
        },
      ],
    };
    const file = {
      data: {} as Record<string, unknown>,
      value:
        "![[ThisProbe.base]]\n![[ThisProbe.base#Second]]\n```base\nviews:\n  - type: list\n```\n",
    };
    embeds!()(tree, file);
    inline!()(tree, file);
    const blocks = file.data.basesBlocks as { views: { type: string }[] }[];
    expect(blocks.map((b) => b.views[0]?.type)).toEqual(["table", "table", "list"]);
    const placeholders = tree.children.map(
      (node) => (node as { properties: Record<string, unknown> }).properties,
    );
    expect(placeholders.map((p) => p.dataQzBasesCodeblock)).toEqual(["0", "1", "2"]);
    expect(placeholders[1]?.dataQzBasesView).toBe("Second");
  });
});

describe("file.hasLink(this) on a .base page", () => {
  it("finds the notes that embed the base", () => {
    const embedder = {
      slug: "folder/host",
      filePath: "folder/Host.md",
      relativePath: "folder/Host.md",
      frontmatter: {},
      embeds: ["thisprobe.base"],
    } as unknown as QuartzPluginData;
    const self = {
      note: {},
      file: {
        name: "ThisProbe.base",
        basename: "ThisProbe",
        path: "ThisProbe.base",
        folder: "/",
        ext: "base",
        tags: [],
        links: [],
      },
    };
    const { entries } = resolveBasesEntries(
      { filters: "file.hasLink(this.file)" },
      [embedder, other],
      undefined,
      self,
    );
    expect(entries.map((e) => e.slug)).toEqual(["folder/host"]);
  });
});
