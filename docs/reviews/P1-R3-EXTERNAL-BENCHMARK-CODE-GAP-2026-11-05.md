# P1-R3｜外部高品質 Three.js 案例 vs Pixel-Games：程式級差距審查

> 日期：2026-11-05（Asia/Taipei）｜類型：唯讀程式碼比較／修正提案｜狀態：**已完成原始碼比對；尚未完成新版真機視覺驗收**。
>
> 審查對象：
> - 已發布主線：[Pixel-Games `main@63837d9`](https://github.com/waydefu/Pixel-Games/tree/63837d9d281e7366f6def261f0ec5b2110c5a0ca)，對應合併 PR #10／P1-R2。
> - 待合併：[Pixel-Games PR #11 `09ab7e6`](https://github.com/waydefu/Pixel-Games/pull/11)，P1-R3 內凹窗洞、雲、海洋、山壁及岸線修正；撰寫時為 Draft，最新 CI 已通過，但尚未合併。
> - 依賴版本：[Three.js r187](../../package.json)（`three: 0.187.0`）。外部參考優先固定 r187，避免用未來新版 API 誤導。
>
> **Owner 更新決策（2026-11-05）**：本階段**禁止導入重型海水渲染**，包括 FFT／多 cascade 波浪模擬、Planar Reflection、SSR、水下折射、持續性白浪場與額外水體渲染 Pass。僅允許修正目前低成本海面的霧、色彩、Shader 穩定性、接縫等必要問題。本文件舊版建議若與此衝突，以此更新為準。
>
> **擴大研究**：額外自行篩選 Athenaion、Aetherfall、程序岩壁、THREE.Terrain、LOD/Chunk、程序城市、Meshoptimizer 與 glTF 資產管線等，詳見 [P1-WORLD-VISUAL-QUALITY-EXPANDED-RESEARCH](P1-WORLD-VISUAL-QUALITY-EXPANDED-RESEARCH-2026-11-05.md)。
>
> **結論：** 現有架構足以支撐小型 WebGL2 海岸視覺切片；畫面品質距離高階作品，主要差在**模型輪廓／材質表面資訊／光照與天空一致性／水面場景反射／多尺度地貌／後處理完整性**，不是單一 Shader 不夠複雜。不得把程式審查、CI 成功等同於美術合格或手機 GPU 驗收。

## 1. 外部對照來源與採用邊界

| 原始來源（可檢查程式） | 實際技術證據 | 對本專案有用的方向 | 不應推論 |
| --- | --- | --- | --- |
| [Three.js r187 Water.js](https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Water.js) | `mirrorCamera`、`WebGLRenderTarget`、`mirrorSampler`、`textureMatrix`、Fresnel 與表面法線 | 把**實際場景反射**與廉價天空近似分為不同畫質級別 | 不能假設水面反射無成本，也不代表手機直接能上高解析反射 |
| [Three.js r187 Sky.js](https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Sky.js) | `sunPosition`、Rayleigh/Mie 散射參數、雲層密度與速度、色調／輸出色彩處理 | 單一太陽方向和天空參數同步更新光照、水面、天空 | 不是原封套用 Sky.js 就可得到商業級體積雲 |
| [Three.js 官方程序地形示例](https://github.com/mrdoob/three.js/blob/r187/examples/webgpu_tsl_procedural_terrain.html) | Domain warping、多階噪聲、坡度法線、草／岩／雪依地貌混合 | 將地形輪廓與材質的尺度拆開設計，先在現有 WebGL2 管線重現原理 | 示例使用 WebGPU/TSL；**不能**不經遷移直接貼進 WebGL2 GLSL |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing/blob/main/README.md) | `EffectComposer`、`RenderPass`、`EffectPass`、HDR framebuffer 與輸出 Tone Mapping 的處理規則 | 分離「選單宣稱的後處理」和「實際執行的渲染管線」 | 不能僅裝套件就宣稱 Bloom／AO 已啟用 |
| [froog/pixel-town-poc：batcher.js](https://github.com/froog/pixel-town-poc/blob/main/src/town/batcher.js) | `mergeGeometries` 依材質 bucket 合併，作為靜態批次設計案例 | 肯定批次合併本身可行；世界變大後仍需空間分區 | 不能以任何 PoC 的畫面當成已量測的 FPS 或品質優勢 |

> 美術比較還需固定**相機、時間、光源、解析度、畫質模式**取得 A/B 截圖。本文件只列經程式驗證或明確標為待測的差異；外部案例未做同硬體 FPS 比較。除技術原理外，不直接複製他人遊戲素材或程式片段。

## 2. 可以從程式確定的缺陷與差距

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

### P1-A｜海水有 Fresnel，卻沒有真正的場景反射

- **證據：** [`ocean.ts` 第 48–71 行](https://github.com/waydefu/Pixel-Games/blob/09ab7e6b7d4827eaea88d0f337d555d6b7d3888c/src/game/ocean.ts#L47-L75) 用兩個固定 `vec3` 天空色和 `reflect()` 近似反射，並加入噪聲、岸線泡沫；**沒有**場景反射 RenderTarget／鏡射攝影機。對照 [Three.js r187 Water.js](https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Water.js)，會把鏡射場景渲染到反射貼圖。
- **結果：** 無法反映船、碼頭、山脈的實際影像；第一人稱近水面看尤其明顯，但 P1-R3 比原本規律 UV 亮條紋已前進一步。
- **建議（依 Owner 最新決策修訂）：** 繼續使用現有低成本天空近似；**不做** Planar Reflection、SSR、FFT 或其他海水高階效果。只修正既有霧、色彩及 Shader 相容性。
- **驗收（修訂）：** 只檢查現有海面的視覺連續性、效能和相容性回歸，不進行高成本反射 A/B 或導入新水體渲染 Pass。

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

## 3. 已改善部分，避免重做

| P1-R3 已做 | 保留原因 | 尚待核實 |
| --- | --- | --- |
| 窗框／門後退到外牆立面內側；牆面開口切分 | 比 PR #10 實心牆貼片正確 | 近景自遮蔽、窗台、門窗與 interior 的實際視覺 |
| 程序雲層；多方向水面波與 Fresnel；海口岸線修正 | 比 PR #10 空白漸層與規律 UV 海面更接近目標 | 手機 shader、天空/水面色彩、海岸邊界 |
| 高度坡度混色、平滑法線、碼頭礁石排除、光源影格跟隨 | 已對應舊問題 | 山脈細節、遠景構圖、陰影穩定與 GPU 成本 |
| InstancedMesh 草花、碼頭木板、材質批次合併 | 有效的工程基礎 | 目前場景 draw calls 真值與擴張後 chunk 成本 |

## 4. 修正包切分（不能把提案當完成）

1. **P1-R3 收尾／P0 缺陷包**：共享日照方向、校正 Shader 輸出與霧、修雪線死分支；新增針對性測試。只動相關檔案，不擴充玩法。
2. **P1-R4A 資產樣板**：限定 1 棟房屋、1 棵樹、1 段碼頭、1 段海岸；做新舊 A/B，確認風格和近景再批量產出；不要先大改整個城。
3. **P1-R4B 渲染樣板**：聚焦非海水的建築、植被、天空／地形材質與輕量色彩處理；任何 compositor 需經手機實測，**排除**高成本海水效果、Planar Reflection／SSR／FFT；保留 WebGL2 fallback。
4. **P1-R4C 效能測試與擴建門檻**：同一場景同一裝置測量實際 GPU／CPU 成本；通過後才擴大地圖、LOD／Chunk 和更多活動物件。
5. **後續玩法另行決策**：釣魚、NPC、職業、存檔和可攀登地形不屬於本報告的程式修補範圍。

## 5. 重現、驗收與證據要求

- **A/B 基準**：`main@63837d9` vs `PR#11@09ab7e6`；對照每次修復後的新 HEAD。固定斜角、第一人稱（靠牆與海港）、風景三種相機，固定起點、時間、sun direction、viewport、DPR、品質檔。
- **最低檢查**：`npm run validate`、`npm run test:e2e`、Chromium 桌面與手機 viewport、Shader/console errors、視角切換與 HUD hit target。**此報告未代替實際執行任何 CI**。
- **測量資料**：畫面、buffer 尺寸、draw calls、triangles、JS／GPU 記憶體（若可用）、RAF interval p50/p95、CPU time、GPU timer（若可用），記錄機型、瀏覽器、解析度和熱狀態。
- **人工視覺檢查**：遠山輪廓、窗洞深度、屋頂瓦片、材質表面、海面反射、天空／陰影方向、海岸線接縫、霧與曝光的一致性。*CI 綠不代表美術通過*。
- **效能目標**：手機 60 FPS 是目標、**不是目前結果**；若不達標，先調降反射解析度／更新率和後處理，不可拿 SwiftShader desktop viewport 假充 POCO F8 Ultra 實機數據。
- **變更邊界**：本報告是文件提案；不修改執行中的 WebGL 管線、不改 Pages、不自動合併 PR #11，也不引入第三方素材或新套件。

## 6. 給 Owner 的決策

**建議先讓 P1-R3 的可證實缺陷修好並做畫面驗收，再做 P1-R4A。** 在場景幾何、材質一致性不足時，一次引進 SSR、SSGI、FFT、水下折射、體積雲與景深，成本高且會混淆美術驗收與效能瓶頸。**其中進階海水效果已由 Owner 明確否決，不是後續的候選任務。**高階 Shader 應該為美術目標服務，而不是當成美術品質的替代品。

> 外部來源僅支援技術差異，不代表相同硬體的效能優劣；尚未完成的美術評分、FPS 或 GPU 時間，一律記為 **NOT MEASURED**。原有研究、ADR、Skills、單一遊戲入口與原創素材授權界線維持不變。
