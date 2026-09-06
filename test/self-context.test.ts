import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Root } from "hast";
import type { BuildCtx, FullSlug, QuartzComponentProps, QuartzPluginData } from "../src/types";
import { BasesPage } from "../src/pageType";
import { evaluate, type EvalContext } from "../src/compiler";

// The browser script is bundled as text by tsup, not executed during SSR.
vi.mock("../src/components/scripts/bases.inline.ts", () => ({ default: "" }));

function person(name: string): QuartzPluginData {
  return {
    slug: `people/${name.toLowerCase()}`,
    relativePath: `people/${name}.md`,
    frontmatter: { title: name, tags: ["person"] },
    links: ["guides/example"],
  } as QuartzPluginData;
}

describe("Bases self context", () => {
  it.each([
    ["authors.contains(this.file.asLink())", { authors: "[[Alice]]" }],
    ["authors.contains(this.file.asLink())", { authors: ["[[Alice]]"] }],
    ["authors.contains(this.file.asLink())", { authors: ["[[people/Alice.md]]"] }],
    ["list(authors).contains(this.file.asLink())", { authors: "[[Alice]]" }],
    ["authors.contains(this.file.asLink())", { authors: ["[[people/Alice|A]]"] }],
    ["file.links.contains(this.file.asLink())", {}],
  ])("filters each embedding note with %s and %j", (filter, frontmatter) => {
    const allFiles = [
      person("Alice"),
      person("Bob"),
      {
        slug: "guides/example",
        relativePath: "guides/Example.md",
        frontmatter: { title: "Alice's guide", ...frontmatter },
        links: ["people/alice"],
      } as QuartzPluginData,
    ];
    const ctx = { allSlugs: allFiles.map((file) => file.slug) } as BuildCtx;
    const plugin = BasesPage({
      customViews: {
        "self-test": ({ entries }) => JSON.stringify(entries.map((entry) => entry.slug)),
      },
    });
    const transform = plugin.treeTransforms!(ctx)[0]!;
    for (const name of ["Alice", "Bob", "Alice"]) {
      const root: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { dataQzBasesCodeblock: "0" },
            children: [],
          },
        ],
      };
      const fileData = {
        ...person(name),
        basesBlocks: [{ views: [{ type: "self-test", filters: filter }] }],
      };
      transform(
        root,
        fileData.slug as FullSlug,
        {
          fileData,
          allFiles,
          ctx,
          cfg: { locale: "en-US" },
        } as unknown as QuartzComponentProps,
      );
      expect(JSON.stringify(root).includes("guides/example")).toBe(name === "Alice");
    }
  });

  it("does not confuse authors with the same name in different folders", () => {
    const alice = person("Alice");
    const otherAlice = {
      ...alice,
      slug: "other/alice",
      relativePath: "other/Alice.md",
    } as QuartzPluginData;
    const self = {
      file: {
        name: "Alice",
        basename: "Alice",
        path: "people/Alice.md",
        folder: "people",
        ext: "md",
        tags: [],
        links: [],
      },
    };
    const otherFile = { ...self.file, path: "other/Alice.md", folder: "other" };
    const context: EvalContext = {
      note: { authors: ["[[other/Alice]]"] },
      file: self.file,
      formula: {},
      self,
      _fileLookup: new Map([
        [alice.relativePath!, self.file],
        [otherAlice.relativePath!, otherFile],
      ]),
    };
    expect(evaluate("authors.contains(this.file.asLink())", context)).toBe(false);
    context.note.authors = "[[other/Alice]]";
    expect(evaluate("authors.contains(this.file.asLink())", context)).toBe(false);
  });

  it("creates a usable file value for standalone bases", () => {
    const directory = mkdtempSync(join(tmpdir(), "bases-self-"));
    try {
      writeFileSync(join(directory, "People.base"), "views:\n  - type: table\n");
      const pages = BasesPage().generate!({
        content: [],
        cfg: {} as QuartzComponentProps["cfg"],
        ctx: { argv: { directory }, allFiles: ["People.base"] } as BuildCtx,
      });
      const self = pages[0]!.data!.basesSelfContext as EvalContext["self"];
      const context = { note: {}, formula: {}, self, file: self!.file } as EvalContext;
      expect(evaluate("this.file.asLink()", context)).toBe("[[People.base]]");
      expect(evaluate("this.file.basename", context)).toBe("People");
      expect(evaluate("this.file.tags", context)).toEqual([]);
      expect(evaluate("this.file.links", context)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
