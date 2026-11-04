---
name: threejs-rendering
description: Use when designing or reviewing Three.js HD-2D renderers, pixel sampling, camera contracts, resizing, color-space, context loss, and GPU lifecycle in Pixel-Games.
---

# Three.js HD-2D 工程（按需）

1. 讀 AGENTS.md、docs/ARCHITECTURE.md 和 docs/research/THREEJS-ENGINEERING-2026-11-04.md。
2. 確認是**架構討論、注入式 host 契約、實際渲染實作**哪一種；不能把 mock 驗證說成真實 WebGL 渲染。
3. 優先 WebGLRenderer（Three.js），保持 UI DOM、遊戲 simulation、world/camera、renderer、scene resources 分層；不用純 render mesh 代替物理碰撞。
4. 像素材質檢查 NearestFilter、色彩空間、atlas 透明邊緣、SpriteMaterial 是否真的能受光；不要亂套 Bloom／DoF 抹掉像素邊緣。
5. Resize 同時驗證 CSS 尺寸、drawing buffer 與 camera projection。DPR 按品質限制，不假定高階手機能長時間跑滿。
6. 管理 context loss、可取消 loop、每層資源所有權；只 dispose 真正由自己擁有的資源。
7. 記錄官方 API、版本、來源、驗證命令與未完成的 Browser/Device cases；Three.js / Vite / TypeScript 已在 PR #5 的使用者授權範圍引入；切換 Pages、正式部署或合併仍須 Owner 明確批准。
