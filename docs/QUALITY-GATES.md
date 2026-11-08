> **2026-11-08 現行補充**：CI 共用 `verify.yml` 一次建置與五個 Chromium 分片，`npm run check:governance` 驗證功能台帳與文件；PR 協作驗證則檢查任務及檔案交集。下方 P1/G2 所寫的 `UNSUPPORTED` 或 `NOT RUN` 是歷史里程碑狀態，不能取代最新 main 的證據。真機與人工驗收另做。

# 品質門檻

**Pipeline**：`npm run check` → `npm run assets` → `npm test` → `npm run typecheck` → `npm run build` → `npm run check:build` → `npm run test:e2e`，CI 成功才可提交合併審查。

**CI 結構（2026-11-08 起）**：`.github/workflows/verify.yml` 是 CI 與 Pages 部署共用的可重用流程——`build` 只做一次安裝與 `npm run validate`（靜態檢查、單元測試、型別、建置、預算）並上傳 `dist`；`e2e` 以五個分片平行跑（桌機 3 片、手機 2 片，只裝無頭 Chromium），每片下載同一份已驗證的 `dist`。上傳／下載 artifact 用 Node 24 版本（`upload-artifact` v7.0.2、`download-artifact` v8.0.2，SHA 以 `git ls-remote` 查得並核對 `action.yml`），避免 Node 20 棄用警告：CI 的目標是**沒有警告註解的乾淨綠燈**。`ci.yml` 的 `required` 關卡名稱不變（`Build, typecheck, unit and browser tests`），任何分片失敗即失敗；`deploy-pages.yml` 也呼叫同一流程，全部通過才發布。覆蓋範圍沒有減少，只是從「兩個長的串行任務、每個都重跑單元測試」變成「建置一次、五個短任務平行」。

## 自動

- 必要檔案和 JS 語法、沒有已淘汰的首頁與原型目錄。
- 物件與碰撞的單元測試（包含西側村莊、碼頭邊緣和生活道具）、asset hash / glTF companion、安全路徑、還原的共用 API contract tests。
- TypeScript strict 與 Vite 單頁 build；JS gzip 上限 330 kB（初始 budget；2026-11-06 由 270 kB 上調到 285 kB、2026-11-07 再上調到 300 kB、再到 330 kB，原因：動態天氣、十雲屬天空與雲影、音訊聲景、風場、路亞釣魚、精修魚竿與捲線器、程序化魚與假餌模型、官方 Water 海面、可划的船；main 為 261 kB，Owner 表示預算無妨）。
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
- **雲的審查網址參數**：`?cloudMix=Cu:.7,Ac:.4`（強制各雲屬占比，代號見 `cloud-genera.js`）、`?cloudOnly=Cu`（只畫一屬）、`?cloudShadow=.5`（雲影強度拉滿）、`?mirror=1`（軟體 GPU 上也開完整畫質與雲影）、`?fullres=1`（軟體 GPU 上也不降解析度；審查截圖用）。軟體 GPU（CI）預設以固定 0.55 倍解析度渲染（高畫質 0.45），**包含帶 `?visualShot=` 的測試頁**——這是 e2e 能穩定在時限內完成的原因。逐屬單獨截圖時請固定 `weather=` 與 `hour=`。
- **手機空白幀診斷參數**：`?reflect=0`（關掉海面反射那一遍）、`?rtt=0`（不用 `WEBGL_multisampled_render_to_texture`，改以 blit 解析多重取樣）。雲影圖與海面反射一律在場景繪製**之前**畫（`hd2d-pipeline` 的 `prePass`），不可在場景繪製途中切換渲染目標：手機 GPU 上這會讓整幀變成空白（Poco F8 Ultra 錄影，約每兩個遊戲幀一次）。
- **雲影圖預算**：雲影只有一張方形渲染目標（高 256 px、平衡 128、基本 64），每幀最多畫一次，軟體光柵（CI、無頭瀏覽器）完全不畫；天上看到的雲與地上的影讀同一組雲層。真機 GPU 時間**未測**。

- `tests/coastline.test.mjs` 保護草岸/沙岸的自然頭岬收尖和座標有限性；東端海灣水道不得因地形更新再次變成斷開的綠色陸地細線。

## G2｜固定鏡頭實圖與視覺回歸（2026-11-05）

- **單一遊戲入口**：`?visualShot=shot-01-quarter-street` 這類**可選查詢參數**進入原本的遊戲場景，固定玩家位置、視角、環境動畫時間（31s）並停用適應性 DPR 調整；一般使用者未帶參數時，既有玩法不變。
- **可用鏡頭**：01 斜角街景、02 第一人稱近牆、03 第一人稱碼頭、04 峽灣風景、05 港口泊船、06 手機直向。07 暮色與 08 夜景在日夜系統未完成前明確標 **UNSUPPORTED**，不能拿彩色濾鏡偽造實作。
- **擷取命令**：`npm ci && npm run visual:audit`。建置後使用 Playwright 對應 desktop/mobile Chromium 截取真實遊戲 `#stage` 的 PNG，並在 `visual-audit-output/`（已 gitignore）保存對應 JSON：shot、commit（若有提供）、瀏覽器、viewport、DPR、品質、buffer、draw calls、RAF p95 等；`catalog.json` 收錄 8 個鏡頭與支援狀態。
- **CI 與真機分層**：`npm run test:e2e` 做一般遊戲和 canonical audit URL 的畫面／shader 啟動 smoke；完整 PNG 產出需主動執行 visual:audit。Playwright SwiftShader 對照圖只做自動化復現／粗排，不宣稱真 GPU、手機 FPS、實際美術 PASS。POCO F8 Ultra 實機、人體美術審查仍 **NOT RUN**。
- **A/B 方法**：比較兩個 commit 時保持相同 shot id、品質、viewport、DPR、瀏覽器與畫面拍攝時機；報告附原圖與場景 shader error、draw calls、p50/p95，**不能**用不同構圖或不同日照作弊；GPU time 不可得時填 N/A。
- **額外注意**：G4 之後才加入 DoF／Bloom；visualShot 凍結時間以保護 A/B，不是對遊戲新增時間控制玩法。
