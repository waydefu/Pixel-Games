# Pixel-Games｜P1 視覺品質：外部實作對照與程式差距整合報告

**開工排程更新（2026-11-05）**：本研究保留技術證據與採用邊界；G1～G6 的**唯一現行實作順序、狀態及景深／泛光核准**改依 [P1 超進化總計畫](../plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md)，過去研究內「候補／待決策」不再用來否定 Owner 的新授權。故障教訓只記錄在[踩坑紀錄](../governance/VISUAL-PITFALLS-LOG.md)。

> **唯一現行研究入口** · 2026-11-05 · 文件狀態：研究完成、實作未開始 · 原始研究附於本文末「來源與保留紀錄」。
>
> **比較版本**：已部署主線 [main@63837d9](https://github.com/waydefu/Pixel-Games/tree/63837d9d281e7366f6def261f0ec5b2110c5a0ca)；P1-R3 待合併 [PR #11@09ab7e6](https://github.com/waydefu/Pixel-Games/pull/11)。版本資訊是研究時點快照，**並非即時部署狀態**；後續改碼須重核 HEAD。
>
> **Owner 已定限制**：海洋項目**只做缺陷修正，不學高成本海洋專案**；不導入 `ocean.min.html`、FFT 多 cascade 波浪、SSR／平面反射、重型白浪場、水下折射或額外水體渲染 Pass。保留目前的輕量海水。
>
> **成果定義**：此文件是可追溯的程式碼研究與決策清單。**沒有**宣稱已完成視覺 A/B、手機 FPS、真 GPU timer 或任何功能實作。外部作者的效能聲明不可當成我們的量測值。

## 0. 執行摘要與優先次序

**結論**：我們的問題不在 Three.js 的能力上限，而在「基本幾何過多、物件變體不足、近景材質只靠 Albedo、場景日照／霧／色彩未完全共享、畫面品質缺少固定鏡頭驗收」。現有 `InstancedMesh`、材質合批、三視角與畫質預算仍應保留，**不能為了追求畫質全部推翻重做**。

| 順序 | 工作包 | 當前問題與直接可見的收益 | 狀態／限制 |
| --- | --- | --- | --- |
| **1 / P0** | P1-R3 渲染正確性 | 統一太陽／陰影與天空，處理自訂 Shader 色彩／霧，修正無法觸發的山體雪線 | **待修、待截圖** |
| **2 / P0.5** | 固定視覺基準 | 斜角／第一人稱／遠景／手機固定鏡頭，參考圖＋A/B＋Shader log | **尚未建立完整金標** |
| **3 / P1** | 精緻街區與材質 | 1 棟房屋、1 棵樹、1 段岩壁、1 段道路／海岸：近景輪廓、凹窗、屋瓦、石材與草地 | **先切片，不全城重做** |
| **4 / P1** | 非海洋渲染品質 | 建築／地形材質、陰影、曝光、可選輕量 AA／色彩；逐項 GPU 成本 | **不可偷渡重型海水** |
| **5 / P2** | 實機效能與大世界 | 空間 Chunk、LOD、分項畫質、影格／GPU 指標 | **量測有瓶頸才實作** |
| **排除** | 高階海洋和離線電影效果 | 專用 FFT、水下光學、反射、多重累積成片 | **不列待辦** |

**判定規則**：P0 = 已有程式證據、優先修正；P1 = 品質缺口或規格未接線，需 A/B；P2 = 擴張後效能風險，須先測。美術優劣（觀感）不可用單一測試或別人的 GPU 數字判定。

## 1. 已能從程式確認的 P0 問題

### P0-A｜太陽方向分裂：天空、陰影、海面高光未共享同一光源

- **證據：** PR #11 [`fjord.ts` 第 85 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/fjord.ts#L83-L90) 使用 `normalize(vec3(-.60,.30,-.74))` 當天空太陽；[`environment.ts` 第 148–165 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/environment.ts#L146-L165) 中 DirectionalLight 相對玩家固定方向為 `(-19,25,-10)`。兩個**正規化向量夾角約 37°**，不是同一束陽光。[`ocean.ts` 第 60 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/ocean.ts#L55-L62) 另寫一組高光方向。
- **結果：** 天空太陽、地面投影、海面 glint 的方向可能彼此矛盾；不需增加多邊形也應優先修正。
- **建議：** 新增單一 `SunEnvironmentState` 或等價共享參數，由同一方向向量推導 `DirectionalLight`、天空 uniforms、水面 glint／顏色，避免不同檔案各寫 magic numbers。
- **驗收：** 三個系統方向差 < 1°（計算檢查）；固定時刻三視角截圖一致；保留玩家移動時 Shadow Camera 跟隨行為。

### P0-B｜自訂 Shader 的霧、Tone Mapping／Color Space 並未統一

- **證據：** [`world.ts` 第 17–20 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/world.ts#L17-L20) 有 `FogExp2`；[`ocean.ts` 第 9–10、72–75 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/ocean.ts#L9-L10) 的 `ShaderMaterial` 無 `fog:true`／fog chunks，卻有 tone mapping 和 color-space chunks；[`fjord.ts` 第 58–104 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/fjord.ts#L58-L104) 天空 `fog:false` 且直接 `gl_FragColor`，未在自訂片段內做相同輸出轉換。[`main.ts`](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/main.ts#L140-L149) 啟用 ACES／sRGB。
- **結果：** 漸層天空、霧化建築和遠方海水有產生亮度／顏色分界的風險；**是否肉眼可見仍要 A/B 實測**。
- **建議：** 訂定 linear → tone mapping → sRGB 的共同契約；水面接入 scene fog 或一致的解析式霧；天空作為背景要依設計明確處理輸出轉換，避免未經測試盲目重複轉換。
- **驗收：** HDR／LDR 色彩對照、不同曝光與霧密度的截圖，沒有海天突變、Shader 編譯錯誤；`main` 和 PR #11 A/B 同參數。

### P0-C｜P1-R3 山峰雪線條件是死分支

- **證據：** [`fjord.ts` 第 30 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/fjord.ts#L27-L33) 只有 `h > 126` 才出現雪色；[`terrain-profile.js` 第 17–19 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/terrain-profile.js#L14-L19) `summit = 24 + 56 * ridge + 18 * abs(wave)`、`small` 最大 5.8。依 `|wave| <= .88`、`ridge <= 1`、`slope <= 1`，產生高度上界約 **101.64**；永遠達不到 126。
- **結果：** 目前雪線調色不生效，這是明確的可靜態驗證問題。
- **建議：** 依實際高度分布調整 `snowStart`，把閾值做成可測參數；是否要積雪還要配合海岸季節與美術設定，不能自動把所有山頭塗白。
- **驗收：** 新增高程樣本或 property tests，驗證雪線在設定啟用時可達，禁用時不出現；保留自然坡度。

## 2. 其餘程式級差距（P1／P2）

> 以下項目有些是**設計缺口**、有些是**尚未接入的功能**，不可全部稱為線上漏洞。原審查中「缺少真正海面反射」僅保留為技術事實：**不開修復任務，因 Owner 已決定輕量海面足夠**。

### P1-B｜材質只生成 Albedo 色塊，近景缺乏法線與粗糙度資訊

- **證據：** [`art.ts` 第 34–35、90–112 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/art.ts#L90-L112) 所有程序紋理預設 `96 × 96` Canvas；`MeshStandardMaterial({ map, roughness:.94, metalness:0 })`，無 `normalMap`、`roughnessMap`、`aoMap`。其設計適合低解析像素風，但第一人稱特寫容易失去表面層次。
- **對照：** [Three.js MeshStandardMaterial](https://threejs.org/docs/#api/en/materials/MeshStandardMaterial) 支援物理材質通道；風格化作品可選擇性使用，不代表所有物件都要 PBR 寫實。
- **建議：** 先選「石牆、木板、屋瓦、地面」四種材料做 A/B：保留 NearestFilter／像素美術語言，針對重要表面補低頻 normal/roughness 變化和少量實體厚度；驗收後再擴充材質庫。
- **驗收：** 第一人稱距牆 1–3 m、斜角中景的相同光源 A/B；表面不塑膠、不破壞像素風；材質貼圖成本需入帳。

### P1-C｜建築、樹木與村落內容密度仍屬展示切片

- **證據：** [`architecture.ts` 第 175–184 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/architecture.ts#L175-L184) 有六棟硬編碼房屋，屋頂主要透過兩塊斜面；P1-R3 已從貼在實心牆上的窗改為挖孔分割（第 95–131 行）。[`environment.ts` 第 94–115 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/environment.ts#L94-L115) 樹木是 Cylinder 樹幹加多個 Icosahedron 樹冠，有 16 組硬編碼樹位。
- **結果：** 清晰但模組重複、形體可辨識為基礎幾何，無法只靠進階後處理掩蓋；新窗洞也不等於可進入室內。
- **建議：** 建立房屋零件 grammar（屋瓦、窗框、木梁、門柱、台階、煙囪與生鏽／磨損變體），一棟精緻房屋 + 一棵樹 + 一段碼頭 + 一小段海岸先達標，再利用程序式組裝產生變化；優先自製資產或取得可核驗授權的 glTF。
- **驗收：** 近景和中景 silhouette 可辨、房屋風格一致；同視角與目標參考做人工評審；資產 license/hash 完整。

### P1-D｜地形噪聲尺度和著色邏輯過於簡單

- **證據：** [`terrain-profile.js`](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/terrain-profile.js) 由多組 sine 和 ridge 產生高度；[`fjord.ts` 第 12–43 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/fjord.ts#L12-L43) 以高度／坡度控制頂點色彩、平滑法線；沒有山體法線材質細節與獨立地貌紋理。
- **對照：** [Three.js 官方程序地形](https://github.com/mrdoob/three.js/blob/r187/examples/webgpu_tsl_procedural_terrain.html) 使用噪聲疊代／Domain Warp／不同地貌顏色。
- **建議：** 高度場改成大中小三級地形輪廓；加入 slope/height/erosion 可調 mask 和材質分層；保留峽灣出海口與玩家活動區一致性；不直接換渲染後端。
- **驗收：** 山壁輪廓不重複、海口暢通、無矩形邊界、正常線連續；增加地形與水面不交錯回歸測試。

### P1-E｜高畫質的 `postprocess` 只是宣告，沒有實際管線

- **證據：** [`quality.js` 第 2–6 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/rendering/quality.js#L2-L6) `high.postprocess=true`；[`main.ts` 第 140–159 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/main.ts#L140-L159) 建立 `WebGLRenderer`；[`renderer-port.js` 第 90–94 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/rendering/renderer-port.js#L90-L94) 直接 `renderer.render(scene,camera)`，沒有 composer/pass 分流。
- **結果：** 選「高畫質」會提高 DPR／buffer 預算、保留陰影，但**不會**自動出現 Bloom、AO、景深或色彩分級。這是規格與實作落差。
- **建議：** 分開曝光／tone mapping、AA、Bloom、接觸陰影／AO 的可量測開關；逐項加入 `EffectComposer`，高畫質預設不等於把所有效果全開。遵守 [pmndrs 後處理與 Tone Mapping 指引](https://github.com/pmndrs/postprocessing/blob/main/README.md)，防止重複 tone mapping。
- **驗收：** 以 screenshot diff 和效果 toggle 證明真的啟用；Shader 沒錯，且每級有 CPU/GPU 成本表。

### P2-A｜靜態合批未按空間 Chunk 分組，未來大世界擴展有風險

- **證據：** [`batch.ts` 第 21–56 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/batch.ts#L21-L56) 將根節點 mesh 依材質、陰影狀態、render order 合併；能減少 draw calls，但合併後 bounding volume 可能跨場景，無法對中間局部物件做細粒度 frustum culling；巢狀 Group 也未納入此 loop。
- **建議：** 保留目前小場景合批優勢；真正擴建後改為 spatial chunk（例如依街區／岸段）後在 chunk 內批次；搭配 InstancedMesh、LOD／distance fade，以 A/B 避免過早優化。
- **驗收：** 代表性「村中心／碼頭／遠離村落」三個位置，實測 visible triangles／draw calls／CPU geometry build 時間／GPU time。

### P2-B｜解析度調節量測的是幀間隔，不是 GPU time

- **證據：** [`main.ts` 第 170–180 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/main.ts#L170-L180) 把 `now - previous` 當作成本；[`quality.js` 第 35–46 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/rendering/quality.js#L35-L46) 依 p95 自動降低 render scale。
- **結果：** 當瓶頸是 CPU、顯示器刷新率、瀏覽器排程或真實 GPU 其中之一，這個指標無法分辨；因此不能宣稱動態解析度已精確鎖定 GPU 瓶頸。
- **建議：** 把 RAF frame interval、CPU update/render-submit、GPU timer（若可用）分開記錄；缺少 GPU extension 就明確顯示 N/A。
- **驗收：** POCO F8 Ultra 的 5 分鐘與較長時間真機錄測；基本／平衡／高畫質各有 frame p50/p95、FPS、GPU time（可用時）、溫控狀態、場景截圖。

## 3. 外部實作索引與分類

**研究原則：** 只比較可檢查的公開原始碼與作者文件，採用相容的**技術原理**，不直接搬授權不明的資產；作者自報效能與本專案實測須區分。

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

## 4. Pixel-Games 與先進場景工程的具體設計差異

**對照方法：** 各案例都配對 Pixel-Games 現行檔案、可切出的最小實作和可測的驗收要求；不得以「研究過」代替「已完成」。

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

## 5. 建議迭代順序與實作邊界

依「**先有鏡頭與基準，再改善代表資產，最後擴充地圖**」順序處理。以下為規劃，不代表已執行。

| 批次 | 工作 | 粗估風險（不是實測） | 完成條件 |
| --- | --- | --- | --- |
| **P1-R3 正確性收尾** | 修同一太陽方向、天空／海面／霧色彩契約、積雪死閾值、岸線邊界；對 PR #11 擷取同視角實圖 | **低～中**；以現有 Shader 改常數／輸出為主 | 手機／桌機 Chromium 回歸 + 三視角截圖，Owner 確認 |
| **P1-R4A-0 美術基準** | 固定鏡頭、風格基準圖、PNG A/B、材質與畫面一致性審查 | **低**；測試與工具，不增加正式 render pass | 6 組可重現截圖，後續每個視覺 PR 有 before/after |
| **P1-R4A-1 代表街區** | 一棟可重複的房屋 grammar、屋瓦幾何、凹窗及木石表面層次 | **中**；近景模型與材質需小步調整 | 第一人稱／斜角都好看，比例正確、貼圖無明顯失真 |
| **P1-R4A-2 景觀自然度** | 近景岩壁連續性／岩石變體、道路邊緣草花與坡度／高度遮罩、三種植被外形 | **中**；控管近景素材密度 | 海岸不露底、不見平面切割線；樹、草不穿道路和牆 |
| **P1-R4C 效能與世界擴展** | 先實測再做 spatial batching、部分 LOD／Chunk；增大可探索路徑 | **中～高**；涉及場景邊界、遮蔽和記憶體 | 實機數據證明成本、無可見 pop-in／陰影消失 |
| **候補選項** | 非海水的輕量 AA、有限色彩分級 | **中**；多 Pass／tone map 有手機成本 | 影像 A/B 有收益、GPU 時間不超基準預算才合併 |

**不要做**：引進整套新引擎、實時多重反射、全場景 triplanar、多層體積雲、離線超高採樣當運行時效果；尤其完全禁止重型海洋路線。凡沒數據的「性能提升 X%」、「畫質已達 AAA」均不得寫在交付報告。

## 6. 已完成的既有改善：不可重做

這些是 PR #11 中已實作的變更，**不等於**美術／真機驗收已通過。

| P1-R3 已做 | 保留原因 | 尚待核實 |
| --- | --- | --- |
| 窗框／門後退到外牆立面內側；牆面開口切分 | 比 PR #10 實心牆貼片正確 | 近景自遮蔽、窗台、門窗與 interior 的實際視覺 |
| 程序雲層；多方向水面波與 Fresnel；海口岸線修正 | 比 PR #10 空白漸層與規律 UV 海面更接近目標 | 手機 shader、天空/水面色彩、海岸邊界 |
| 高度坡度混色、平滑法線、碼頭礁石排除、光源影格跟隨 | 已對應舊問題 | 山脈細節、遠景構圖、陰影穩定與 GPU 成本 |
| InstancedMesh 草花、碼頭木板、材質批次合併 | 有效的工程基礎 | 目前場景 draw calls 真值與擴張後 chunk 成本 |

## 7. 驗證證據與品質門檻

- **同條件 A/B**：固定畫面大小、三種鏡頭、種子、太陽方向、霧、曝光和渲染模式；桌面及手機 viewport 均需截圖。
- **絕不混同**：UI／CI 通過 ≠ Shader 真正連結 ≠ 人工美術合格 ≠ 真手機穩定 60 FPS。

- **A/B 基準**：`main@63837d9` vs `PR#11@09ab7e6`；對照每次修復後的新 HEAD。固定斜角、第一人稱（靠牆與海港）、風景三種相機，固定起點、時間、sun direction、viewport、DPR、品質檔。
- **最低檢查**：`npm run validate`、`npm run test:e2e`、Chromium 桌面與手機 viewport、Shader/console errors、視角切換與 HUD hit target。**此報告未代替實際執行任何 CI**。
- **測量資料**：畫面、buffer 尺寸、draw calls、triangles、JS／GPU 記憶體（若可用）、RAF interval p50/p95、CPU time、GPU timer（若可用），記錄機型、瀏覽器、解析度和熱狀態。
- **人工視覺檢查**：遠山輪廓、窗洞深度、屋頂瓦片、材質表面、海面反射、天空／陰影方向、海岸線接縫、霧與曝光的一致性。*CI 綠不代表美術通過*。
- **效能目標**：手機 60 FPS 是目標、**不是目前結果**；若不達標，先調降反射解析度／更新率和後處理，不可拿 SwiftShader desktop viewport 假充 POCO F8 Ultra 實機數據。
- **變更邊界**：本報告是文件提案；不修改執行中的 WebGL 管線、不改 Pages、不自動合併 PR #11，也不引入第三方素材或新套件。

## 8. 技術採用／排除總決策

| 分類 | 接下來怎做 | 原因 |
| --- | --- | --- |
| **優先採用原理** | Athenaion 建築文法／Art Bible／固定鏡頭；Rock & Cliff 的近景地形接縫／三向材質測試；THREE.Terrain 坡度與草地遮罩 | 高可見收益、能小範圍試做 |
| **試點後決定** | Aetherfall 分區合批、視錐與陰影保留；材質 normal／roughness；非海洋 AA／有限色彩調整 | 須 A/B 並記錄手機成本 |
| **需要擴圖才考慮** | Terrain LOD morph／Chunk 排程；glTF-Transform／meshoptimizer | 未達效能瓶頸前不擴充依賴 |
| **明確拒絕** | `ocean.min.html` 等 FFT 海浪、Planar Reflection、SSR、複雜白浪、重型水下效果、離線多取樣即時化 | 違反 Owner 效能與設計決策 |

### 8.1｜Nightshoal（ProFactor）：非開源海港遊戲的設計與效能參考

> **分類：產品體驗／美術風格／開發流程參考，非 Three.js 程式級對照。** 官方：[Nightshoal itch.io](https://profactor.itch.io/nightshoal)｜[2026-11-04 Demo 日誌](https://profactor.itch.io/nightshoal/devlog/1751893/demo-update-the-sun-moves-and-loading-is-lighter)｜[2026-10-02 玩法日誌](https://profactor.itch.io/nightshoal/devlog/1686876/nightshoal-is-on-itch-first-public-build-windows)｜[2026-10-14 島嶼探索日誌](https://profactor.itch.io/nightshoal/devlog/1707645/nightshoal-collectables-update)。研究日期 2026-11-05；官方頁最近更新 2026-11-04。作者明示以 **Godot** 開發，主要結合 Claude Code、影像模型與 Tripo 資產。**未找到可對照的公開 Nightshoal 原始碼，因此不能斷言其內部 Shader、Chunk 實作與 FPS。** 本研究沒有下載並實玩 Demo。

| 可核實的展示／作者描述 | 對 Pixel-Games 的建議 | 邊界與採用判斷 |
| --- | --- | --- |
| 1920 年代群島、燈塔、海港、晚間返航；宣傳圖以**冷藍海天／暖黃燈塔／岸邊剪影**建立視覺焦點 | **P1-R4A 美術基準候選**：建立「夕陽港口 → 藍調時刻 → 夜晚燈塔」固定鏡頭組，比較天際線、建築輪廓、遠景層次與暖冷光比例 | 只能參考構圖和情緒，不能當作相同解析度／引擎畫質 benchmark；時代建築是 1920s，**不要照搬成中世紀世界** |
| [2026-11-04 更新](https://profactor.itch.io/nightshoal/devlog/1751893/demo-update-the-sun-moves-and-loading-is-lighter)：太陽隨時間移動，地面陰影／水面太陽高光同步，月亮有獨立路徑 | **P0 光照規格佐證**：持續沿用本報告 P0-A 的「單一環境時間／SunState → 場景光源、天空與低成本水面高光」；不要求新增高階水材質 | **官方僅敘述呈現效果，無公開 Shader 可驗證**；不得將此列成「複製 Nightshoal 程式」 |
| 同篇更新稱載入階段 GPU 記憶體約少四分之一、Cabinet 約少 1 GB；遠處港口接近時背景建置、離開後釋放 | **P2 世界擴充參考**：以海港／街區為單位非同步預載與 unload，並有記憶體上限、資源回收與進場停頓量測。現階段只有展示切片，**先量測再做串流** | 是**作者自述的改善幅度**，不是我們實測，不能移植成 WebGL/POCO F8 Ultra 的效能承諾；作者仍回報首次登岸可能卡 1–2 秒 |
| 開發日誌：航海探索、逐步顯示海圖、收穫／船艙配置、修船、港口居民委託、收藏瓶中船 | **玩法靈感庫，非 P1 必做**：未來選配自由釣魚、海圖揭露與純觀景收藏，作為自然探索動機 | **原遊戲有危險、時間壓力與主線任務**；我們的願景是無強制目標、高自由度養老。不得把海盜、返航倒數、強制主線照搬 |
| 日誌有紙質海圖、卡片、日記與燈塔導航等資訊設計 | **候選 UX**：用低干擾的地圖／日記／釣獲紀錄，HUD 不要過度遮擋風景；做操作簡便性的真機檢查 | 不代表遊戲內所有功能已完成；本階段只留研究與規格，不加 UI 模組 |

**最小可執行研究驗收（非本 PR 實作）**：
1. 固定同一斜角港灣、第一人稱碼頭與觀景視角，截取**日間／暮色／夜間**三組 A/B，對比燈塔（或我們的等價地標）在明暗與剪影下是否保持可辨識。尚未建造的地標**不得在報告寫已完成**。
2. 由同一太陽方向推導主陰影、天空和**原有廉價水面高光**，且控制色彩輸出的一致性；不增加 FFT、反射 RenderTarget、昂貴白浪或水下 Pass。
3. 未來擴圖時再記錄港口 Chunk 從預載→顯示→釋放的耗時／記憶體峰值與首進場卡頓，並對比 P1 當前小場景；沒有數據只列 **NOT MEASURED**。
4. 將 Nightshoal 歸入**視覺與玩法參考**，不列「可直接引用技術原始碼」或效能基準；素材與展示截圖僅以原作者外連，不擅自收編進遊戲素材庫。

## 9. 來源、研究留存與後續引用

**本文件為唯一現行決策入口。** 原先兩份文件留作完整研究快照以追溯引用和修訂，不應當成獨立、互相競爭的待辦清單：

- [2026-11-05：P1-R3 外部程式差距原始審查](P1-R3-EXTERNAL-BENCHMARK-CODE-GAP-2026-11-05.md)（**已被整合**，任何舊版「建議做海面反射」以本文件排除決策為準）。
- [2026-11-05：P1 擴大研究原始紀錄](P1-WORLD-VISUAL-QUALITY-EXPANDED-RESEARCH-2026-11-05.md)（**已被整合**；保留外部來源、技術對照與最小實作細節）。
- [2026-11-05：HD-2D 呈現與效果補充提案](HD2D-VISUAL-TECH-PLAN-2026-11-05.md)（**補充，不是獨立入口**；PR #11 合併後的剩餘缺陷、待 Owner 決策的移軸景深／泛光與呈現方式；遵守輕量海水決策）。
- [既有獨立程式審查](INDEPENDENT-AUDIT-2026-11-05.md)、[官方 Three.js 技術核實](../research/THREEJS-ENGINEERING-2026-11-04.md)：歷史依據，沒有改動。

**不修改其他研究或資產、不改遊戲程式、不部署、不合併 PR。** 後續每次修補，必須回填「目前 HEAD／程式差異／同鏡頭前後圖／測試與真機數據／風險」，不能只寫完成了。
