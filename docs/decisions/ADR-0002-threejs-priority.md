> **歷史架構決策，保留原始內容**：以下「提案／待審核」及過去方案狀態是 2026-11-04 當時的紀錄，不代表現在仍未決定。當前遊戲入口與技術以 [README](../../README.md) 及 [ARCHITECTURE](../ARCHITECTURE.md) 為準。

# ADR-0002｜Three.js 為 Pixel-Games 優先渲染方向

日期：2026-11-04。狀態：**Owner 已明確指定技術優先順序；實作／引擎套件安裝／第一款遊戲玩法未經本 ADR 授權**。

## 已決定
- 在新像素遊戲的**3D／HD-2D 視覺驗證**中優先採 Three.js，目標是 3D 場景深度、像素材質與角色、真實光源與陰影，重視視覺一致性。
- Three.js 為預設評估基線，不等於已確認所有遊戲都必須使用它；如果具體遊戲只需高效率純 2D，可提出證據再調整選型。
- 目前 P0 保持原生 ESM 基線，不追加 npm package／Luminati 原始碼／第三方素材；第一款遊戲仍待決定。

## 參考架構（規劃中，未實作）

```text
Game-specific content (尚未決定)
       ↓
Shared core: clock / scene lifecycle / viewport
       ↓
Renderer interface (未實作)
       ├── Three.js renderer (優先)
       │     ├── WebGLRenderer + Scene + Camera
       │     ├── 3D geometry + pixel-textured planes / billboard sprites
       │     ├── physically grounded lighting / shadows
       │     └── optional bloom, color grading, depth of field
       └── Canvas2D / basic presentation (能力有限的回退)
```

不強迫以 2D renderer 完整複製 3D 效果；要明確界定降級後的可玩性與畫面能力。

## PoC 驗收／技術風險
1. 使用**中立、原創**的場景示範，不導入「地城迴路」也不假設玩法；同一組可再現測試素材。
2. 瀏覽器支援與失敗模式：WebGL2 建立失敗、context lost、低 GPU 能力、資源載入失敗時仍有明確提示／簡化替代。
3. 像素風格：Sprite／Billboard 的邊緣清晰、相機角度與世界單位一致、動態陰影、光暈獨立開關、後處理不得模糊主要角色。
4. 效能：記錄 Desktop Chrome、Android Chrome（可取得時）、iOS Safari（可取得時）的裝置、視窗、DPR、渲染尺寸、p50/p95 frame time、記憶體、長時間熱降頻；**60 FPS 是目標不是既有成績**。
5. 靜態部署：GitHub Pages 可支援的相對資源路徑、固定依賴版本與授權；未經授權不得改變原本 main/(root) 發佈流程。
6. 後製及大型幾何方案（如 Nanites 類）不是預設必要依賴。先驗證基礎場景，再量化導入效果與成本。

## 主要研究證據
- [Research-：Luminati HD-2D](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/26-luminati-hd2d-browser-engine.md)
- [Research-：圖形兼容與降級](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/06-graphics-and-compatibility.md)
- [Research-：效能與可及性](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/07-performance-and-accessibility.md)
- [Three.js 官方文件](https://threejs.org/docs/)

## 不在本決策範圍
不實作遊戲、不複製外部資產、不自動安裝渲染器、不改 Pages 設定、不合併 PR、不假稱真機驗收。
