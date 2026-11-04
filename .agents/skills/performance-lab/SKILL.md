---
name: performance-lab
description: Use when measuring and interpreting CPU RAF intervals, Three.js renderer.info, GPU resources, mobile thermal effects or comparing HD-2D quality modes.
---

# 性能測試／數據可信度

1. 先讀 docs/QUALITY-GATES.md、docs/research/THREEJS-ENGINEERING-2026-11-04.md。
2. 記錄 commit、瀏覽器、裝置、viewport、DPR、quality、場景、時長、背景狀態。
3. `npm run graphics:matrix` 僅是**像素 buffer 上限試算**；`createFrameMetrics` 為 CPU RAF 間距，`renderer.info` 是 draw calls / 資源計數。
4. 不能以 60 FPS 目標、模擬高階手機尺寸、空 scene 或 Node mock 推出真實效能／功耗。
5. 診斷瓶頸按證據路由：shader compile／draw calls／材質數／render target／DPR／CPU long tasks／context loss／熱。
6. 降級需保持畫面可讀和操作有效；比較 basic/balanced/high 要同條件測，留截圖與 raw numbers。
7. 缺少 GPU profiler 或實機時如實標 `NOT RUN`，不填造性能數值。
