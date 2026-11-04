# Three.js / HD-2D 技術採用紀錄（2026-11-04 更新）

**已導入的開發依賴**：Three.js 0.187.0、@types/three 0.187.0、Vite 8.3.5、TypeScript 7.0.2、@playwright/test 1.64.1；CI 使用 Node.js 26 LTS 與 npm ci。實際版本以 package-lock.json 為準，不能把外部 Research- 的舊快照當現況。

| 官方依據 | 已實作 | 尚待驗證 |
| --- | --- | --- |
| [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer) | lab/main.ts 建立 WebGL2 3D 場景，像素材質、動態光照、陰影與色彩管理 | Android／iOS 真機 |
| [WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer) | renderer-port.js 支援非同步初始化與 draw | TSL、WebGPU adapter、材質／後製相容性仍未實作 |
| [Texture](https://threejs.org/docs/pages/Texture.html) | nearest pixel texture 和顯式 sRGB／NoColorSpace | 遠景紋理 aliasing、atlas padding |
| [Responsive](https://threejs.org/manual/pages/responsive.html) | DPR／max pixels、camera aspect、保守自適應渲染比例 | GPU/熱降頻長時間驗證 |
| [Disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html) | scope 追蹤 geometry、material、texture 並清理 | 共享資產回收與多場景長測 |
| [Vite Pages deployment](https://vite.dev/guide/static-deploy) | /Pixel-Games/ subpath 和 dist build | Pages Source 仍未切到 Actions，不應聲稱 lab 已線上發佈 |
| [Playwright CI](https://playwright.dev/docs/ci) | Chromium 桌面與行動 viewport 的 E2E | 不是 POCO Android 與 iOS Safari 真機測試 |
| [Research- Luminati](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/26-luminati-hd2d-browser-engine.md) | 使用渲染／資產／測試分層理念 | 未複製任何上游專案素材、程式或遊戲玩法 |

**重要限制：** Playwright 的 fallback 測試通過不等於 WebGL2 已成功繪製；當 CI Chromium 支援 WebGL2 時應明確驗證 renderer 的 frames 和 draw calls。CPU RAF p95 並非 GPU time，renderer.info textures 不是 VRAM 實際用量。第一款遊戲尚待 Owner 另外核准。

版本來源：[three](https://www.npmjs.com/package/three)、[vite](https://www.npmjs.com/package/vite)、[typescript](https://www.npmjs.com/package/typescript)、[playwright](https://www.npmjs.com/package/@playwright/test)、[Node LTS](https://nodejs.org/en/about/previous-releases)。原研究基線：Research- main 7d75fa961afec6115342aaef73786205358a5a29，查核日 2026-11-04。
