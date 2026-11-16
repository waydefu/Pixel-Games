# #146 材質配方演進

本次只處理 #145 港鎮原型的三個程序化材質配方與模型接線；未增加天候、季節或其他環境系統。舊材質索引 0–18 保留，`tileRed2` 的預設回退也保留，並補上 ID 16 的明確分支。

## 新配方與模型

- **ID 19 `saltOak`（2.4 m/tile，anti-tile 關閉）**：橡木長紋沿 UV.y，加入鹽霜漂白、潮濕暗化與板縫；同一鹽霜／濕痕／板縫遮罩影響顏色、高度、粗糙度及 AO。只接到 `src/landmarks.js` 的港口棧橋頂面木板，保留原側板與其他木構材質。
- **ID 20 `mossStone`（1.6 m/tile，anti-tile 關閉）**：錯縫石塊、灰縫、週期性近地濕帶與 Voronoi 苔斑；灰縫／濕帶／苔斑同步作用於材質通道。接到 `src/houses.js` 的建物基座石，不替換一般牆石。
- **ID 21 `linenCanvas`（1.2 m/tile，anti-tile 關閉）**：經緯交織與纖維方向紋理；依帆面 UV 保持經線沿帆高、緯線沿帆寬。只由 `src/boats.js` 的帆布網格使用（魚船與柯格船帆），不替換旗幟或其他布面。

三種 recipe 的 albedo、height、roughness、AO 與 bump 強度皆有界；整數週期的雜訊／格紋與可回繞雜湊索引是可平鋪的設計意圖。尚未做像素邊界比較或 GPU 畫面驗證，不能宣稱 tile 邊界沒有跳變。

## 有界效能審查

> 下列 22 層同解析度與雙 target 數字是材質 bank 分級前的上一批基線；本批現況以後文「共用材質包」的兩 bank 數據為準。

- 畫質設定維持原樣：low 256、med/high 512、ultra 1024；沒有降低解析度或刪減材質。`HEAD` 有 19 層，現況 22 層；新增層讓兩張 RGBA8 array texture 的 base+mipmap 理論配置增加 3 層。
- 記憶體公式：`2 張 × 4 bytes/texel × layers × size² × Σ(4^-k), k=0..log2(size)`。MiB 以 1,048,576 bytes 計；僅為理論 texture payload，不含 driver 對齊、額外配置或平台開銷。

| 畫質 | 邊長 | 舊版 19 層 | 現況 22 層 | 增量 |
|---|---:|---:|---:|---:|
| low | 256 | 13,281,912 B (12.67 MiB) | 15,379,056 B (14.67 MiB) | 2,097,144 B (2.00 MiB) |
| med | 512 | 53,127,800 B (50.67 MiB) | 61,516,400 B (58.67 MiB) | 8,388,600 B (8.00 MiB) |
| high | 512 | 53,127,800 B (50.67 MiB) | 61,516,400 B (58.67 MiB) | 8,388,600 B (8.00 MiB) |
| ultra | 1024 | 212,511,352 B (202.67 MiB) | 246,065,776 B (234.67 MiB) | 33,554,424 B (32.00 MiB) |

- 烘焙每層 albedo 與 normal/height 各一次全螢幕 pass：舊 19 層為 38 次實際繪製，新 22 層為 44 次。完整解析度輸出像素（`2 × layers × size²`）依 low、med/high、ultra 從 2,490,368→2,883,584、9,961,472→11,534,336、39,845,888→46,137,344；新增 3 層的固定 bake 工作仍增加。normal/height pass 以中心高度及 +x/+y 高度差估算法線；目前沒有可證實的跨片元快取，未改其 shader／畫質。
- 已依安裝的 Three.js 0.187.0 原始碼確認：`WebGLRenderer.render()` 每次渲染後呼叫 `updateRenderTargetMipmap()`；對 array target，`WebGLTextures` 會呼叫 `generateMipmap(TEXTURE_2D_ARRAY)`。原本每張 target 烘焙 22 層時會重建完整 array mip chain 22 次。本次設 `mipmapsAutoUpdate: false` 完成切片後，對每張 target 做一次不清畫面的空 render 觸發最終 mipmap；兩張 target 的完整鏈重建由 44 次降為 2 次，解析度及 mipmap 使用不變。
- lower-level mip texel 輸出量估算公式為 `2 targets × layers × size² × Σ(4^-k), k=1..log2(size) × rebuilds per target`；兩張 RGBA8 arrays 合計，非實測頻寬。未優化時每 target 每層都重建（22 次），本次每 target 一次：

