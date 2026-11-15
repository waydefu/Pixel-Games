// Makes Playwright's "flaky" outcome visible without failing the run (#48, O-29). A test that fails and then passes on retry
// is reported as flaky by Playwright but is not a failure, so nothing else in CI shows it. This reads the JSON report that the
// CI reporter writes and lists those tests in the job summary. It never fails the job.
import { readFileSync, appendFileSync, existsSync } from "node:fs";

/** @returns {{project:string,title:string,retries:number}[]} every test whose final outcome is "flaky" */
export function flakyTests(report) {
  const found = [];
  const visit = (suite, trail) => {
    const names = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status !== "flaky") continue;
        const project = test.projectName ?? "unknown";
        found.push({ project, title: [...names, spec.title].join(" › "), retries: Math.max(0, (test.results ?? []).length - 1) });
      }
    }
    for (const child of suite.suites ?? []) visit(child, names);
  };
  for (const suite of report.suites ?? []) visit(suite, []);
  return found;
}

export function summaryMarkdown(found) {
  if (!found.length) return "### 重試後通過的測試（flaky）\n\n無。\n";
  const rows = found.map(f => `| ${f.project} | ${f.title} | ${f.retries} |`).join("\n");
  return `### 重試後通過的測試（flaky）\n\n這些測試第一次失敗、重試後通過，**不會讓 CI 失敗**，但代表有不穩定的地方（#48）。\n\n| 專案 | 測試 | 重試次數 |\n| --- | --- | --- |\n${rows}\n`;
}

// CLI: node scripts/flaky-summary.mjs [path-to-json]
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const path = process.argv[2] ?? "test-results/results.json";
  if (!existsSync(path)) {
    console.log("no JSON report at " + path + "; nothing to summarise");
  } else {
    const found = flakyTests(JSON.parse(readFileSync(path, "utf8")));
    const markdown = summaryMarkdown(found);
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
  }
}
