# 工具與環境｜實際存在 vs 候選

## 現在 Repo 具備（不需 npm install）

| 工具 | 位置／指令 | 現狀 |
| --- | --- | --- |
| Node.js 20+（使用者環境需具備） | `npm run validate` | package.json 已聲明；不代表每個終端已安裝 |
| JS Syntax + 檔案存在／HTML 參照檢查 | `npm run check` | 已實作 |
| 原生 Node 單元測試 | `npm test` | 已加入測試 |
| Github Actions（PR / main 檢查） | `.github/workflows/ci.yml` | 已提交定義；結果要看 Actions |
| 工作範圍／知識技能 | `AGENTS.md`、`.agents/skills/` | 已存文字；支援程度依 Agent 宿主 |
| 本地預覽 | `python3 -m http.server 8000` | 使用者自行執行，非部署 |

CI 只檢驗目前列入的程式，不檢查外部研究結論正確性，也不代表已跑手機 E2E。

## 候選（目前沒有安裝、沒有啟用）
- **ripgrep**：推薦 `rg --files`、`rg -n 'pattern' src docs` 進行逐段定位。
- **Serena**：程式 Symbol 查找；等有足夠 JS/TS 規模並驗證宿主／版本／唯讀權限再加 repo-scoped 設定。
- **Playwright**：真瀏覽器測試／手機 viewport／截圖／頁面互動；建立第一款遊戲時再固定版本並加 E2E。
- **Biome／ESLint、TypeScript、Vite**：依遊戲規模挑少數工具，導入時附 lockfile、版本、CI。
- **Three.js（優先方向）**：規劃 WebGL2 立體場景＋像素 Sprite／Billboard 的 HD-2D PoC；目前**尚未安裝、未實作、未驗證手機性能**。**PixiJS／Phaser／Canvas2D**：保留 2D 或降級候選，需做相同情境測試並衡量表現與功能差異。
- **Aseprite、LibreSprite、Tiled、TexturePacker**：素材製作／地圖工具候選；採用前檢查授權、匯出格式及可重現流程。
- **zizmor／Dependabot／License scanner**：CI 安全加固候選，確認 GitHub 設定與噪音成本後另提 PR。
- **MCP、向量資料庫、外部 Agent 框架**：暫不需要，不能視研究文字為安裝授權。

## Pages 發佈
維持原本選擇的 **Deploy from a branch → main → /(root)**。根目錄已提供 `index.html`，引用相對路徑而非以 `/` 開頭；未使用 bundler，也沒有擅自切換 Actions 部署。**本 PR 不更改 GitHub Settings**；是否已公開上線以 Pages 的實際狀態判定。

## 排查
1. `npm run validate` 出錯 → 查看第一個 FAIL 和對應檔案。
2. Pages 空白 → 先開檢視原始碼，確認 index.html、script 相對路徑和 Console；ESM 不能直接用 file 協定測。
3. CI 無法執行 → 檢查 Actions 是否啟用／權限／branch rules；不以 YAML 文件推定成功。
4. 效能很差 → 先量測真裝置的 frame time／記憶體／瀏覽器版本，才降畫質和決定用 WebGL。
