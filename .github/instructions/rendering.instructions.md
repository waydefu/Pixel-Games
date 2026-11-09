---
applyTo: "src/rendering/**,src/game/ocean.ts,src/game/cloud-*.ts,src/game/fjord.ts"
---

# Rendering / Shader 局部工作契約

- 先從 `docs/INDEX.md` 路由到渲染模組，定位當次的 shader/pass/function；只有改到整體生命週期時才擴讀 `docs/ARCHITECTURE.md` 和 `docs/QUALITY-GATES.md` 的相關節。
- 反射、雲影、海水與後製的 Render Target 切換不能破壞主場景；確認資源擁有者、釋放與 Context Restore。修改 Shader 同時檢查編譯錯誤與可見畫面，不只 grep 原始碼。
- 同 SHA／鏡頭／天氣／品質設定提供影像 A/B；效能宣稱需同設備測量，SwiftShader 與手機 viewport 不等於 Android 真 GPU。沒有實際證據標 `NOT RUN`。
- 維持單一正式遊戲入口；所有 PR 與 Owner 合併規範以根目錄 `AGENTS.md` 為準。
