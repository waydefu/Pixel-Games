---
name: mobile-webgl-qa
description: Use when testing or planning Chrome Android, iOS Safari, responsive WebGL2, DPR budgets, thermal load and WebGL context recovery.
---

# 手機 WebGL 工程驗收

1. 讀 docs/QUALITY-GATES.md、docs/TOOLING.md 與當前 commit 的 Three.js 版本資訊。
2. 區分 CPU `requestAnimationFrame` 間距、GPU profile、渲染 buffer、DPR 與 CSS viewport，不得互相代替。
3. 固定相同場景／素材／裝置／瀏覽器／測試時長，測 basic/balanced/high 的 p50/p95、render calls、幾何／貼圖數。
4. 手機實測橫直向、safe-area、雙指觸控、背景再回來、WebGL context loss、低電量／熱節流（若可）。
5. Browser viewport 模擬是 layout 測試，不是手機 GPU、散熱或電池驗證；沒設備標 `NOT RUN`。
6. 建議簡化 visual fallback 和可讀的 DOM 錯誤狀態，不能假稱 2D fallback 等價於真 3D。
7. 只在有明確遊戲或渲染 PoC 後加入 Playwright E2E，不建無意義的假通過測試。
