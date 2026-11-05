# P1｜Three.js 高品質開放世界：跨專案程式級研究與採用門檻

> 研究日期：2026-11-05｜目的：改善 Pixel-Games **中世紀海邊小鎮**的可見品質、場景密度與手機效能。
>
> **Owner 明確限制**：海洋研究只做技術對照，**不採用** `ocean.min.html`、FFT／頻譜海浪、重型白浪模擬、Planar Reflection／SSR、水下折射或新增海水後處理；不將它們排進開發待辦。保留既有輕量水面；僅處理霧、色彩、Shader 相容與視覺接縫等必要修補。
>
> **研究定位**：靜態程式碼及原始作者說明的可信技術差距；非 FPS 實測、非已完成工程、非同硬體橫向跑分。所有新增內容是**方案與驗收規格**，**未修改遊戲功能、未安裝依賴、未合併 PR**。

## 1. 自主擴充的研究名單

不是依「最華麗截圖」排序，而依**與目前 Three.js/WebGL2 專案相容性、可獨立採用程度、近景改善與成本**排序。

| 專案（審查快照） | 讀過的具體檔案／真實做法 | 對本專案決策 |
| --- | --- | --- |
| [Leonxlnx/athenaion @ 9b8bd23](https://github.com/Leonxlnx/athenaion/tree/9b8bd23b39c458a50fb1201037360047781c45b5) | [Art Bible](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/docs/ART_BIBLE.md)、[module contract](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/docs/CONTRACT.md)、[`src/city/house.js`](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/city/house.js)、[`src/materials/stone.js`](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/materials/stone.js)、[`tools/render.mjs`](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/tools/render.mjs)；參考圖、可參數化建築 grammar、固定鏡頭、統計比對 | **採用美術規格和建築生成方法**；不移植離線多次累積、高採樣與重型體積雲 |
| [NT9712/aetherfall @ bb665c0](https://github.com/NT9712/aetherfall/tree/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e6e) | [`src/core/culling.js`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e6e/src/core/culling.js) 先距離再視錐／地形遮擋；[`src/world/vegetation.js`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e6e/src/world/vegetation.js) 攝影機追隨 6×6 草叢 Chunk、合併樹木；[`src/core/quality.js`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e6e/src/core/quality.js) 距離／密度／特效三軸分級 | **採用空間裁切和清晰分級概念**，但不直接照搬 15 萬草葉或其 fps 宣稱 |
| [maxliebscher/threejs-procedural-rocks-cliffs @ 94629ea](https://github.com/maxliebscher/threejs-procedural-rocks-cliffs/tree/94629eade34721599755b22243a5b3766f59fa98) | [`landscaping-field.js`](https://github.com/maxliebscher/threejs-procedural-rocks-cliffs/blob/94629eade34721599755b22243a5b3766f59fa98/src/landscaping-field.js) 單一 scalar field + marching tetrahedra 封閉岩壁；[`landscaping-materials.js`](https://github.com/maxliebscher/threejs-procedural-rocks-cliffs/blob/94629eade34721599755b22243a5b3766f59fa98/src/landscaping-materials.js) 以公尺為單位的 triplanar albedo／normal／roughness；[`topology-smoke.mjs`](https://github.com/maxliebscher/threejs-procedural-rocks-cliffs/blob/94629eade34721599755b22243a5b3766f59fa98/tests/topology-smoke.mjs) 檢查封閉拓樸 | **採用岩壁與地形接縫思路**；只先做碼頭周邊一小段，事先烘焙而非每幀重算 |
| [IceCreamYou/THREE.Terrain @ 344efb0](https://github.com/IceCreamYou/THREE.Terrain/tree/344efb0803482d1b3ab93fa5d4687f327a1e92c2) | [`src/grass.js`](https://github.com/IceCreamYou/THREE.Terrain/blob/344efb0803482d1b3ab93fa5d4687f327a1e92c2/src/grass.js) 讓草叢散布權重對應**高度／坡度／著色材質權重**，並使用可重現雜湊變化 | **採用地表覆蓋一致性方法**，避免植被出現在岩壁、道路與沙灘 |
| [ZyFou/ProceduralTerrains @ 8349b2c](https://github.com/ZyFou/ProceduralTerrains/tree/8349b2c8c8637f355bfe17e01c76807d41994407) | [`LodMorph.js`](https://github.com/ZyFou/ProceduralTerrains/blob/8349b2c8c8637f355bfe17e01c76807d41994407/src/engine/terrain/LodMorph.js) 對 2:1 LOD 做 geomorph 避免可見跳變；[`ChunkStreamScheduler.js`](https://github.com/ZyFou/ProceduralTerrains/blob/8349b2c8c8637f355bfe17e01c76807d41994407/src/engine/terrain/ChunkStreamScheduler.js) 以時間預算排定最近 Chunk | **列為大地圖階段方案**，不是 P1-R3 立即導入整套 editor |
| [jstrait/city-tour @ 4e35fbe](https://github.com/jstrait/city-tour/tree/4e35fbea591232f663db975b51ac0e67a74d525e) | [README](https://github.com/jstrait/city-tour/blob/4e35fbea591232f663db975b51ac0e67a74d525e/README.md)、[`src/generators/`](https://github.com/jstrait/city-tour/tree/4e35fbea591232f663db975b51ac0e67a74d525e/src/generators) 先生成**地形→道路→地塊→建築**抽象藍圖，再轉 3D | **採用城鎮規劃與資產分離的思路**，避免只增加重複房屋 |
| [donmccurdy/glTF-Transform @ 8e2a94a](https://github.com/donmccurdy/glTF-Transform/tree/8e2a94a2616d293c4b503d0fb6a4b42e6ec7c62f) | [README](https://github.com/donmccurdy/glTF-Transform/blob/8e2a94a2616d293c4b503d0fb6a4b42e6ec7c62f/README.md)：prune、dedup、meshopt、WebP／KTX2 等資產處理 | **未來有授權 glTF 模型時才採用離線壓縮**；目前以程序幾何為主，不必先裝 |
| [zeux/meshoptimizer @ f0a684f](https://github.com/zeux/meshoptimizer/tree/f0a684f11ead064e176775c9b796f82a55910e92) | [README](https://github.com/zeux/meshoptimizer/blob/f0a684f11ead064e176775c9b796f82a55910e92/README.md)：頂點重用、Overdraw、Vertex Fetch 優化、mesh 簡化 | **有大量模型後再量測導入**；不能把壓縮率當做 GPU 畫質提升 |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | [README](https://github.com/pmndrs/postprocessing/blob/main/README.md)：EffectComposer、RenderPass、EffectPass、Linear HDR 與最後 Tone Mapping | **有限採用於非海水畫面**：先解決現有色彩輸出，再 A/B 輕量 AA／細微色彩調整；禁止默默堆滿效果 |

### 排除清單（Owner 決策，不是待實作）

- [Noniv/web-ocean](https://github.com/Noniv/web-ocean)／`ocean.min.html`：WebGPU FFT、N=256／6 cascades、環境 cube、多階 Bloom 等；**整套海水渲染不採用**。其作者在 README 也表明這是純遠洋、沒有岸線和物件的專用示範。
- [Leonxlnx/open-water](https://github.com/Leonxlnx/open-water)、[Humpalumps/Ultra-Water](https://github.com/Humpalumps/Ultra-Water)、[0-robert/open-ocean](https://github.com/0-robert/open-ocean)、[reed-soul/SeedOcean](https://github.com/reed-soul/SeedOcean)、[iamtechartist/coastal-simulation](https://github.com/iamtechartist/coastal-simulation)：先前已確認各有 FFT／淺水 Solver／多 Pass／反射等，但**不適用於本階段輕量海面目標**；不以「有 WebGL2 fallback」當效能保證。
- Athenaion 的 4K 靜態圖和多採樣離線影片：**不可**拿來當手機即時 60 FPS 成果；只取可重現美術流程與經控管的幾何技術。

## 2. 和 Pixel-Games 現行實作的**具體差距**

### A｜建築：「固定六棟 Box 房屋」對「建築文法＋材質分桶」

- Pixel [`src/game/architecture.ts`](../../src/game/architecture.ts)：主場景六棟固定 house parameters；P1-R3 新增門窗實際開口，但主要仍是 `k.block` + 兩面屋頂。
- Athenaion [`src/city/house.js`](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/city/house.js) 將 geometry 依 `plaster / roof / stone / wood` 發給 per-chunk `GeoBuilder`，單棟可由多個 volume 與不同屋頂形制組裝，外觀可以保持變化。
- **最小採用**：在既有 `buildHouse` 外抽 `HouseBlueprint`（立面、屋脊、山牆、窗口、顏色、風格與種子），先重製一棟，**不一次全盤替換**；做屋瓦厚度、屋簷交接、木梁連續性、窗框凹入量與屋牆交界的第一人稱近景測試。
- **不可直接搬用**：Athenaion 的模型尺寸與希臘建築語彙不是我們的中世紀漁村資產。

### B｜岩壁：「簡單高度場／平面頂點色」對「封閉岩石結構＋實際材質層」

- Pixel [`fjord.ts`](../../src/game/fjord.ts) 把四個遠景地形區域製作成格網，依高度／坡度 lerp 頂點色；[P1-R3 `terrain-profile.js`](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/terrain-profile.js) 主要以 sin 組合控制山形。
- Rock & Cliff Lab 的 [Field](https://github.com/maxliebscher/threejs-procedural-rocks-cliffs/blob/94629eade34721599755b22243a5b3766f59fa98/src/landscaping-field.js) 提供封閉的岸石 mass、共享邊界、guarded simplification；[Triplanar](https://github.com/maxliebscher/threejs-procedural-rocks-cliffs/blob/94629eade34721599755b22243a5b3766f59fa98/src/landscaping-materials.js) 依世界座標／公尺尺度投影 albedo/normal/roughness，減少 UV 拉扯。
- **最小採用**：只對**靠玩家的一段峭壁與石塊**做離線預生成／快取；遠景仍用簡化山體。先解決「大塊塑膠山」和岸邊地形懸空，測頂點數、壓縮與畫面收益。三向貼圖有多次 texture fetch，**手機不應對全地圖全時使用**。
- **幾何驗收**：若做封閉 mesh，測 `boundaryEdges=0`、無退化三角、法線方向一致，以及 mesh 與海岸／道路接觸無穿插。

### C｜植被：「硬編碼樹木與固定草花」對「材質一致＋分區與視距」

- Pixel [`environment.ts`](../../src/game/environment.ts) 16 組硬編碼樹位、`IcosahedronGeometry` 樹冠與約 900 草葉實例；遮蔽建築主要用 Collider 來排除物件。
- THREE.Terrain [`grass.js`](https://github.com/IceCreamYou/THREE.Terrain/blob/344efb0803482d1b3ab93fa5d4687f327a1e92c2/src/grass.js) 的草覆蓋權重同時依**高度與坡度**；Aetherfall [`vegetation.js`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e/src/world/vegetation.js) 把草叢切成 **6×6 近身 Chunk**，讓 CPU／GPU 可做有效裁切。
- **最小採用**：引入分布遮罩（街道 0、山石陡坡接近 0、草地 1）；三種樹型差異，分中／遠景細節，景深外不維持樹葉幾何；小規模 A/B 先優化前景草花密度與地表接觸。
- **提醒**：Aetherfall README 的 150k 草葉是它自身 demo 特徵，**不是我們應直接設定的數量**；目前每台真機負載均 NOT MEASURED。

### D｜視錐與空間裁切：「同材質合批」對「按區塊＋陰影可見性」

- Pixel [`batch.ts`](../../src/game/batch.ts) 以 `material.uuid + shadow state` 聚合靜態根節點，合併後跨街區；`InstancedMesh` 本身還是獨立處理。
- Aetherfall [`culling.js`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e/src/core/culling.js) 依 distance → camera frustum → terrain occlusion 排除 sector，**另外保留可能影響畫面陰影的離屏投射者**。
- **最小採用**：將村莊沿街／岸邊分幾個固定 `sector`，先在 sector 內合批，再在兩個角度驗證 draw calls、visible triangles、近遠陰影；遮擋裁切一開始只作記錄／debug，避免誤刪必需陰影與角色可見道具。
- **驗收**：視角穿越 sector 邊界不出現閃爍、可見建築陰影不突然消失；功能上不增加無意義的 CPU 檢查。

### E｜大世界地形：「單次完整幾何」對「逐步串流與無縫 LOD」

- Pixel [`fjord.ts`](../../src/game/fjord.ts) 先建四區固定網格；對目前小區域**不一定**需要串流。
- ZyFou [`LodMorph.js`](https://github.com/ZyFou/ProceduralTerrains/blob/8349b2c8c8637f355bfe17e01c76807d41994407/src/engine/terrain/LodMorph.js) 用 2:1 LOD morph 在切換時使幾何貼合；[`ChunkStreamScheduler.js`](https://github.com/ZyFou/ProceduralTerrains/blob/8349b2c8c8637f355bfe17e01c76807d41994407/src/engine/terrain/ChunkStreamScheduler.js) 以預算毫秒數及附近區塊優先級處理。
- **最小採用**：只在開始真正增加可探索街區與山路後使用。先量測現有 terrain build latency、峰值記憶體與遠景跳變；未遇瓶頸前不引入龐大 terrain editor。
- **驗收**：相機移動時無可見裂縫、pop-in 與長幀；遠山幾何規模受控。

### F｜美術驗收：「CI 可跑」對「固定鏡頭＋色彩統計＋人工審美」

- Pixel 已有 Playwright 操作測試，PR #11 增加截圖；然而現有 [`e2e/visual-audit-temporary.spec.mjs`](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/e2e/visual-audit-temporary.spec.mjs) 仍屬暫存性審查程式，並非長期金標美術門檻。
- Athenaion [`tools/render.mjs`](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/tools/render.mjs) 固定 shot、可重現合成圖與參考圖 side-by-side；[`docs/ART_BIBLE.md`](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/docs/ART_BIBLE.md) 把光照和亮度統計具體化。Aetherfall [`tools/critic.mjs`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e/tools/critic.mjs) 計算 flat area ratio、edge density；這些**僅是輔助訊號，不等於美術分數**。
- **最小採用**：固定六組場景（斜角街景、斜角碼頭、第一人稱牆面、第一人稱海岸、風景遠山、手機直向），每組固定相機、曝光、太陽方向與種子；輸出 PNG、對照參考圖及每幀 metrics。色彩百分位只作回歸，不盲目以 Athenaion 的希臘畫面門檻打分。
- **驗收**：CI 測 Shader／路徑／滑鼠與觸控；美術由同一視角 A/B 人工判斷，畫面有沒有改善需要**截圖證據**，不是 README 宣稱。

### G｜三軸畫質與資產：只改 DPR 不等於可控品質

- Pixel [`quality.js`](../../src/rendering/quality.js) 有 basic／balanced／high 的 DPR 與像素上限；`high.postprocess` 目前沒有在 [`renderer-port.js`](../../src/rendering/renderer-port.js) 接入 composer。Pixel 使用 RAF frame interval 作自動降解析度，**不是 GPU timestamp**。
- Aetherfall [`quality.js`](https://github.com/NT9712/aetherfall/blob/bb665c0c67e2f1df5ed1d79e1b53ee165c8e3e/src/core/quality.js) 類型分為**距離／植被密度／效果**，以遲滯與 cooldown 降低品質震盪。
- **最小採用**：對畫質級別分別控制**陰影解析度、草葉密度、可見距離、DPR**；新增實際已啟用的 AA／曝光處理才標記。替換或引用 GLB 之前用 glTF-Transform 做去重／壓縮；若完全仍是程序幾何則先不新增模型轉碼步驟。
- **驗收**：Pixel F8 Ultra 真機 Chrome 測 FPS、frame p50/p95、GPU timing（若可用，否則 N/A）、熱降頻；保留高／平衡／基本畫質可回退，不能假定 60 FPS 已實現。

## 3. 執行順序：最大視覺收益／最小效能成本

| 批次 | 工作 | 粗估風險（不是實測） | 完成條件 |
| --- | --- | --- | --- |
| **P1-R3 正確性收尾** | 修同一太陽方向、天空／海面／霧色彩契約、積雪死閾值、岸線邊界；對 PR #11 擷取同視角實圖 | **低～中**；以現有 Shader 改常數／輸出為主 | 手機／桌機 Chromium 回歸 + 三視角截圖，Owner 確認 |
| **P1-R4A-0 美術基準** | 固定鏡頭、風格基準圖、PNG A/B、材質與畫面一致性審查 | **低**；測試與工具，不增加正式 render pass | 6 組可重現截圖，後續每個視覺 PR 有 before/after |
| **P1-R4A-1 代表街區** | 一棟可重複的房屋 grammar、屋瓦幾何、凹窗及木石表面層次 | **中**；近景模型與材質需小步調整 | 第一人稱／斜角都好看，比例正確、貼圖無明顯失真 |
| **P1-R4A-2 景觀自然度** | 近景岩壁連續性／岩石變體、道路邊緣草花與坡度／高度遮罩、三種植被外形 | **中**；控管近景素材密度 | 海岸不露底、不見平面切割線；樹、草不穿道路和牆 |
| **P1-R4C 效能與世界擴展** | 先實測再做 spatial batching、部分 LOD／Chunk；增大可探索路徑 | **中～高**；涉及場景邊界、遮蔽和記憶體 | 實機數據證明成本、無可見 pop-in／陰影消失 |
| **候補選項** | 非海水的輕量 AA、有限色彩分級 | **中**；多 Pass／tone map 有手機成本 | 影像 A/B 有收益、GPU 時間不超基準預算才合併 |

**不要做**：引進整套新引擎、實時多重反射、全場景 triplanar、多層體積雲、離線超高採樣當運行時效果；尤其完全禁止重型海洋路線。凡沒數據的「性能提升 X%」、「畫質已達 AAA」均不得寫在交付報告。

## 4. 審查範圍與下一個 PR 的最小切片

- **本 PR**：研究、來源、判斷與執行門檻；不更新遊戲、Pages、渲染設定或套件。
- **下一個可執行 PR**：只選 **P1-R3 正確性**或 **P1-R4A-0 固定視覺基準**，先有可檢驗的 before/after，再一個模組一個模組重製；非經批准不擴大功能。
- **評分框架**：幾何輪廓、材料表面、光照／天空一致性、地形與資產接觸、遠近層次、圖面構圖、GPU 成本各獨立紀錄；美術與效能不能互相代替。

> 補充：第三方展示的性能數字是作者測量或 README 陳述，未獨立重現；來源 commit 只用於可回溯程式快照，不等於推薦引入其全部程式／素材。授權與相容性於實作 PR 另行驗證。
