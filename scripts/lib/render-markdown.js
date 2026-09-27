// Node wrapper around scripts/render-markdown.rb, which renders markdown
// with Jekyll's own kramdown setup. Needs the local Ruby/Bundler setup.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function renderMarkdown(markdown) {
  // A single command string so `bundle` resolves to bundle.bat on Windows too.
  return execSync("bundle exec ruby scripts/render-markdown.rb", {
    cwd: REPO_ROOT,
    input: markdown,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "inherit"],
  });
}
