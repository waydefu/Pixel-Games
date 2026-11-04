---
name: pixel-visual-qa
description: Use for pixel art scene quality, legibility, lighting consistency, HUD overlap, sprite sampling and camera/composition review across desktop and mobile.
---

# 像素美術與畫面審查

1. 先讀 docs/ASSET-POLICY.md、docs/QUALITY-GATES.md。
2. 定義原始 sprite 像素、Three.js world unit、CSS viewport、drawing buffer 與 2D 邏輯像素的關係；不能混成一個值。
3. 檢查 SpriteMaterial vs Mesh 材質：不受光材質不會因點光源自動出現真實陰影。
4. 圖像要清晰可讀，光影要有合理方向與功能；除非需求明確，不做無意義 bloom / plastic glare / 滿屏裝飾。
5. 檢查色彩空間、pixel filtering、atlas bleeding、景深是否破壞像素邊緣；手機橫直向 UI 不遮主角。
6. 沒有畫面截圖／Browser/Device 證據不能宣稱已完成最高畫質；可列明待測。
7. 審查採用研究來源時保留作者、授權與核實日期，不把他人現成遊戲素材當原創。
