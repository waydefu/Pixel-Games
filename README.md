# Pixel-Games｜Three.js 優先的原創遊戲平台

一個可以長期擴充的瀏覽器像素／風格化 3D 遊戲開發環境。**目前沒有已批准的遊戲玩法；沒有匯入先前的地城遊戲。**

## 目前有什麼

- **可直接開啟的首頁**：根目錄 `index.html`；沿用 GitHub Pages 既有的 `main/(root)` 設定。
- **獨立 3D 渲染實驗室**：`lab/`，使用 Three.js r187、WebGL2、色彩管理、陰影和原創程式產生的像素貼圖。**不是可玩的遊戲。**
- **可替換 Renderer Port**：`src/rendering/renderer-port.js`，支援同步／非同步渲染後端初始化、viewport resize、context loss 及 GPU resource 回收。
- **核心／工具／資產**：固定時間步、可回復的場景切換、畫質分級與自適應解析度、可驗證的工具 adapter、gltf 與外部素材引用驗證。
- **測試**：Node 單元測試、TypeScript 7 嚴格型別檢查、Vite 8 multi-page build、Playwright Chromium 桌機與手機 viewport E2E。
- 依賴精確鎖定至 `package-lock.json`，CI 使用 `npm ci`。

## 執行（Node.js 26 LTS 推薦）

```sh
npm ci
npm run validate              # 語法／素材 SHA256／單元／TypeScript／Vite build
npm run dev                   # 在 /Pixel-Games/lab/ 預覽 Three.js 實驗場
npm run test:e2e              # 須先安裝 Playwright Chromium
npm run graphics:matrix       # 僅渲染 Buffer 規劃，不是 FPS 測試
```

安裝測試瀏覽器：`npx playwright install chromium`；在 CI 使用 `npx playwright install --with-deps chromium`。

- 開發入口通常是 `http://127.0.0.1:5173/Pixel-Games/lab/`。
- `npm run build` 產生 `dist/`，`npm run preview` 預覽 `/Pixel-Games/` 路徑。
- **Pages 發布工作流程已在 PR #5 補上**，位於 `.github/workflows/deploy-pages.yml`，合併後在 `main` 更新時通過驗證才會上傳 `dist/`。**GitHub Settings → Pages 的 Source 仍須由 Owner 選 GitHub Actions**；在 PR 合併、設定完成及部署成功之前，不能宣稱 `/lab/` 已公開。

## 下一階段

先完成此 PR 的工程驗收與 Chrome 渲染檢查，再決定是否發布 3D 技術展示，最後才根據獨立的遊戲企劃核准、開始實作玩法與世界內容。手機熱降頻、真正的 GPU frame time、iOS Safari 都需要另外做實機測試。

文件入口：[架構](docs/ARCHITECTURE.md) · [工具接入](docs/TOOL-INTEGRATIONS.md) · [品質門檻](docs/QUALITY-GATES.md) · [Pages 部署步驟](docs/governance/PAGES-DEPLOYMENT.md) · [審查修復報告](docs/reviews/ARCHITECTURE-REPAIR-2026-11-04.md) · [研究來源](docs/research/THREEJS-ENGINEERING-2026-11-04.md)。

相關研究： [Research-](https://github.com/waydefu/Research-)。

> 任何外部 MCP／Serena／素材編輯器都沒有自動安裝或取得權限。正式程式、部署與 PR 合併仍由 Owner 審查。
