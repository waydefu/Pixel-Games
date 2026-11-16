# Pixel-Games｜聖奧爾德里克港

**唯一正式遊戲入口：** https://waydefu.github.io/Pixel-Games/

主線是聖奧爾德里克港（Saint Aldric Harbour）：原創、全程式生成的中世紀波羅的海港鎮。PR #145／#147 的模組升為 `src/harbour/`，取代舊 HD-2D 發布；舊版只保留作歷史／回退，不再並行部署。遷移、發布及證據追蹤於 [#148](https://github.com/waydefu/Pixel-Games/issues/148)。**此分支的文件描述合併後契約，實際是否上線以 Pages Actions 與網頁 build SHA 為準。**

## 交付與現況

- `npm run build` 產生 **`dist/index.html` 一個檔案**，內嵌 Three.js、程式、CSS；不發布舊 `public/`，不需外部模型、圖片、音檔、字型或 CDN。可下載 HTML 後離線開啟；瀏覽器本機檔案的存檔權限仍依平台。
- 程式已有第一人稱行走、釣魚與划船、程序天空／天氣／晝夜、FFT 海洋、四季日曆、農地、背包市集、單一存檔及匯入匯出。**有實作不等於完整玩法、美術或手機驗收完成**，見 [功能台帳](docs/FEATURE-STATUS.json)。
- 四檔畫質：低／中／高／極高；低檔內部短邊 720–1080，其餘 1080–1440，可自動調整於各檔範圍內。平面反射尚未實作；完整遮擋剔除、場景重建資源生命週期、四檔長時 GPU／熱節流仍待驗證。
- [#146](https://github.com/waydefu/Pixel-Games/issues/146) 是持續的超進化願景，**不因主線部署而關閉**。[#120](https://github.com/waydefu/Pixel-Games/issues/120) 追蹤 POCO F8 Ultra／人工畫質／音訊／效能。CI SwiftShader 與手機 viewport **不是**手機 GPU／FPS／散熱或人眼畫質驗收。

## 開發與驗證

Node.js >=24（GitHub Actions 使用 26），依根 `package-lock.json` 鎖定 Three.js 0.187.0、Vite 8.3.5、Playwright 1.64.1。

```sh
npm ci
npm run dev
npm run validate     # 新主線語法、Node 回歸、單檔 build、離線資產／3 MiB 上限
npm run test:e2e     # 須先 build 及安裝 Playwright Chromium；真 WebGL2/SwiftShader 功能測試
```

**不要從 `research/saint-aldric-harbour/` 再建另一份原型。** 原模組與測試已移到正式目錄；研究及未經重建的歷史 HTML 留存但不部署。舊 HD-2D 程式、測試與 `legacy:*` 命令屬歷史工具，不是新遊戲的驗收；舊 `perf:run`／graphics matrix 不可套用新主線，必須另建真機效能 harness。

## CI 與部署

- PR：`ci.yml` → `verify-mainline.yml`，一次建置、兩個桌面／手機 browser jobs；驗證 shader link、無外部請求、行走／觸控、選單／背包、保存／重載及桌面 `file://` 啟動，保留截圖／JSON／失敗 trace。
- 必要檢查保留 **`Build, typecheck, unit and browser tests`**（ruleset 相容名稱）；新來源是 JavaScript，實際執行語法、回歸與瀏覽器檢查，**不宣稱已有 TypeScript 型別覆蓋**。
- main：`deploy-pages.yml` 用同一 reusable 流程完整驗證，**所有 E2E 通過才發布**；不再先部署後驗證，也不與另一個 main CI 重複建置。未修改 Pages Source／Ruleset／付費資源。
- `dist/index.html` 內的 `pixel-games-mainline=saint-aldric` 與 `pixel-games-build=<40-char SHA>` 用於核對實際上線版本。

## 操作與存檔

WASD／方向鍵移動、Shift 疾跑、滑鼠環視、E 互動／上下船、F 拿釣竿、左鍵或空白蓄力／拋竿、I 背包、1–4 農具、G 種子、T 時間、R 天氣、M 靜音、Esc 選單。手機用浮動搖桿、觸控環視及右側操作鈕。

存檔沿用 `aldric.save`，設定沿用 `aldric.settings.v1`；支援每 30 秒自動保存、手動保存／讀取、JSON 匯入匯出。舊 HD-2D 釣獲／設定不會自動轉成新存檔，**也不刪除舊資料**。首次使用新主線請開新遊戲；清除網站資料前先匯出備份。完整多存檔尚未實作。

## 導覽

- [主線決策、研究依據、回退與驗收](docs/mainline/MAINLINE-MIGRATION.md)
- [Issues 分流台帳](docs/mainline/ISSUE-TRIAGE.md) · [現行功能](docs/FEATURE-STATUS.json)
- `src/harbour/`：正式模組；`tests/harbour/`、`e2e/harbour/`：正式回歸。
- `legacy/hd2d/`：舊 README／入口／功能台帳；`src/game/`、`src/rendering/`、舊 tests／e2e 保留但不發布。
- [文件索引](docs/INDEX.md) · [決策效力表](docs/decisions/DECISION-REGISTER.md) · [協作與認領](docs/CONTRIBUTING.md)
