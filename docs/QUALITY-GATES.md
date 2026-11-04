# 品質門檻

**Pipeline**：`npm run check` → `npm run assets` → `npm test` → `npm run typecheck` → `npm run build` → `npm run check:build` → `npm run test:e2e`，CI 成功才可提交合併審查。

## 自動

- 必要檔案和 JS 語法、沒有已淘汰的首頁與原型目錄。
- 物件與碰撞的單元測試（包含西側村莊、碼頭邊緣和生活道具）、asset hash / glTF companion、安全路徑、還原的共用 API contract tests。
- TypeScript strict 與 Vite 單頁 build；JS gzip 上限 270 kB（初始 budget）。
- 角色 Billboard 不再投射生硬的矩形陰影；改用原創軟邊地面陰影。
- 靜態物件依材質合批，來源幾何正確釋放；Draw Calls 必須從 Chrome 診斷量測，不能假設效果。
- Playwright Chromium 桌面和手機 viewport，驗證網頁滿版、真 WebGL2 frame/draw calls（GPU 可用時）、鍵盤位移、畫質與 UI。**另外監控 console 中 WebGLProgram / Shader Error**；draw calls 正常不代表每個 Shader 都成功連結。

## 人工（不得假稱已通過）

- 質感與參考遊戲差距：屋頂、材質、海岸、角色的實際螢幕截圖逐項比對。
- POCO F8 Ultra Chrome 橫／直向與手把／搖桿；iOS Safari。
- 真 GPU 幀時間、長時間熱降頻、耗電、鏡頭與房屋遮擋、視覺美術完成度。
- 手機 FPS 60 為優化目標，不是測試結果；高畫質要能安全回退到平衡／基本。
