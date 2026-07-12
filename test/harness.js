/* ============================================================
   TINY TEST HARNESS
   Zero-dependency test runner that works in Node (`node test/x.test.js`)
   and in the browser. No npm, no build step.
   ============================================================ */

let passed = 0;
let failed = 0;
let suite = '';
const lines = [];

function out(msg) {
  lines.push(msg);
  // eslint-disable-next-line no-console
  console.log(msg);
}

export function describe(name, fn) {
  suite = name;
  out(`\n${name}`);
  fn();
  suite = '';
}

export function it(name, fn) {
  const label = suite ? `  ${name}` : name;
  try {
    fn();
    passed++;
    out(`  ✓ ${label.trim()}`);
  } catch (err) {
    failed++;
    out(`  ✗ ${label.trim()}`);
    out(`      ${err.message}`);
  }
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(msg || `expected ${b}, got ${a}`);
}

export function assertTrue(value, msg) {
  if (value !== true) throw new Error(msg || `expected true, got ${JSON.stringify(value)}`);
}

export function assertFalse(value, msg) {
  if (value !== false) throw new Error(msg || `expected false, got ${JSON.stringify(value)}`);
}

/** Print totals and return the failure count. */
export function summary() {
  out(`\n${passed} passed, ${failed} failed`);
  return failed;
}

/** Node entry point: call at the end of a test file to set the exit code. */
export function finish() {
  const f = summary();
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(f > 0 ? 1 : 0);
  }
  return f;
}
