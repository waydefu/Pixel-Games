# 聖奧爾德里克港主線遷移｜#148

## 決策、範圍與證據分級

Owner 本次明確選擇 PR #145／#147 的 Saint Aldric Harbour 為唯一正式遊戲，取代舊 HD-2D，並要求更換 GitHub 部署、整理 Issues 和 CI。實作及合併候選為 #147；主線遷移驗收為 #148；#146 繼續追蹤完整願景，#120 繼續追蹤真機與人工驗收。

- **OBSERVED（來源）**：原 `research/saint-aldric-harbour` 已有 30 個 ES modules、原型 Vite/inline 建置、四品質、FFT ocean、程序 GPU 材質、CSM、LOD、背包／農地／保存。根入口／npm scripts／CI／Pages 原本仍指向不同的 HD-2D 遊戲；舊 CI 綠燈不能覆蓋新主線。
- **IMPLEMENTED（此 PR）**：源碼升為 `src/harbour`，原測試升為 `tests/harbour`，根 `index.html` 改接新主線；根鎖檔依賴已含所需 Three.js/Vite，不再安裝原型的第二份套件。原型歷史 HTML 不重建、不部署。
- **VERIFIED**：以 #147 最新 SHA 的實際 checks、`dist` 與 `mainline-evidence-*` artifacts 為準，不能把此文件或計畫當作執行成功。首次遠端低檔 file:// 已啟動，Node/建置已通過；新存檔 E2E 初輪因測試鍵值寫錯而 fail，已校正真實 `aldric.save`，必須重跑。
- **NOT RUN**：POCO F8 Ultra／iOS 實機、四檔長時 FPS/GPU/熱節流、畫面達標、音訊、完整釣魚／划船／耕作／跨季玩法、跨瀏覽器 BFCache；CI SwiftShader 不代表上述通過。

## 遷移方式與舊版保留

| 項目 | 正式主線 | 保留歷史／相容界線 |
|---|---|---|
| 入口 | 根 `index.html` → `/src/harbour/main.js` | 舊入口與 README 在 `legacy/hd2d`；不提供第二個正式 URL |
| 源碼 | `src/harbour/*.js` | 舊 `src/game`、`src/rendering` 原樣保留，Vite 入口不引用 |
| 測試 | `tests/harbour`、`e2e/harbour`、governance regressions | 舊 tests/e2e 不假裝適用；`legacy:*` 命令僅作歷史工具 |
| 素材 | GPU／幾何／Web Audio 程序生成 | `publicDir:false`：不複製 GLB、HALOFLUX、外部字型；不刪舊授權紀錄 |
| 交付 | `dist/index.html` 唯一檔案，<3 MiB | 源碼仍模組化；「單檔」指發行產物，不要求開發時手工維護巨型 HTML |
| 保存 | `aldric.save`、`aldric.save.bak`、`aldric.settings.v1` | 不刪舊 HD-2D 任意 storage key；不盲轉不相容資料；只有一個活躍保存＋滾動備份，不是完整多槽 |
| 願景 | 四檔解析度、原創寫實中世紀港鎮 | 反射選項未接實作，修正 UI 誤稱；完整遮擋與效能仍需另做 |

不複製 Saltline 未釐清授權的程式；此批只遷移本庫原創模組與既有官方依賴。新正式產物不使用 HALOFLUX，因此不再因正式載入畫面引入其非商用條款；歷史檔案及 `ASSET-CREDITS` 原樣保留，未替所有歷史素材做新授權背書。

## 研究依據與技術採用

