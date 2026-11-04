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


## P1-R2 新增驗收

- Node 測試檢查 `fjordHeight()` 的聚落平臺、遠方山峰、兩側山壁與確定性。
- Playwright 桌機與 mobile viewport 測試：三種模式實際改變 Camera/Projection，第一人稱能移動；觀景模式不移動玩家，能切回斜角；Shader console 沒有編譯錯誤。
- 需要獨立檢查第一人稱與遠景的螢幕實圖：不只檢查按鈕文字。**真 Android/iOS、山體近景、跨設備 Shader 穩定性、GPU 時間與可攀山路均 NOT RUN。**


## P1-R3 新增交付檢查

- `tests/facade.test.mjs`：將牆面分成實心 cells，精確確認門／窗開口不與任何磚牆矩形重疊；保護凹窗不退化成貼圖。
- Playwright 桌機／mobile viewport 渲染、三視角切換、console Shader errors = 0 與可探索移動必須通過。
- 目視比較：窗洞立面深度、山牆上窗、雲層是否可辨識、山麓是否減少不自然直壁、碼頭甲板是否不再被大型礁石遮住、海面是否不再出現規律亮條紋。
- 量測：不同解析度 DPR，第一人稱水面特寫和斜角景觀兩個鏡頭各自量測 draw calls、frame p50/p95、真機 GPU time（若可用）；避免以桌面 SwiftShader 代替行動 GPU。
- **不得假稱**已達 Bells of Evermere、已有 SSGI/SSR/FFT/體積雲或通過長時間實機溫控驗收。
