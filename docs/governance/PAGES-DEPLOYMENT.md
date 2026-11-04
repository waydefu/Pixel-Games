# GitHub Pages 部署與回退（2026-11-05）

目前單一玩家入口：<https://waydefu.github.io/Pixel-Games/>。**不再有 `/lab/` 第二頁。** GitHub Pages Source 已由 Owner 設為 GitHub Actions，`.github/workflows/deploy-pages.yml` 在 `main` 更新或手動 dispatch 時執行。

```text
main push / workflow_dispatch
  → npm ci → npm run validate → Playwright Chromium E2E
  → upload-pages-artifact (dist/) → deploy-pages
```

部署最小權限：build job `contents:read`；deploy job `pages:write` 和 `id-token:write`。Vite base 維持 `/Pixel-Games/`。

操作：在 [Actions](https://github.com/waydefu/Pixel-Games/actions) → Deploy to GitHub Pages 確認最近一次 run 的驗證和部署兩個 job 均 SUCCESS。使用者若仍看到舊內容，先確認最新 commit、頁面 URL 與快取，不要直接改 Settings。

回退：從 PR/Commit 建立 revert，走既有分支保護和 CI，合併後由 Actions 發布以前版本。不可把歷史研究文件直接當部署工作流程。更改 Pages Source 或 Ruleset 前需 Owner 批准。

**CI mobile viewport 不是 Android Chrome／iOS Safari 真機。**
