# Pixel-Games｜像素遊戲實驗室

一個以 **原創、可擴充、手機優先** 為方向的瀏覽器像素遊戲專案。目前只建立共用工程基線，**沒有選定任何遊戲，也未移入「地城迴路」**。

## 目前可使用
- 公開入口：根目錄 `index.html`，原生 HTML/CSS/ES Modules，可用 GitHub Pages 的 **main / (root)**，不需要建置或外部 CDN。
- 共用底層：固定時間步、像素縮放／座標轉換、場景生命週期、遊戲登錄契約；**不是完成的遊戲引擎**。
- 工程驗證：Node.js 20+、無 npm 依賴；`npm run check`、`npm test`、`npm run validate`。
- 治理文件：`AGENTS.md`、`docs/INDEX.md`、`.agents/skills/`、PR 模板與唯讀 CI。

## 開始開發
```sh
npm run validate
python3 -m http.server 8000
```
瀏覽 `http://localhost:8000`。ES Modules 不應直接以 `file://` 開啟，請透過靜態伺服器或 Pages 測試。

## 下一步（需由 Owner 決策）
1. 選第一款原創遊戲的類型、操作模式、核心循環。
2. **Three.js 為優先渲染技術方向**：先驗證 WebGL2 的 3D 場景＋像素 Sprite／Billboard、光影、手機性能與降級；Canvas 2D／PixiJS／Phaser 為替代方案。選為優先不等於已安裝或已完成渲染器。
3. 選定最小遊戲垂直切片後才加入遊戲資產、玩法程式與 E2E。

先讀 [文件索引](docs/INDEX.md)、[架構邊界](docs/ARCHITECTURE.md)、[研究採用地圖](docs/RESEARCH-ADOPTION.md)。研究來源：[waydefu/Research-](https://github.com/waydefu/Research-)。

> 本儲存庫沒有設定全域 Agent、MCP 或自動發佈權限；CI 檔案存在不等於 GitHub Rulesets 已啟用。對外內容與授權須另外審核。
