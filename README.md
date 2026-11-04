# Pixel-Games｜原創像素遊戲實驗室

一個**Three.js 優先、手機兼容、具 GPU 資源治理**的瀏覽器像素遊戲開發專案。目前只有工程基礎與作品入口，**沒有選定任何遊戲，沒有導入先前的「地城迴路」**。

## 工程現況

- 首頁 `index.html`、`styles.css`、`src/app.js` 保留原生 HTML/ESM，可沿用 GitHub Pages 的 `main/(root)`。
- `src/platform/`：固定時間步、場景生命週期、2D 像素座標、空作品清單、素材 manifest。
- `src/rendering/`：Three.js **注入式 WebGLRenderer host**、品質尺寸限制、像素貼圖策略、GPU 資源追蹤、CPU frame interval 記錄。
- `src/integrations/`：通用工具能力路由，顯式接入 adapter；**不自動載入、安裝或授權外部工具**。
- `assets/manifest.json`：目前為空。未經授權不搬入任何第三方資產。
- **尚未**安裝 `three` 或 Vite，也沒有可玩的遊戲或已實際執行的 Three.js 畫面；這份 PR 是工具與架構基線。

## 使用（Node 20+，無外部 npm 依賴）

```sh
npm run validate       # 語法 + 素材完整性 + 單元測試
npm run graphics:matrix # 解析度 / DPR 理論規格試算（不是 FPS）
python3 -m http.server 8000
```

打開 `http://localhost:8000` 預覽**靜態首頁**。JS modules 不應以 `file://` 當成正式預覽方式。

## 接下來要先決定

1. 將未來的 Three.js PoC 以單獨 PR 實作：固定版本與 lockfile、Vite、無玩法的原創場景，先做 WebGL2 實測。
2. 因 Vite build 輸出 `dist`，若要公開 Pages 需另審核部署流程（不自行切換 main/(root)）。
3. 由 Owner 選第一款**新遊戲**的玩法、鏡頭與美術後，才開始遊戲垂直切片。

檔案導航：[docs/INDEX.md](docs/INDEX.md)｜[Three.js 研究](docs/research/THREEJS-ENGINEERING-2026-11-04.md)｜[架構](docs/ARCHITECTURE.md)｜[工具與命令](docs/TOOLING.md)｜[工具接入標準](docs/TOOL-INTEGRATIONS.md)。上游研究：[waydefu/Research-](https://github.com/waydefu/Research-)。

> 本 Repo 的 Skill 是按需文字說明，不會自動安裝外部 MCP、修改宿主設定或繞過 GitHub PR 審查。
