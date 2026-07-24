import type {
  QuartzPageTypePlugin,
  PageMatcher,
  FullSlug,
  FilePath,
  VirtualPage,
  TreeTransform,
  QuartzComponentProps,
} from "@quartz-community/types";
import type { Root as HtmlRoot, Element, ElementContent } from "hast";
import { visit } from "unist-util-visit";
import { render } from "preact-render-to-string";
import { h, Fragment } from "preact";
import { fromHtml } from "hast-util-from-html";
import { readFileSync } from "fs";
import { join } from "path";
import { slugifyFilePath } from "@quartz-community/utils";
import type { SimpleSlug } from "@quartz-community/utils";
import { parseBasesData } from "./parser";
import { resolveBasesEntries } from "./resolver";
import BasesBody from "./components/BasesBody";
import type { BasesPageOptions, BasesData } from "./types";
import type { EvalContext } from "./compiler";
import { registerBuiltinViews } from "./components/views";
import { registerCustomViews, viewRegistry } from "./registry";
import { i18n } from "./i18n";
import { ViewSelector } from "./components/ViewSelector";

const basesMatcher: PageMatcher = ({ fileData }) => {
  return "basesData" in fileData;
};

export const BasesPage: QuartzPageTypePlugin<BasesPageOptions> = (opts) => ({
  name: "BasesPage",
  priority: 20,
  fileExtensions: [".base"],
  match: basesMatcher,
  generate({ content, ctx }) {
    const baseFiles = ctx.allFiles.filter((fp) => fp.endsWith(".base"));
    const allFileData = content.map((c) => c[1].data);
    const virtualPages: VirtualPage[] = [];

    for (const filePath of baseFiles) {
      const fullPath = join(ctx.argv.directory, filePath);
      let raw: string;
      try {
        raw = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const basesData = parseBasesData(raw);
      if (!basesData) continue;

      const slug = slugifyFilePath(filePath as unknown as FilePath) as unknown as FullSlug;
      const fileWithoutExt = filePath.replace(/\.base$/, "");
      const baseName = fileWithoutExt.split("/").pop() ?? "Base";

      const lastSlash = filePath.lastIndexOf("/");
      const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
      const dotIndex = filePath.lastIndexOf(".");
      const ext = dotIndex >= 0 ? filePath.slice(dotIndex + 1) : "";
      const basesSelfContext = {
        file: {
          name: baseName,
          path: filePath,
          folder,
          ext,
        },
      };

      virtualPages.push({
        slug,
        title: baseName,
        data: {
          frontmatter: { title: baseName, tags: [] },
          links: resolveBasesEntries(
            basesData,
            allFileData,
            undefined,
            basesSelfContext,
          ).entries.map((e) => e.slug as SimpleSlug),
          basesData,
          basesOptions: opts,
          basesSelfContext,
        },
      });
    }

    return virtualPages;
  },
  layout: "bases",
  body: BasesBody,
  treeTransforms(_ctx) {
    return [createBasesCodeblockTransform(opts)];
  },
});

/**
 * Creates a tree transform that resolves `data-qz-bases-codeblock` placeholder
 * divs at render time, replacing them with fully rendered Bases views.
 *
 * This runs after transclusion in `renderPage()`, when `allFiles` is available.
 */
function createBasesCodeblockTransform(opts: BasesPageOptions | undefined): TreeTransform {
  let builtinViewsRegistered = false;

  return (root: HtmlRoot, _slug: FullSlug, componentData: QuartzComponentProps) => {
    const fileData = componentData.fileData as Record<string, unknown>;
    const basesBlocks = fileData.basesBlocks as BasesData[] | undefined;
    if (!basesBlocks || basesBlocks.length === 0) return;

    // Ensure built-in views are registered
    if (!builtinViewsRegistered) {
      registerBuiltinViews();
      builtinViewsRegistered = true;
    }
    if (opts?.customViews) {
      registerCustomViews(opts.customViews);
    }

    const locale = componentData.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const allFiles = componentData.allFiles;
    const slug = (componentData.fileData.slug as string) ?? "";
    const allSlugs = ((componentData.ctx as Record<string, unknown>)?.allSlugs as string[]) ?? [];
    const linkResolution = opts?.linkResolution ?? "shortest";

    visit(root, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined) return;
      const blockIndexStr = node.properties?.["dataQzBasesCodeblock"] as string | undefined;
      if (blockIndexStr === undefined) return;

      const blockIndex = Number(blockIndexStr);
      const basesData = basesBlocks[blockIndex];
      if (!basesData) return;

      const viewName = node.properties?.["dataQzBasesView"] as string | undefined;

      const fd = componentData.fileData as Record<string, unknown>;
      const selfPath = (fd.relativePath ?? fd.filePath ?? slug) as string;
      const selfName =
        selfPath
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? "";
      const selfLastSlash = selfPath.lastIndexOf("/");
      const selfContext = {
        file: {
          name: selfName,
          path: selfPath,
          folder: selfLastSlash >= 0 ? selfPath.slice(0, selfLastSlash) : "",
          ext: selfPath.slice(selfPath.lastIndexOf(".") + 1),
        },
      };

      const baseSlugs = new Set(allSlugs.filter((s) => s.endsWith(".base")));
      const baseAliases = new Set([...baseSlugs].map((s) => s.replace(/\.base$/, "")));
      const contentSlugs = allSlugs.filter((s) => !baseSlugs.has(s) && !baseAliases.has(s));

      const htmlString = renderBasesInline(
        basesData,
        allFiles,
        locale,
        localeStrings,
        opts,
        slug,
        contentSlugs,
        linkResolution,
        viewName,
        selfContext,
      );
      const fragment = fromHtml(htmlString, { fragment: true }) as HtmlRoot;

      // Replace the placeholder node's children with the rendered content
      node.tagName = "div";
      node.properties = { class: "bases-page bases-inline" };
      node.children = fragment.children as ElementContent[];
    });
  };
}

