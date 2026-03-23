/* ============================================================
   SHUFFLE UTILITY
   Fisher-Yates shuffle — returns a new shuffled copy.
   ============================================================ */

/**
 * Return a new array with elements in random order (Fisher-Yates).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
