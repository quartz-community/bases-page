import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import type {
  BuildCtx,
  FilePath,
  FullSlug,
  ProcessedContent,
  QuartzPluginData,
  VirtualPage,
} from "../src/types";
import type { BasesData } from "../src/types";
import type { QuartzConfig } from "@quartz-community/types";
import { BasesPage } from "../src/pageType";

// the page body imports a browser script that only Quartz's bundler can load
vi.mock("../src/components/BasesBody", () => ({ default: () => null }));
vi.mock("../src/components/scripts/bases.inline.ts", () => ({ default: "" }));

const base = ["views:", "  - type: table", "    name: All"].join("\n");

function ctxFor(files: Record<string, string>): BuildCtx {
  const directory = mkdtempSync(join(tmpdir(), "bases-page-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), text);
  }
  return {
    buildId: "test",
    argv: {
      directory,
      verbose: false,
      output: "public",
      serve: false,
      watch: false,
      port: 0,
      wsPort: 0,
    },
    cfg: { configuration: {} } as QuartzConfig,
    allSlugs: [],
    allFiles: Object.keys(files) as FilePath[],
    incremental: false,
  } as unknown as BuildCtx;
}

describe("BasesPage generate", () => {
  it("gives a .base page the file's paths, so publish filters see a file without frontmatter (#11)", async () => {
    const ctx = ctxFor({ "views/Team Board.base": base, "note.md": "# Note" });
    const plugin = BasesPage();
    const pages = await plugin.generate!({ content: [], cfg: ctx.cfg.configuration, ctx });
    expect(pages.map((p) => [p.slug, p.data.relativePath, p.data.filePath])).toEqual([
      [
        "views/team-board.base",
        "views/Team Board.base",
        `${ctx.argv.directory}/views/Team Board.base`,
      ],
    ]);
  });
});

type TestNote = {
  slug: string;
  frontmatter?: Record<string, unknown>;
  links?: string[];
  unlisted?: boolean;
};

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function makeNote(note: TestNote): ProcessedContent {
  const data = {
    slug: note.slug as FullSlug,
    filePath: `${note.slug}.md` as FilePath,
    relativePath: `${note.slug}.md`,
    frontmatter: note.frontmatter ?? {},
    links: note.links ?? [],
    unlisted: note.unlisted ?? false,
  } as unknown as QuartzPluginData;

  // generate() only reads the second tuple member's data.
  return [null, { data }] as unknown as ProcessedContent;
}

function generatePages(
  basesData: BasesData,
  notes: TestNote[],
  basePath = "Templates.base",
): VirtualPage[] {
  const directory = mkdtempSync(join(tmpdir(), "bases-page-test-"));
  directories.push(directory);

  // All test fixtures use a root-level .base file.
  if (basePath.includes("/") || basePath.includes("\\")) {
    throw new Error("Test fixture must use a root-level .base file");
  }

  writeFileSync(join(directory, basePath), stringify(basesData), "utf-8");

  const ctx = {
    argv: { directory },
    allFiles: [basePath],
  } as unknown as BuildCtx;

  const content = notes.map(makeNote);
  const plugin = BasesPage();

  if (!plugin.generate) {
    throw new Error("BasesPage.generate is not defined");
  }

  return plugin.generate({ content, cfg: {}, ctx }) as VirtualPage[];
}

function getLinks(basesData: BasesData, notes: TestNote[], basePath = "Templates.base"): string[] {
  const pages = generatePages(basesData, notes, basePath);

  expect(pages).toHaveLength(1);

  return [...(pages[0]!.data.links ?? [])] as string[];
}

describe("BasesPage.generate graph links", () => {
  const notes: TestNote[] = [
    {
      slug: "notes/a",
      frontmatter: {
        status: "active",
        featured: true,
      },
    },
    {
      slug: "notes/b",
      frontmatter: {
        status: "active",
        featured: false,
      },
    },
    {
      slug: "notes/c",
      frontmatter: {
        status: "active",
        featured: true,
      },
    },
    {
      slug: "notes/d",
      frontmatter: {
        status: "inactive",
        featured: false,
      },
    },
    {
      slug: "notes/e",
      frontmatter: {
        status: "inactive",
        featured: true,
      },
    },
  ];

  it("applies view-specific filters", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Active",
          filters: 'status == "active"',
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(["notes/a", "notes/b", "notes/c"]);
  });

  it("combines multiple view results", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Active",
          filters: 'status == "active"',
        },
        {
          type: "table",
          name: "Featured",
          filters: "featured == true",
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(["notes/a", "notes/b", "notes/c", "notes/e"]);
  });

  it("deduplicates files appearing in multiple views", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Active",
          filters: 'status == "active"',
        },
        {
          type: "table",
          name: "Also Active",
          filters: 'status == "active"',
        },
      ],
    };

    const links = getLinks(bases, notes);

    expect(links).toEqual(["notes/a", "notes/b", "notes/c"]);
    expect(new Set(links).size).toBe(links.length);
  });

  it("respects view.limit", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Active",
          filters: 'status == "active"',
          limit: 2,
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(["notes/a", "notes/b"]);
  });

  it("sorts before applying view.limit", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Active",
          filters: 'status == "active"',
          sort: [
            {
              property: "file.name",
              direction: "DESC",
            },
          ],
          limit: 2,
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(["notes/c", "notes/b"]);
  });

  it("combines limited views without duplicates", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Active",
          filters: 'status == "active"',
          sort: [
            {
              property: "file.name",
              direction: "ASC",
            },
          ],
          limit: 2,
        },
        {
          type: "table",
          name: "Featured",
          filters: "featured == true",
          limit: 1,
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(["notes/a", "notes/b"]);
  });

  it("applies global and view-specific filters together", () => {
    const bases: BasesData = {
      filters: 'status == "active"',
      views: [
        {
          type: "table",
          name: "Featured",
          filters: "featured == true",
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(["notes/a", "notes/c"]);
  });

  it("excludes unlisted files", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "All",
        },
      ],
    };

    const input: TestNote[] = [
      ...notes,
      {
        slug: "notes/hidden",
        frontmatter: { status: "active" },
        unlisted: true,
      },
    ];

    expect(getLinks(bases, input)).toEqual(notes.map((note) => note.slug));
  });

  it("preserves unfiltered view behavior", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "All",
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual(notes.map((note) => note.slug));
  });

  it("returns no links when every view matches nothing", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Missing",
          filters: 'status == "missing"',
        },
      ],
    };

    expect(getLinks(bases, notes)).toEqual([]);
  });

  it("returns no links when there are no views", () => {
    expect(getLinks({ views: [] }, notes)).toEqual([]);
  });

  it("uses the .base file as this context", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "Linked to Base",
          filters: "file.links.contains(this)",
        },
      ],
    };

    const input: TestNote[] = [
      {
        slug: "notes/linked",
        links: ["Templates.base"],
      },
      {
        slug: "notes/unlinked",
        links: ["Other.base"],
      },
    ];

    expect(getLinks(bases, input)).toEqual(["notes/linked"]);
  });

  it("preserves virtual page metadata", () => {
    const bases: BasesData = {
      views: [
        {
          type: "table",
          name: "All",
        },
      ],
    };

    const pages = generatePages(bases, notes);
    const page = pages[0]!;

    expect(page.title).toBe("Templates");
    expect(page.data.frontmatter).toEqual({
      title: "Templates",
      tags: [],
    });

    expect(page.data.basesData).toBeDefined();
    expect(page.data.basesSelfContext).toEqual({
      file: {
        name: "Templates.base",
        basename: "Templates",
        path: "Templates.base",
        folder: "",
        ext: "base",
        tags: [],
        links: [],
      },
    });
  });

  it("handles invalid YAML without generating a page", () => {
    const directory = mkdtempSync(join(tmpdir(), "bases-page-test-"));
    directories.push(directory);

    writeFileSync(join(directory, "Broken.base"), "views: [unclosed", "utf-8");

    const ctx = {
      argv: { directory },
      allFiles: ["Broken.base"],
    } as unknown as BuildCtx;

    const plugin = BasesPage();

    if (!plugin.generate) {
      throw new Error("BasesPage.generate is not defined");
    }

    const pages = plugin.generate({
      content: notes.map(makeNote),
      cfg: {},
      ctx,
    });

    expect(pages).toEqual([]);
  });
});