| 畫質 | 原烘焙重複生成 | 延後一次生成 |
|---|---:|---:|
| low | 21,145,960 texels | 961,180 texels |
| med/high | 84,584,808 texels | 3,844,764 texels |
| ultra | 338,340,200 texels | 15,379,100 texels |

- `linenCanvas` 待修品質點（本次保留原視覺）：recipe 以 1.2 m tile、16 格交織，船帆 UV 又乘 0.35；有效交織格距為 `1.2 / (16 × 0.35) ≈ 0.214 m`，纖維尺度偏大。之後若調整，應依有效 UV 尺度（格距 = tile 尺度 ÷ recipe 格數 ÷ UV 每公尺倍率）校準，並做畫面驗收。

## 驗證與限制

- 上一批配方階段的紀錄：`node --test tests/material-recipes.test.js` **PASS，5/5**；涵蓋舊 ID／唯一名稱／有限尺度、GLSL 分支、通道界限、模型接線與當時雙 target 的 fake renderer 測試。本批擴充後的當前結果見「共用材質包」。
- `node --check src/textures.js && node --check src/landmarks.js && node --check src/houses.js && node --check src/boats.js && node --check tests/material-recipes.test.js`：**PASS**。
- 瀏覽器、GPU／WebGL shader 編譯、真機效能與畫面驗收：**NOT RUN**；fake renderer／靜態測試不能證明 shader 或 mipmap 結果在真實 GPU 上正確，亦未量測耗時或 FPS。
- `saint-aldric-harbour.html`：未重建、未覆寫。原有生成 HTML 的工作樹修改保留；本次沒有納入它，也未完成完整港鎮視覺願景驗收。

## 幾何／LOD 優化（#146，本批）

- 城內樹與森林樹都用 near／far 幾何 LOD。城內樹的遠景複本包含蘋果樹，並對齊 near 的三個 variant ID；Node 幾何計數測試在 quality 0.4、0.55、1 下，覆蓋 10 個城內樹種，各同 ID 的 far trunk+foliage 頂點數都低於 near。這是幾何計數證據，不是 FPS 或 GPU 時間結果；新增 far variant 會增加常駐幾何資料，實際記憶體未量測。
- 150 m LOD 邊界採 10 m hysteresis：近景狀態超過 160 m 才切遠景，遠景狀態小於 140 m 才切回；near/far 成對切換，無配對時保留唯一模型可見。主迴圈在 `game.update()` 後讀相機位置；可見性只在鏡頭位移達 0.5 m 或首次更新時重算，快速位移／傳送會在下一次畫面更新即檢查，避免固定每 30 幀延遲。
- 城內 near/far 複本仍併入原有非森林材質 batch，保留原陰影策略；森林原本的 far 陰影策略不變。兩套 instance 記錄同駐，但同一樹只顯示其中一套，GPU／記憶體實際成本尚未量測。
- 已證實風擺是 shader 頂點位移而原 foliage bounds 未含風。現在 foliage 幾何的 AABB 與 sphere 各留 0.25 m；測試按當前 shader 係數與天氣最大風速 1.0 計得最大擺動 0.2478009 m，並確認 Three.js `BatchedMesh` 取得的 sphere 保留此餘量。若日後增大風速或改 shader 係數，需同步更新界限。
- BatchedMesh 既有 per-object frustum culling 保留；沒有遮擋剔除，不測建築／城牆／門窗遮擋，也不把主鏡頭 frustum／occlusion 可見性旗標覆用到陰影或反射相機。near/far LOD 仍按主相機距離選一套幾何，並非遮擋判定。
- `tests/geometry-lod.test.js` 驗證生成樹木幾何的有限座標／法線、非零法線、索引範圍與非退化三角形；本批未做 winding 朝向、TBN、z-fight 或地形／建築接縫的目視稽核，沒有以 DoubleSide 或位移掩蓋未證實問題。
- 幾何 LOD 階段記錄（材質包擴充前）：`node --test tests/*.test.js` **PASS，9/9**；只代表當時的 Node／Three.js CPU 幾何及配方測試；本批當前整包結果見下方，瀏覽器、WebGL、GPU、手機畫面與 FPS 仍 **NOT RUN**。
- 材質包分級解析度、seeded recipe sampling 與釋放已在本批落地，詳見下方「共用材質包（#146，本批）」；沒有改 foliage 的 leaf／needle／blossom map 契約。
- `saint-aldric-harbour.html`、正式遊戲、CI、DESIGN REPORT 歷史均未由本批修改；瀏覽器／dev server／build／重型 benchmark 未執行。

