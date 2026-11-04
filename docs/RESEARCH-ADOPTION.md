# Research- → Pixel-Games 技術採用對照

參考 repo：[waydefu/Research-](https://github.com/waydefu/Research-)（檢閱日期：2026-11-04）。**引用研究不代表工具已安裝、方案已啟用或效能已驗證**。

| 原研究 | 本專案做法 | 採用狀態 |
| --- | --- | --- |
| [Agent 權限與治理](https://github.com/waydefu/Research-/blob/main/research/2026-11-agent-repository-operations/01-governance-and-authority.md) | 精簡 AGENTS、工作分支、PR 審查、拒絕越權 | 已寫入文件 |
| [精確搜尋路由](https://github.com/waydefu/Research-/blob/main/research/2026-11-agent-repository-operations/02-search-routing.md) | `rg/git grep` → 讀最小檔案；大型索引以後再說 | 已寫入指南；未安裝索引 |
| [Agent 工作流](https://github.com/waydefu/Research-/blob/main/research/2026-11-agent-repository-operations/06-agent-workflows.md) | Locate→Verify→Plan→Test→PR；不開自動子代理 | 已寫入指南 |
| [Repo 工具治理](https://github.com/waydefu/Research-/blob/main/docs/governance/REPO-TOOLING.md) | Node 原生測試、按需 Skill、唯讀 CI | 部分已落地 |
| [Web 渲染兼容](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/06-graphics-and-compatibility.md) | 渲染能力分層，先做可測 PoC | 候選，未選引擎 |
| [畫質效能／可及性](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/07-performance-and-accessibility.md) | 幀時間、DPR、掉幀率、手機與 reduced motion 驗收 | 已寫入檢驗規格，未真機測 |
| [安全測試部署](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/08-security-testing-and-deployment.md) | SHA-pinned checkout/setup-node、read-only CI、無外部 script | 已寫入 CI |
| [創意工具庫](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/12-github-creative-ecosystem.md) | Phaser／PixiJS／Three.js 只列候選，不混裝 | 未採用 |
| [設計與效能架構](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/13-design-performance-and-architecture.md) | 動效有意義、手機優先、避免純濾鏡堆疊 | 已寫入準則 |
| [Luminati HD-2D](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/26-luminati-hd2d-browser-engine.md) | 學習渲染／資產／場景／測試的分層，不搬原始碼／素材 | 研究參考 |
| [前端開發選型](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/05-runtime-build-and-dx.md) | 初期原生 ESM＋Node 內建測試；需要 TS/Vite 時另提 ADR | 暫定低依賴方案 |

## 為什麼現在不照搬 Research- ？

- 它主要是 Markdown 研究館＋Astro 作品館，遊戲的即時更新、輸入、素材和 FPS 問題不同。
- `research_search.py` 的 SQLite FTS5 對大量 Markdown 有效；本 repo 現在檔案少且偏 JS，先 `rg` + 原始檔。
- Serena MCP 需要支援的宿主、語言、版本與最小權限驗證；光放設定檔並不代表它有啟動。
- Vite／TypeScript／PixiJS／Phaser／WebGL 可在第一個可玩垂直切片確定需求後比較，並非愈多愈好。
- 本專案現在不含上游第三方程式、音樂、圖片、Shader 或字型；一旦引入，必須查當時原始授權、存證與署名。

關於時效：表格是 2026-11-04 的研究採納快照，官方功能、版本與授權需在實際使用前重新查證。
