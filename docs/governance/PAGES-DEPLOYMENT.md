# GitHub Pages｜部署與回退

> 2026-11-08 依 `.github/workflows/deploy-pages.yml` 與 `verify.yml` 核對；是否已上線只能看 [Pages Actions](https://github.com/waydefu/Pixel-Games/actions/workflows/deploy-pages.yml)。

最新流程：`main` 更新 → 一次 `npm ci` + `npm run validate`（含治理檢查）→ 保存 `dist` → 5 個桌面／手機 Chromium E2E 分片 → 全部通過才部署 Pages。

唯一正式網址：https://waydefu.github.io/Pixel-Games/ 。PR 合併或 CI 綠不等於網站已更新；需確認部署 run 的 head SHA、實際網址與瀏覽器快取。

回退一律用獨立 revert PR 通過必要 CI，合併後才重新發布。Pages Source／Secrets／Ruleset 的修改需要 Owner 當次授權。Playwright mobile viewport 不是 Android 或 iOS 真機測試。
