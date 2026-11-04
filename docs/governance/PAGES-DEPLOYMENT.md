# GitHub Pages 發布工作流程

## 最初設定（需 Repo Owner 操作）

1. 確認 [PR #5](https://github.com/waydefu/Pixel-Games/pull/5) 經審查並合併到 `main`。
2. 到 [Settings → Pages](https://github.com/waydefu/Pixel-Games/settings/pages) → Build and deployment → Source，選擇 **GitHub Actions**。
3. GitHub Actions 中確認 `Deploy to GitHub Pages` 的執行結果。若環境權限或 Pages Source 尚未設定，部署可能失敗；先讀錯誤再處理。
4. 如需重新執行，可在 [Actions](https://github.com/waydefu/Pixel-Games/actions) 選 `Deploy to GitHub Pages` → **Run workflow** → main，不要誤以為 workflow_dispatch 會繞過驗證。

## 自動流程

```text
push main / 手動 workflow_dispatch
  → 安裝 Node 26 + npm ci
  → npm run validate（語法、素材、單元、TS、Vite、體積）
  → Playwright Chromium E2E
  → upload-pages-artifact(dist)
  → deploy-pages → github-pages
```

Build job 只有 `contents: read` 權限；部署 job 另有 `pages: write`、`id-token: write`。Actions 固定完整 SHA，部署和驗證使用同一 commit 的 `dist/`，不從 main/(root) 直接複製未編譯的 TypeScript。

- 首頁：<https://waydefu.github.io/Pixel-Games/>
- Three.js 技術實驗室：<https://waydefu.github.io/Pixel-Games/lab/>
- Vite 設定：`base: "/Pixel-Games/"`，符合 GitHub Project Pages 子目錄。

## 狀態與限制

- 本文件與 Workflow 的存在不代表已正式部署成功。需看到 `Deploy to GitHub Pages` 的實際部署成功和網站 URL 回傳。
- GitHub Pages `Source` 屬 Repository Settings；**本 PR 不會修改設定，也不自動合併**。
- Playwright 在 GitHub Runner 上運行桌面／行動 viewport Chromium，不代表 POCO Android/iOS Safari 真機性能或散熱驗收。
- 如果驗證失敗，後續 deploy job 不會執行；已有的 Pages 版本應保留。部署失敗請記錄 run URL 與 job error，勿跳過檢查強行發布。