/**
 * Render a BasesData block to an HTML string, replicating the core rendering
 * logic of BasesBody.tsx but invoked at tree-transform time.
 */
function renderBasesInline(
  basesData: BasesData,
  allFiles: Record<string, unknown>[],
  locale: string,
  localeStrings: { noData: string; noViews: string },
  opts: BasesPageOptions | undefined,
  slug: string,
  allSlugs: string[],
  linkResolution: "absolute" | "relative" | "shortest",
  viewName?: string,
  selfContext?: EvalContext["self"],
): string {
  let views = basesData.views ?? [];

  if (viewName) {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
    const viewNameNorm = normalize(viewName);
    views = views.filter((v) => v.name !== undefined && normalize(v.name) === viewNameNorm);
    if (views.length === 0) {
      return `<div class="bases-empty">View &quot;${viewName}&quot; not found</div>`;
    }
  }

  if (views.length === 0) {
    return `<div class="bases-empty">${localeStrings.noViews}</div>`;
  }

  const preferredType = opts?.defaultViewType ?? "table";
  const initialIndex = Math.max(
    0,
    views.findIndex((view) => view.type === preferredType),
  );

  // Collect CSS from custom view registrations (deduplicated by type)
  const activeTypes = new Set(views.map((v) => v.type));
  const viewCssChunks: string[] = [];
  for (const typeId of activeTypes) {
    const reg = viewRegistry.get(typeId);
    if (reg?.css) viewCssChunks.push(reg.css);
  }

  // Render the view selector
  const selectorHtml = render(
    h(Fragment, null, ViewSelector({ views, activeIndex: initialIndex, locale })),
  );

  // Render each view panel
  const viewPanels = views.map((view, index) => {
    const { entries, total } = resolveBasesEntries(basesData, allFiles, view, selfContext);
    const registration = viewRegistry.get(view.type);
    const Renderer = registration?.render;
    const activeClass = index === initialIndex ? " is-active" : "";

    let innerHtml: string;
    if (entries.length === 0) {
      innerHtml = `<div class="bases-empty">${localeStrings.noData}</div>`;
    } else if (Renderer) {
      innerHtml = render(
        h(
          Fragment,
          null,
          Renderer({
            entries,
            view,
            basesData,
            total,
            locale,
            slug,
            allSlugs,
            linkResolution,
            options: registration?.options,
          }),
        ),
      );
    } else {
      innerHtml = `<div class="bases-empty">Unknown view type: ${view.type}</div>`;
    }

    return `<div class="bases-view${activeClass}" data-view-index="${index}" data-view-type="${view.type}">${innerHtml}</div>`;
  });

  const cssBlock = viewCssChunks.length > 0 ? `<style>${viewCssChunks.join("\n")}</style>` : "";

  return `${cssBlock}${selectorHtml}<div class="bases-view-container">${viewPanels.join("")}</div>`;
}
