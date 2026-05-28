#!/usr/bin/env node
// Regression tests for scripts/commit-validate.js.
// Dependency-free: run with `node test/commit-validate.test.js`.
// Exits non-zero if any case fails.
const { execFileSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'commit-validate.js');

// Each case feeds the hook the JSON it receives on stdin and asserts the exit code.
// exit 0 => allowed (valid, or unparseable so skipped); exit 2 => blocked.
const cases = [
  // The bug this fixes: -m wrapping a heredoc command substitution. The real
  // subject lives inside the heredoc and must be validated, not "$(cat <<'EOF'".
  { name: 'heredoc-in-$(...) with valid subject is allowed',
    command: `git commit -S -m "$(cat <<'EOF'\nfix(scope): valid subject\n\nBody.\nEOF\n)"`,
    expect: 0 },
  { name: 'heredoc-in-$(...) with quotes in body is allowed',
    command: `git commit -S -m "$(cat <<'EOF'\nfix(scope): valid subject\n\nBody with ("quoted") text.\nEOF\n)"`,
    expect: 0 },
  { name: 'heredoc-in-$(...) with INVALID subject is still blocked',
    command: `git commit -S -m "$(cat <<'EOF'\nnope: not a real type\nEOF\n)"`,
    expect: 2 },

  // Forms that already worked — guard against regressions.
  { name: 'plain -m with valid subject is allowed',
    command: `git commit -S -m "fix(scope): valid subject"`,
    expect: 0 },
  { name: 'plain -m with invalid type is blocked',
    command: `git commit -S -m "nope: bad type"`,
    expect: 2 },
  { name: 'bare heredoc (-F -) with valid subject is allowed',
    command: `git commit -S -F - <<'EOF'\nfix(scope): valid subject\nEOF`,
    expect: 0 },
  { name: 'multiple -m flags with valid subject is allowed',
    command: `git commit -S -m "fix(scope): valid subject" -m "Body."`,
    expect: 0 },

  // -m wrapping a non-heredoc command substitution can't be parsed; skip, don't block.
  { name: '-m "$(...)" with no heredoc is skipped (not blocked)',
    command: `git commit -S -m "$(printf 'whatever')"`,
    expect: 0 },
];

let failures = 0;
for (const c of cases) {
  const payload = JSON.stringify({ tool_input: { command: c.command } });
  let exit = 0;
  try {
    execFileSync('node', [SCRIPT], { input: payload, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    exit = e.status;
  }
  const ok = exit === c.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name} (exit ${exit}, expected ${c.expect})`);
}

if (failures) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} tests passed.`);