## 共用材質包（#146，本批）

- 原有 22 個 ID 和模型 `aMat`／`aUv` 接口不變。ID 0–18 放在 tier 原解析度 bank，ID 19–21（`saltOak`／`mossStone`／`linenCanvas`）放半邊長 bank；兩個 RGBA8 array bank 各含 albedo、normal/height，`layerBank`／`layerIndex` 由原 ID 明確映射到 bank-local slice。烘焙與 sampling 都讀同一映射；terrain、town、boat 材質持有同一套 bank texture，不拆 mesh、不按 bank 拆 draw。
- `makeTownMaterial(tex, recipeSeed)` 提供固定整數 seed；seed 透過 CPU 一次算好的 `uRecipePhase` 只平移新配方的週期 UV，不在每幀產生隨機數、不重烘焙，也不改原配方的尺度／pattern。main 的 town／boat 使用固定 seed 101／303，terrain 預設 0；其 sampler 指向同一 bank 資源，僅取樣相位不同。Node 測試驗證同 seed 可重現、不同 seed 相位不同且 texture 物件相同。
- 沒加 bake cache：目前只有一個啟動 bake caller；現實收益來自多個材質共用同一個已烘焙 pack，而不是快取單次產物。
- Bank 化讓 fragment array sampler 由 2 增至 4。保守靜態盤點 terrain 最多 12 個 fragment texture units（4 array + mask/forest 2 + aerial sky LUT 1 + 4 CSM shadow + environment 1）；Three.js 0.187.0 `WebGLCapabilities.maxTextures` 對應 `MAX_TEXTURE_IMAGE_UNITS`，WebGL2 保證至少 16。沒有分 bank draw，因此保留現有 batching；真機編譯、實際 GPU sampler 上限／耗時仍未驗證。
- 理論 base+mipmap RGBA8 payload 公式：`2 textures × 4 B × [19Σ(S²/4^k) + 3Σ((S/2)²/4^k)]`，每組 k 從 0 到其最後 1×1 mip；不含 driver 對齊、FBO、sampler 以外 GPU 配置及平台額外開銷。相較 22 層全用 S，省約 10.23%：

| 品質 | full→detail 邊長 | 原 payload | 分級 payload | 理論減少 |
|---|---:|---:|---:|---:|
| low | 256→128 | 15,379,056 B | 13,806,192 B | 1,572,864 B (1.50 MiB) |
| med/high | 512→256 | 61,516,400 B | 55,224,944 B | 6,291,456 B (6 MiB) |
| ultra | 1024→512 | 246,065,776 B | 220,899,952 B | 25,165,824 B (24 MiB) |

- 每層仍烘焙兩次，共 44 個 layer render；每個 bank target 最後做一次隱藏 mesh 空 render，因此最終 mip pass 從 2 次增為 4 次。理論輸出像素（不含 mip）依 low、med/high、ultra 為 2,883,584→2,588,672、11,534,336→10,354,688、46,137,344→41,418,752；這是工作量估算，不是 bake 時間或 FPS。Three.js 0.187.0 源碼確認 array target 的 render layer 是 `setRenderTarget` 第二參數、mip level 是第三參數，且可讀回 active face/layer 與 mip；例外與成功路徑都在 `finally` 還原 target、layer、mip、`autoClear`，scratch geometry/material 在 `finally` dispose，半成品 target 例外時 dispose。
- `TEX.dispose()` 對四個 target 做冪等釋放，main 在非 BFCache `pagehide` 接線，並一併 dispose terrain/town/boat/glass 材質；進 BFCache 不釋放，以免返回時畫面引用已 dispose 資源。
- `node --test tests/*.test.js`：**PASS，11/11**；包含 fakeRenderer 的 bank IDs、尺寸、sampling uniforms、共用與 seed 確定性、mipmap 次數、renderer state 還原、失敗清理及重複 dispose。Node syntax check 通過。fakeRenderer 不是 WebGL；shader 實際編譯、GPU/畫面、真機記憶體與 FPS：**NOT RUN**。新 detail bank 的半解析度可能弱化細織物（尤其 linen）的近景細節，須待允許的畫面驗收確認；不能宣稱實機效能提升比例。
