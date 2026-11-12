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
- **新素材來源**：本 PR 的沙紋、草地、石板細節、松樹樹皮與 128px 程序樹葉圖集由專案程式生成；乾／濕沙的掃描素材另見下節，已正式匯入。既有 Polyfork 樹模型授權維持不變。


## ambientCG — CC0 海灘掃描材質（Issue #126）

| 材質 | 來源 | 授權與處理 |
|---|---|---|
| 乾沙 Ground027 | https://ambientcg.com/a/Ground027 | ambientCG，Creative Commons CC0 1.0；取官方 1K-JPG Color/NormalGL/Roughness |
| 濕沙 Ground059 | https://ambientcg.com/a/Ground059 | ambientCG，Creative Commons CC0 1.0；取官方 1K-JPG Color/NormalGL/Roughness |

- 依 ambientCG 官方 [授權頁](https://docs.ambientcg.com/license/) CC0 允許加工、重製、公開再散布及商用；本專案自願保留署名，**不聲稱 ambientCG 官方背書**。
- `scripts/assets/import_ambientcg_sand.py` 是可重複執行的素材打包器；官方來源為 1K JPG ZIP，沒有複製其他人的轉檔包。
- 乾沙（左半）與濕沙（右半）分別做成 512×512、含 4px 平鋪保護區的 Atlas；色彩為 `assets/materials/ambientcg-sand-albedo.webp`，OpenGL Normal RGB + Roughness Alpha 為 `assets/materials/ambientcg-sand-normal-roughness.png`。
- 兩個檔案都在 `assets/manifest.json` 登記 SHA256；遊戲由 Vite 編譯時打包為同源本地檔案，不依賴任何第三方 CDN。
- 保留原沙材質作為載入失敗時的 fallback。Shader 以原本頂點色濕度在乾／濕影像間混合，使用世界 X/Z 座標，維持沙紋與海岸方向的設定。
- 權限與技術獨立：Grassworks 仍未匯入、未使用其商業素材；NeuralSpecOcean 仍只有技術概念參考，未複製實作。

## Quaternius — Stylized Nature MegaKit CC0 樹木（2026-11-11）

- 官方來源：https://quaternius.com/packs/stylizednaturemegakit.html（Quaternius，CC0-1.0；允許修改、商用及再散布）
- 本專案匯入 `tree-01.glb`、`tree-02.glb`、`tree-03.glb`；由 [skyline-run 公開版 GLB](https://github.com/anshaneja5/skyline-run/tree/main/public/assets/models) 取得（原檔分別為 `tree1.glb`、`tree2.glb`、`tree3.glb`），其 WebP 貼圖隨 GLB 內嵌，非即時外部 CDN。
- 這是 **手繪／風格化的遊戲用網格與樹皮／葉片貼圖**，非真實樹木掃描、非攝影測量模型。專案在執行時正規化尺寸、使用 InstancedMesh、LOD 與原本共享風場；原檔未重打包。
- GLB 確切 SHA-256 在 `assets/manifest.json`，模型載入失敗時自動回退程序樹。未引用付費 GrassWorks 程式碼。

## World Fish GLB — CC0 魚類模型（Issue #133）

| 遊戲內的魚 | 資料集種類 | 來源與授權 | 處理 |
|---|---|---|---|
| 鯖魚 | Atlantic mackerel（*Scomber scombrus*） | https://huggingface.co/datasets/codepawl/world-fish-glb，**CC0 1.0** | 取 `engine/` 層級（完整面數、無 meshopt，約 2 萬面，WebP 貼圖，約 760 KB）；檔案 `assets/models/fish/scomber_scombrus.glb` |
| 鯡魚 | Atlantic herring（*Clupea harengus*） | 同上 | `assets/models/fish/clupea_harengus.glb` |
| 鱈魚 | Atlantic cod（*Gadus morhua*） | 同上 | `assets/models/fish/gadus_morhua.glb` |
| 鰈魚（代用） | Atlantic halibut（*Hippoglossus hippoglossus*）；資料集沒有鰈屬 | 同上 | `assets/models/fish/hippoglossus_hippoglossus.glb`；載入時躺平 |
| 鮭魚 | Atlantic salmon（*Salmo salar*） | 同上 | `assets/models/fish/salmo_salar.glb` |

- 資料集的模型作者：CodePawl（World Fish）；建模方法 fish-kit method by [@nachat_dayo](https://x.com/nachat_dayo)。依 CC0 1.0 無須署名，本專案仍保留出處。
- **只使用網格與貼圖**；未修改檔案內容。選 `engine/` 而非 `lods/`：後者需要 meshopt 解碼器，約 7 KB gzip，會超過已接近滿載的 JS 預算（見 #133）。座標轉換（尾在 −x、頭在 +x、置中、縮放到遊戲的長度）在執行期完成，見 `src/game/fish-glb-frame.js`。
- 資料集其他 116 種魚未納入倉庫；`lods/`、`mobile/`、`objects/` 等其他層級未使用。


## HALOFLUX — 載入畫面的光環動畫（Issue #135）

- 來源與授權：[HALOFLUX](https://github.com/Ryder191/haloflux)，作者 Ryder191（RYDER CODE / Ms MAIKEBAIs CAT），**[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)**。完整條款與作者的使用規定在 `public/loader/HALOFLUX-LICENSE.txt`，隨檔案一起發布。
- Required Notice：`Copyright (c) 2026 Ryder191 (RYDER CODE / Ms MAIKEBAIs CAT) - https://github.com/Ryder191/haloflux`；`Noncommercial use only. Any commercial use is strictly prohibited. No commercial licenses are offered.`
- **只限非商用。** 禁止任何商業使用，包括營利、收費、廣告、贊助或捐款連結。分享本遊戲的影片或截圖時，作者要求在貼文**本文**附上 `Source: HALOFLUX by Ryder191 - https://github.com/Ryder191/haloflux`（不能只放在留言）。載入畫面下方也顯示署名與連結。
- **Owner 決定：** Waydefu 於 2026-11-12 確認本專案為非商用並同意此例外（見[決策效力表](decisions/DECISION-REGISTER.md)）。若專案日後要營利，必須先刪除 `public/loader/haloflux-worker.js`；載入畫面會自動退回只顯示遊戲日誌，不需要改程式。
- 取自作者的 `mobile.html`（commit `02174503d0f391b1bb2537b8cad75e8e5f9997f2`，SHA-256 `e1b25af46fea77125bd42210445009c5573c34cb47ff856599df9f108f8d399c`）。
- **修改說明（Modified from HALOFLUX）：** 作者的繪圖程式碼原封不動搬進 `public/loader/haloflux-worker.js` 的 `boot()`，在 Web Worker 以 OffscreenCanvas 繪製，所以遊戲載入時主執行緒再忙也不會凍住它，也不佔用遊戲的主執行緒。不收錄研究儀表板、設定面板與背景音樂（7.5 MB 的 mp3 不放進倉庫）；加上最小的 DOM 相容層與暫停／縮放／就緒訊息；像素比與幀率維持作者的設定。
- 它是程式碼、不是遊戲素材，放在 `public/loader/`（原樣複製到發布目錄），不在 `assets/manifest.json`。檔案與 SHA-256：

| 檔案 | SHA-256 |
| --- | --- |
| `public/loader/haloflux-worker.js` | `db431f554d808ac2a94f49bba3ae97bed683cf0985748a4f1d537d1cd761baa4` |
| `public/loader/HALOFLUX-LICENSE.txt`（與上游 `LICENSE` 相同） | `b0cfd4081cb8979afcc94c59055412e3585beafbf69fbf2d744cc89eef889471` |

## 550C — 載入畫面日誌與入港許可視窗的介面風格（Issue #135）

- 風格參考：Voidpocket 的 550C 場景（[html_550c](https://github.com/Voidpocket/html_550c)），經 [dsh-550c-boot](https://github.com/yannicksong0106/dsh-550c-boot)（MIT，© 2026 Ziyang Song）移植。配色、版面規則與逐行打字的節奏改寫自該場景；**程式碼為本專案重寫、所有文字為原創**。不使用 550C 的 logo、名稱、文字與其他素材。
- 上游授權狀況：dsh-550c-boot 有完整的 MIT 授權檔；Voidpocket 的 html_550c README 聲明 MIT，但倉庫內沒有 LICENSE 檔，所以只採「風格參考＋重寫」，不複製其原稿程式碼或文字。載入畫面下方顯示署名（`UI style: 550C by Voidpocket`）。

```text
MIT License

Copyright (c) 2026 Ziyang Song

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
