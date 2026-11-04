# Pixel-Games 技術架構 v0.2（Three.js 優先）

狀態：P0 共用工程底座已存在；本 PR 擴充**無外部依賴、可單元測試**的渲染契約。Three.js 是已批准的優先技術方向，但 **Three.js package 尚未加入、GPU 畫面尚未執行**。第一款遊戲尚未選定。

## 導航圖

```text
index.html / styles.css (GitHub Pages main/(root) 靜態入口)
    │
    ├── src/app.js                   作品清單與 DOM（無遊戲內容）
    ├── src/platform/
    │     registry.js               多遊戲本地路徑契約
    │     clock.js                  固定時間步（不自動建 RAF）
    │     scene-controller.js       enter / update / render / exit
    │     viewport.js               2D 邏輯像素與指標映射
    │     asset-manifest.js         素材來源、授權、路徑與 hash 規格
    │
    ├── src/integrations/
    │     tool-registry.js           顯式 capability/adapter 路由（default deny）
    │
    └── src/rendering/
          quality.js                限制渲染 buffer（與 UI CSS 分離）
          pixel-texture.js          nearest / color-space 策略
          resource-scope.js         WebGL 資源生命週期所有權
          frame-metrics.js          幀時間觀測（RAF 間距）
          three-host.js             WebGLRenderer 注入式宿主
                  ↑
          Three.js（選定版本、npm / bundler / lockfile 尚待後續 PoC）
                  ↑
          games/<slug>/（未建立：未指定玩法）
```

入口、遊戲玩法、渲染器、素材和 DOM HUD 的責任分開，避免像前期單檔 HTML 一樣把碰撞、地圖、光影與 UI 糾結在一起。

## 具體可用的 API（Node 測試覆蓋）

`calculateRenderSize({cssWidth,cssHeight,devicePixelRatio,quality})`
- 三級基本配置：basic / balanced / high，分別限制 **DPR** 與最大像素數。數字是起始策略，**不是量到的設備建議值**。
- 回傳實際 buffer 寬高，不能拿回傳值當 CSS 畫面尺寸。相機投影矩陣要由後續遊戲的 camera system 更新。
- 不使用 user-agent 判斷硬體，也不保證自動壓到 60 FPS。

`createThreeRendererHost({THREE,canvas,scene,camera,quality,onStatus})`
- 使用**由呼叫端提供**的 `THREE.WebGLRenderer`，不隱式使用 CDN；建立時若不支援 WebGL 會明確失敗。
- 方法：`resize(cssWidth,cssHeight,dpr)`、`render()`、`stats()`、`dispose()`；狀態 `ready/context-lost/disposed`。
- `canvas` 的 CSS 版面由宿主頁面處理，`resize` 僅設 WebGL buffer；`onStatus` 可讓 DOM 顯示錯誤／降級提醒。
- **不負責** Camera projection、renderer loop、postprocess、Sprite 的照明模式、資源上傳重建或 UI fallback。context restored 表示事件已觸發，**不等於所有自訂 GPU 資產已恢復**。
- `stats()` 使用 `renderer.info` 的 draw calls、triangles、geometries、textures：計數器不是 GPU 時間，也不是全部 VRAM 消耗。

`configurePixelTexture(THREE, texture, {kind})`
- 色彩貼圖（`kind:"color"`）使用 sRGB；法線／粗糙度／ID 等資料貼圖（`"data"`）使用 NoColorSpace。
- 像素圖預設 NearestFilter / 無 Mipmap；遠景縮小抖動、atlas 邊緣、alpha bleeding 需在實際場景單獨測，不能認為參數已解決全部。

`createResourceScope()`
- 跟蹤具 `dispose()` 方法的**所有者資源**；同一 scope 去重，反向釋放，重複 dispose 無副作用。
- 跨場景共享的 Texture/Material 應由共享資產管理器擁有，不能每個 scene 都追蹤一次。

`createFrameMetrics({capacity})`
- 在真正 RAF loop 由呼叫者提供 `frameMs`；回傳 p50/p95 與平均，樣本容量有限。
- **不把 requestAnimationFrame 的間距當 GPU 渲染耗時**。切到背景分頁時應停記錄並重置。

`validateAssetManifest({version:1,assets})`
- 目前 `assets/manifest.json` 為空；加入第一批素材前先規範相對路徑、hash、license、author、source。
- `npm run assets` 依 manifest 驗證實體檔案和 SHA256，不推導法律授權。

## 宿主整合範例（說明用，尚不能執行）

```js
// 下一階段核准 Three.js + 打包工具並安裝後才可啟用：
import * as THREE from 'three';
import { createThreeRendererHost } from './src/rendering/three-host.js';

const host = createThreeRendererHost({
  THREE, canvas, scene, camera,
  quality: 'balanced',
  onStatus: status => console.log(status),
});
host.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
host.render();
// 停用時 host.dispose()，並由擁有者釋放幾何／材質／貼圖。
```

**不要**將上方未完整定義的 `canvas/scene/camera` 片段當可立即執行的遊戲檔。

## 與早期 core 的關係

- `clock.js`、`scene-controller.js`、`viewport.js` 沒有改掉或重做。
- `viewport.js` 對應**2D 邏輯像素座標**；Three.js 的 world→screen 或 raycasting 必須另建 camera/input adapter，不能用 2D 座標函數假裝 3D 拾取。
- Gameplay / physics / collision 是未決的領域：渲染場景的 Mesh 不等於碰撞體，不能靠視覺模型自行判定箱子能否通行。
- Renderer 與 Game 可以獨立更換；多款遊戲不必強迫使用相同鏡頭或玩法。

## 後續工具的接入點

- `src/integrations/tool-registry.js` 為**可選的工具調用介面**，由可信 host 手動 register，採用 `id`＋`version`＋`capability`（例如 `assets.inspect`、`qa.capture`）而非綁定特定編輯器。
- Registry 預設拒絕調用，明確 `allowedCapabilities` 與 provider ID 才可路由。**這不是 OS 隔離、credential broker、MCP server 或真實權限管制**。
- 新增工具不應修改 game loop、Three.js renderer 或核心 gameplay；CLI/CI/MCP 要由有權限的開發宿主封裝，不能把秘密憑證放進瀏覽器。
- 詳見 [工具整合契約](TOOL-INTEGRATIONS.md) 與 [tool-integration Skill](../.agents/skills/tool-integration/SKILL.md)。

## 平台與風險

- PC / Android / iOS 要檢查真機：WebGL2、viewport／safe area、context loss、背景恢復、畫面比例、觸控互動、發熱／掉幀。
- 在沒有可用 3D renderer 時，應提供文字說明與安全的基本介面，而不是承諾可用 Canvas2D 完整呈現 3D。
- `prefers-reduced-motion` 可以保留邏輯而降低視覺動效，但不等於直接停遊戲。
- 參閱 [官方研究摘要](research/THREEJS-ENGINEERING-2026-11-04.md)、[工具與狀態](TOOLING.md)、[品質門檻](QUALITY-GATES.md)。
