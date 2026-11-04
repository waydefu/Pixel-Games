# Pixel-Games 架構 v0.4｜單一玩家入口

**玩家端**只需要一頁：GitHub Pages `/Pixel-Games/` → `index.html` → 滿版 Three.js 場景。整個畫面由原創 Quarter View 海岸探索切片承載，畫質與控制設置顯示成可關閉的 Overlay。沒有 Landing Page、作品列表或獨立 /lab/ 預覽頁。

```text
                         index.html (Game viewport 100dvh)
                                    │
                src/game/main.ts (bootstrap / HUD / camera / RAF)
                      ┌─────────────┼───────────────┐
                      ▼             ▼               ▼
             world.ts (scene) input.ts      navigation.js
              original geometry    │       collision / walkable
              sprite / lighting    │
                      ▼            ▼
            src/rendering/renderer-port.js
            quality / frame-metrics / resources
                      │
                Three.js WebGL2
                      │
        Vite8 + TypeScript7 build → dist/index.html
                      │
                GitHub Pages Actions

          src/platform/ / src/integrations/
          可接的核心／工具契約（不暴露 MCP 權限）
```

## 視角、世界和輸入

- OrthographicCamera 使用相對角色的 3D 固定偏移 `(14,19,15)`，從斜上方看建築與路面，與常見正上方鳥瞰不同。固定透視避免鏡頭旋轉造成方向不一致。
- Camera smooth follow 角色，邏輯座標使用 `x,z`。鏡頭方向和按鍵移動向量一致：W/↑ 為畫面向上，D/→ 為畫面向右；左右/斜向正規化速度。
- 移動／碰撞使用可單測的純函數，角色半徑及可走區單獨定義，**視覺 Mesh 不能直接等於碰撞資料**；未來大場景需換空間分區而不是硬塞更多碰撞。
- 自製幾何與程式生成 CanvasTexture 小角色以 NearestFilter 呈現像素感；PBR 3D 場景材質保持可渲染光影。海面採原創著色器；不能說是《棕色塵埃 2》的地圖或角色。
- 畫質依 `quality.js` 的 pixel budget 與保守 adaptive resolution；Renderer Port 支援未來不同 GPU 後端，但**尚未實作 WebGPU TSL**。

## 工程保留

`src/platform/`（時鐘、場景控制、作品登錄契約等）與 `src/integrations/`（可插拔工具能力路由）保留在 Repo，不會因為取消首頁就刪除，以便未來加入地圖工具、素材流程或其他可玩模式。舊的 `src/app.js` 作品清單 UI 與 `lab/index.html` 已移除，不再做 Vite Multi-Page Build。

## 部署與驗證

`npm ci && npm run validate && npm run test:e2e`；由 read-only GitHub Actions 完成 CI，再由受限制 Pages Deploy workflow 發布單頁 `dist/`。不能把本地 Chromium mobile viewport 成功當作 POCO 真機 GPU 成功。

先讀 [ADR-0003](decisions/ADR-0003-direct-game-root.md)、[品質驗收](QUALITY-GATES.md)、[工具接入](TOOL-INTEGRATIONS.md)。
