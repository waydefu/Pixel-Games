# 第三方素材署名（Asset credits）

專案其餘素材為程式繪製的原創內容（見 [ASSET-POLICY](ASSET-POLICY.md)）。以下是唯一的第三方素材。

## Polyfork — Medieval Village Kit 等免費低多邊形模型

- 來源與授權：[polyfork.dev](https://polyfork.dev/)，免費低多邊形模型的 GLB 網格檔以 **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** 使用（Polyfork 的[授權條款](https://polyfork.dev/licensing)原文：網格檔可在署名並標明修改的前提下使用、修改、散布與商用）。
- 選用 CC BY 4.0 而非 Polyfork 授權的原因：Polyfork 授權不允許再散布檔案本身，而本倉庫是公開的；CC BY 4.0 明確允許。
- **只存放 GLB 網格檔。** Polyfork 的 ES module（`.mjs`）與 HD 版本只受 Polyfork 授權，**不得**放進本倉庫。
- **修改說明：** 載入後烘焙節點變換、重設原點與縮放以符合場景地塊；頂點色以著色器降低飽和度，並加上世界座標像素顆粒與明暗分段（以 `src/game/village-kit.ts` 在執行時處理，原始檔案未被改寫）。
- Polyfork 沒有為本專案背書；此處不使用其名稱或標誌暗示贊助。

| 模型 | 署名（可複製） | 來源頁 |
| --- | --- | --- |
| Village Tavern | Village Tavern by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/village-tavern-4e94e3 |
| Two-Story House | Two-Story House by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/two-story-house-40f6dc |
| Thatched Cottage | Thatched Cottage by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/thatched-cottage-0e63f5 |
| Stone Chapel | Stone Chapel by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/stone-chapel-03e774 |
| Timber Barn | Timber Barn by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/timber-barn-90b3ce |
| Blacksmith Forge | Blacksmith Forge by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/blacksmith-forge-09fa85 |
| Stilted Granary | Stilted Granary by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/stilted-granary-3e7d7d |
| Fisherman Shack | Fisherman Shack by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/fisherman-shack-ea9b2b |
| Market Stall | Market Stall by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/market-stall-94937d |
| Village Well | Village Well by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/village-well-f8e361 |
| Barrel | Barrel by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/barrel-aadc94 |
| Wooden Crate | Wooden Crate by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/wooden-crate-b9c96a |
| Haystack | Haystack by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/haystack-77b0dd |
| Wooden Cart | Wooden Cart by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/wooden-cart-bf83d8 |
| Signpost | Signpost by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/signpost-8287c3 |
| Drying Net Rack | Drying Net Rack by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/drying-net-rack-93ec3b |
| Oak Tree | Oak Tree by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/oak-tree-50ee7c |
| Orchard Apple Tree | Orchard Apple Tree by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/orchard-apple-tree-b21f85 |
| Wooden Fence | Wooden Fence by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/wooden-fence-3d8ee7 |
| Rowboat | Rowboat by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/rowboat-c42d85 |
| Ship's Longboat | Ship's Longboat by Polyfork, CC BY 4.0 | https://polyfork.dev/asset/ship-s-longboat-f159fd |

授權紀錄以 `assets/manifest.json`（含 SHA256）為準；manifest 自填內容不是法律證明，使用前請再對照 Polyfork 當時的條款。

## 程式碼來源（非素材）

| 項目 | 來源與授權 | 用途 |
|---|---|---|
| AgX tone mapping 的對比多項式與色彩矩陣 | [Noniv/web-ocean](https://github.com/Noniv/web-ocean)，**MIT**（AgX 本身出自 Troy Sobotka）；Noniv 的 WGSL 轉為 GLSL | `src/rendering/hd2d-pipeline.js` 的合成通道（取代原本的 ACES 擬合；`?tone=aces` 可切回做 A/B）。同一倉庫的海水體色（混濁藍綠）只作美術參考，沒有複製其 FFT 海面程式 |
| 十雲屬雲層的做法（形態分類、天氣到雲屬占比、受光與日暈公式的思路） | [takustaqu/atmosphere](https://github.com/takustaqu/atmosphere)，**MIT**；只採用公開的技法描述與參數量級，程式碼為本專案重寫（`cloud-shader.ts`、`cloud-genera.js`） | 天空雲與雲影；天氣占比的曲線、尺度與色彩為本專案自行調校 |


### 2026-11-10｜海岸與植被技術來源（Issue #126）
- **NeuralSpecOcean**（bgbg108555，MIT）｜https://github.com/bgbg108555/NeuralSpecOcean — 研究它的共享海床／岸線及水深驅動碎浪構想；本次修正為自有程式實作，保留現有 Three.js `Water`、海面反射與泡沫。**未複製上游 CFD、PINN、GPU SwashRig 或 GLSL／JS 程式碼**。
- **Grassworks / Tech Redux**｜https://grassworks.techredux.co/forest-demo — 僅研究分區植被、草葉／Billboard 與 LOD 策略；未購買、未複製商業套件與展示素材。
- **新素材來源**：本 PR 的沙紋、草地、石板細節、松樹樹皮與 128px 程序樹葉圖集全部由本專案程式生成，沒有新增外部二進位素材。既有 Polyfork 樹模型授權維持不變。
