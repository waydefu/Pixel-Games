# HISTORICAL：Saint Aldric 原型研究

正式主線已在 #148／PR #147 升為根入口。原 `src/` → `../../src/harbour/`；原測試 → `../../tests/harbour/`。請從 repo 根使用鎖檔及 npm scripts，不要在此重建另一個遊戲或重用歷史 package／Vite 設定。

REPORT／DESIGN／EVOLUTION 與歷史 HTML 保留，並非另一個正式遊戲入口。歷史生成 HTML 有先前未確認的本機差異，本次未覆蓋／提交／部署。正式產物由 GitHub Actions 重新建成根 `dist/index.html`。

目前有效決策、部署與回退見 [MAINLINE-MIGRATION](../../docs/mainline/MAINLINE-MIGRATION.md)。
