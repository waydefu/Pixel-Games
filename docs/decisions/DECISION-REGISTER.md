# 決策效力登錄｜CURRENT / SUPERSEDED / HISTORICAL

> 本次 #148／PR #147 的 Owner 決定取代舊主線；實際是否部署須查 Pages run 與 build SHA。此處管理有效決策，不是即時 PR 清單；歷史原文保留，舊基準 main@6056e6c 不再代表新主線。

| 決策或紀錄 | 狀態 | 生效依據與正確解讀 |
| --- | --- | --- |
| Saint Aldric Harbour 唯一正式主線；舊 HD-2D 僅歷史／回退 | CURRENT | Owner本次決定、#148／PR #147；[遷移決策](../mainline/MAINLINE-MIGRATION.md) |
| 單檔離線、全程式生成、四檔畫質；根入口與 CI 測新主線 | CURRENT | #148；src/harbour → dist/index.html；低720–1080、其他1080–1440，不降規作弊 |
| main browser E2E全過才部署，移除CI/Pages重複main建置 | CURRENT | verify-mainline.yml／deploy-pages.yml；required check與ruleset不變 |
| 單一 `index.html` 正式遊戲入口；中世紀海岸無強制主線 | CURRENT | AGENTS / 已合併遊戲 PR；不復活舊地城 |
| 舊 HD-2D Renderer Port／後製 | SUPERSEDED | 新主線仍用Three.js WebGL2，改為src/harbour程序材質／CSM／Post，舊renderer-port非新主線 |
| 原創與有授權資產須保留來源／修改資訊 | CURRENT | ASSET-POLICY / ASSET-CREDITS |
| PR + 必要 CI、Owner 當次決定合併 | CURRENT | Active Protect main ruleset / CONTRIBUTING |
| 舊 HALOFLUX 非商用例外（#135） | HISTORICAL | 授權及檔案保留；新正式產物publicDir:false不打包此資產，不復活作新載入畫面 |
| 釣魚、划船、天氣、合成音訊、背包、單保存、農地四季 | CURRENT | 新主線PR #145/#147；有實作不等於完整玩法／人工驗收，見FEATURE-STATUS |
| 舊十雲屬 2D 分層＋雲影 | HISTORICAL | PR #33研究保留；新主線sky.js不繼承其驗收 |
| 舊手機雲影／反射 prepass 修復 | HISTORICAL | PR #34證據保留；新主線須#120真機驗收，平面反射尚未實作 |
| 「不引入重型海水／Planar Reflection」絕對限制 | SUPERSEDED | 11/5 的 PV-024 歷史方案；PR #29 已導入官方 Water 反射，不能再拿它否決目前程式 |
| 「未加入動態天氣、音景、釣魚與日夜」 | SUPERSEDED | 舊 P1-R1 文件的當時狀態；PR #21/#27/#29/#32 已實作 |
| 28 步高畫質體積雲與 CPU 雲圖當作現行基線 | SUPERSEDED | PR #32 初版，#33 換成 ten-genera layer/shadow 方案 |
| P1 G1～G6 初版計畫中的 OPEN／TODO | HISTORICAL | `docs/plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md` 為日期快照，不能據此新開重複任務 |
| P1-R1 原美術規格、11/5 架構研究／審查 | HISTORICAL | 保留技術討論及演變，不直接覆蓋 main 程式事實 |
| `VISUAL-PITFALLS-LOG` 中未重新查證的 OPEN／RISK | HISTORICAL | 問題和假說證據保留；狀態必須對比新 PR 才能稱為當前缺陷 |
| 11/5 一次性全面重構／刪檔授權記錄 | HISTORICAL | 保留 Owner 背景；不能視為任何 Agent 可永久繞過 PR／CI／當次合併授權 |

## 更新流程

新決策改變既有設計時：(1) 同 PR 修改表格的 CURRENT/SUPERSEDED；(2) 附原 PR、Owner 指示、相容性、回退方式；(3) 保留原始 ADR/研究並加註取代資訊，不抹除歷史。(4) 功能進度要改 `docs/FEATURE-STATUS.json`，而不是只更新研究敘述。

## 舊資料使用規則

- **CURRENT**：現有工作遵循，仍需核對程式與 GitHub 最新狀態。
- **SUPERSEDED**：保留可查，但不得拿來限制新實作。
- **HISTORICAL**：僅代表當時的背景、假說、進度與驗收，不做現行待辦。
- 未定論時標「待核實」，不可把推測寫成事實；如與 Owner 最新決定衝突，以可追溯的新決定優先。
