import { describe, it, expect } from "vitest";
import type { Root as HTMLRoot } from "hast";
import { BasesTransformer } from "../src/transformer";

function makeTree(baseContent: string): HTMLRoot {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "pre",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "code",
            properties: { className: ["language-base"] },
            children: [{ type: "text", value: baseContent }],
          },
        ],
      },
    ],
  };
}

function getCodeblockTransformer() {
  const plugin = BasesTransformer({});
  const mockCtx = { allFiles: [] } as any;
  const htmlPlugins = plugin.htmlPlugins!(mockCtx);
  return (htmlPlugins[1] as () => (tree: any, file: any) => void)();
}

describe("BasesTransformer - inline codeblock handler", () => {
  it("registers a codeblock block on file.data.basesBlocks", () => {
    const tree = makeTree('filters: "status == done"');
    const file = { data: {} };

    getCodeblockTransformer()(tree, file);

    expect((file.data as any).basesBlocks).toHaveLength(1);
  });

  it("assigns placeholder index 0 when there are no existing blocks", () => {
    const tree = makeTree('filters: "status == done"');
    const file = { data: {} };

    getCodeblockTransformer()(tree, file);

    const placeholder = (tree.children[0] as any);
    expect(placeholder.properties.dataQzBasesCodeblock).toBe("0");
  });

  it("continues block indices from pre-existing transclusion blocks", () => {
    const existingBlock = { filters: "pre-existing transclusion" };
    const tree = makeTree('filters: "status == done"');
    const file = { data: { basesBlocks: [existingBlock] } };

    getCodeblockTransformer()(tree, file);

    // Inline block should get index 1 (after the transclusion block at 0)
    const placeholder = (tree.children[0] as any);
    expect(placeholder.properties.dataQzBasesCodeblock).toBe("1");
  });

  it("merges inline blocks with pre-existing transclusion blocks", () => {
    const existingBlock = { filters: "pre-existing transclusion" };
    const tree = makeTree('filters: "status == done"');
    const file = { data: { basesBlocks: [existingBlock] } };

    getCodeblockTransformer()(tree, file);

    const blocks = (file.data as any).basesBlocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toBe(existingBlock);
  });

  it("preserves existing blocks when no inline codeblocks are present", () => {
    const existingBlock = { filters: "pre-existing transclusion" };
    const tree: HTMLRoot = { type: "root", children: [] };
    const file = { data: { basesBlocks: [existingBlock] } };

    getCodeblockTransformer()(tree, file);

    // No inline blocks → existing blocks untouched
    expect((file.data as any).basesBlocks).toHaveLength(1);
    expect((file.data as any).basesBlocks[0]).toBe(existingBlock);
  });
});
