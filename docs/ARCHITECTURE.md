# Pixel-Games｜現行架構導覽

> 核對基準：2026-11-08 main@6056e6c。這是模組導覽，不是即時 PR 或部署狀態。歷史 P1 架構研究保留在 \`docs/reviews/\`、\`docs/plans/\` 及 ADR。

## 執行流程

\`\`\`text
index.html / styles.css
    -> src/game/main.ts (啟動、相機、輸入、UI、幀迴圈、模組串接)
       -> world.ts (目前單一海岸世界、場景與物件)
       -> camera.ts / input.ts / navigation.js (三視角、移動、碰撞)
       -> environment.ts / fjord.ts / architecture.ts / ocean.ts / boats.ts
       -> sky-live.ts / cloud-shader.ts / cloud-shadow.ts / cloud-genera.js
       -> time-of-day.js / environment-state.js / wind.js / weather.js
       -> fishing.ts / fishing-logic.js / boating.ts
       -> soundscape.ts / audio-mix.js
       -> src/rendering/renderer-port.js / hd2d-pipeline.js
    -> Vite dist -> GitHub Pages
\`\`\`

- 單一 WebGL2/Three.js HD-2D 渲染生命週期；不能因不同視角建立平行 renderer。
- \`src/game/main.ts\` 是最容易產生多端隱性衝突的整合點，PR 交集須人工確認事件／狀態契約。
- \`src/platform/\`、\`src/integrations/\` 與 \`.agents/skills/\` 是工程資產，不代表瀏覽器具備 MCP 或任意系統權限。
- \`docs/\` 保留原研究、授權證據、歷史決策；其「當時未完成」敘述不是現況。
- GitHub Actions \`ci.yml\` + \`verify.yml\`：一次建置驗證、5 個桌面／手機 Playwright 分片及必要總關卡；\`deploy-pages.yml\` 使用同一驗證流程後才發布。
- \`docs/FEATURE-STATUS.json\` 反映已整合功能；\`docs/decisions/DECISION-REGISTER.md\` 管理決策效力；GitHub Issues / PRs 管理工作生命週期。

**範圍界線：** 真手機與音訊實聽無法由 SwiftShader CI 證明；全功能存檔與統一背包目前仍屬規劃，不應把漁獲個別記錄誤作完整存檔。
