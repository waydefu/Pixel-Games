# Pixel-Games｜原創中世紀海岸 HD-2D 遊戲

**唯一遊戲入口：** https://waydefu.github.io/Pixel-Games/

自由探索的中世紀海岸小鎮，沒有強制任務。桌面與手機均可進入遊戲；實際手機 GPU、熱降頻與美術品質仍需真機驗收，不能由 CI 模擬器的綠燈代替。

## 遊戲現況與驗證界線

截至 2026-11-08 的 **main@6056e6c（PR #34）**，程式已具備斜角／第一人稱／風景視角、海岸與村莊、日夜與動態天氣、程序雲影、合成環境音、路亞釣魚及划船。部分功能仍可能有已知問題；**已合併不等於真機與視覺驗收完成**。

**尚未完成完整玩法：** 統一背包系統、多存檔、自動／手動保存與存檔匯入匯出、完整 NPC 作息、職業及大世界串流。現有漁獲記錄不等同完整遊戲存檔。

狀態來源：
- [功能台帳](docs/FEATURE-STATUS.json) — 功能是否已進入 main 及對應原始碼／PR，隨功能 PR 維護。
- [目前路線與風險](docs/ROADMAP.md) — 已證實的範圍與未來工作方向；**待辦以 GitHub Issues、未合併工作以 Pull Requests 為準**。
- [協作與交接](docs/CONTRIBUTING.md) / [無同步交接入口](docs/HANDOFF.md)。
- [決策效力表](docs/decisions/DECISION-REGISTER.md) — 最新有效／被取代／歷史決策；不要用 11/5 的舊計畫壓過新決策。

