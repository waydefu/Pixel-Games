import test from "node:test";
import assert from "node:assert/strict";
import { flakyTests, summaryMarkdown } from "../scripts/flaky-summary.mjs";

const report = {
  suites: [{
    title: "action-keys.spec.mjs", specs: [
      { title: "physical C and F work", tests: [{ projectName: "desktop-chromium", status: "expected", results: [{}] }] },
      { title: "phone portrait dock", tests: [{ projectName: "mobile-chromium", status: "flaky", results: [{}, {}] }] },
    ],
    suites: [{ title: "nested", specs: [{ title: "slow shot", tests: [{ projectName: "desktop-chromium", status: "flaky", results: [{}, {}, {}] }] }] }],
  }],
};

test("only tests whose final outcome is flaky are listed, with their retry count", () => {
  const found = flakyTests(report);
  assert.deepEqual(found.map(f => [f.project, f.title, f.retries]), [
    ["mobile-chromium", "action-keys.spec.mjs › phone portrait dock", 1],
    ["desktop-chromium", "action-keys.spec.mjs › nested › slow shot", 2],
  ]);
});

test("an empty or failing-free run yields a clear summary and never throws", () => {
  assert.deepEqual(flakyTests({}), []);
  assert.match(summaryMarkdown([]), /無。/);
  assert.match(summaryMarkdown([{ project: "p", title: "t", retries: 1 }]), /不會讓 CI 失敗/);
});
