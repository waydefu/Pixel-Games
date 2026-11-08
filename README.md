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
- `docs/`：現行規範與**保留原文**的研究／ADR／歷史紀錄。
- `.agents/skills/`：按需載入的開發技能，不是遊戲執行端自動授權。

## 操作與驗收

WASD／方向鍵移動、Shift 加速、C 或 1/2/3 切換視角；手機使用搖桿及觸控環視；桌面第一人稱點擊畫面啟用滑鼠鎖定環視，按 Esc 釋放游標，若瀏覽器不支援則保留滑鼠拖曳環視。靠近可釣魚區時以 F（手機操作鈕）蓄力拋竿／收線；E 可操作小船。時間、天氣、畫質、音量等從遊戲選單調整。

所有玩法 PR 需要程式驗證；天空／海面／材質 PR 還需固定鏡頭對照與裝置觀察。Playwright 的 mobile viewport **不是** POCO F8 Ultra 的實測。

**專案規則：** 一個正式遊戲入口、不復活舊地城或平行原型、不使用未授權素材、不繞過 main ruleset；研究和舊決策需標記狀態而非盲目刪掉。
