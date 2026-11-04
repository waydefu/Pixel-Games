---
name: pixel-visual-qa
description: Use when reviewing pixel art, scene readability, HUD, camera, lighting and visual consistency across desktop and mobile.
---

# 像素美術／視覺 QA

1. 先讀 docs/ASSET-POLICY.md 與 docs/QUALITY-GATES.md。
2. 區分邏輯像素／CSS 像素／DPR，檢查整數縮放、nearest-neighbor、分數縮放 fallback。
3. 視覺不只是 Bloom：檢查角色與地面對比、光源邏輯、陰影方向、層級、可互動標示、相機鏡頭及 UI 空間。
4. 在桌機和手機橫豎屏實測文字切割、touch safe area、碰撞與圖像是否對齊。
5. 若採 HD-2D，參考 Research- Luminati 研究的分層做法；不能假設上游素材可直接使用，必須檢視授權。
6. 使用截圖／對照與具體測量回報，而不是主觀稱「電影級、最高畫質」；沒有實測就標 NOT RUN。
