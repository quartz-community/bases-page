/**
 * The tab a key moves to in a horizontal tab list of `count` tabs (WAI-ARIA tabs pattern): the
 * previous or next one (wrapping around), the first or the last; `undefined` for other keys.
 */
export function tabIndexForKey(key: string, current: number, count: number): number | undefined {
  if (count <= 0) return undefined;
  switch (key) {
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "ArrowRight":
      return (current + 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
}

/**
 * An id prefix for a base's tabs and views that no element on the page uses yet: `prefix`, else
 * `prefix-2`, `prefix-3`, … (`taken` tells whether an id is used).
 */
export function freeIdPrefix(
  prefix: string,
  ids: (prefix: string) => string[],
  taken: (id: string) => boolean,
): string {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? prefix : `${prefix}-${n}`;
    if (!ids(candidate).some(taken)) return candidate;
  }
}
