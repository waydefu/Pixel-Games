# Pixel-Games｜P1 超進化：唯一執行總計畫（G1–G6）

> 版本：2026-11-05；文件狀態：**開工準備完成／各實作包尚未執行**。
> 基準：`main@a8a504b3f5d1e540e7b172f1842e0e277e1f76ea`（PR #11、#12、#13 已合併）；開始每一包前必須重新查 HEAD、PR、程式與測試，不得把本日快照假裝永遠最新。
> Owner 授權：依對話將 **DoF（移軸景深）、Bloom（選擇性泛光）**與 G1～G6 超進化正式納入計畫。**這是規劃與分包授權**；實作按獨立 PR 與真機／人工門檻逐包驗收，未授權不直推 main、不自行合併或更動 Pages/權限。
>
> **本文件是唯一現行「執行排程與任務狀態」來源**。研究、技術證據以 [P1 整合研究](../reviews/P1-VISUAL-QUALITY-INTEGRATED-RESEARCH-2026-11-05.md) 為依據；[HD-2D 補充](../reviews/HD2D-VISUAL-TECH-PLAN-2026-11-05.md)保留原文，但其舊「景深／泛光待決策」已被本次 Owner 批准取代。故障與避坑只寫入[踩坑紀錄](../governance/VISUAL-PITFALLS-LOG.md)，不要創建第二份執行清單。

## 0. 北極星：我們要做成什麼

- **核心體驗**：無強制目標、可自由漫遊的中世紀海邊小鎮；先讓進入遊戲就能欣賞峽灣、港灣、街道及生活細節。斜角 Quarter View、第一人稱、觀景模式三者保留，手機觸控／鍵盤可用。
- **視覺目標**：帶有高質感模型感與手繪像素紋理的 HD-2D；房屋必有凹入式門窗與可信的結構，岩壁分層、植被自然、陰影接地；冷藍陰影與暖金光源一致，**高畫質能看到有效的 DoF＋局部 Bloom**，而不是只把場景糊掉。
- **表現重點**：場景內可跳過開場鏡頭、明信片觀景機位、柔順鏡頭切換、風／雲影／船帆／炊煙／海鷗與合法音效；保持自然、低干擾的 HUD。
- **世界觀**：低魔法中世紀沿海，不加入現代燈柱、電線、當代船隻；外部案例只借鑑技法與氣氛，不複製其素材或畫面。
- **技術邊界**：維持 Three.js **0.187.0 / WebGL2**、Vite 單頁直接進遊戲、原創或可稽核授權資產。保留 `src/platform/`、`src/integrations/`、`.agents/skills/`、研究、ADR 與治理。
- **海水硬限制**：保留現有輕量 `ocean.ts`。**不導入** `ocean.min.html` 的 WebGPU FFT／多 cascade 海浪、SSR、planar reflection、水下折射、昂貴白浪流場或新增海水 render pass。可修現有 Shader 的霧／色彩／波浪與船的位置一致性；全畫面 DoF／Bloom 雖會處理海水像素，仍須依 GPU/手機成本控制。
- **60 FPS 是目標，不是已達成果**：POCO F8 Ultra 的真機性能、GPU time、長時間熱穩定性尚未測量；不得用桌面 SwiftShader 或作者 RTX 數字當成實測。效能不達標時依效果品質 → DPR → 陰影 → 可視距／密度回退，保留高畫質選項但不強迫在所有硬體啟用。
- **非本輪玩法**：釣魚、職業扮演、商店、NPC 作息、存檔、建造、大世界生活系統是長期方向，**這 6 包不實作其玩法**；不加入強制任務、倒數、勝負或海盜壓力。

## 1. 現況基線與來源事實

