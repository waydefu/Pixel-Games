# Pixel-Games｜雙人異地、零即時溝通協作規則

本流程專為 **A/B 兩個獨立開發端，可能共用同一 GitHub 帳號，彼此不即時聊天**而設計。以 GitHub 作為唯一工作紀錄。目標是可預測的整合，而非增加會議或繁重文書。

## 開發端身分對照（唯一指定來源）

| 執行端 | 固定名稱 | 狀態 |
| --- | --- | --- |
| **A** | **Waydefu** | 已由 Owner 指定 |
| **B** | **cooby19** | 已由 Owner 指定 |

- 建立 Issue、PR 或交接記錄時，**Waydefu 一律填「執行端: A」**。cooby19 一律填「執行端: B」。
- 執行端 A/B 是**專案工作角色**，不是 GitHub 登入帳號、權限或 CODEOWNERS 身分。若兩端共用帳號，也必須在 Issue/PR 自行標明執行端。
- 本表只記錄 Owner 已確認的指派；A＝Waydefu、B＝cooby19。不可僅由提交者名稱或工具模型推斷執行端；異動時以新的 Owner 指定更新本表。

## 1. 開工與認領

1. 先讀 [交接入口](HANDOFF.md)，核對最新 main SHA、[open Issues](https://github.com/waydefu/Pixel-Games/issues)、[open PRs](https://github.com/waydefu/Pixel-Games/pulls) 及 CI；不可用本地或對話記憶取代。
2. 一件獨立工作用 **一個 Issue**；記錄目的、驗收標準、影響模組、相依工作、優先級 P0/P1/P2、執行端 A 或 B。只有指定執行端修改該任務；需要切換時更新 Issue 紀錄。
3. 修緊急故障可用唯一 `HOTFIX-YYYYMMDD-代號` 代替 Issue；hotfix 也要有 PR、驗收及可回退提交，不能當作免管理捷徑。
4. 比對目前 open PR 的修改路徑；若涉及同一核心模組（`main.ts`、`world.ts`、render pipeline、CI、資料格式），先在 Issue/PR 寫出接合與驗證方式，必要時分為依序合併。
5. 從**最新 main** 建個人專用分支；不要在別人的 PR 分支寫入或直接改 main。

## 2. PR 契約

每個新 PR 均需填：
- **任務**：Issue #N 或唯一 HOTFIX-ID；同一任務不得被兩個 open PR 同時認領。
- **執行端**：A 或 B；共用 GitHub 帳號也必須填。
- **影響模組**：例如 `render/sky`、`game/input`、`governance`。
- **相依 PR**：無或 #N；未合併依賴需標 BLOCKED，避免半成品先併。
- **交集處理**：若和其他 open PR 共同改核心檔案，具體列出整合方式、順序、回歸測試。未驗證不得填「已完成」。
- **驗收／回退**：自動測試、人工畫面、真機、音訊實聽分層紀錄；各寫 PASS / FAIL / NOT RUN。

`scripts/check-pr-collaboration.mjs` 會用 GitHub API 比對 open PR：**重複認領同一任務阻擋**；共用檔案預警；共用核心檔案而沒有整合說明則阻擋。對歷史 PR #35/#36 採相容模式，避免新制度無故把舊 PR 變紅。此工具不能辨認同一 GitHub 帳號背後到底是誰，也不能防止尚未開 PR 的私下重複開工，所以 **Issue 人工認領仍必要**。

## 3. 合併條件與交接

- Branch ruleset、必要 CI 和最新 main 合併檢查均通過；**只靠綠燈不等於遊戲好看或手機穩定**。
- Core overlap 完成整合回歸，且 Owner 對當次 PR 給合併授權；不要自行修改 ruleset 迴避。
- 合併後由 PR 結案關聯 Issue，並記下實際完成與待驗收的差異。若有新已落地功能，同 PR 更新 [功能台帳](FEATURE-STATUS.json)；若有重大決策變更，同 PR 更新 [決策效力表](decisions/DECISION-REGISTER.md)。
- 新端下一次開工以 GitHub 即時狀態接手，不用每天手寫「最新 PR」而形成第二套過時資料。若 CI／Pages／人工驗收沒過，Issue 保留或另外開驗收 Issue。
- 涉及外部素材保留出處與 license；不得復活已淘汰的第二遊戲入口，不可刪失效但有研究價值的紀錄。

## 4. 擴張與平台限制

現有 `Protect main` 強制 PR、必要 CI、不得 force push，但審查批准數為 0，CODEOWNERS 未被強制。**本 PR 不擅改平台權限**。Owner 若要求雙人交叉審查，需要兩個不同的 GitHub 身分，並在 Ruleset 設定 1 位 reviewer／code-owner review；兩個 Agent 共用帳號無法真正形成 GitHub 的獨立審查。詳見 [主分支保護](governance/BRANCH-PROTECTION.md)。

本流程優先監測檔案交集，**不禁止**不同任務在同一檔案並行；是否允許整合由改動的契約和回歸證據決定。
