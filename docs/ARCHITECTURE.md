# Pixel-Games 架構 v0.3｜可替換 Renderer、可驗證工具邊界

現階段是可實測的**獨立渲染技術場景 + 共用底座**，並非完成的遊戲引擎。Three.js 為已指定的優先技術，第一款遊戲玩法仍待獨立決策。

```text
                  index.html / styles.css （GitHub Pages 既有首頁）
                           │
                  src/platform/ （Game-agnostic）
                  clock / scene-controller / viewport / registry
                           │
      ┌────────────────────┼─────────────────────────┐
      ▼                    ▼                         ▼
 src/rendering/       src/platform/assets       src/integrations/
 renderer-port.js     asset-manifest            tool-registry
 quality.js                 │                         │
 pixel-texture.js    check-assets.mjs           Dev/CI/Agent adapters
 resource-scope.js         │                    （未自動啟用工具）
 frame-metrics.js      sprites / glTF
      │
      ▼
 lab/main.ts ── Three.js r187 WebGLRenderer + 原創無玩法測試場景
      │
      └── Vite 8 build → dist/index.html + dist/lab/index.html
               │
               └── GitHub Pages 正式部署仍須 Owner 決策
```

## Renderer Port 核心契約

`createRendererPort({renderer,canvas,scene,camera,quality,onStatus,resizeCamera,restoreResources})`：

- `initialize(): Promise<void>`：明確等待非同步後端初始化（可用於未來 WebGPURenderer）；不能在初始化前宣稱 render ready。
- `draw(): Promise<boolean>`：統一呼叫後端 `renderAsync` 或 `render`，在 lost/restoring 時拒絕繪製。
- `resize(width,height,dpr)`：設定實際 Drawing Buffer，呼叫端透過 `resizeCamera` 修改 camera aspect（不是偷用像素 buffer aspect）。
- `setQuality(q)` / `setRenderScale(scale)`：畫質預設及動態縮放；`quality.js` 中 controller 只給建議，由 Host 決定是否採用。
- `stats()`：回傳 draw calls、triangle 及部分 renderer.info 的 GPU 資源統計；不是完整 VRAM 或 GPU duration。
- `dispose()` 與 context-loss 事件：狀態 `new/initializing/ready/lost/restoring/failed/disposed`，由 `restoreResources` 明確告知自定義資產是否恢復。
- `three-host.js` 保留為既有 WebGL 相容轉接器；**新開發不應繼續向它加入通用功能**。WebGPURenderer/TSL 應另做 Backend Adapter，不能假設 ShaderMaterial 與 EffectComposer 可原封不動移植。

這是 JavaScript runtime 契約、單元測試與獨立 E2E；不是已建立 GPU 安全沙盒。

## 資產與場景

- `createSceneController()` 對新場景先執行同步 `enter()`，成功後才退出舊場景；若新場景初始化失敗則呼叫新場景 `exit()` 並保留舊場景。非同步讀取應先 preload 完成，再 commit。
- 若舊場景 `exit()` 途中部分釋放後再拋錯，系統無法復原外部副作用，仍需場景自身提供可回復釋放策略與實際瀏覽器測試。
- `assets/manifest.json` 登錄所有資產路徑與 SHA256，`check-assets.mjs` 驗證未註冊檔、symlink escape、glTF 引用的 `.bin`/紋理與相對路徑；不代表自動證明版權。
- 3D Mesh 跟碰撞、尋路是不同邏輯；實際遊戲的碰撞/場景串流/存檔，必須在玩法核准後另設計。
- 像素 CanvasTexture/角色可用 nearest；風格化 PBR 3D 材質要依距離用合理的 Mipmap/Anisotropy，不能一律最近鄰。

## 工具接入

`src/integrations/tool-registry.js` 現在具有 capability 的顯式 allowlist、adapter id/version、handler 的 input/output 檢查、timeout、AbortSignal、unregister 取消。它是**應用程式層的呼叫路由**，不是檔案／網路權限機制。外部工具需由可信宿主隔離、加入對應 adapter；禁止把 MCP Token 注入前端。詳見 [TOOL-INTEGRATIONS](TOOL-INTEGRATIONS.md)。

## 可驗證的執行／部署

- `npm ci && npm run validate`：syntax、assets、Node unit、TypeScript、Vite build。
- `npm run test:e2e`：在由 Vite preview 服務的 `/Pixel-Games/` 下執行桌面與手機 viewport Chromium 測試；模擬手機不代表行動 GPU 實測。
- 現在 Pages Source 不做變更：`main/(root)` 只服務未編譯資源；`dist/` 預覽不等於已上線。
- 長期引入真正物理、遊戲活動系統、存檔或大世界串流以前，先用小型垂直切片量測必要性，避免過度設計。

參考 [官方研究](research/THREEJS-ENGINEERING-2026-11-04.md)、[品質驗收](QUALITY-GATES.md)、[修復報告](reviews/ARCHITECTURE-REPAIR-2026-11-04.md)。