| 項目 | 2026-11-05 `main@a8a504b` 已知現況 | 切記 |
| --- | --- | --- |
| 遊戲入口 | `index.html` → `src/game/main.ts`；Pages 同一入口；三視角 CameraRig 與 renderer-port `setCamera()` 已有 | 不重建 Renderer，不新增平行首頁／Demo |
| 建築 | PR #11 已做真正門窗洞和內縮玻璃；主要仍是程序房屋參數與簡單屋頂 | 近景質感需實拍 A/B，不得把「開洞」當完整建築 |
| 峽灣與海岸 | PR #11 改遠山、雲、海面延伸、碼頭礁石遮蔽與玩家陰影跟隨 | **不重做已合併成果** |
| P0 異常 | `fjord.ts` 程序天空 `sunDir=(-.60,.30,-.74)` 與場景直射光不共用；`world.ts` FogExp2；`fjord.ts` 雪線 `h>126` 不可達；自訂水材質雖 include tone/color chunks，霧／天空輸出待統一 | 靜態程式碼證據，渲染觀感仍須截圖核實 |
| 接觸與幾何 | `environment.ts` 近海小岩石只依碼頭範圍排除，未排船位；堤岸頂石純色 `#c7b99a`；`camera.ts` `standingOnPier` 使用硬編碼 +0.29 | 先做可重現座標／碰撞單測，後補美術 |
| 後處理 | `src/rendering/quality.js` `high.postprocess=true`，`renderer-port.js` 仍直接呼叫 `renderer.render(scene,camera)` | **旗標不等於已接 Composer**；DoF/Bloom 是正式工作項目 |
| 場景／效能 | `batch.ts` 按材質與陰影狀態合批，尚未按空間切；`quality.js` 依 RAF 幀間隔自調解析度 | 沒有測到真正 GPU time；不直接上大場景串流 |
| 研究與治理 | [整合主研究](../reviews/P1-VISUAL-QUALITY-INTEGRATED-RESEARCH-2026-11-05.md)、[HD-2D 補充](../reviews/HD2D-VISUAL-TECH-PLAN-2026-11-05.md)、[美術規範](../ART-DIRECTION.md)、[品質門檻](../QUALITY-GATES.md) | 研究是證據，不把舊「待決策」當今天決策；保留來源 |

## 2. 工作包總表與 PR／依賴拓樸

```text
G0 開工前：main／CI／截圖與風險快照（包含舊畫面基準）
 ├─ G1 渲染正確性、資料與物理接觸修正 ─┐
 └─ G2 固定鏡頭＋視覺回歸／效能記錄工具 ─┤ → G3 代表街區重製
                                         └ → G4 HD-2D Bloom＋DoF（須依 G2 A/B）
G3 + G4 → G5 角色、動態環境與遮擋 → G6 開場／觀景／音景與全平台驗收
                         G6 之後：若量測證明有需求，獨立啟動 Chunk／LOD／擴圖
```

