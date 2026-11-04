# Three.js / HD-2D 工程研究備忘｜2026-11-04

研究狀態：**官方文件核對 + Repo 對應設計 + 可執行純 JS 契約**；**沒有實際在 Android/iOS 執行 Three.js 場景、沒有 GPU benchmark、不宣稱特定版本已安裝**。

參考 Research- 基線：[`waydefu/Research-`](https://github.com/waydefu/Research-) main `7d75fa961afec6115342aaef73786205358a5a29`（2026-11-04 查詢）。注意 upstream 可能演進，正式採用時需重新核對原始碼和授權。

## 核實結果與技術採用

| 項目 | 官方證據 | Pixel-Games 採納／限制 |
| --- | --- | --- |
| 引擎定位 | [Three.js installation](https://threejs.org/manual/pages/installation.html) | Three.js 優先；真正使用 `three` npm package 時固定版本並提交 lockfile |
| WebGL / WebGPU | [WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer) | 初始實驗優先 `WebGLRenderer`；WebGPU 仍在演進，ShaderMaterial / EffectComposer 不能不經驗證直接移植 |
| HD-DPI | [Responsive design](https://threejs.org/manual/pages/responsive.html) | 由 CSS 與渲染 buffer 分開計算；限制 DPR 和最大 pixel count，透過 `setSize(width,height,false)` |
| 像素濾鏡 | [Texture](https://threejs.org/docs/pages/Texture.html) | 像素 atlas 先採 NearestFilter / 取消 mipmap，顏色貼圖標註 sRGB，數據貼圖 NoColorSpace |
| 色彩與材質 | [Color management](https://threejs.org/manual/pages/color-management.html) | output color space 與 color texture 一致，若上後製需查 OutputPass；MeshBasicMaterial / SpriteMaterial 不等同受光材質 |
| 記憶體 | [Disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html) | 對 Geometry / Material / Texture / RenderTarget 明確所有權與 dispose；共享資源須設單獨策略 |
| Draw calls | [Optimize lots of objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html) | 先量測，再考慮實例化／合批；不是一開始全部轉成 InstancedMesh |
| Context loss | [MDN webglcontextlost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event) | host 暫停渲染、可回報 lost/restored；畫面恢復後仍要真實瀏覽器驗收 |
| 靜態部署 | [Vite GitHub Pages](https://vite.dev/guide/static-deploy) | 若轉用 Vite build，需 GitHub Actions 發佈 `dist` 或等價的審核過流程；**不擅自修改現有 main/(root)** |
| 原始 2.5D 參考 | [Research- Luminati](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/26-luminati-hd2d-browser-engine.md) | 學分層／工具／測試，不複製遊戲玩法、程式或素材 |

## 對應現有實作（本次 PR）

1. `src/rendering/quality.js`：`basic / balanced / high` 預設解析度上限，純函數，不看 user-agent，不是自動 GPU benchmark。
2. `src/rendering/three-host.js`：以**依賴注入**接入 Three.js namespace，管理 WebGLRenderer 建立、Buffer resize、context loss/restored、info counters、dispose；**不在本 PR 載入 Three.js package**。
3. `src/rendering/pixel-texture.js`：對色彩／資料貼圖設 nearest、wrapping、colorSpace。
4. `src/rendering/resource-scope.js`：dedupe／反向釋放已擁有資源；若共享材質／貼圖請避免多次 `dispose`。
5. `src/rendering/frame-metrics.js`：固定上限的 RAF 間距統計 p50/p95；**不等於 GPU frame time 或實機性能結果**。
6. `src/platform/asset-manifest.js` + `scripts/check-assets.mjs`：資料來源、授權、SHA256、相對路徑驗證（目前只有空 manifest，沒有第三方資產）。
7. `scripts/graphics-matrix.mjs`：顯示配置預算試算，**不是跑了 Three.js FPS**。

## 暫不引入的依賴

- `three` / Vite：需要在下一個批准的渲染實驗中選具體版本、lockfile、`base: "/Pixel-Games/"`、合適的部署方式與 E2E。
- EffectComposer、Bloom、DoF：材質和色彩策略尚未做穩定的 WebGL smoke test；先測正確性再上特效。
- WebGPURenderer：需不同後製／shader 策略，不能假裝與 WebGLRenderer 功能等價。
- 大型幾何虛擬化、MCP、向量索引：現階段缺少必要 workload 和可靠收益測量。

## 下一個批准的實驗（尚未開始）

以**中立原創技術場景**，比較「純場景 → 像素 Sprite → 一盞光／陰影 → optional postprocess」，在電腦和手機分別測：首次載入、載入失敗、context loss、resize、品質切換、資源釋放、p50/p95 幀時間、draw calls、GPU 資源數和長時間溫度。**沒有用過的裝置就標 NOT RUN**。

不建立地圖、戰鬥、箱子或地城類遊戲。第一款遊戲由 Owner 另行決定。
