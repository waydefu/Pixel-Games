# 全 repo 優化點盤點與具體修法（2026-11-10）

> **有日期的審查快照，不是待辦清單，也不是即時狀態。** 基準 main `0fa888d`；任務 Issue #118。即時狀態查 GitHub main／Issues／PR／Actions。
> 本報告**不實作任何修法**：每項修法要另開（或沿用既有）Issue 與 PR，由 Owner 排優先序。已被 [#78](https://github.com/waydefu/Pixel-Games/issues/78)（F-01～F-17）涵蓋的主題只補具體修法、不重複開單。

## 0. 方法與證據等級

- **方法**：Haiku 子代理做靜態盤點（唯讀、未執行建置或測試）→ 主 session 逐項以原始碼行號與量測**覆核**（未覆核的不列入）→ Sonnet 子代理查線上資料，只用在需要外部事實的修法（§6）。
- **等級**：`CONFIRMED`＝本基準的程式碼或量測可直接核實；`HYPOTHESIS`＝推論，需量測才能下結論；`NOT MEASURED`＝沒有數字。**效益欄除非註明，一律是預期，不是實測。**
- **真機數據只引用 Issue 內已有的快照**，本次沒有新的真機量測。軟體 GPU（SwiftShader）不代表手機。
- 覆核時更正了子代理一項錯誤：海面網格在反射那一遍**不會**再畫一次（three.js `Water` 在畫反射時把自己設為不可見）。

## 1. 量測基準（本次實測）

| 項目 | 數值 | 來源 |
| --- | --- | --- |
| JS bundle | 單一 chunk `index-*.js` 1,088 kB，gzip 313 kB | `npm run build` |
| JS gzip 預算 | 330,000 bytes，目前用掉 **95%** | `scripts/check-build.mjs:10` |
| GLB 模型 | 21 個，原始 3.01 MB；無貼圖、無壓縮擴充 | 讀 GLB JSON chunk |
| GLB 線上傳輸 | Pages **有** gzip（長船 414 kB → 66 kB）；21 個合計 gzip 後約 455 kB | 線上 response header |
| 快取 | 所有資產 `cache-control: max-age=600`（含帶雜湊檔名的） | 線上 response header |
| 單元測試 | 48 檔、約 2.2 秒 | `time npm test` |
| 對原始碼字串的斷言 | `assert.match/doesNotMatch` 396 個，佔全部 `assert.` 1151 個的 34% | grep |
| 依賴 | `npm audit` 0 弱點；Playwright 1.64.1→1.65.0、Vite 8.3.5→8.3.7 | `npm audit`、`npm outdated` |
| 手機 High | p50 約 16.6 ms（約 60 fps）、緩衝 1642×592、draw calls 154 | [#46](https://github.com/waydefu/Pixel-Games/issues/46) 2026-11-09 兩份使用者快照 |

「高畫質約 10 fps」是 PR #34 之前的歷史基線，**已不成立**；本次已更正 #46 標題並關閉過時的 #55。

## 2. 優化點與具體修法

每項：位置 → 現況 → 修法 → 預期效果與驗證 → 風險 → 對應 Issue。

### A. 載入與下載

**O-01｜three.js 與遊戲程式在同一個 chunk，任何小改動都讓使用者重抓 313 kB**（CONFIRMED）
- 位置：`vite.config.*` 無分包設定；全專案 `import * as THREE from "three"`。
- 修法：把 `three`（與 `three/addons`）拆成獨立 chunk，遊戲程式另一個。設定寫法見 §6 的 Q2(c)。`scripts/check-build.mjs` 的預算改成**分開檢查**（例如 vendor ≤ 260 kB、game ≤ 90 kB gzip），否則總量預算會掩蓋遊戲程式變胖。
- 效果：遊戲程式更新時，使用者只重抓遊戲 chunk。**但 Pages 的 `max-age=600` 仍會每 10 分鐘重新驗證**（回 304，不重傳內容），所以效益是省流量，不是省請求數。驗證：連續兩次部署後看 vendor chunk 檔名雜湊不變。
- 風險：低；需確認 `check-build` 的「單一入口」檢查仍成立。對應：無既有 Issue（可併入 #66 冷啟動）。

**O-02｜JS 預算只剩 5%**（CONFIRMED）
- 位置：`scripts/check-build.mjs:10`。
- 修法：先做 O-01 分開預算；再量 three 佔比（Rolldown 的 bundle 分析）。`import * as THREE` 是否妨礙 tree-shaking **NOT MEASURED**，量完才決定要不要改成具名匯入。**不要直接調高預算。**

**O-03｜21 個 GLB 在啟動時全部平行載入，且擋住第一幀**（CONFIRMED）
- 位置：`src/game/main.ts:53`（頂層 `await loadVillageKit()`）、`src/game/village-kit.ts:16,47`（`import.meta.glob(..., eager:true)`＋`Promise.all`）。
- 修法：(1) 先用既有的程序化村莊（`loadVillageKit` 失敗時已有 fallback）畫出第一幀，GLB 到齊後再替換；或 (2) 依與出生點的距離分兩批，近的先載。(3) 進度顯示接到現有的狀態列。
- 效果：縮短「看到畫面」的時間；**幅度 NOT MEASURED**（#93 的效能快照可加 `firstFrameMs`）。
- 風險：中——替換模型時的閃動、碰撞盒與 `batchStaticScene` 的時機。對應：[#66](https://github.com/waydefu/Pixel-Games/issues/66)（F-11）。

**O-04｜GLB 幾何高度冗餘**（CONFIRMED 現象／修法效益 HYPOTHESIS）
- 證據：3.01 MB gzip 後只剩 455 kB（壓掉 85%），代表大量重複頂點或未量化的 float。
- 修法：用 glTF-Transform 做 `weld`＋`dedup`＋`quantize`（必要時 meshopt，見 §6 的 Q2(b)）。**傳輸量已被 Pages 的 gzip 吃掉大半**，主要效益在解析時間與 GPU 記憶體。
- 風險：授權（CC BY 4.0 允許修改，但 `assets/manifest.json` 的 SHA256 與 `docs/ASSET-CREDITS.md` 的修改說明要同步）。對應：#66。

### B. 每幀 CPU（都是小項，合併成一個 PR 即可）

| ID | 位置 | 現況（CONFIRMED） | 修法 |
| --- | --- | --- | --- |
| O-05 | `src/game/camera.ts:62-63` | `movement()` 每次配置兩個 `Vector3` 只為了取 sin/cos | 直接用 `const s=Math.sin(yaw),c=Math.cos(yaw)` 算 x、z，不配置物件 |
| O-06 | `src/game/main.ts:599-604` | 聲音區塊每幀 `new THREE.Vector3()`、新的 options 物件與 `listener:{...}` | `fwd` 提到模組層重用；options 物件重用並就地改值 |
| O-07 | `src/game/main.ts:603` | 每幀第二次 `input.read()`（`input.ts:69` 每次建新物件並查 9 次 Set） | `update()` 讀到的結果存起來傳下去 |
| O-08 | `src/game/main.ts:588` | 每幀寫 `pickupButton.textContent`（即使沒變） | 只在拾取物 id 改變時寫 DOM |
| O-09 | `src/game/main.ts:369` | `nearPickup()` 每幀 `PICKUPS.find`＋`collected.includes`（O(n·m)） | `collected` 用 `Set`；或每 100 ms 才重算一次 |
| O-10 | `src/game/fishing.ts:430` | 釣線每段每幀 `tmp.clone()` | 預先配置 `mid`，改 `mid.addVectors(tmp,tmp2).multiplyScalar(.5)` |

- 效果：減少 GC 壓力；在 60 fps 的手機上**不會**明顯提高平均 fps，目標是降低偶發卡頓（p95／p99）。驗證：#93 的效能快照前後比較 p95。
- 風險：低。對應：無既有 Issue；建議一張「每幀配置清理」小單。

### C. GPU 與渲染

**O-11｜陰影圖每幀重畫，且陰影相機跟著玩家連續移動（沒有對齊紋素）**（CONFIRMED）
- 位置：`src/game/environment.ts:223-227`（1024²、68×70 m 視錐，一個紋素約 6.6 cm）、`:248`（`sunlight.position.set(px+…, …, pz+…)` 直接用玩家座標）；專案內沒有任何 `shadowMap.autoUpdate` 設定。
- 問題：(1) 走路時陰影邊緣會游動（相機以小於一個紋素的距離移動）；(2) 太陽 16 分鐘轉一圈（`main.ts:81`，約 0.375°/秒），每幀重畫大多是浪費。
- 修法：
  1. 把陰影相機位置**對齊到紋素格**：在光空間把 `px,pz` 量化成 `68/1024` 的倍數（和 `cloud-shadow.ts` 的 `setCenter` 同一個做法）。
  2. `renderer.shadowMap.autoUpdate=false`，只在「對齊後的位置改變、太陽方向變化超過約 0.25°、或有投影物體移動」時設 `needsUpdate=true`；保底每 N 幀更新一次。
- 效果：消除走路時的陰影游動；省下大部分陰影 pass。**省多少 NOT MEASURED**，用 #42／#93 的工具量。
- 風險：中——樹受風擺動（陰影會變成不動）、船與村民的陰影延遲；要逐項確認哪些是動態投影者。與 open PR **#112**（同幀共用陰影圖）改同一個機制，**必須排在 #112 之後並整合**。對應：#46、#52 R1-C。

**O-12｜海面網格 165×161＝26,565 個頂點，全域等密度**（CONFIRMED）
- 位置：`src/game/ocean.ts:228`（`PlaneGeometry(680,620,164,160)`）。
- 修法：改成近密遠疏（例如中心 96×96 細格＋外圈粗格，或頂點著色器裡依距離降低位移），遠處的浪本來就被霧蓋掉。
- 效果：頂點處理量約減半；**在已 60 fps 的手機上屬於省電／降溫，不是提高 fps**。驗證：固定鏡頭 A/B 截圖＋快照。風險：中（浪的接縫、泡沫位置）。對應：#52 R1-C。

**O-13｜風的振幅寫進著色器程式快取鍵，三個振幅編出三支程式**（CONFIRMED）
- 位置：`src/game/vegetation-wind.ts:45`（`"|coastal-wind-v3-"+amplitude`）；呼叫端 `environment.ts:157`（.075）、`:186`（.13）、`mountain-forest.ts:31`（.12）。
- 修法：振幅改成 uniform（每個材質自己的值），快取鍵固定為 `"|coastal-wind-v3"`。
- 效果：少編兩支程式（縮短首次編譯與切換畫質時的卡頓）。風險：低。對應：#66。

**O-14｜城鎮樹木關閉視錐剔除**（CONFIRMED）
- 位置：`src/game/trees.ts:109`（註解：instance bounds are not tracked）。
- 修法：填完矩陣後呼叫 `mesh.computeBoundingSphere()`，半徑加上風擺的保守外擴（`mountain-forest.ts` 已經這樣做），再移除 `frustumCulled=false`。
- 效果：樹不在畫面內時不送繪製。風險：低（反射與陰影相機也要能正確剔除）。對應：[#52](https://github.com/waydefu/Pixel-Games/issues/52) R1-B（F-10）。

**O-15｜Bloom 鏈每幀 8～10 個全螢幕 pass**（CONFIRMED 結構／成本 NOT MEASURED）
- 位置：`src/rendering/hd2d-pipeline.js:20-22`（balanced 4 層、high 5 層，每層下採樣＋上採樣）。
- 修法：**先量再動**。用 #42 的 pass 計時做「少一層」的 A/B；確認畫面差異肉眼不可見才改。不要在沒有數字時動畫質。對應：#52 R1-C。

**O-16｜多重取樣目標的擴充只能靠除錯參數關閉**（CONFIRMED 現況／根因 HYPOTHESIS）
- 位置：`src/game/main.ts:503-507`（`?rtt=0` 改寫 `renderer.extensions.has`）。
- 現況：PR #34 已把雲影與反射移到場景 pass 之前，使用者回報空白幀消失；但根因仍是推論（PV-035），而 `?rtt=0` 是對 three.js 內部的猴子補丁。
- 修法：見 §6 的 Q1；在真機用 `?rtt=0`／`?reflect=0` 的快照確認前，**不要**把它改成預設。對應：#46。

### D. 資源生命週期

| ID | 位置 | 現況（CONFIRMED） | 修法 | 對應 |
| --- | --- | --- | --- | --- |
| O-17 | `src/game/fishing.ts:83`、`src/game/rod-model.ts:121` | `material.clone()` 沒有經過 `scope.track`，`dispose` 時不會釋放 | `scope.track(x.clone())` | #61／#66 |
| O-18 | `src/game/main.ts:641-650` | `pagehide` 釋放了 renderer、world、input，但沒有關 `AudioContext`、沒有釋放 soundscape | `sound?.dispose?.(); void soundCtx?.close();` | [#63](https://github.com/waydefu/Pixel-Games/issues/63)（F-05） |
| O-19 | `src/game/main.ts:534` | `restoreResources:async()=>{}`：WebGL context 恢復時什麼都不重建 | 至少重新套用畫質（重配後製目標）、重設雲影圖與反射目標、觸發材質重編 | [#62](https://github.com/waydefu/Pixel-Games/issues/62)（F-04） |
| O-20 | `src/game/cloud-field.ts:13` | `void scope;` 參數沒用到 | 移除參數或真的用它追蹤資源 | #64 |

### E. 程式品質

**O-21｜同一個小工具在多個檔案各寫一份**（CONFIRMED）
- hash：`wind.js:11` 與 `fish-model.js:11` **完全相同**；`architecture.ts:15`、`mountain-forest.ts:11`、`environment.ts:18` 是同一種 sin-fract 寫法但**常數不同**（不能直接合併成一個函式）。clamp（三份相同）：`wind.js:10`、`audio-mix.js:8`、`camera.ts:18`；mulberry32：`weather.js:21`、`wander.js:2`、`pixel/tree-gen.js:96`。
- 修法：新增 `src/platform/math.js`（`clamp`、`lerp`、`hash11`）與 `src/platform/rng.js`（`mulberry32`），各檔改為匯入。完全相同的（clamp、`wind`／`fish-model` 的 hash、mulberry32）可直接合併；常數不同的 hash 以「帶種子參數」的形式收斂（`hash11(n, k, phase)`），**先用單測鎖住每個現有函式的輸出再替換**——世界生成依賴這些數值，差一點樹和建築的位置就會全變。
- 對應：#64。

**O-22｜20 處各自解析網址參數，除錯參數散落在正式路徑**（CONFIRMED）
- 位置：`main.ts` 13 處、`world.ts` 3、`fishing.ts` 2、`fjord.ts` 1、`life.ts` 1（都不在每幀路徑上）。
- 修法：新增 `src/platform/audit-params.js`，啟動時解析一次，匯出具名、有型別的唯讀物件（`visualShot`、`hour`、`mirror`、`fullres`、`rtt`、`reflect`、`cloudMix`…）。`docs/QUALITY-GATES.md` 的參數表由這個檔案的清單驅動，避免文件與程式不同步。
- 對應：#64。

**O-23｜匯出但沒有任何其他檔案使用的符號**（CONFIRMED 抽查 6 個）
- `makeWaterNormals`（ocean.ts）、`buildLure`（fish-model.js）、`hullCircles`（rowing.js）、`WALK_BOUNDS`（navigation.js）、`edgeFade`（terrain-profile.js）、`moonIllumination`（time-of-day.js）在 `src`、`tests`、`e2e`、`scripts` 都只出現在定義檔。子代理另列約 15 個，**未逐一覆核**。
- 修法：檔內有用的去掉 `export`；沒用的刪除。之後可在 CI 加一個「未使用匯出」檢查，但先人工清一輪。

**O-24｜`.js` 檔完全沒有型別檢查**（CONFIRMED）
- 位置：`tsconfig.json`（`include: ["src/game/**/*.ts"]`、`checkJs:false`）；`src/rendering`、`src/platform`、`src/integrations` 與 `src/game` 約 30 個 `.js`。
- 修法：分階段——先對 `src/rendering/*.js`、`src/platform/*.js` 開 `// @ts-check`＋JSDoc，CI 另跑一個只檢查這批的 `tsc -p tsconfig.js.json`；再擴到 `src/game/*.js`。`soundscape.ts:116,217` 的 `as any` 改成 `"positionX" in listener` 的型別收窄。
- 對應：[#65](https://github.com/waydefu/Pixel-Games/issues/65)（F-07）。

### F. 測試

**O-25｜三分之一的斷言是比對原始碼字串**（CONFIRMED）
- 位置：`tests/cloud-shader.test.mjs`（98）、`aerial-cloud-integration.test.mjs`（50）、`environment-evolution.test.mjs`（43）、`night-lighting.test.mjs`（31）、`fishing.test.mjs`（25）等。
- 問題：重構時測試會壞，但行為沒壞；反過來，行為壞了測試不一定抓得到（本專案就發生過 `uHalo` 未宣告、截圖安靜壞掉，見 PV-045）。
- 修法：(1) 常數檢查改成匯入匯出的值（例如把 `BUDGET` 匯出再斷言）；(2) 著色器加**真正的編譯測試**：在 Playwright 裡用 WebGL2 編譯每支 shader、檢查 `getShaderInfoLog` 為空（軟體 GPU 也能編譯）；(3) 保留少數有意義的結構檢查（`prePass` 順序、`smoothstep` 邊界）。
- 對應：[#48](https://github.com/waydefu/Pixel-Games/issues/48)（F-13）。

**O-26｜e2e 用固定秒數等待**（CONFIRMED）
- 位置：`e2e/fishing.spec.mjs:32`（3000 ms）、`farm-navigation.spec.mjs:10`（2000 ms）、`inventory.spec.mjs:13`（400 ms）、`game.spec.mjs:110`（220 ms）。
- 修法：改成 `expect.poll` 等待狀態（位置改變、釣魚狀態轉換）。按住按鍵的那兩個改成「按下 → poll 到位移超過門檻 → 放開」。
- 效果：軟體 GPU 慢的時候不會假失敗，快的時候不白等。對應：#48。

### G. CI

**O-27｜每個 e2e 分片都重新下載 Chromium 與系統套件**（CONFIRMED）
- 位置：`.github/workflows/verify.yml:87`（5 個分片各跑一次 `playwright install --with-deps`，註解記載曾經慢到超時）。
- 修法：用 `actions/cache` 快取 `~/.cache/ms-playwright`，鍵用 `@playwright/test` 的版本；命中時只跑 `npx playwright install-deps`（或把字型套件也快取）。
- 效果：每個分片省約 15～20 秒（本次 CI 記錄中該步驟耗時），並降低鏡像慢造成的失敗。風險：低；新 action 要釘 SHA。對應：#48。

**O-28｜視覺稽核步驟的觸發條件是兩個早已不存在的分支名，等於永遠不會執行；執行時還會重建一次**（CONFIRMED）
- 位置：`.github/workflows/verify.yml:96-97`（條件含 `feat/g2-reproducible-visual-audit…`、`feat/g4-cinematic-post…`）、`package.json:22`（`visual:audit` 先 `npm run build`）。
- 修法：觸發改成 PR 標籤（repo 已有 `visual-audit` 標籤）或 `workflow_dispatch`；步驟直接跑 `node scripts/run-visual-audit.mjs`，用已下載的 `dist`；加 `?mirror=1&fullres=1` 走完整畫質路徑，產物上傳、**不擋合併**。
- 效果：補上 CI 看不到完整畫質路徑的盲區（PV-036）的一部分。對應：#48 第 1 項、[#70](https://github.com/waydefu/Pixel-Games/issues/70)。

**O-29｜重試才通過的測試沒有任何紀錄**（CONFIRMED；Owner 已決定暫不開 `failOnFlakyTests`）
- 位置：`playwright.config.mjs:10-11`（`retries:1`、reporter `line`）。
- 修法：維持不擋，但**讓它看得見**，作法見 §6 的 Q3。對應：#48 第 3 項。

### H. 文件

| ID | 現況（CONFIRMED） | 修法 | 對應 |
| --- | --- | --- | --- |
| O-30 | `docs/TOOLING.md` 第一行標 HISTORICAL，但 #80／#85 又在裡面新增「現行」的 Serena 與 Ponytail 列；且與 `docs/history/TOOLING-2026-11-04.md` 幾乎重複 | 拆開：現行工具表留在 `docs/TOOLING.md`（拿掉 HISTORICAL 標記、只留現況），11-05 的快照搬到 `docs/history/` | #49 |
| O-31 | `docs/ART-DIRECTION.md` 標 HISTORICAL 卻放在頂層現行文件旁 | 搬到 `docs/history/` 或在 `docs/INDEX.md` 標明是歷史；確認現行美術規範的入口是哪一份 | #70 |
| O-32 | `docs/FEATURE-STATUS.json` 缺已合併的功能與驗收狀態欄 | 細目已寫在 [#49 的留言](https://github.com/waydefu/Pixel-Games/issues/49) | #49 |
| O-33 | `docs/reviews/` 有 8 份 11-04／11-05 的報告，主題重疊 | 不刪；在 `docs/INDEX.md` 把它們收進「歷史」一節，只留一個現行入口 | #49 |

## 3. Issue 整理

**已做（2026-11-10，後三項依 Owner「按建議來」的指示）**
- 關閉 #55（11-08 的手寫進度快照，已過時，且違反「不維護第二份最新清單」）；#46、#48 改標題反映現況；#49 補上逐項核對後的實際缺口。
- **驗收總清單 #120**：把分散的真機與人工驗收收成一張檢查表（手機 9 列、桌面 3 列），#45、#53、#57、#111 掛為子 Issue。之後新的「真機 NOT RUN」加一列到 #120，不再各開一張。
- **關閉 #105、#94**：修復與功能已由 PR #106、#95 合併；兩個 PR 標為 NOT RUN 的人工與真機項目已移到 #120。
- **標籤**：所有開啟中的 Issue 都已上標籤——優先級 `P1`／`P2`（照標題與內文既有的優先級，沒有改任何人的優先級）、領域 `render`／`gameplay`／`engine`／`governance`／`ci`、`驗收`。`engine` 是原建議之外新增的，用在 GameClock、音訊生命週期、`main.ts` 拆分、型別檢查這類核心程式項目。新標籤是灰色、沒有說明文字，顏色可在 GitHub 介面調整。

**仍建議 Owner 決定**
1. `development-task.yml` 的優先級下拉改成自動加標籤（需要改範本，屬治理變更）。
2. #54（滑鼠鎖定疑慮）已標 `question` 並列入 #120 桌面區；下次桌面測試驗一次，仍無法重現就關閉。
3. 本報告**沒有**為 O-01～O-33 逐項開 Issue。建議只開三張：「每幀配置清理（O-05～O-10）」「陰影相機對齊與更新策略（O-11，排在 #112 之後）」「CI：瀏覽器快取、視覺稽核觸發、flaky 可見（O-27～O-29，可直接併入 #48）」，其餘併入表中對應的既有 Issue。

## 4. 建議順序

1. **便宜、低風險、可立即做**：O-05～O-10、O-13、O-14、O-17、O-20、O-26、O-27。
2. **先量再做**：O-11（等 #112）、O-12、O-15、O-03、O-04。量測工具已有（#42、#93）。
3. **結構性、需拆多個 PR**：O-01／O-02、O-21～O-24、O-25。
4. **不要做**：在沒有真機數據時降低畫質；調高 JS 預算；把 `?rtt=0` 設為預設。

## 5. 與 #78（F-01～F-17）的對照

| #78 項目 | 本報告補充 |
| --- | --- |
| F-02／F-03 反射例外與 RT 所有權（#60、#61） | O-17 |
| F-04 Context restore（#62） | O-19 |
| F-05 音訊清理（#63） | O-18 |
| F-06／F-17 `main.ts` 耦合（#64） | O-20、O-21、O-22 |
| F-07 JS 型別（#65） | O-24 |
| F-08／F-13 畫面回歸與 source-regex（#48、#70） | O-25、O-26、O-28 |
| F-09／F-10／F-12 合批、剔除、RT（#52） | O-11、O-12、O-14、O-15 |
| F-11 GLB 冷啟動（#66） | O-03、O-04、O-13 |
| F-14 依賴掃描（#67） | §1：目前 0 弱點、兩個小版本落後 |
| F-15 台帳新鮮度（#49） | O-30～O-33 |
| **#78 沒有涵蓋** | O-01、O-02（分包與預算）、O-05～O-10（每幀配置）、O-23（未使用匯出）、O-27～O-29（CI） |
| F-01 GameClock（#59）、F-16 產品功能 | 本報告未涉及 |

## 6. 線上查證（Sonnet 子代理，2026-11-10）

> 子代理只查線上資料、未接觸 repo。下列「未找到／未驗證」是它自己的標註，照實保留；**這些來源我沒有逐一重新開啟核對**，引用前請自行點開。

**Q1（O-16）多重取樣渲染到貼圖與中途切換渲染目標**
- **沒有找到**記載「巢狀渲染後返回會丟失內容」的 Adreno／Mali／Chrome 官方錯誤報告（子代理沒有直接搜尋 Chromium／ANGLE 的 tracker）；Khronos 規格頁回傳 403，未能引用原文。所以 PV-035 的根因**仍是假說**，線上查證沒有把它升級成已證實。
- three.js 的防護是目前唯一的一手證據：`WebGLRenderer.js` 有註解「The multisample_render_to_texture extension doesn't work properly if there are midframe flushes and an external depth buffer. Disable use of the extension.」並設 `__useRenderToTexture = false`（[dev 原始碼](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/WebGLRenderer.js)；啟用條件見 [WebGLTextures.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/webgl/WebGLTextures.js)）。本機 `node_modules/three` 可核實同一段。
- 相關但不同的問題：[three.js #28131](https://github.com/mrdoob/three.js/issues/28131)（此擴充存在時雙面透射材質出錯，仍開啟）。
- **沒有公開 API** 可讓單一 render target 退出此擴充；`__useRenderToTexture` 是內部屬性。受支援的避開方式只有 `samples = 0`。
- **具體作法**：維持 PR #34 的結構（不在場景 pass 途中切換目標）；`?rtt=0` 只當診斷用；若真機 `?rtt=0` 對照顯示仍需要關閉，再評估「該檔改用 `samples=0`＋後處理抗鋸齒」而不是依賴內部屬性。

**Q2（O-01、O-04）下載量**
- (b) glTF-Transform 文件**沒有**給 meshopt 的典型節省比例（[meshopt](https://gltf-transform.dev/modules/functions/functions/meshopt)、[CLI](https://gltf-transform.dev/cli)）。因為線上已有 gzip，真正的效益是「gzip 之後的差額」，**必須拿這 21 個檔案實測**。three.js 端要加 `loader.setMeshoptDecoder(MeshoptDecoder)`（子代理量到解碼器約 29 kB、gzip 約 7.7 kB；這個 API 名稱它是憑記憶寫的，未查文件）——解碼器本身會吃掉 JS 預算的一部分。
- (c) Vite 文件只說 `build.rolldownOptions` 會併入 Rolldown 選項（[Vite build options](https://vite.dev/config/build-options)）；設定形狀在 [Rolldown `output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting)：
  ```js
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: "three", test: /node_modules[\\/]three/, priority: 20 },
  ] } } } }
  ```
- **具體作法**：O-01 用上面的 `groups` 設定，建置後確認輸出兩個 JS 檔，再把 `check-build.mjs` 改成分別檢查。O-04 先對一兩個最大的 GLB 試 `weld`＋`quantize`，比較 gzip 後大小與載入時間，再決定要不要引入 meshopt。

**Q3（O-29）讓重試才通過的測試看得見，但不擋合併**
- Playwright 把「先失敗、重試後通過」算成獨立的 `flaky` 結果，**預設不會讓執行失敗**；`failOnFlakyTests`／`--fail-on-flaky-tests` 才是會失敗的選項（[retries](https://playwright.dev/docs/test-retries)、[TestConfig](https://playwright.dev/docs/api/class-testconfig)、[TestCase.outcome](https://playwright.dev/docs/api/class-testcase)）。
- JSON reporter 的 `onlyFailures: true` 會保留失敗與 flaky 的測試（[reporters](https://playwright.dev/docs/test-reporters)）；`github` reporter 是否會為 flaky 產生標註，子代理**沒有查到**。
- **具體作法**（不設 `failOnFlakyTests`，符合 #48 的決定）：
  ```js
  reporter: process.env.CI
    ? [["line"], ["json", { outputFile: "test-results/results.json", onlyFailures: true }]]
    : "list",
  ```
  CI 多一個步驟讀 `results.json`，有 flaky 就印 `::warning::` 並把檔案上傳成 artifact。注意：`::warning::` 會產生警告標註，與 PR #33 時「乾淨的綠」的要求有取捨，上線前請 Owner 確認要標註還是只留 artifact。

## 7. 沒有檢查的範圍

`cloud-shader.ts`、`fjord.ts`、`architecture.ts` 等的完整內容（只看 grep 命中處）；自適應解析度控制器；`renderer-port.js` 的 context-loss 路徑細節；`docs/reviews/` 各報告的內容重疊程度；e2e 規格的行為斷言品質；`scripts/performance/*`；各畫質檔實際的著色器程式數；three.js 的 tree-shaking 效果；音訊實聽；任何新的真機量測。open PR #108、#112、#117 的內容未審查。
