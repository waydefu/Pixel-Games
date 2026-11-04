# Pixel-Games 基礎架構 v0

狀態：**已提交的是工程骨架，不是可玩遊戲引擎**。2026-11-04 以 [Research-](https://github.com/waydefu/Research-) 的架構、渲染、效能與 Agent 治理研究為設計參考。

## 層級與資料流

```text
index.html + styles.css         → 可被 Pages 直接服務的作品入口
        │
src/app.js                      → DOM 展示，不混進遊戲狀態
        │
src/platform/registry.js        → 作品目錄：id/title/summary/local entry
        │
games/<slug>/（未建立）         → 每款獨立遊戲的程式、內容、素材
        │
src/platform/clock.js           → 固定更新步長（不擁有 RAF）
src/platform/viewport.js        → 邏輯像素／顯示座標轉換
src/platform/scene-controller.js→ 場景生命週期
        │
renderer/input/audio/assets     → 候選介面，尚未實作
```

**為什麼這樣拆？** 先讓多款遊戲的清單、生命週期和測試互不牽連；第一款遊戲選型之前，不臆造地圖、碰撞、戰鬥或 3D 引擎。

## 已實作契約

- `createFixedStepClock({hz,maxFrameMs,maxSteps})`：由呼叫端傳 `now/update/render`，首幀只渲染；背景切回需主動 `reset()`；尖峰更新有步數上限。它不包含 RAF、音效、碰撞或網路同步。
- `fitPixelViewport(containerW,containerH,logicalW,logicalH)`：能放大時使用整數倍率；小螢幕使用分數倍率避免裁切。搭配 `screenToLogical()` 忽略黑邊互動。
- `createSceneController()`：`enter/update/render/exit`；場景切換呼叫 exit 再 enter。沒有場景堆疊或異步資產協調。
- `listGames()`：預設空清單；遊戲必須有安全本地 `./games/<slug>/index.html` 路徑和摘要；新增前應先通過規格與授權審查。
- 首頁以語義 HTML 為基礎，**不依賴 JavaScript 才能知道專案尚未推出遊戲**；名錄內容透過 DOM `textContent` 寫入而非 `innerHTML`。

## 待決設計（不得擅自填空）

1. **遊戲類型**：動作、解謎、平台、回合、模擬等；先有一頁式設計與垂直切片範圍。
2. **渲染（方向已定）**：Three.js 為首選 PoC：使用 3D Scene／Camera／WebGLRenderer，結合像素 Sprite／Billboard、3D 光照與陰影；後處理按畫質分級開啟。正式整合須通過實機測試。Canvas2D／PixiJS／Phaser 保留為功能或降級替代，但不要求重現等價的 3D 光影。詳見 [ADR-0002](decisions/ADR-0002-threejs-priority.md)。
3. **輸入**：不同玩法需求決定虛擬按鍵、手把、雙搖桿或點擊，不先綁死。
4. **世界／物理**：地圖、碰撞、攝影機、存檔只在需求成立後加入。
5. **素材規則**：像素規格、色盤、音效、美術來源在首款遊戲設計與授權核實後決定。

## 跨裝置的品質原則

- 更新固定時間步、渲染插值，畫面 FPS 與模擬速度分開。
- DPR／渲染比例要設上限與降級策略；不要將 CSS 畫布尺寸當實際 render target。
- 優先保持像素邊緣清晰、視覺物件與碰撞位置一致；無法通行處不得形成隱形死角。
- 手機橫／直向、安全區、觸控、背景切換與 `prefers-reduced-motion` 必須在遊戲驗收時測。
- DOM 承載說明、設置、無障礙替代方案；Canvas/WebGL 不是全部 UI 的容器。
- 未有裝置／trace／時長／數據時，不得聲稱 60 FPS 或低耗電。
