import { describe, it, expect } from "vitest";
import { resolveBasesEntries } from "../src/resolver";
import type { SimpleSlug } from "@quartz-community/utils";
import type { BasesData, BasesView, FilePath, FullSlug, QuartzPluginData } from "../src/types";

type FileInput = {
  slug: string;
  filePath?: string;
  frontmatter?: Record<string, unknown>;
  links?: string[];
  outgoingLinks?: string[];
  unlisted?: boolean;
  dates?: {
    created: string;
    modified: string;
    published?: string;
  };
};

const asFullSlug = (value: string): FullSlug => value as FullSlug;
const asFilePath = (value: string): FilePath => value as FilePath;
const asSimpleSlugs = (value: string[] | undefined): SimpleSlug[] | undefined =>
  value as SimpleSlug[] | undefined;

function makeFile(input: FileInput): QuartzPluginData {
  const frontmatter = {
    title:
      (input.frontmatter?.title as string | undefined) ?? input.slug.split("/").pop() ?? "Untitled",
    ...(input.frontmatter ?? {}),
  };
  const dates = input.dates
    ? {
        created: new Date(input.dates.created),
        modified: new Date(input.dates.modified),
        published: new Date(input.dates.published ?? input.dates.modified),
      }
    : undefined;
  const result = {
    slug: asFullSlug(input.slug),
    filePath: asFilePath(input.filePath ?? `${input.slug}.md`),
    frontmatter,
    links: asSimpleSlugs(input.links),
    outgoingLinks: asSimpleSlugs(input.outgoingLinks),
    dates,
  } as QuartzPluginData;
  if (input.unlisted === true) {
    (result as Record<string, unknown>).unlisted = true;
  }
  return result;
}

const baseFiles: QuartzPluginData[] = [
  makeFile({
    slug: "notes/alpha",
    filePath: "notes/alpha.md",
    frontmatter: {
      title: "Alpha",
      status: "done",
      priority: 5,
      tags: ["work", "important"],
    },
    links: ["beta"],
    dates: {
      created: "2024-01-01T00:00:00Z",
      modified: "2024-01-02T00:00:00Z",
    },
  }),
  makeFile({
    slug: "notes/bravo",
    filePath: "notes/bravo.md",
    frontmatter: {
      status: "todo",
      priority: 2,
    },
    outgoingLinks: ["gamma"],
  }),
];

