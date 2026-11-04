# ADR-0003｜單頁沉浸式遊戲入口與 3/4 Quarter View

- 日期：2026-11-04
- 狀態：PR 待審核（使用者已明確指示入口不用首頁、開啟即遊戲、視角接近《棕色塵埃 2》）

## 決策

1. `/Pixel-Games/` 唯一可公開進入的遊戲頁是 `index.html`，Vite 只建置該入口。移除原有作品清單、獨立 `/lab/` HTML 頁，工程測試改為直接驗證根路徑。
2. Canvas 以 `100dvh`、`100vw` 填滿瀏覽器視窗，畫質／幀時間設置用 HUD overlay。OpenGL/WebGL 保持與 DOM 層分離，不把選單塞到 3D 空間。
3. 使用 **Three.js OrthographicCamera**、斜角約 45° 的 Quarter View，跟隨角色且保持固定方位，避免使用者每次轉鏡頭迷失方向。角度屬原創可調設計，**不是宣稱原作攝影機的精確數值**。
4. 原創中世紀海岸探索切片提供鍵盤／搖桿、世界邊界、房屋障礙及碼頭可通行區，不能再生成「箱子卡死角色」的障礙物布局。
5. 不複製《棕色塵埃 2》角色、地圖、音樂、UI 版權素材；參考的是視角和視覺層級。
6. 不在這個 PR 發展釣魚、NPC、經濟或其他未確認細節。後續玩法可插入 `src/game/`，工具接口維持 `src/integrations/`。

## 平台限制

手機 Chrome 不是原生 APP，瀏覽器頂部工具列無法在 load 時自動隱藏。可以立即滿版覆蓋**網頁可用 viewport**；使用者按「進入全螢幕」後才嘗試 Fullscreen API。部分 iOS Safari 與 App 內建瀏覽器可能不支持該 API，須顯示原因，不可空白。

## 驗證

- Vite 單入口、GitHub Pages `/Pixel-Games/` base、Chromium desktop/mobile viewport 的滿版 Canvas。
- 3D 啟動成功時檢查實際 drawn frames、drawCalls、3/4 camera 類型，鍵盤位移與碰撞。
- HUD 開關、畫質切換、失去 WebGL2 的 fallback；手機搖桿尺寸與 safe-area。
- Android/iOS 實機 10 分鐘性能、觸控與熱測為後續獨立驗收。
