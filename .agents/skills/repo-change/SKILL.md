---
name: repo-change
description: Use for repository architecture, CI, dependency, security and governance changes using research-backed evidence and explicit approval.
---

# Repo 工程／治理變更

1. 讀 AGENTS.md、docs/INDEX.md，再只讀相關 Research- 來源和精確檔案。
2. 分清 Owner 已授權與需要另行決策的資安、Secrets、Actions 權限、Ruleset、部署、合併。
3. 優先最小依賴和確定性檢查；新工具需有問題／成本／回退策略，別把候選 MCP 當已安裝。
4. 從工作分支提出小範圍 PR，附實際測試命令、來源日期和未驗證事項。
5. 只可依真實 GitHub Checks／實驗結果宣稱通過；CODEOWNERS／YAML 不等於執行層級強制。
6. 不自動合併、不重寫預設分支、不跨 Repo 修改。
