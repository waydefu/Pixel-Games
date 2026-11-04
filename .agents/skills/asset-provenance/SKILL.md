---
name: asset-provenance
description: Use when adding, replacing, auditing, packaging or publishing pixel sprites, textures, sounds, fonts, glTF or third-party assets.
---

# 素材與資產流程

1. 先讀 docs/ASSET-POLICY.md、assets/manifest.json 與 AGENTS.md。
2. 對每項來源核對當下授權、作者、可否散布及是否含獨立第三方資產；MIT 引擎授權不代表所有遊戲素材都有相同授權。
3. 不從研究範例直接複製圖片、聲音、Shader、模型；新素材必須經工作範圍核准。
4. 登錄唯一 id、repo 相對路徑、author、license、source、實際 SHA256。無來源或 license 不明，**阻止發佈**而非編造。
5. 執行 `npm run assets` 和 `npm run validate`；hash 驗證通過不等於法律驗證通過。
6. 真正渲染 sprite 時檢查 alpha 邊緣／nearest／sRGB／非色彩貼圖。負載與資源卸載也要報告。
