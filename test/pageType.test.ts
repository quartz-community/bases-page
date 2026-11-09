import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { BuildCtx, FilePath, QuartzConfig } from "@quartz-community/types";
import { BasesPage } from "../src/pageType";

// the page body imports a browser script that only Quartz's bundler can load
vi.mock("../src/components/BasesBody", () => ({ default: () => null }));

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
        join(ctx.argv.directory, "views/Team Board.base"),
      ],
    ]);
  });
});
