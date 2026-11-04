# 2026-11-05｜Pixel-Games 獨立審查與研究資料恢復

審查基準：PR #7 合併後 `main` commit `1397b4884da81bb26f63689ffde52028596ff967`。本次審查**只以 GitHub 實際檔案、測試和提供的參考需求為依據**；不把測試通過當成美術達標。Bells of Evermere 是視覺品質目標，不是可直接拷貝的素材庫。

## A. 誤刪範圍

PR #7 把「清除舊遊戲實作」誤解為清除 35 份非遊戲資產：研究文件、歷史 ADR、工具與治理規格、8 個 Agent Skills、以及通用 Platform／Tool Registry／Renderer 相容模組和相應測試。這破壞研究來源追溯與可重用工程知識，且 `scripts/check-repository.mjs` 竟會拒絕這些資料回到 Repo。

**修正：** 恢復原始 blob 與原測試，標註歷史狀態；更新現行工具/部署/路線圖文件；將 clean check 改為只拒絕舊遊戲入口與暫存資料。玩家 bundle 仍只有唯一根入口。

## B. 已確認的原始碼問題

| 優先級 | 證據（原本狀態） | 影響 | 本 PR 修正 |
| --- | --- | --- | --- |
| P1 | `src/game/navigation.js` 限 `x>=-25`，但 `architecture.ts` 在 `x=-26` 建築、地形延伸至更西側 | 西村區域有畫面卻無法走到 | 依實際地形更新邊界，補測試 |
| P1 | `environment.ts` 只調整 `hull.rotation.z`，桅杆、船帆等留在原座標 | 船隻晃動時組件分離 | 建立整艘船 `THREE.Group` 統一輕微上下移動 |
| P1 | 房屋有碰撞，但木桶、木箱、漁市桌面沒有 | 玩家可能穿過實體場景道具 | 加入物件對應碰撞 |
| P2 | `batchStaticScene` 合併後 scene.remove(old)，但原始 geometry 仍在 resource scope 追蹤集合 | 峰值 CPU 記憶體與資源持有偏高 | `ResourceScope.release()` 釋放已無引用的舊 geometry，回歸測試 |
| P2 | `tests/navigation.test.mjs` 僅驗證單一主路與海域 | 無法發現西區不可到達與碼頭邊界 | 新增西區、碼頭邊界、道具碰撞檢查 |

## C. 尚未完成／需真機與視覺驗證

1. **實際視覺差距**：程序材質、屋瓦、角色動作與參考作品完成度仍有明顯差距；沒有證據能說「已到 Bells of Evermere 水準」。
2. **角色／遮擋**：建築目前只有方形碰撞，沒有攝影機前景遮擋淡化與可靠的路徑導覽，部分角度角色可能被屋頂蓋住。
3. **海洋與光影**：Shader 錯誤已經在 PR #7 修復，但高階 HDR/DoF、真實水面反射、陰影品質尚需比較，不應直接堆重型後製。
4. **場景可探索性**：現有碰撞仍是離散 AABB/Circle，不是完整 navmesh；增加更多建築前需做路徑與多點出生測試。
5. **效能**：RAF p95 不等於 GPU time；真機幀率／熱降頻／耗電／GPU context 恢復仍 **NOT RUN**。CI 的 mobile viewport 只驗證瀏覽器模擬尺寸。
6. **長時間穩定性**：尚沒有完整 10–15 分鐘持續探索、頻繁全螢幕切換及背景恢復的真機證據。

## D. 驗收邊界

本 PR 需完成 Node 單元測試、TS7、Vite、資產與 Playwright desktop/mobile viewport 驗證。若 CI 通過僅代表這些自動化關卡成功；**不等於視覺達標、正式部署或真機完成**。維持 PR/CI/Owner 審查與既有 Pages 部署流程，不自行改 main。