**即時入口：** [Issues](https://github.com/waydefu/Pixel-Games/issues) · [Open PRs](https://github.com/waydefu/Pixel-Games/pulls) · [Actions](https://github.com/waydefu/Pixel-Games/actions) · [main](https://github.com/waydefu/Pixel-Games/tree/main)

## 本機開發

Node.js >=24（CI 使用 26）：

```sh
npm ci
npm run dev
npm run validate       # repo / 治理資料 / 資產 / 單測 / TypeScript / 建置 / 預算
npm run test:e2e       # Playwright desktop + mobile viewport，非真機
npm run graphics:matrix
```

GitHub Pages 僅由 `.github/workflows/deploy-pages.yml` 在 main 更新時發布，與 CI 共用 `verify.yml` 的建置及五個 Chromium E2E 分片。合併成功後仍須確認 Pages Actions 成功與瀏覽器快取。

## 目錄

- `index.html`、`styles.css`：單一遊戲入口和 HUD。
- `src/game/main.ts`：啟動、操作、UI、環境更新的整合點；更改前需檢查其他開啟中的 PR。
- `src/game/world.ts`：場景組裝；其他 `src/game/` 模組處理相機、海洋、天空、天氣、釣魚、划船、音訊與美術。
- `src/rendering/`：單一 HD-2D 後製及渲染生命週期。
- `tests/`、`e2e/`、`scripts/`：回歸與建置檢查；`.github/workflows/`：CI/Pages。
- `public/loader/`：載入畫面的光環 worker 與其授權文字（原樣複製到發布目錄，非商用授權，見 [ASSET-CREDITS](docs/ASSET-CREDITS.md)）。
- `docs/`：現行規範與**保留原文**的研究／ADR／歷史紀錄。
- `.agents/skills/`：按需載入的開發技能，不是遊戲執行端自動授權。

## 進場載入畫面

進網頁後到世界載入完成之間不再空白：先逐行顯示與遊戲相關的日誌並出現「入港許可」視窗，接著循環播放光環動畫（Web Worker／OffscreenCanvas，不佔用遊戲主執行緒），光環至少循環五秒，之後才淡入遊戲（世界比光環早就緒時也會播滿五秒）。第一次點擊、按鍵或觸控會自動進入全螢幕（瀏覽器只允許由使用者操作觸發）。點一下或按 Esc／Enter／空格可略過日誌；同一分頁再次進站只顯示一行載入提示；`prefers-reduced-motion` 不播動畫；WebGL2 不可用或啟動失敗時立刻讓位給錯誤訊息。

網址參數：`?splash=0` 關閉；`?splash=full` 永遠播完整日誌；`?splash=hold` 停到點擊為止（檢視設計用）；自動化瀏覽器（Playwright）預設不顯示，用 `?splash=1` 強制開啟。光環動畫為**非商用**授權；真機載入觀感記在驗收 Issue #120。

## 操作與驗收

WASD／方向鍵移動、Shift 加速、C 或 1/2/3 切換視角；手機使用搖桿及觸控環視；桌面第一人稱點擊畫面啟用滑鼠鎖定環視，按 Esc 釋放游標，若瀏覽器不支援則保留滑鼠拖曳環視。靠近可釣魚區時以 F（手機操作鈕）蓄力拋竿／收線；E 可操作小船。時間、天氣、畫質、音量等從遊戲選單調整。

所有玩法 PR 需要程式驗證；天空／海面／材質 PR 還需固定鏡頭對照與裝置觀察。Playwright 的 mobile viewport **不是** POCO F8 Ultra 的實測。

**專案規則：** 一個正式遊戲入口、不復活舊地城或平行原型、不使用未授權素材、不繞過 main ruleset；研究和舊決策需標記狀態而非盲目刪掉。

## 桌機效能 A/B 測試

`npm run perf:run` 使用有視窗的 Playwright Chromium 和實際可用的 GPU，在 1280×720、DPR 1、balanced 畫質下依序測試街景、近牆、碼頭及往返步行；每場景預熱 15 秒、採樣 30 秒、重複 3 次，完整執行約 9 分鐘以上。先執行 `npm ci` 和 `npx playwright install chromium`。測試期間保持瀏覽器前景、避免其他負載與更改視窗。可用 `PERF_BROWSER_PATH` 指定本機 Chromium 相容瀏覽器、`PERF_QUALITY=basic|balanced|high` 指定畫質。輸出位於 `performance-output/`，每次包含 `result.json`、PNG 和可離線開啟的 `report.html`。

基準和候選版本分別在同一裝置執行，保留乾淨的 commit，建議 A→B→B→A 重複。用 `npm run perf:compare -- <A/result.json> <B/result.json> <report.html>` 產生自帶截圖的離線比較報告。環境、渲染條件不一致或工作目錄有未提交內容時，報告會禁止直接比較。每次的原始 RAF 間隔均保留供審查；draw calls 與 triangles 為含前置／場景／後製的整幀計數，geometry 和 texture 為數量，不是記憶體容量。RAF 間隔不是 GPU 時間，螢幕更新率也會限制改善幅度。軟體渲染、GPU 身分不可得、失焦、渲染失敗及樣本不足的結果標為無效；手機真機的 GPU 時間、熱與耗電仍需另測。

兩個版本必須包含相同版本的效能工具與採樣介面；若舊基準版沒有這套工具，先將相同工具變更套用並提交到基準和候選版本，再量測。工具不會自動 checkout 或修改版本；畫面比較仍需人工確認場景與視覺品質一致。

測試設定可用 `PERF_WARMUP_MS`、`PERF_SAMPLE_MS`、`PERF_REPETITIONS` 和 `PERF_OUTPUT_DIR` 調整；非預設設定只應與完全相同設定的結果比較。移動路線在固定場景時間下以 3 秒為單位交替前進與後退，經遊戲碰撞系統處理。

效能測試使用 `EXT_disjoint_timer_query_webgl2` 非同步量測每次 WebGL 繪製的 GPU 時間，涵蓋前置、場景和後製 pass；報告分別顯示 GPU 毫秒及 RAF 間隔的 p50／p95／p99。GPU 計時不包含所有 CPU 遊戲邏輯或顯示器延遲，也可能對效能造成少量量測負擔。擴充不支援、計時失效、樣本未完成或遺失時顯示狀態及 N/A，不以零代替。舊版未量 GPU 的結果仍可開啟，但其協定不同，不能與新版本直接 A/B 比較。

效能報告另列出超過 33.3／50 ms 的卡頓次數、最長幀間隔及事件時間線（橘線），並提供接近該時間的 CPU／GPU 取樣；接近不表示因果。CPU 分段包括移動與碰撞、相機、世界／音效、同步繪製提交，數值是主執行緒區段的經過時間，包含量測成本，不是 GPU 時間或 CPU 使用率。GPU 分段涵蓋雲影、實際執行的海面反射、主場景、Bloom、光線、景深與合成；未啟用或沒有執行的階段顯示 `NOT_RUN`／N/A。WebGL 不支援巢狀 elapsed query，因此整幀與各階段交錯抽樣；反射不是每幀執行，階段數據不應相加，也不能直接與舊版效能協定 A/B 比較。效能報告記錄完整原始樣本供重新分析。

報告使用單一離線 HTML：左側選單可切換總覽、啟動時間、順暢與卡頓、CPU、GPU、資源變化及畫面資訊；上方可選場景與單次結果。啟動時間從導覽開始計算，記錄素材載入、世界及輸入建立、渲染器就緒、第一個 WebGL 繪製呼叫完成；第一幀與輸入就緒只是可操作時間的代理，不代表已呈現在螢幕或實測輸入延遲。每輪建立新的瀏覽器 context，系統、GPU 等快取仍可能保留；啟動時間是在切換測試畫質之前的遊戲預設畫質。測試期間約每秒採樣幾何、貼圖與 shader program 數量，另外三次切換基本／高畫質及視角後回到原設定並記錄數量。資源數量是物件數、不是記憶體容量；快取與延後釋放可能導致數量增加，不能單憑它認定洩漏。新版採樣協定與舊結果不可直接比較。
