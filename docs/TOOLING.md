# 工具盤點：已導入／未導入

核對時間：2026-11-04。真正的「已導入」是指 `package.json`、lockfile 及具體程式已存在；是否已測試通過需看 PR 的實際 GitHub Actions Checks。

| 工具 | 版本／狀態 | 實際用途 |
| --- | --- | --- |
| Three.js | `three@0.187.0`（引入） | 獨立實驗場景 WebGL2、光照陰影與像素貼圖 |
| Vite | `vite@8.3.5`（引入） | Multi-page 開發／建置到 `dist/`；使用 `/Pixel-Games/` base |
| TypeScript | `7.0.2`（引入） | `lab/**/*.ts` strict typecheck，既有 JS 維持無破壞遷移 |
| @types/three | `0.187.0`（引入） | Three.js 型別 |
| Playwright Test | `1.64.1`（引入） | Chromium desktop／mobile viewport E2E |
| Node.js | 26 LTS（CI），`package.json` 最低 24 | CLI／test／build |
| Node 內建 Test | `npm test` | Core／Renderer Port／工具／素材與生命週期 |
| Repo integrity | `npm run check` | JS 語法、必要檔案及入口 |
| Asset validator | `npm run assets` | 已登錄 hash、glTF 外部引用／路徑、未登錄檔 |
| Vite compile | `npm run build` | 產生 `dist/index.html` 和 `dist/lab/index.html` |
| Typecheck | `npm run typecheck` | TypeScript strict |
| Playwright | `npm run test:e2e` | 真 Chromium；**不等於真手機** |

```sh
npm ci
npm run validate
npx playwright install chromium
npm run test:e2e
```

**候選但未接入：** WebGPU+TSL 第二套渲染 adapter、Serena MCP、Tiled、Aseprite／LibreSprite、glTF-Transform、KTX2 壓縮 CLI、ECS、物理引擎、遊戲存檔。不要把研究資料當成安裝／授權紀錄。

## GitHub Pages 部署

本 PR 已新增 `.github/workflows/deploy-pages.yml`：只在 `main` push 或手動 dispatch 執行，先 `npm ci` + `npm run validate` + Playwright，再上傳 `dist/` artifact；獨立 deploy job 以 Pages 專用最小權限發布。**目前只是待合併 PR 的工作流程，沒有宣稱已完成部署。**

正式運行前由 Owner 在 Settings → Pages 選 Source = GitHub Actions，並確認工作流程執行及公開 URL。詳見 [Pages Deployment](governance/PAGES-DEPLOYMENT.md)。原生首頁的舊 main/(root) 設定不會因提交 YAML 自動被修改。
