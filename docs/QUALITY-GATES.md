# 玩家入口與效能驗收

每個結論需區分：**Node Unit / TypeScript Build / Chromium Desktop / Chromium Mobile Viewport / Android 真機 / iOS 真機**。CI 不可冒充真機。

## 本 PR 自動檢查

- `npm run check`：只有根目錄 `index.html` 是玩家入口；不允許舊 Landing Page 與 `lab/index.html`。
- `npm run assets`：來源 SHA256 與 glTF 外部引用。程式生成素材不複製商業作品。
- `npm test`：原有工具、渲染、資產、場景 + `tests/navigation.test.mjs`。
- `npm run typecheck` + `npm run build`：TypeScript / Vite 單入口、正確 GitHub Pages 路徑。
- `npm run check:build`：`dist/index.html` / bundle 體積上限 270k gzip、不能輸出第二張 `dist/lab/index.html`。
- Playwright desktop + mobile viewport：滿版 canvas、Quarter View / orthographic diagnostics、畫質選項、沒有 runtime JS error；WebGL2 支援時要實際畫 frame 和 drawcalls。
- 角色移動：按鍵可實際改變角色位置；障礙物阻擋及路面可行走必須可回歸測試。

## 真機待測（目前不是 PASS）

Android Chrome（POCO F8 Ultra）、iOS Safari、手機內建瀏覽器的 Fullscreen API、safe-area、搖桿、多指觸控、熱、功耗、GPU context lost、30/60 FPS 長時間波動。Web browser 可填滿 100dvh 但不能無互動自動隱藏系統瀏覽器工具列。

## 遊戲完整度

本切片有鏡頭與自由移動，但還沒有釣魚、採集、互動 NPC、工作職業、存檔、完整大世界。不可把「入口改成遊戲」當成「所有生活系統已完成」。
