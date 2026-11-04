# Pixel-Games｜原創 2.5D 海岸探索

一個以 **Three.js** 建構的原創像素與立體光影探索專案。入口直接顯示**全視窗的遊戲畫面**；沒有作品列表、Landing Page 或獨立實驗室。此階段是可移動的探索垂直切片，還不是包含職業、釣魚、完整 NPC 或存檔的成品。

## 玩與測

**公開入口（PR 合併且 Pages 成功部署後）：** https://waydefu.github.io/Pixel-Games/

- 桌機：WASD 或方向鍵移動，Shift 加速。
- 手機：左下角虛擬搖桿。
- 右上角選單：基本／平衡／高畫質、全螢幕、統計。
- 主要鏡頭：**3/4 Quarter View**、固定方位、Orthographic、平滑跟隨角色；參考《棕色塵埃 2》探索視角的構圖，但使用自製幾何與程式生成角色，**未複製任何原作素材／程式**。
- 地景：中世紀海岸房屋、道路、碼頭、海面與光影。可以自由走動，沒有任務。
- 網頁打開就是滿版遊戲畫布；瀏覽器位址列需要使用者按下「進入全螢幕」（或加入主畫面）才能隱藏，Web Fullscreen API 無法在載入時無互動強制啟動。

## 工程

- `src/game/main.ts`：遊戲啟動、動畫影格、場景相機、畫質與 UI。
- `src/game/world.ts`：原創海岸場景與像素角色。
- `src/game/input.ts`：鍵盤／觸控搖桿。
- `src/game/navigation.js`：不依賴 Three.js 的位移、碰撞和海域邊界規則。
- `src/rendering/`：Three.js 可替換 Renderer Port、資源追蹤、畫質與幀時間。
- `src/integrations/`：外部工具可接入 Registry（目前不自動安裝 MCP／工具）。
- 建置：Vite 8、TypeScript 7、Three.js 0.187.0、Node 26 CI，版本鎖定在 `package-lock.json`。
- Pages：`.github/workflows/deploy-pages.yml` 使用 `dist/` 發布，保持 `base: '/Pixel-Games/'`。

```sh
npm ci
npm run validate      # Syntax + asset + Node test + TS + Vite + bundle
npm run dev           # 本機遊戲入口
npm run test:e2e      # Playwright Chromium desktop + mobile viewport
```

沒有 WebGL2 會顯示中文 fallback；未真機測試的 POCO Android Chrome、iOS Safari、溫度、電力及 GPU time 仍標 **NOT RUN**。

文件：[架構](docs/ARCHITECTURE.md) · [入口決策](docs/decisions/ADR-0003-direct-game-root.md) · [品質門檻](docs/QUALITY-GATES.md) · [工具接入](docs/TOOL-INTEGRATIONS.md) · [研究庫](https://github.com/waydefu/Research-)。

新增職業、釣魚、NPC、可換角色或更大世界時，以獨立功能模組和 PR 擴充；不要又長出一個沒有意義的作品收藏首頁。
