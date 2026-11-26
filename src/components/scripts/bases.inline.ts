// @ts-nocheck
import { freeIdPrefix, tabIndexForKey } from "./tabs";

function setActiveView(page, index) {
  const tabs = page.querySelectorAll(".bases-view-tabs button");
  const views = page.querySelectorAll(".bases-view");

  tabs.forEach((tab) => {
    const active = tab.dataset.viewIndex === String(index);
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    // roving tabindex: only the selected tab is in the tab order
    tab.tabIndex = active ? 0 : -1;
  });
  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.viewIndex === String(index));
  });
}

function compareValues(a, b) {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return String(a).localeCompare(String(b));
}

function sortDataRows(rows, columnIndex, direction) {
  if (rows.length === 0) return rows;
  rows.sort((rowA, rowB) => {
    const cellA = rowA.children[columnIndex];
    const cellB = rowB.children[columnIndex];
    const valueA = cellA?.dataset?.value ?? cellA?.textContent ?? "";
    const valueB = cellB?.dataset?.value ?? cellB?.textContent ?? "";
    return compareValues(valueA, valueB);
  });
  if (direction === "desc") rows.reverse();
  return rows;
}

function sortTable(table, columnIndex, direction) {
  const body = table.querySelector("tbody");
  if (!body) return;
  const allRows = Array.from(body.querySelectorAll("tr"));
  if (direction === "none") {
    const original = table._originalOrder;
    if (original) {
      original.forEach((row) => body.appendChild(row));
    }
    return;
  }
  if (!table._originalOrder) {
    table._originalOrder = Array.from(allRows);
  }
  const hasGroups = allRows.some((row) => row.classList.contains("bases-table-group-header"));
  if (hasGroups) {
    const groups = [];
    let currentGroup = null;
    for (const row of allRows) {
      if (row.classList.contains("bases-table-group-header")) {
        currentGroup = { header: row, summaries: [], rows: [] };
        groups.push(currentGroup);
      } else if (currentGroup && row.classList.contains("bases-group-summary-row")) {
        // a group's summary row stays under its heading
        currentGroup.summaries.push(row);
      } else if (currentGroup) {
        currentGroup.rows.push(row);
      } else {
        currentGroup = { header: null, summaries: [], rows: [row] };
        groups.push(currentGroup);
      }
    }
    for (const group of groups) {
      sortDataRows(group.rows, columnIndex, direction);
    }
    for (const group of groups) {
      if (group.header) body.appendChild(group.header);
      group.summaries.forEach((row) => body.appendChild(row));
      group.rows.forEach((row) => body.appendChild(row));
    }
  } else {
    sortDataRows(allRows, columnIndex, direction);
    allRows.forEach((row) => body.appendChild(row));
  }
}

function initTables(page, cleanupFns) {
  const tables = page.querySelectorAll(".bases-table");
  tables.forEach((table) => {
    const headers = table.querySelectorAll("th[data-sortable='true']");
    headers.forEach((header, index) => {
      const handler = () => {
        const current = header.dataset.sortDirection || "none";
        const next = current === "asc" ? "desc" : current === "desc" ? "none" : "asc";
        headers.forEach((th) => {
          if (th !== header) th.dataset.sortDirection = "none";
          th.classList.remove("is-sorted-asc", "is-sorted-desc");
        });
        header.dataset.sortDirection = next;
        header.classList.toggle("is-sorted-asc", next === "asc");
        header.classList.toggle("is-sorted-desc", next === "desc");
        sortTable(table, index, next);
      };
      header.addEventListener("click", handler);
      cleanupFns.push(() => header.removeEventListener("click", handler));
    });
  });
}

/**
 * Give the tabs and views of a base ids no earlier base on the page has (the same note or base
 * can be on a page twice, e.g. transcluded), keeping each tab's aria-controls and each view's
 * aria-labelledby pointing at the other.
 */
function uniqueTabIds(page, tabs, seen) {
  const panelOf = (tab) => {
    const index = tab.dataset.viewIndex;
    return Array.from(page.querySelectorAll(".bases-view")).find(
      (view) => view.dataset.viewIndex === index && view.closest(".bases-page") === page,
    );
  };
  const pairs = Array.from(tabs, (tab) => [tab, panelOf(tab)]);
  const ids = pairs.flatMap(([tab, panel]) => [tab.id, panel?.id].filter(Boolean));
  if (ids.length > 0 && !ids.some((id) => seen.has(id))) {
    ids.forEach((id) => seen.add(id));
    return;
  }
  const base = (tabs[0].id || "bases-tab-0").replace(/-tab-\d+$/, "");
  const prefix = freeIdPrefix(
    base,
    (p) =>
      pairs.flatMap(([tab]) => [
        `${p}-tab-${tab.dataset.viewIndex}`,
        `${p}-view-${tab.dataset.viewIndex}`,
      ]),
    (id) => seen.has(id) || document.getElementById(id) !== null,
  );
  for (const [tab, panel] of pairs) {
    const index = tab.dataset.viewIndex;
    tab.id = `${prefix}-tab-${index}`;
    seen.add(tab.id);
    if (panel) {
      panel.id = `${prefix}-view-${index}`;
      seen.add(panel.id);
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      if (!panel.hasAttribute("tabindex")) panel.tabIndex = 0;
    }
  }
}

function initTabs(page, cleanupFns, seenIds) {
  const tabs = page.querySelectorAll(".bases-view-tabs button");
  if (tabs.length === 0) return;
  uniqueTabIds(page, tabs, seenIds);
  const initial = parseInt(page.dataset.initialView || "0", 10);
  setActiveView(page, Number.isNaN(initial) ? 0 : initial);

  const list = Array.from(tabs);
  list.forEach((tab, position) => {
    const select = () => {
      const index = parseInt(tab.dataset.viewIndex || "0", 10);
      setActiveView(page, Number.isNaN(index) ? 0 : index);
    };
    // Left/Right (wrapping), Home and End move to a tab and select it
    const onKeydown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const next = tabIndexForKey(e.key, position, list.length);
      if (next === undefined) return;
      e.preventDefault();
      list[next].focus();
      list[next].click();
    };
    tab.addEventListener("click", select);
    tab.addEventListener("keydown", onKeydown);
    cleanupFns.push(() => {
      tab.removeEventListener("click", select);
      tab.removeEventListener("keydown", onKeydown);
    });
  });
}

function initBases() {
  const pages = document.querySelectorAll(".bases-page");
  if (pages.length === 0) return;
  const cleanupFns = [];
  const seenIds = new Set();

  pages.forEach((page) => {
    initTabs(page, cleanupFns, seenIds);
    initTables(page, cleanupFns);
  });

  if (window.addCleanup) {
    window.addCleanup(() => {
      cleanupFns.forEach((fn) => {
        fn();
      });
    });
  }
}

document.addEventListener("nav", () => {
  initBases();
});
document.addEventListener("render", () => {
  initBases();
});

initBases();
