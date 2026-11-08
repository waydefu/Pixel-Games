# Pixel-Games｜產品路線與待驗收（不作為即時 PR 清單）

> 核實基準：2026-11-08 / main@6056e6c。此處是**有日期的版本快照**。最新 HEAD、未合併 PR、測試與部署狀態必須從 GitHub 即時查；**禁止**在此永久保存「PR #N 開啟中」等容易過時的敘述。

## 已進入 main 的功能（不等於真機驗收）

截至上述基準：單入口 HD-2D 海岸場景與三視角（#10、#21）、日夜循環和時間控制（#21、#31）、路亞釣魚（#27、#29、#30）、划船（#29）、天氣／音訊（#32）、十雲屬與雲影（#33）、手機空白幀渲染修正（#34）。

每項功能的**機器可讀狀態與原始碼證據**只維護在 [FEATURE-STATUS.json](FEATURE-STATUS.json)；改功能時同 PR 更新。已合併 PR 是程式證據，畫面品質、真機性能與穩定性需要獨立驗收。

## 長期未完成方向

- 統一背包、物品分類與漁獲整合。
- 完整存檔、自動／手動保存、存檔匯入匯出及故障復原。
- NPC 生活作息、職業扮演、可互動室內場景。
- 中世紀海邊開放世界擴展；仍無強制主線任務。
- 畫質 A/B、POCO F8 Ultra 真機效能、持續回歸與熱降頻驗收。

以上是產品方向，不代表任何一項正在被誰執行；具體工作以 Issues 認領。

## 四條不同狀態不可混為一談

1. **程式存在**：main 與已合併 PR。
2. **CI 成功**：當次 commit 的 GitHub Actions。
3. **正式發布**：對應 SHA 的 GitHub Pages deployment。
4. **玩家驗收**：真機操作、FPS／GPU／熱測與使用者視覺判斷。

## 實時工作板和交接

[待辦 Issues](https://github.com/waydefu/Pixel-Games/issues) · [開啟的 PRs](https://github.com/waydefu/Pixel-Games/pulls) · [Actions](https://github.com/waydefu/Pixel-Games/actions) · [協作規範](CONTRIBUTING.md) · [交接入口](HANDOFF.md) · [決策效力](decisions/DECISION-REGISTER.md)

G1～G6 原技術計畫、2026-11-05 審查與踩坑紀錄都是原始歷史證據，應保留並標記，不把當時的 OPEN 或 TODO 當作 11/8 最新待辦。
