# 無即時溝通的雙端交接入口

本文件**不維護「目前最新 PR 號碼」**，避免內容每天過期。每次接手依固定順序查 GitHub 的即時資料，結果記回 Issue / PR 而不是新建每日進度檔。

| 查什麼 | 即時來源 | 接手時要做什麼 |
| --- | --- | --- |
| 正式程式版本 | [main](https://github.com/waydefu/Pixel-Games/commits/main) | 取 HEAD SHA，確定自己的分支是否落後 |
| 任務與負責端 | [Issues](https://github.com/waydefu/Pixel-Games/issues) | 找未被 A/B 認領的 Issue，先認領再動工 |
| 可能衝突的變更 | [Open PRs](https://github.com/waydefu/Pixel-Games/pulls?q=is%3Apr+is%3Aopen) | 檢查修改檔案、相依 PR 與「交集處理」 |
| 檢查結果 | [Actions](https://github.com/waydefu/Pixel-Games/actions) | 只採本次 head SHA 的驗證，不沿用其他提交的綠燈 |
| 線上版本 | [Pages workflow](https://github.com/waydefu/Pixel-Games/actions/workflows/deploy-pages.yml) | 確認部署成功且 SHA 與正式網站版本一致 |
| 未完成的真機／人工驗收 | Issues（標題含「驗收」，或 PR 的「驗收 Issue」欄位） | 實作 PR 合併不等於驗收完成；沒有真機結果就保持開啟 |
| 已實作的功能 | [FEATURE-STATUS](FEATURE-STATUS.json) | 保留未完成標示，改功能時更新 |
| 有效的設計決策 | [DECISION-REGISTER](decisions/DECISION-REGISTER.md) | 不沿用已被新 PR 取代的限制 |

## 快速交接語法（寫在 Issue 或 PR）

- **已完成**：提交 SHA、做了什麼、測試證據、影響模組。
- **待驗收**：哪些測試 PASS，哪些真機／使用者檢查 NOT RUN。
- **阻塞**：相依 PR、共同檔案或無法決定的功能契約。
- **下一端可接手**：可開工的具體 Issue，不寫模糊的「剩下優化」。

Agent A/B 可以不通話，但**不能沒有共同紀錄**。若兩個 PR 同時認領同 Issue，CI 會阻止後建立的新 PR；若都碰核心整合檔案，CI 要求交集說明。GitHub 只能在 PR 建立之後偵測到這種重疊，未建立 PR 前仍要靠 Issue 認領。

2026-11-08 起的治理導入 Issue：[ #37](https://github.com/waydefu/Pixel-Games/issues/37)。這個連結是起源記錄，**不是**未來永遠的開啟中事項。
