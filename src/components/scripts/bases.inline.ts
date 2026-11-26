// @ts-nocheck

function setActiveView(page, index) {
  const tabs = page.querySelectorAll(".bases-view-tabs button");
  const views = page.querySelectorAll(".bases-view");

  tabs.forEach((tab) => {
    const active = tab.dataset.viewIndex === String(index);
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
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

function initTabs(page, cleanupFns) {
  const tabs = page.querySelectorAll(".bases-view-tabs button");
  if (tabs.length === 0) return;
  const initial = parseInt(page.dataset.initialView || "0", 10);
  setActiveView(page, Number.isNaN(initial) ? 0 : initial);

  tabs.forEach((tab) => {
    const handler = () => {
      const index = parseInt(tab.dataset.viewIndex || "0", 10);
      setActiveView(page, Number.isNaN(index) ? 0 : index);
    };
    tab.addEventListener("click", handler);
    cleanupFns.push(() => tab.removeEventListener("click", handler));
  });
}

function initBases() {
  const pages = document.querySelectorAll(".bases-page");
  if (pages.length === 0) return;
  const cleanupFns = [];

  pages.forEach((page) => {
    initTabs(page, cleanupFns);
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
