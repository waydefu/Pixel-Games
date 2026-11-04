# Pixel-Games 工具狀態（2026-11-04）

狀態分類：**已加入 repo** ≠ **已在 GitHub CI 執行** ≠ **已通過實機測試**。不裝無關工具，也不把 Research- 文件當可執行的 MCP。

## 現在可用（Node 標準庫，無外部 npm 依賴）

| 工具 | 指令／位置 | 真正驗證什麼 |
| --- | --- | --- |
| JS Syntax／專案入口 | `npm run check` | 必要檔案、語法、首頁相對資源、作品目錄契約 |
| Asset manifest | `npm run assets` | 登錄素材的路徑、SHA256 與必填來源 metadata（目前是空資料） |
| 單元測試 | `npm test` | core、渲染模組 mock 契約、品質預算、資源清理及素材 schema |
| 一次驗證 | `npm run validate` | 連續執行 check + assets + tests |
| 渲染尺寸試算 | `npm run graphics:matrix` | 桌機／手機幾種 CSS + DPR 下的理論 drawing-buffer 限制；**不是 FPS 測試** |
| Tool adapter registry | `src/integrations/tool-registry.js` | 不依賴品牌的 capability API，預設拒絕調用，搭配單元測試；**無真實外部工具已連接** |
| PR CI | `.github/workflows/ci.yml` | Node 24 + read-only token，執行 validate；需核對當次 Checks |
| 專案 Skills | `.agents/skills/` | Agent 按需閱讀指引，**不是自動安裝的軟體** |
| 原生本機預覽 | `python3 -m http.server 8000` | 預覽 GitHub Pages 相容的根目錄靜態入口 |

本次 `src/rendering/three-host.js` 使用注入式契約，**沒有宣稱已啟動 Three.js WebGLRenderer**。真正執行需先有通過審核的 npm 版 `three` 與 bundler/import map，並寫入版本 lockfile。

## 導入 Three.js 的推薦順序（下一個技術實驗，未啟用）

1. 確認 npm `three`、Vite 的當前版本及安全公告 → 寫入 `package.json` 和 lockfile → `npm ci`。
2. 建立獨立、**中立**的渲染實驗，使用幾何、像素紋理、1 盞光和基本相機；先測 WebGL2，不必先做 Bloom / DoF。
3. `npm run build` 生成靜態 `dist`，核對 `/Pixel-Games/` 的 asset base，切換 Pages 部署方式須 Owner 明確批准。
4. Playwright 用來驗證瀏覽器 canvas 建立、console errors、resize、context loss 和 snapshot；手機真機驗收不能被 viewport 模擬取代。
5. 量測 renderer.info、frame-time；依證據再增加後製、Sprites、Instancing／GLTF／KTX2 等。

工具接入與宿主授權邊界詳見 [Tool Integrations](TOOL-INTEGRATIONS.md)。

參考 [Three.js installation](https://threejs.org/manual/pages/installation.html)、[Vite Pages deploy](https://vite.dev/guide/static-deploy)。

## 分階段候選（尚未安裝）

- 渲染：`three`、Vite，之後可考慮 TypeScript 型別、PixiJS（純 2D fallback）。
- Browser QA：Playwright（固定版本、browser binaries）、真機 Android Chrome／iOS Safari。
- 素材：Aseprite／LibreSprite、Tiled（按遊戲需求再決定 tile 地圖是否必要）、glTF-Transform、KTX2、素材授權掃描。
- 原始碼：ripgrep、git grep；未來有足夠 JS/TS 規模再評估 TypeScript LSP／Serena Read-only。
- CI：Dependabot／zizmor／靜態依賴掃描，確認上下游版號、安全策略與執行額度後採用。
- **暫不引入**：大型 RAG／向量庫、多 Agent 自動改碼／全域 MCP、Nanite 風格 GPU 虛擬幾何、為了看起來高級而堆疊特效。

## 使用／故障排除

- `node >=20`，這份 repo 目前無外部依賴，`npm run validate` 無需 `npm install`。
- `npm run assets` 只驗證登錄的素材，並**不保證授權合法**；未登錄的檔案還需人工審查。
- 若 WebGLRenderer 建立失敗：由遊戲入口捕捉錯誤，保留 DOM fallback；`context-restored` 事件不等於自訂 GPU material 已自動完整恢復。
- GitHub Pages 繼續使用 **Deploy from a branch → main → /(root)**；本 PR 不修改 Pages 設定、不引入 CDN、不自動部署。
- 渲染進階來源與依據：[Three.js 研究備忘](research/THREEJS-ENGINEERING-2026-11-04.md)。