- **開發包 ID**：`G1`～`G6` 是六個獨立**執行／審查 PR**，原則各包不跨界；依賴衝突時先重讀最新 main，不用已過期 SHA 盲目疊支線。各包可以按測試證據拆成子 PR（例：`G4-a` compositor skeleton、`G4-b` DoF/Bloom），但不得在 PR 開了之後無限制加需求。
- **實作狀態（2026-11-05 更新）**：**G1 第一輪已合併 [PR #15](https://github.com/waydefu/Pixel-Games/pull/15)，自動 CI PASS**（光向／霧、雪線死分支、碼頭高度、壓船礁石、堤岸頂石；**全場材質密度、美術與真機驗收未完成**）；**G2 [PR #16](https://github.com/waydefu/Pixel-Games/pull/16) 已合併且 CI PASS，六個固定鏡頭／可選 PNG 擷取與 artifact 已建立；真機 A/B 人工驗收仍未完成**；G3～G6 尚未開始。最初 G0 靜態研究基準不等於本輪有完整 A/B 圖證據。
- **授權邊界**：Owner 已允許上述整體方向與 DoF/Bloom；每個 PR 必須可審、可回退、CI 綠且實際畫面有提升。不得自動合併，沒有真機證據不得宣稱 60 FPS PASS。

| ID | 核心產出 | 主責檔案／可新增的模組（預估） | 先決條件 | 完成定義 |
| --- | --- | --- | --- | --- |
| **G1** | P0 修正＋地形／碼頭／船與裝飾物一致 | `fjord.ts`、`environment.ts`、`world.ts`、`ocean.ts`、`camera.ts`、`boats.ts`、`navigation.js`、`tests/` | G0 | 同日照、霧／色彩、雪線策略、共享地高、無壓船／可走區穿模；三視角回歸 |
| **G2** | 8 組固定視角／多時段 A/B、指標與人工審查清單 | `e2e/`、`scripts/`、`docs/QUALITY-GATES.md`、測試 fixture（需核對最小實作） | G0，可與 G1 前段並行 | 固定視角與隨機種子可重現、前後圖與尺寸／Shader log／幀指標可稽核 |
| **G3** | 第一個完整高品質港口樣板：房屋＋岩壁＋碼頭＋樹草 | `architecture.ts`、`kit.ts`、`art.ts`、`environment.ts`、`fjord.ts`、新 Blueprint / geo helpers | G1、G2 | 第一人稱 0.5m／1.5m／5m 和斜角都精緻；近景接縫、比例與材質可信 |
| **G4** | WebGL2 HD-2D Post Pipeline：Bloom、DoF、film/grade | `renderer-port.js`、`src/rendering/quality.js`、`src/rendering/post*.*`（新）、`main.ts`、`tests/` | G1 色彩契約、G2 A/B；G3 hero 有亮源 | High 明顯 Bloom＋移軸 DoF；basic 無、balanced 視成本降級；無重複 tone mapping |
| **G5** | 角色接地／遮擋、風和生活場景動態 | `world.ts`、`environment.ts`、`boats.ts`、`art.ts`、`camera.ts`、`tests/` | G3、G4 或其穩定 API | 光影與風同步，角色不被建築永久遮住，粒子少量且可關閉 |
| **G6** | 可跳過開場、明信片觀景、平順切換、音景、整體效能／相容驗收 | `main.ts`、`camera.ts`、`input.ts`、音訊模組（如需新增）、`e2e/` | G1～G5 | 直接入口維持、無強制播放／操作阻塞；桌面／手機實測、性能及回退紀錄 |

## 3. G0 開工基線（第一個開工 PR 前）

1. 重新查 `main` SHA／open PR／Actions／Pages 最新 deploy SHA；保留 `main@a8a504b` 作**研究快照**而非每包未來實作基準。若部署仍顯示舊畫面先證明是分支、Pages 或快取何者造成，不以重新上傳「另一個網站」處理。
2. 記錄 `npm ci`、`npm run validate`、`npm run test:e2e`、`npm run graphics:matrix` 結果，console Shader errors 與 Browsers／WebGL 能力；不要假裝已在本文件 PR 執行。
3. **在 G1 改畫面前留 baseline 截圖**：固定相機／viewport／DPR／seed／畫質／時間／程式 SHA，斜角街道、第一人稱牆面、第一人稱碼頭、峽灣遠景、港口泊船、手機直向、黃昏、夜間（若尚無日夜系統，將其標為 **尚不支援**，不可用假截圖代替）。
4. 做事件／缺陷入口：在[踩坑紀錄](../governance/VISUAL-PITFALLS-LOG.md)按 ID 登記發現、重現、證據、修復 PR、驗收和回退；不靠 chat 內口頭說「修好了」。
5. 核對 Three.js r187／`postprocessing`（若選用）版本相容：WebGL2、DepthTexture、透明物件、OrthographicCamera、XR/resize/context loss；依官方 API 和實際編譯決定技術選型，不先假設可以單一 EffectPass 容納每種效果。

## 4. G1｜渲染、幾何與世界資料正確性（優先 P0）

**驗證順序：先可證明的 bug，再新風格。**

| Task | 內容／實作方式 | 回歸證據與阻擋條件 |
| --- | --- | --- |
| `G1-01` | 定義一個共用的 `EnvironmentState`（sun direction、sun colour、fog horizon、ambient、time）；讓 `fjord.ts` 天空、`environment.ts` 主光／陰影、`ocean.ts` 既有低成本高光共享來源；不得引入重型水系統 | 同一時間天空太陽與物體陰影方向可對上；沒有 shader uniform 遺漏 |
| `G1-02` | 統一 linear→tone map→sRGB 路徑；解決 `world.ts` FogExp2 與自訂 Shader／天空背景契約；檢查有無雙重 output transform／重複曝光 | 斜角和第一人稱天際線無突兀色帶；高／低畫質都不曝光跳變；WebGL program errors=0 |
| `G1-03` | 驗證 `fjordHeight` 數值範圍，處理雪線 `h>126` 不可達：先由 Owner 已知中世紀場景季節風格確認「移除雪」或「重新可達閾值」，**不能直接硬加大雪景** | terrain profile 邊界與色彩測試、同鏡頭 A/B |
| `G1-04` | 將 `groundHeight(x,z)` 由 `navigation.js` 或獨立可測模型提供，取代 `camera.ts` 硬寫 `standingOnPier` 的 +0.29；保持玩家碰撞、碼頭與斜坡坐標一致 | 碼頭上下移動高度連續且不穿模；第一人稱視點符合玩家站高 |
| `G1-05` | 船位／可走區／裝飾礁石共同使用物件配置與 footprint；先修可證實的船—石頭空間重疊、碼頭附近漂浮扁石；不覆蓋 PR #11 已修的「遮擋碼頭」 | 座標不重疊單測＋第一人稱船首／岸線實圖；不能誤刪自然頭岬 |
| `G1-06` | 堤岸頂石材質與地表 texel density 校準；建議 32 px/m **只是候選規格**，先用第一人稱近景採樣驗證；避免全場景一次改 texture repeat | 近景 0.5m／1.5m／5m 不見劇烈拉伸，性能不暴增 |
| `G1-07` | regression 檢查 R3 已完成的凹窗、海口、雲、船、陰影隨玩家、碼頭；保持單入口 | `validate`、`e2e` 與固定三視角截圖可重現 |

**G1 合併門檻**：P0-A/B/C 與船／碼頭空間缺陷有對應測試，Shader 無錯、場景無新的水陸斷線、操作模式沒有退化；未完成非阻斷的美術工作可列 G3，禁止宣稱「全部畫質已完成」。

## 5. G2｜固定視角美術基準與可量測效能

- **固定 8 組**：`shot-01-quarter-street`、`02-first-wall`、`03-first-pier`、`04-vista-fjord`、`05-harbour-boats`、`06-mobile-portrait`、`07-dusk`、`08-night`。後兩組在日／夜功能完成前登記 `UNSUPPORTED`，不可假造圖片。對每張保存 camera、mode、seed、clock、sun、fog、quality、CSS size、DPR、render scale、commit SHA。
- 比較工具使用**本遊戲實際渲染**的同鏡頭 PNG。若參考圖授權未明，只連外或使用 Owner 自有圖片，**不把他人截圖／帶水印圖片提交成遊戲素材**。可以針對亮度百分位、平均明暗、局部對比／色溫趨勢產報表；**不能**自稱有客觀「AAA 分數」。
- 最小診斷：frame interval p50/p95、draw calls、triangles、buffer 尺寸、裝置／OS／瀏覽器、品質檔、console／shader errors、renderer info、GPU timestamp（**若可取得；取不到即 N/A**），冷啟動與切鏡頭卡頓。區分 CPU/RAF 時間與真正 GPU 時間。
- CI 可自動檢查一致性、可見畫面與 Shader errors；**人眼美術 A/B 與 POCO F8 Ultra 真機**是另外的審查結果，不得由通過 CI 自動填 PASS。
- 接受：8 個 shot ID／支援狀態可列出；每個實作 PR 至少附改動相關的前後截圖、復現條件及性能差；同一截圖不得換時間、DPR 或構圖作弊。

## 6. G3｜主場景「英雄切片」精緻化

> **Owner 新增美術參考（2026-11-05）**：四張《鳴潮》畫面已被拆解成 [場景美術驗收規格](../reviews/P1-CINEMATIC-FOUR-REFERENCE-ART-BRIEF-2026-11-05.md)。**先達到圖 D 的清透山海、三層地標構圖與近景幾何；A 的黃昏、B/C 的夜間星光與金光屬後續 G4/G6，不當成已實作的功能。** 引用創作技法，不使用原遊戲截圖或素材。


**先改善一小塊能同時用三視角驗收的港口街區，成形後再複製整個小鎮。**

1. **建築語法與密度**：以 `HouseBlueprint` 描述尺寸、色票、屋頂種類、窗洞、台階／屋簷、梁柱、店牌、煙囪與水邊高腳漁屋；先做 1 棟主屋 + 1 棟碼頭漁屋，整合真凹窗，不用平面假窗；有地標、用途與分區，而不只亂加盒子。
2. **高質量但可控的屋瓦／木石材**：屋脊收口、瓦片重疊、屋檐陰影；原創手繪風 Albedo 搭配法線／roughness（或更廉價的頂點變化／局部 AO），先量 GPU 取樣成本，再決定是否擴大；不要盲目把 full PBR + triplanar 開全地圖。
3. **地形與峽灣**：近景岩壁有真實岩塊輪廓、灰色陡坡、下緣綠苔、三層遠山藍灰大氣透視；封閉／簡化岩塊可以離線生成；保留遠景簡化 mesh，地形表面和道路／木橋交界自然，防止山麓直立綠牆與岸線缺口。
4. **植被系統**：3 種有辨識差異的樹型 + 3 種草花；坡度／道路／沙灘／建築／碼頭遮罩；近景稀疏而精緻、遠景用 LOD／卡片（若真有收益），渲染位置以 seeded random 穩定。
5. **角色與材質統一**：原創像素角色和 96×96 材質模組維持一致 texel 密度；針對近 0.5m、1.5m、5m 觀察是否只剩平面貼紙；精修不要改壞行走和碰撞。
6. **海水成本固定**：只在原有 shader 調海岸／港內／遠海色相、反射近似與 fog 接縫；**不得**引入 FFT、SSR、鏡像反射、額外海洋 Pass。

**驗收**：近景窗洞有深度、屋頂不只是兩片三角板、岩石接地、草不穿路與牆、船不壓礁、第一人稱與 Quarter View 都成立；提交同視角 A/B 和場景／材質成本，不准直接寫「已達 Athenaion 畫質」。

## 7. G4｜真正可見的 HD-2D 後製（Owner 已批准）

**這包是確定要做的畫質重點，不再列為「需 Owner 決策」；但每個實作仍須通過風格、相容與效能驗收。**

### G4-a：管線架構與測試

- 以 WebGL2 現有單一 renderer 接 Composer／自建 post chain；現有 `renderer-port.js` `draw()`／`resize()`／`setCamera()`／`dispose()`／context lost/restored 不得壞掉。**先核對實際 Three.js 0.187.0 與選用 postprocessing 的相容性**，不預設某版 API 一定存在。
- 先用純粹 RenderPass／最後顯示測試驗證顏色、透明順序、畫面深度、正交／透視兩相機、反鋸齒與像素清晰度。保留 `basic` 完全直出且能自動降級／關閉特效。
- HDR linear 空間作曝光與 bloom，**只在最後 tone map / colourspace transform 一次**；現在自訂海水的 chunks 可能已自行輸出，必須先解決轉換契約，避免後製雙 tone map。

### G4-b：選擇性泛光（Bloom）

- 目標是暖窗、燭火、燈籠、夕陽反光和地標局部亮點；使用高亮閾值／可選 emissive mask，半解析度或可縮減的 mip passes，不讓白牆／天空／整個海面泛白。
- 驗收：夜間有燈火輪廓，白天材質不塑膠、窗框不糊；上／下限強度有 A/B；跨鏡頭不出現短暫曝光閃爍。

### G4-c：移軸景深（DoF）

- 目標是 **斜角**的縮微景觀、主角附近清楚、遠／近層柔化；**第一人稱**不能套斜角同一深度焦平面，需換參數或依距離關閉；**vista** 視風景可弱化。
- 若景深基於深度圖，需處理正交鏡頭深度線性化、天空背景／透明的 `depthWrite`、UI 未經場景 render target 的處理、畫面邊緣 halo；低解析度 blur 不可使像素角色失焦。
- 驗收：多個焦距／鏡頭距離 A/B、玩家輪廓清楚、手機直向不會上下全部糊掉；切鏡不閃屏。

### G4-d：畫質與回退

| Preset | 視覺規格 | 保護機制 |
| --- | --- | --- |
| `basic` | 不使用 DoF／Bloom，單一 tone/color 正確輸出 | 弱機與 WebGL 特性缺失可強制回退 |
| `balanced` | 可保留低成本色彩分級，Bloom 預設關或極弱；DoF 關 | 以測量決定啟用，不讓畫質選項失效 |
| `high` | **啟用可辨識的 Bloom＋DoF＋色彩分級**，依鏡頭控制 | 各 Pass 可單獨關閉、縮半解析度、監控 frame time |
| fallback | Renderer／FBO／DepthTexture／Shader 編譯失敗時切回直出 | 真正回退可用，不能失敗後黑屏 |

- 60 FPS 是**目標**：在真機測量相同 viewport、DPR、亮度與熱狀態的 before/after；記錄 sustained fps、p50/p95、掉幀、電量／發熱主觀描述（如可得）、GPU timing N/A 的限制。高畫質即便未達目標，也不能藉停用兩種主效果後宣稱「高畫質已完成」，應列明阻擋與限制。

## 8. G5｜角色、遮擋、風與微動態

| 子項 | 最小實作 | 避坑與測試 |
| --- | --- | --- |
| 角色陰影／外觀 | 剪影式陰影圖或 alphaTest custom depth，腳底接觸 shadow；微呼吸與低成本輪廓光 | 不再讓 Sprite Billboard 投矩形影；第一人稱隱藏角色時需同步調整影子 |
| 建築遮擋 | 相機與玩家之間局部 dither cutout（若適用），材質 cache key 與 instancing／合批相容 | 避免透明排序／alpha popping；玩家必須可辨識 |
| 全域風 | 同一風向與 time uniform 控草、樹冠、船帆、煙 | 不只讓一個物件動而天空／陰影不協調；測 shader 頂點 bounds |
| 雲影與空氣感 | 少量隨時間移動的便宜雲影、炊煙、浮塵、海鷗 sprite；預算固定 | 不引入體積雲、重型粒子；畫質級別與省電可關 |
| 船浪同步 | JS/TS 端輕量波浪高度近似，讓船的起伏和既有海面波相位相近 | 不新增 FFT／海水計算 Pass；不重做船隻動力學 |

驗收：不同視角無角色消失／影子爆裂；靜態截圖與動態錄製各一，花草／帆布／煙運動有方向邏輯；切模式與視距變化無 Shader 蹦裂或資源累積。

## 9. G6｜呈現、音景、整體驗收及是否擴圖

- **直達遊戲**：維持載入根路徑就看到遊戲；可跳過 3–4 秒場景內開場鏡頭，HUD 可互動，不新增第二頁或影片遮住遊戲。
- **明信片觀景機位**：港口泊船、街景、峽灣出口、暮色與夜間（若時段已實作）各有固定構圖；觀景只移 Camera、不動玩家位置；保留返回原視角。
- **鏡頭運動**：斜角／第一人稱／vista 的切換可用受控 interpolation 或短淡入淡出；必須遵守 `setCamera()` contract，不重啟 WebGL；手機雙指／右側拖曳和左搖桿不衝突。
- **音景**：風、浪、海鷗、木／石／沙腳步，音量、靜音與瀏覽器使用者手勢解鎖；來源優先原創或 CC0，記錄授權與 SHA256，不下載他人影片音軌直接當遊戲素材。
- **最終風格與效能**：8 種固定鏡頭的 before/after、日間／黃昏／夜景（未實作則標 N/A）、全部畫質級別、shader logs、冷啟動／切鏡／長時間運行；POCO F8 Ultra 真機作主要目標，另 Android 直橫向／iOS Safari（若有可用設備）明確記已測或 NOT RUN。
- **可控擴圖**：只有 G1～G6 的代表街區通過手機測試且真正需要更多世界時，才另立 Chunk culling／LOD／串流 PR。參考 Athenaion、Aetherfall、ZyFou 的技術，但不直接把其工程搬進來。

## 10. 每個實作 PR 的固定完成契約

1. **Before**：main SHA、問題／對應 task ID、預期畫面差距、引用研究、受影響檔案、初始測試及原圖。
2. **Implementation**：只改該包模組／測試；不能刪研究、拆第二入口、增大玩法、未記錄的新依賴；新增資產需 [授權政策](../ASSET-POLICY.md) 支持。
3. **Validation**：`npm ci && npm run validate && npm run test:e2e`、CI 狀態、WebGL2 Shader/console error、桌面與 mobile viewport 的畫面；真正手機結果另記。
4. **Visual proof**：相同 seed、相機、clock、quality、DPR 的畫面前後圖；在 PR 中指出哪些是明顯改善、哪些是回歸疑慮，對第一人稱近牆最嚴。
5. **Performance**：draw calls、triangles、buffer、frame p50/p95、GPU timer 若支持；避免一次同時改 DPR+後製+材質無法歸因。沒有 GPU 數據填 **NOT MEASURED**，不得用預估值冒充。
6. **Failure／rollback**：效果可 flag 關閉，post 錯誤可 fallback，逐包 revert 不破壞入口；踩坑新增記錄（缺陷、觀察、原因、解決／未解）。
7. **Review**：先等 CI、審查建議回應、Owner 目視；PR 結論區分 **PASS / BLOCKED / NOT RUN**。沒有授權不自行 merge／部署。

## 11. 可直接啟動的第一個工作指令（G1）

1. 從**最新 main**建 `feat/g1-rendering-world-correctness`（實際命名加日期／版本避免撞名）；重跑基線。
2. 先新增共用環境狀態和單元測試，保護太陽方向／材質輸出；**不先碰 DoF/Bloom**（那是 G4）。
3. 再改雪線死分支（不自行決定要不要下雪）、groundHeight、兩船—岩石 footprint、堤岸頂石；單測分項落地。
4. 固定三視角＋泊船近景 A/B，對比未改 `main`；CI 及 Shader error = 0。
5. 提交 **G1 PR 待審**，更新[踩坑紀錄](../governance/VISUAL-PITFALLS-LOG.md)與本計畫狀態。之後 G2（完整 8 組基準）、G3、G4……依依賴拓樸推進。

## 12. 文件治理：唯一排程，研究保留

- [本檔](P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md)唯一管理 **G1–G6 待辦、依賴、授權和最新完成狀態**；新研究只能追加證據、提出最小新項目並核准，不能另創第二套排程。
- [踩坑紀錄](../governance/VISUAL-PITFALLS-LOG.md)只管 **失敗案例、缺陷、教訓、可復現方式、預防／處理**；禁止將風險寫成已發生事故。
- [整合研究](../reviews/P1-VISUAL-QUALITY-INTEGRATED-RESEARCH-2026-11-05.md) 是程式差距／外部來源證據，不是與本檔競爭的第二個 roadmap。[HD-2D 補充](../reviews/HD2D-VISUAL-TECH-PLAN-2026-11-05.md) 僅留歷史資訊及細節。
- [ROADMAP](../ROADMAP.md) 只顯示**各 G 包高層狀態與本檔連結**，不逐段複製技術分工。[INDEX](../INDEX.md)提供唯一入口。
- **未證實／未量測項目**保留明確的 NOT RUN／NOT MEASURED 和 commit SHA；每次 PR 改動、合併、重新部署後要更新證據，不能沿用老成果。