describe("resolveBasesEntries", () => {
  it("returns all files when no filters are set", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("excludes .base files", () => {
    const basesData: BasesData = {};
    const files = [
      ...baseFiles,
      makeFile({
        slug: "notes/excluded.base",
        filePath: "notes/excluded.base",
        frontmatter: { status: "done" },
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.find((entry) => entry.slug.endsWith(".base"))).toBeUndefined();
  });

  it("applies global filters", () => {
    const basesData: BasesData = {
      filters: 'status == "done"',
    };
    const result = resolveBasesEntries(basesData, baseFiles);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.slug).toBe("notes/alpha");
  });

  it("applies view-specific filters", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      filters: "priority > 3",
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.slug).toBe("notes/alpha");
  });

  it("excludes unlisted pages from the rendered entries", () => {
    const basesData: BasesData = {};
    const files = [
      ...baseFiles,
      makeFile({
        slug: "secret/hidden",
        filePath: "secret/hidden.md",
        frontmatter: { title: "Hidden", status: "done", priority: 9 },
        unlisted: true,
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.find((e) => e.slug === "secret/hidden")).toBeUndefined();
    expect(result.total).toBe(2);
  });

  it("excludes unlisted pages even when a matching filter would include them", () => {
    const basesData: BasesData = {
      filters: "priority >= 1",
    };
    const files = [
      ...baseFiles,
      makeFile({
        slug: "secret/hidden",
        filePath: "secret/hidden.md",
        frontmatter: { title: "Hidden", priority: 10 },
        unlisted: true,
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries.find((e) => e.slug === "secret/hidden")).toBeUndefined();
  });

  it("includes pages with unlisted: false", () => {
    const basesData: BasesData = {};
    const files = [
      ...baseFiles,
      makeFile({
        slug: "secret/not-hidden",
        filePath: "secret/not-hidden.md",
        frontmatter: { title: "Not Hidden" },
        unlisted: false,
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries).toHaveLength(3);
    expect(result.entries.find((e) => e.slug === "secret/not-hidden")).toBeDefined();
  });

  it("unlisted pages cannot be dereferenced via .asFile() from a visible page", () => {
    const basesData: BasesData = {
      formulas: {
        linkedTitle: "note.linked.asFile().name",
      },
    };
    const files = [
      makeFile({
        slug: "visible/page",
        filePath: "visible/page.md",
        frontmatter: {
          title: "Visible",
          linked: "secret/hidden",
        },
      }),
      makeFile({
        slug: "secret/hidden",
        filePath: "secret/hidden.md",
        frontmatter: { title: "Hidden Secret" },
        unlisted: true,
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries).toHaveLength(1);
    const visible = result.entries[0];
    expect(visible?.slug).toBe("visible/page");
    // The unlisted page must NOT be resolvable via asFile() — the fileLookup
    // excludes unlisted pages, so formula evaluation returns undefined rather
    // than the unlisted page's title ("Hidden Secret").
    expect(visible?.formulaValues?.linkedTitle).not.toBe("Hidden Secret");
  });

  it("evaluates formulas on entries", () => {
    const basesData: BasesData = {
      formulas: {
        doubled: "priority * 2",
        label: 'if(priority > 3, "high", "low")',
      },
    };
    const result = resolveBasesEntries(basesData, baseFiles);
    const alpha = result.entries.find((entry) => entry.slug === "notes/alpha");
    expect(alpha?.formulaValues.doubled).toBe(10);
    expect(alpha?.formulaValues.label).toBe("high");
  });

  it("sorts entries by property", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      order: ["priority"],
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries.map((entry) => entry.slug)).toEqual(["notes/bravo", "notes/alpha"]);
  });

  it("sorts entries by direction", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      groupBy: { property: "priority", direction: "DESC" },
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries.map((entry) => entry.slug)).toEqual(["notes/alpha", "notes/bravo"]);
  });

  it("applies view limits", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      limit: 1,
      order: ["priority"],
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  it("builds file properties correctly", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    const alpha = result.entries.find((entry) => entry.slug === "notes/alpha");
    expect(alpha?.fileProperties).toEqual({
      name: "alpha",
      basename: "alpha",
      path: "notes/alpha.md",
      folder: "notes",
      ext: "md",
      tags: ["work", "important"],
      links: ["beta"],
      embeds: [],
      created: "2024-01-01T00:00:00.000Z",
      modified: "2024-01-02T00:00:00.000Z",
      ctime: new Date("2024-01-01T00:00:00Z"),
      mtime: new Date("2024-01-02T00:00:00Z"),
    });
  });

  it("strips .md extension from file.name", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    const alpha = result.entries.find((entry) => entry.slug === "notes/alpha");
    expect(alpha?.fileProperties.name).toBe("alpha");
  });

  it("keeps file.name as-is for files without extension", () => {
    const basesData: BasesData = {};
    const files: QuartzPluginData[] = [
      makeFile({ slug: "notes/README", filePath: "notes/README" }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries[0]?.fileProperties.name).toBe("README");
  });

  it("falls back to file name when title is missing", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    const bravo = result.entries.find((entry) => entry.slug === "notes/bravo");
    expect(bravo?.title).toBe("bravo");
  });

  it("sorts entries by sort field with multiple keys", () => {
    const files: QuartzPluginData[] = [
      makeFile({
        slug: "a",
        frontmatter: { status: "done", priority: 3 },
      }),
      makeFile({
        slug: "b",
        frontmatter: { status: "done", priority: 1 },
      }),
      makeFile({
        slug: "c",
        frontmatter: { status: "todo", priority: 2 },
      }),
    ];
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      sort: [
        { property: "status", direction: "ASC" },
        { property: "priority", direction: "ASC" },
      ],
    };
    const result = resolveBasesEntries(basesData, files, view);
    // "done" < "todo" alphabetically, then by priority ascending
    expect(result.entries.map((entry) => entry.slug)).toEqual(["b", "a", "c"]);
  });

  it("sort field takes priority over groupBy and order", () => {
    const files: QuartzPluginData[] = [
      makeFile({ slug: "x", frontmatter: { priority: 3, status: "done" } }),
      makeFile({ slug: "y", frontmatter: { priority: 1, status: "todo" } }),
    ];
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      sort: [{ property: "priority", direction: "DESC" }],
      groupBy: { property: "status", direction: "ASC" },
      order: ["status"],
    };
    const result = resolveBasesEntries(basesData, files, view);
    // sort field wins: priority DESC → x(3) first, y(1) second
    expect(result.entries.map((entry) => entry.slug)).toEqual(["x", "y"]);
  });

  it("sort applies globally even when groupBy is present", () => {
    const files: QuartzPluginData[] = [
      makeFile({ slug: "a", frontmatter: { category: "B", title: "Zebra" } }),
      makeFile({ slug: "b", frontmatter: { category: "A", title: "Mango" } }),
      makeFile({ slug: "c", frontmatter: { category: "B", title: "Apple" } }),
      makeFile({ slug: "d", frontmatter: { category: "A", title: "Cherry" } }),
    ];
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      groupBy: { property: "category", direction: "ASC" },
      sort: [
        { property: "category", direction: "ASC" },
        { property: "title", direction: "ASC" },
      ],
    };
    const result = resolveBasesEntries(basesData, files, view);
    // sort applies globally: category ASC then title ASC
    // A-Cherry, A-Mango, B-Apple, B-Zebra
    expect(result.entries.map((e) => e.slug)).toEqual(["d", "b", "c", "a"]);
  });

  it("includes embeds in file properties", () => {
    const files: QuartzPluginData[] = [makeFile({ slug: "notes/embed-test", frontmatter: {} })];
    // Manually add embeds to the file data
    (files[0] as Record<string, unknown>).embeds = ["image.png", "doc.pdf"];
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries[0]?.fileProperties.embeds).toEqual(["image.png", "doc.pdf"]);
  });

  it("spreads frontmatter into file.properties for formula access", () => {
    const basesData: BasesData = {
      formulas: {
        customTitle: "file.properties.title",
      },
    };
    const files: QuartzPluginData[] = [
      makeFile({
        slug: "notes/props-test",
        frontmatter: { title: "My Custom Title" },
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries[0]?.formulaValues.customTitle).toBe("My Custom Title");
  });

  it("resolves file metadata in string.asFile() via _fileLookup", () => {
    const elfFile = makeFile({
      slug: "Compendium/Lineages/elf",
      filePath: "Compendium/Lineages/elf.md",
      frontmatter: { title: "Elf", tags: ["lineage"] },
    });
    const humanFile = makeFile({
      slug: "Compendium/Lineages/human",
      filePath: "Compendium/Lineages/human.md",
      frontmatter: { title: "Human", tags: ["lineage"] },
    });
    const dragonFile = makeFile({
      slug: "Compendium/Creatures/dragon",
      filePath: "Compendium/Creatures/dragon.md",
      frontmatter: { title: "Dragon", tags: ["creature"] },
    });
    const speciesFile = makeFile({
      slug: "Compendium/Species/halfelf",
      filePath: "Compendium/Species/halfelf.md",
      frontmatter: { title: "Half-Elf", tags: ["species"], source: "PHB" },
    });
    (speciesFile as Record<string, unknown>).embeds = [
      "Compendium/Lineages/elf.md",
      "Compendium/Creatures/dragon.md",
    ];

    const basesData: BasesData = {
      formulas: {
        Inheritances: 'file.embeds.filter(value.asFile().hasTag("lineage")).map(value.asFile())',
      },
      filters: 'file.tags.contains("species")',
    };

    const allFiles = [elfFile, humanFile, dragonFile, speciesFile];
    const result = resolveBasesEntries(basesData, allFiles);
    expect(result.entries).toHaveLength(1);
    const halfelf = result.entries[0];
    expect(halfelf?.slug).toBe("Compendium/Species/halfelf");
    const inheritances = halfelf?.formulaValues.Inheritances as Record<string, unknown>[];
    expect(inheritances).toHaveLength(1);
    expect(inheritances[0]?.name).toBe("elf");
    expect(inheritances[0]?.tags).toEqual(["lineage"]);
  });

  it("resolves string.asFile() without .md extension in embeds", () => {
    const targetFile = makeFile({
      slug: "docs/guide",
      filePath: "docs/guide.md",
      frontmatter: { title: "Guide", tags: ["reference"] },
    });
    const sourceFile = makeFile({
      slug: "pages/index",
      filePath: "pages/index.md",
      frontmatter: { title: "Index", tags: ["page"] },
    });
    (sourceFile as Record<string, unknown>).embeds = ["docs/guide"];

    const basesData: BasesData = {
      formulas: {
        refs: 'file.embeds.filter(value.asFile().hasTag("reference")).map(value.asFile())',
      },
      filters: 'file.tags.contains("page")',
    };

    const result = resolveBasesEntries(basesData, [targetFile, sourceFile]);
    expect(result.entries).toHaveLength(1);
    const refs = result.entries[0]?.formulaValues.refs as Record<string, unknown>[];
    expect(refs).toHaveLength(1);
    expect(refs[0]?.name).toBe("guide");
  });

  it("resolves short basename embeds from OFM wikilinks", () => {
    const appleFile = makeFile({
      slug: "Compendium/Species/Dryad/Apple",
      filePath: "Compendium/Species/Dryad/Apple.md",
      frontmatter: { title: "Apple", tags: ["homebrew", "lineage", "dryad"] },
    });
    const cherryFile = makeFile({
      slug: "Compendium/Species/Dryad/Cherry",
      filePath: "Compendium/Species/Dryad/Cherry.md",
      frontmatter: { title: "Cherry", tags: ["homebrew", "lineage", "dryad"] },
    });
    const oakFile = makeFile({
      slug: "Compendium/Species/Dryad/Oak",
      filePath: "Compendium/Species/Dryad/Oak.md",
      frontmatter: { title: "Oak", tags: ["homebrew", "lineage", "dryad"] },
    });
    const dryadFile = makeFile({
      slug: "Compendium/Species/Dryad/index",
      filePath: "Compendium/Species/Dryad/index.md",
      frontmatter: { title: "Dryad", tags: ["species"], source: "Homebrew" },
    });
    (dryadFile as Record<string, unknown>).embeds = ["Apple", "Cherry", "Oak"];

    const basesData: BasesData = {
      formulas: {
        Inheritances: 'file.embeds.filter(value.asFile().hasTag("lineage")).map(value.asFile())',
      },
      filters: 'file.tags.contains("species")',
    };

    const allFiles = [appleFile, cherryFile, oakFile, dryadFile];
    const result = resolveBasesEntries(basesData, allFiles);
    expect(result.entries).toHaveLength(1);
    const dryad = result.entries[0];
    expect(dryad?.slug).toBe("Compendium/Species/Dryad/index");
    const inheritances = dryad?.formulaValues.Inheritances as Record<string, unknown>[];
    expect(inheritances).toHaveLength(3);
    expect(inheritances.map((f) => f.basename)).toEqual(["Apple", "Cherry", "Oak"]);
    expect(inheritances.every((f) => (f.tags as string[]).includes("lineage"))).toBe(true);
  });

  it("resolves short basename embeds with non-matching tags filtered out", () => {
    const lineageFile = makeFile({
      slug: "Species/Dryad/Apple",
      filePath: "Species/Dryad/Apple.md",
      frontmatter: { title: "Apple", tags: ["lineage"] },
    });
    const creatureFile = makeFile({
      slug: "Species/Dryad/Treant",
      filePath: "Species/Dryad/Treant.md",
      frontmatter: { title: "Treant", tags: ["creature"] },
    });
    const speciesFile = makeFile({
      slug: "Species/Dryad/index",
      filePath: "Species/Dryad/index.md",
      frontmatter: { title: "Dryad", tags: ["species"] },
    });
    (speciesFile as Record<string, unknown>).embeds = ["Apple", "Treant"];

    const basesData: BasesData = {
      formulas: {
        Inheritances: 'file.embeds.filter(value.asFile().hasTag("lineage")).map(value.asFile())',
      },
      filters: 'file.tags.contains("species")',
    };

    const allFiles = [lineageFile, creatureFile, speciesFile];
    const result = resolveBasesEntries(basesData, allFiles);
    expect(result.entries).toHaveLength(1);
    const inheritances = result.entries[0]?.formulaValues.Inheritances as Record<string, unknown>[];
    expect(inheritances).toHaveLength(1);
    expect(inheritances[0]?.basename).toBe("Apple");
  });

  it("file.links.contains(this) matches slug-format links against self context", () => {
    const files = [
      makeFile({
        slug: "notes/alpha",
        filePath: "notes/alpha.md",
        frontmatter: { title: "Alpha" },
        links: ["bases/my-base"],
      }),
      makeFile({
        slug: "notes/bravo",
        filePath: "notes/bravo.md",
        frontmatter: { title: "Bravo" },
        links: ["notes/alpha"],
      }),
    ];
    const basesData: BasesData = {
      filters: "file.links.contains(this)",
    };
    const selfContext = {
      file: {
        name: "My Base",
        path: "bases/My Base.base",
        folder: "bases",
        ext: "base",
      },
    };
    const result = resolveBasesEntries(basesData, files, undefined, selfContext);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.slug).toBe("notes/alpha");
  });

  it("resolves scalar custom frontmatter from selfContext via this.*", () => {
    const files = [
      makeFile({ slug: "a", frontmatter: { genre: "fiction" } }),
      makeFile({ slug: "b", frontmatter: { genre: "non-fiction" } }),
    ];
    const basesData: BasesData = {
      filters: "note.genre == this.preferredGenre",
    };
    const selfContext = {
      file: { name: "My Base", path: "bases/my-base.base", folder: "bases", ext: "base" },
      preferredGenre: "fiction",
    };
    const result = resolveBasesEntries(basesData, files, undefined, selfContext);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.slug).toBe("a");
  });

  it("resolves list custom frontmatter from selfContext via this.* in formulas", () => {
    const files = [
      makeFile({ slug: "a", frontmatter: { status: "done" } }),
      makeFile({ slug: "b", frontmatter: { status: "todo" } }),
      makeFile({ slug: "c", frontmatter: { status: "active" } }),
    ];
    const basesData: BasesData = {
      formulas: {
        isAllowed: "this.allowedStatuses.contains(note.status)",
      },
    };
    const selfContext = {
      file: { name: "My Base", path: "bases/my-base.base", folder: "bases", ext: "base" },
      allowedStatuses: ["done", "active"],
    };
    const result = resolveBasesEntries(basesData, files, undefined, selfContext);
    const a = result.entries.find((e) => e.slug === "a");
    const b = result.entries.find((e) => e.slug === "b");
    const c = result.entries.find((e) => e.slug === "c");
    expect(a?.formulaValues.isAllowed).toBe(true);
    expect(b?.formulaValues.isAllowed).toBe(false);
    expect(c?.formulaValues.isAllowed).toBe(true);
  });

  it("hasProperty filter includes files with null/falsy property values", () => {
    const files = [
      makeFile({
        slug: "notes/with-null",
        filePath: "notes/with-null.md",
        frontmatter: { title: "With Null", status: null },
      }),
      makeFile({
        slug: "notes/with-false",
        filePath: "notes/with-false.md",
        frontmatter: { title: "With False", status: false },
      }),
      makeFile({
        slug: "notes/without",
        filePath: "notes/without.md",
        frontmatter: { title: "Without" },
      }),
    ];
    const basesData: BasesData = {
      filters: 'file.hasProperty("status")',
    };
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((e) => e.slug).sort()).toEqual([
      "notes/with-false",
      "notes/with-null",
    ]);
  });
});
