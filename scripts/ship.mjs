/**
 * Run backend build + tests; if clean, git add/commit/push.
 * Usage: npm run ship -- "feat: your message"
 *    or: SHIP_MESSAGE="feat: your message" npm run ship
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8", shell: true }).trim();
}

const msg =
  process.argv.slice(2).join(" ").trim() ||
  (process.env.SHIP_MESSAGE && String(process.env.SHIP_MESSAGE).trim());

if (!msg) {
  console.error("Missing commit message.");
  console.error('  npm run ship -- "feat: short description"');
  console.error("  SHIP_MESSAGE=\"feat: ...\" npm run ship");
  process.exit(1);
}

try {
  run("npm run build --prefix backend");
  run("npm run test --prefix backend");
} catch {
  console.error("\nship: build or test failed; not committing.");
  process.exit(1);
}

const status = runCapture("git status --porcelain");
if (!status) {
  console.log("ship: nothing to commit.");
  process.exit(0);
}

run("git add -A");
run(`git commit -m ${JSON.stringify(msg)}`);
run("git push");
console.log("ship: done.");
