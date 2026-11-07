# 品質門檻

**Pipeline**：`npm run check` → `npm run assets` → `npm test` → `npm run typecheck` → `npm run build` → `npm run check:build` → `npm run test:e2e`，CI 成功才可提交合併審查。

## 自動

- 必要檔案和 JS 語法、沒有已淘汰的首頁與原型目錄。
- 物件與碰撞的單元測試（包含西側村莊、碼頭邊緣和生活道具）、asset hash / glTF companion、安全路徑、還原的共用 API contract tests。
- TypeScript strict 與 Vite 單頁 build；JS gzip 上限 300 kB（初始 budget；2026-11-06 由 270 kB 上調到 285 kB、2026-11-07 再上調到 300 kB，原因：路亞釣魚、精修魚竿與捲線器、程序化魚與假餌模型、官方 Water 海面、可划的船；main 為 261 kB，Owner 表示預算無妨）。
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

- `tests/coastline.test.mjs` 保護草岸/沙岸的自然頭岬收尖和座標有限性；東端海灣水道不得因地形更新再次變成斷開的綠色陸地細線。

## G2｜固定鏡頭實圖與視覺回歸（2026-11-05）

- **單一遊戲入口**：`?visualShot=shot-01-quarter-street` 這類**可選查詢參數**進入原本的遊戲場景，固定玩家位置、視角、環境動畫時間（31s）並停用適應性 DPR 調整；一般使用者未帶參數時，既有玩法不變。
- **可用鏡頭**：01 斜角街景、02 第一人稱近牆、03 第一人稱碼頭、04 峽灣風景、05 港口泊船、06 手機直向。07 暮色與 08 夜景在日夜系統未完成前明確標 **UNSUPPORTED**，不能拿彩色濾鏡偽造實作。
- **擷取命令**：`npm ci && npm run visual:audit`。建置後使用 Playwright 對應 desktop/mobile Chromium 截取真實遊戲 `#stage` 的 PNG，並在 `visual-audit-output/`（已 gitignore）保存對應 JSON：shot、commit（若有提供）、瀏覽器、viewport、DPR、品質、buffer、draw calls、RAF p95 等；`catalog.json` 收錄 8 個鏡頭與支援狀態。
- **CI 與真機分層**：`npm run test:e2e` 做一般遊戲和 canonical audit URL 的畫面／shader 啟動 smoke；完整 PNG 產出需主動執行 visual:audit。Playwright SwiftShader 對照圖只做自動化復現／粗排，不宣稱真 GPU、手機 FPS、實際美術 PASS。POCO F8 Ultra 實機、人體美術審查仍 **NOT RUN**。
- **A/B 方法**：比較兩個 commit 時保持相同 shot id、品質、viewport、DPR、瀏覽器與畫面拍攝時機；報告附原圖與場景 shader error、draw calls、p50/p95，**不能**用不同構圖或不同日照作弊；GPU time 不可得時填 N/A。
- **額外注意**：G4 之後才加入 DoF／Bloom；visualShot 凍結時間以保護 A/B，不是對遊戲新增時間控制玩法。
