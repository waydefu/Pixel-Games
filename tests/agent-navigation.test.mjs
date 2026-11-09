import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const text = (file) => readFileSync(file, "utf8");

test("agent entrypoints are concise and point to on-demand navigation", () => {
  const agents = text("AGENTS.md");
  const copilot = text(".github/copilot-instructions.md");
  assert.match(agents, /docs\/INDEX\.md/);
  assert.match(copilot, /AGENTS\.md/);
  assert.match(copilot, /docs\/INDEX\.md/);
  assert.match(agents, /Owner/);
  assert.match(agents, /NOT RUN/);
});

test("navigation index local Markdown links resolve to real files or directories", () => {
  const file = "docs/INDEX.md";
  const index = text(file);
  const links = [...index.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)];
  assert.ok(links.length >= 12, "navigation index should route to existing docs");
  for (const [, url] of links) {
    if (/^(https?:|mailto:|#)/i.test(url)) continue;
    const localPath = decodeURIComponent(url.split("#", 1)[0]);
    assert.ok(existsSync(resolve(dirname(file), localPath)), `broken docs/INDEX.md link: ${url}`);
  }
});

test("path-specific instructions stay scoped to their respective areas", () => {
  for (const [path, match] of [
    [".github/instructions/rendering.instructions.md", "src/rendering/"],
    [".github/instructions/governance.instructions.md", ".github/workflows/"],
  ]) {
    const body = text(path);
    assert.match(body, /^---\napplyTo: ".+"\n---/);
    assert.ok(body.includes(match), `missing scoped path in ${path}`);
    assert.ok(body.includes("AGENTS.md"), `missing global instruction reference in ${path}`);
  }
});
