# Pixel-Games 工程與畫面驗收門檻

**依據真實操作記錄狀態**：Unit PASS / GitHub CI PASS / Browser PASS / Device PASS / NOT RUN，互不可取代。

## 工程基線
- `npm run check`：JS 語法、首頁引用、必須文件。
- `npm run assets`：manifest schema、已登錄檔案 SHA256。**空 manifest 的 PASS 表示沒有可審查資產，不是現有資產都合法。**
- `npm test`：core + rendering 契約、context lost mock、品質上限、素材規範；**mock 不是 GPU 實測**。
- `npm run graphics:matrix`：只印配置估算，不會提供 FPS。
- GitHub Actions Checks 以該 PR/head SHA 的實際執行紀錄為準，不以 YAML 存在當 PASS。

## Three.js 真正接入後須追加的測試
1. Browser smoke：Chromium / Firefox / WebKit 能建立 WebGL2 canvas；無圖形能力時顯示有用錯誤訊息。
2. Resize：CSS、drawing buffer 和相機 aspect 三者一致；手機橫／直向、safe area、縮放不裁切。
3. Context lost：可以重現、停止渲染、通知使用者，恢復後 scene/material/texture 的實際重建有畫面證據。
4. Pixel art：明確 nearest 採樣、sRGB 正確；atlas 邊緣與遠景小物件不可不受控閃爍。
5. Scene transition：確實釋放 GPU 資源，記錄多次切換前後的 renderer.info；只靠 Texture.dispose() 不處理 ImageBitmap 原始記憶體。
6. Quality：基本／平衡／高三等級的 render buffer 上限可調整，降級不犧牲核心可用性。
7. Performance：記錄裝置型號、瀏覽器、版本、DPR、品質、場景、持續時間、p50/p95 RAF frame interval、draw calls；GPU time／VRAM／電池另由專用 profiler 或裝置數據取得。
8. 長測：裝置實測才可描述掉幀、發熱與耗電；目標 60fps（16.67ms）或 30fps fallback（33.33ms）不是保證。

## 第一款遊戲才需測
- 遊戲操作、鍵盤／觸控／手把（實際使用者指定），玩法回饋、碰撞／相機／地圖可通行性、暫停與背景恢復。
- Canvas/WebGL 的視覺物件不是物理碰撞：需要一致的碰撞與生成路徑測試。
- 社交／排行榜／存檔／網路服務若尚未批准，不需提前建立測試與憑證。

## 證據格式

```text
Commit / branch：
Check 層級：Unit / CI / Browser / Device
裝置 / OS / 瀏覽器 / 版本：
Viewport CSS px / DPR / Quality / Render buffer：
動作、測試時長及場景：
CPU RAF p50/p95： （不是 GPU time）
Renderer calls / triangles / texture / geometry：
觀察 / 螢幕截圖／Trace：
結果：PASS / FAIL / NOT RUN
缺陷、回退與待決：
```

研讀 [Three.js 研究備忘](research/THREEJS-ENGINEERING-2026-11-04.md) 和 [實作架構](ARCHITECTURE.md)。
