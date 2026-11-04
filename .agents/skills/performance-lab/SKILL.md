---
name: performance-lab
description: Use when measuring frame time, GPU load, memory, thermal behavior and quality fallbacks for browser pixel games.
---

# 遊戲性能基準

1. 先讀 docs/QUALITY-GATES.md 和 Research- web performance / compatibility 文件。
2. 明確固定 commit、裝置、瀏覽器、DPR、畫面尺寸、品質設定、測試路徑和測量時長。
3. 蒐集 p50/p95 frame time、掉幀、資源載入和記憶體，必要時記 GPU context lost 與持續玩後熱降頻。
4. 分清 CPU 固定步、RAF、GPU render 時間；FPS 不是 Core Web Vitals。
5. 比較方案必須有同內容／同裝置／相同採樣；未做量測不可推定某引擎一定更快。
6. 提供 high/balanced/basic fallback 與可恢復策略，但要避免自動啟動未授權的 WebGL／外部腳本。
