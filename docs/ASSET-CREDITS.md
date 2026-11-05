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

授權紀錄以 `assets/manifest.json`（含 SHA256）為準；manifest 自填內容不是法律證明，使用前請再對照 Polyfork 當時的條款。
