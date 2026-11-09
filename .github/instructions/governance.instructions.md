---
applyTo: ".github/workflows/**,.github/ISSUE_TEMPLATE/**,scripts/check-*.mjs,docs/governance/**"
---

# GitHub 治理／CI 局部工作契約

- 對應 GitHub 的即時 main／Issue／PR／Actions；優先讀當次相關 workflow、治理腳本和 `docs/CONTRIBUTING.md`，不要依日期快照猜測 CI 狀態。
- 調整 workflow、必要 Gate、認領與檔案交集時，保留既有安全邊界：真失敗仍失敗，不能因重試／取消／Skip 隱藏失敗；修改要有回歸證據。
- Ruleset、Secrets、Pages Source、付費資源與 PR 合併，需要當次 Owner 明確授權。不要因文件改動擅自變更平台設定。
- 這是匹配路徑的補充規則，根目錄 `AGENTS.md` 的通用契約仍然適用。