1. [GitHub：custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — build artifact 與部署 job 分離，部署需 `pages:write`、`id-token:write` 及 github-pages environment；延用原本既有權限，不變更 Source/Secrets/Ruleset。
2. [Vite：Static deploy](https://vite.dev/guide/static-deploy.html) — 產物為 `dist`，production preview 只供驗證、非正式伺服器；改相對 `base:'./'` 並將唯一 bundle 內嵌，避免 `/Pixel-Games/assets` 或 file:// 模組依賴；`publicDir:false` 避免複製舊資產。
3. [Playwright：route](https://playwright.dev/docs/api/class-page#page-route) — 在遠端阻擋所有非文件請求，實際捕捉外部依賴；desktop/mobile 同一份下載的 dist，不拿 dev source 或 mock 代替。另用遠端 `file://` 開啟完整內嵌產物。
4. shader／LOD 的規格證據與限制保留於 [EVOLUTION](../../research/saint-aldric-harbour/EVOLUTION.md)：Khronos GLSL ES 3.00、Three.js r187、MDN BFCache。此遷移不把 mipmap／draw-call 數量推論說成真機 FPS。

## CI 契約

```
PR ci.yml → collaboration + verify-mainline.yml
  build: npm ci → npm run validate → dist + immutable source SHA
  desktop E2E + mobile E2E: download SAME dist → real Chromium/SwiftShader
  required: build + every E2E + collaboration all pass
main deploy-pages.yml → SAME full verify → deploy exact Pages artifact
```

- 舊 Ruleset 必要檢查名稱 `Build, typecheck, unit and browser tests` 保留，不改 Ruleset／不旁路。JavaScript 新主線以 `node --check`、行為／契約回歸與瀏覽器驗證；名稱中的 typecheck 僅為歷史相容，不宣稱新源碼已有 TS 型別覆蓋。
- 移除舊 reusable verify.yml 的五分片與 G2 opt-in 舊版 audit；新主線兩個 browser jobs，**無 docs-only／e2e=false 旁路**。PR 與 Pages 各自驗證其 SHA，但 main 不再額外跑一份相同 CI。這是替換測試對象，不是把舊版 E2E 當成新遊戲通過。
- 桌面／手機 viewport 以**完整低檔**測試：無 rs/tex/veg/mocked renderer override，短邊必須 720–1080。桌面 file:// 用**未指定畫質的預設 high**，短邊必須 1080–1440，檢查 AO/bloom/MSAA 路徑 shader link；不降解析度／刪效果來過 CI。
- 測試涵蓋：真正 shader link、console error、DOM/meta、鍵盤或真 touch dispatch 位移、背包、四檔選單、保存／reload／繼續、舊 storage 保留、外部請求 0；保存 schema／備份／損壞／封鎖另以 Node 測。
- 第一輪 mobile trace 實測：boot 約27s、touch每次21–30s、UI actionability每次15–32s（SwiftShader 排隊）。完整保存＋reload測試界線設360s，單一wait仍有時限、retry=0；這不是效能合格或手機速度的證據。
- 證據 artifacts 保存14日：桌面低檔實際 PNG、各平台 shader/存檔 JSON、失敗 trace。第二輪已證實桌面保存重載與預設 high 離線／shader 通過，但高檔 PNG 截圖卡住；mobile trace 的 PNG 佔105秒並擠壓 reload 時限。故保留所有功能／shader／解析度檢查，取消 mobile／high 的額外 PNG 捕捉，不再提高 timeout，不修改或降低遊戲畫質；mobile/high 視覺仍 NOT RUN。中文字型不屬遊戲依賴；runner 截圖不是人工視覺驗收。

## 暫停時的重複渲染

最新 mobile trace（d177ca4）顯示 reload 在總時限中等待約114秒；取消額外 PNG 後仍能再現，故不能只歸因截圖或繼續加 timeout。程式的暫停旗標原本只限制部分遊戲／天氣邏輯，海洋 FFT、天空、陰影、場景及後製仍每幀執行。新增直接執行實際 frame prefix 的輕量回歸：修正前2/4 fail（暫停仍進入渲染路徑、時間仍前進），修正後4/4 pass，全套43/43 pass。

最小修正只在已進入遊戲且選單／背包暫停時保留最後完整畫面，停止重做世界更新與GL渲染；每個rAF仍更新last，避免恢復時dt突跳或把暫停算成高FPS。resize／context restore可重繪一次、dt=0；開場環繞與正常遊玩、解析度／材質／陰影／效果不變。遠端E2E另外讀取實際renderer.info.render.frame及遊戲時間，跨兩個rAF必須保持不變，再驗證恢復移動與保存重載；不以單元測試宣稱GPU效能提升。

規格參考：[MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)、[Three.js r187 WebGLInfo](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl/WebGLInfo.js)。驅動、真機效能與BFCache仍需另驗，不把此控制流修正說成全部裝置的GPU故障已修復。

## Issues／PR 整理

原有43張 open Issues 逐項讀 body 分流，見 [ISSUE-TRIAGE](ISSUE-TRIAGE.md)。治理／安全／驗收沿用，產品需求沿用或標新主線重驗，舊版限定標歷史但不說已修好。#137/#142/#143 的作者工作與討論保留，明確告知新主線不自動套用其舊源碼變更；未做自動合併／覆寫／關閉他人PR。

## 發布與回退

只有驗證通過且 Owner 合併授權符合本次決策後才可合併 #147；main Pages 執行完整驗證再發布。最後必須用 HTTP 讀回正式頁的 `pixel-games-mainline=saint-aldric` 與 `pixel-games-build=<main SHA>`，並比對 Pages run 的 SHA；未讀回不能說已切換成功。

若發布異常：先停止宣稱成功，保留失敗 logs/artifacts；使用獨立 revert PR 回退本次主線遷移提交（#147 原型及 shader 修復可依問題保留），復原舊 npm scripts／Vite／CI／入口，再經 required check 和 Pages 正常發布。不得改 Pages Source 或跳過 ruleset。舊保存資料仍保留，回退不要求刪瀏覽器 storage。
