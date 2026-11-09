> **HISTORICAL：本檔保存原始踩坑證據，不是即時缺陷清單。** PV-006「尚無 Bloom/DoF」已由 #21 取代；PV-024「禁止重型海水」已由 #29 Water 方案取代；#32 的 28 步體積雲也由 #33 十雲屬分層替換。保留原文供追溯；有效決策看 [DECISION-REGISTER](../decisions/DECISION-REGISTER.md)。

# Pixel-Games｜畫面超進化踩坑紀錄（Pitfalls / Lessons Learned）

> 初版：2026-11-05；適用 G1～G6。**不是待辦總表**：工作順序、責任與授權以 [P1 超進化唯一總計畫](../plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md) 為準。
>
> 每筆都必須先標明 **證據強度**：`CODE-VERIFIED`（目前原始碼可直接核實）、`HISTORY`（PR／使用者報告／歷史缺陷，需註明已修或未確認）、`RISK`（未發生／尚未量測的風險）、`DECISION`（Owner 明確限制）。`RISK` **不得寫成既成事故**。
>
> 預防「AI 自己審自己」：CI、Playwright、SwiftShader、真手機、人工美術 A/B 是**不同證據層**；有綠色勾勾不等於真機畫質合格，作者自報 FPS 不能充當 Pixel-Games 的實測。

> **進度更新（2026-11-05）**：G1 第一輪已合併 [PR #15](https://github.com/waydefu/Pixel-Games/pull/15)，CI 建置、單測、desktop/mobile Chromium E2E PASS；PV-001～PV-005 只標 **RESOLVED-CODE**，**不是**桌面實圖／真機美術 PASS。G2 固定視角與 PNG 工具見 [PR #16](https://github.com/waydefu/Pixel-Games/pull/16)，仍待驗證；PV-006（DoF/Bloom 未實裝）、PV-007（全材質）與 PV-009（GPU timing）未關閉。

## 0. 使用規則

1. 開始 G 包前先查 [總計畫](../plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md)、最新 `main` SHA、`docs/QUALITY-GATES.md`、本表；PR 修改期間發現新坑，**在同個 PR 新增／更新一筆**，不用另建平行檔案。
2. 記錄欄位固定：**ID、類型、狀態、觸發條件／現象、查證路徑、根因確定度、修法／防呆、回歸證據、相關 PR／owner 決策**。
3. 狀態定義：`OPEN` = 已證實且未修；`RESOLVED-CODE` = 已有修正，但不代表真機驗收；`RISK-UNVERIFIED` = 尚未證實、需監控；`DECIDED-DO-NOT-DO` = 明確排除技術；`NEEDS-VERIFY` = 用戶觀察或推算，尚未重現。
4. 永遠區分 `head_sha` 與 Pages deployment、cache 與 viewport。重要性能數字要有裝置、瀏覽器、DPR、品質、熱狀態與時間區間；若欠缺，寫 **NOT MEASURED**。
5. 修復時**先新增針對根因的回歸測試**，之後才標 `RESOLVED-CODE`；若已有歷史 PR，但無此輪重跑證據，寫「歷史修復／待重新驗收」。
6. 只引用第三方技術原理；不複製外部遊戲材質、照片、水印、模型或劇情。新資產按 [ASSET-POLICY](../ASSET-POLICY.md) 登記。

## 1. 目前已由程式確認、需優先避開的坑

### PV-001｜天空太陽、環境光、水面高光互相獨立

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（G1-01；PR #15 已合併，畫面／真機待驗）。
- **現象**：太陽方位與雲層亮側可能和陰影方向不一致，尤其日落時暴露。
- **證據**：`src/game/fjord.ts` 天空 shader 第 85 行寫死 `vec3(-.60,.30,-.74)`；`src/game/environment.ts` 的主 DirectionalLight 使用獨立方向；海面 `src/game/ocean.ts` 亦有獨立的近似高光，未共用 SunState。
- **根因**：獨立模組分別配置光向；不是「Three.js 不夠強」。
- **預防／修法**：G1 由單一 `EnvironmentState` 管所有方向和顏色，再注入天空／主光／廉價水面 shader。增加相同時間及角度回歸測試。
- **驗收**：日中、黃昏至少兩個固定 shot；光向一致，不能只檢查 uniform 有值。

### PV-002｜FogExp2 不會自動影響自訂 ShaderMaterial

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（G1-02；PR #15 已合併，地平線實圖待驗）。
- **現象**：地表／遠山／海水與天空的距離霧和地平線色相不連續。
- **證據**：`src/game/world.ts:18-19` 背景 `#a5bdb8`、FogExp2 `#a5b5b0`；`fjord.ts` 自訂 Sky `fog:false`；`ocean.ts` 自訂 shader 沒有一般材質的 fog chunks。
- **根因**：場景霧、Sky shader、Water shader 不共享輸出契約。
- **預防／修法**：先定義天空／霧／海面／後製的 linear→tone map→sRGB 流程；Shader 編譯和長焦地平線圖像兩者都檢查。
- **驗收**：Three.js r187 shader logs + desktop/mobile viewport 螢幕實圖，不得只憑 scene.fog 屬性。

### PV-003｜雪線 if 永遠觸發不到

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（G1-03；PR #15 移除不可達雪色分支，不代表已做季節系統）。
- **現象**：預期高海拔灰白岩或雪色從不出現。
- **證據**：`fjord.ts:30` 的 `(h-126)/100` 被 max(0) 截斷；`terrain-profile.js` 同版地形高度達不到該閾值（研究時的靜態範圍，修前重新數值掃描）。
- **根因**：美術常數與程序地形高度尺度脫節。
- **預防／修法**：用固定 seed／多點 sample 測可達高度，定義雪或不雪的美術策略後修閾值，不自行創造寒帶版本。
- **驗收**：color branch 的邊界測試 + 山峰三視角。

### PV-004｜裝飾礁石只避開碼頭，未避開泊船與可走區

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（G1-05；PR #15 已排除 i=7 礁石，實圖待驗）。
- **現象**：船身可能壓礁石、礁石漂在水上或擋近景；座標推估已有重疊疑慮。
- **證據**：`environment.ts:86-92` 岩石排除區間 `x[10,31] z[3,12.8]`；`boats.ts:9` 兩艘船位置 `(18,-3.5)`、`(24,15.2)`，不包含在前述碼頭排除的 z 區間內。
- **根因**：船、岩石、碼頭三份硬編碼位置沒有共用 footprint／碰撞約束。
- **預防／修法**：新增同一份 scene placements + footprint 檢查，不只新增另一個硬編碼 if；岩石深度／縮放符合潮岸視覺。
- **驗收**：船首、船側、碼頭三視角＋禁止重疊單測；保留已有修正的海口地形。

### PV-005｜碼頭高度寫死在 Camera 內，違背地面／行走模型

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（G1-04；PR #15 共享 groundHeight，真機切鏡待驗）。
- **現象**：進出碼頭時鏡頭高度突變，後續加入坡道／階梯會不一致。
- **證據**：`camera.ts:66-67` `standingOnPier` +0.29，`navigation.js` 目前只有 `canOccupy` 和 `stepOnGround`，沒有統一的 `groundHeight`。
- **根因**：相機與世界碰撞／地面高程分離。
- **預防／修法**：地面高度是 gameplay 幾何的一部分；由可測 `groundHeight` 共用。視角對相機的 offset 由狀態決定，避免座標魔法數字。
- **驗收**：第一人稱碼頭進出及切斜角不跳；長時站立高度穩定。

### PV-006｜High postprocess 旗標不代表景深泛光已實裝

- **類型／狀態**：`CODE-VERIFIED / OPEN`（G4）。
- **現象**：使用者選 `high` 卻看不到 DoF／Bloom。
- **證據**：`quality.js:5` `postprocess:true`，但 `renderer-port.js:93` 仍用 `renderer.render(scene, activeCamera)`。
- **根因**：設定旗標與實際 pass 管線分離。
- **預防／修法**：G4 真正建立 composer + pass lifecycle，basic bypass / high effect 明確可見；在 e2e 驗證啟用／停用改變輸出。
- **驗收**：同鏡頭、同曝光的 high/balanced/basic A/B，並在缺支援時自動回退而非黑屏。

### PV-007｜圖樣與 texel density 看似有材質，近景仍塑膠

- **類型／狀態**：`CODE-VERIFIED / OPEN` 的技術缺口；**視覺缺陷程度待 A/B**（G1-06、G3）。
- **現象**：石材缺高度／法線變化、木石比例亂、地面紋理在長方形區域被拉伸。
- **證據**：`src/game/art.ts` 生成原創 CanvasTexture；`kit.ts`／環境地表部分圖樣重複與 `flat()` 尺度沒有標準，舊審查 px/m 僅屬程式推算；堤岸 `environment.ts:41` 為 `k.solid("#c7b99a")`。
- **根因**：僅 Albedo 變化和世界尺度不一致。
- **預防／修法**：設定候選 32 px/m（先試，不硬寫成既定規格）、局部法線與 roughness／頂點 AO，近景分階段試用；禁止全地圖無限制 triplanar。
- **驗收**：0.5m／1.5m／5m 近景及性能數據，不只看縮圖。

### PV-008｜合批減 draw calls 可能破壞空間裁切

- **類型／狀態**：`CODE-VERIFIED` 的擴圖設計風險；`RISK-UNVERIFIED` 對目前性能影響（G6 後評估）。
- **現象**：材質一樣但跨街區的 mesh 合成一個，camera frustum 無法捨棄一整段離屏區域。
- **證據**：`src/game/batch.ts` 依 material.uuid + shadow state + renderOrder 分組，沒有 sector id。
- **根因**：以 draw calls 為唯一成本指標，缺少空間分區。
- **預防／修法**：**先量測，再**將街區 sector 納入合批 key，測陰影 caster 不被錯誤隱藏；分區代價可能增加 draw calls。
- **驗收**：同相機角度實測 visible triangles、GPU／CPU frame、陰影保留與沒有 pop-in。

### PV-009｜RAF p95 不是 GPU frame time

- **類型／狀態**：`CODE-VERIFIED / OPEN` 量測限制（G2、G4）。
- **現象**：顯示 FPS 或 renderScale 變化無法辨認 shader 負載、JS 卡頓、GPU 填充率哪個是瓶頸。
- **證據**：`src/rendering/quality.js` adaptive controller 使用 p95 frame interval，不是 `timestamp-query`。
- **預防／修法**：分開 logging RAF、CPU、GPU timestamp（若 API／瀏覽器提供）與真機熱狀態；對不可測 GPU 寫 N/A。
- **驗收**：測量紀錄附解析度、quality、device、時間與快照，無虛構 fps。

## 2. 歷史有過、已處理或需要重新核實的坑

### PV-010｜窗戶突出外牆：不能把玻璃貼片假裝凹窗

- **類型／狀態**：`HISTORY / RESOLVED-CODE`；**近景視覺再驗**（G3）。
- **紀錄**：Owner 指出窗戶應內縮。PR [#11](https://github.com/waydefu/Pixel-Games/pull/11) 修改牆面開口切分與玻璃內縮，`tests/facade.test.mjs` 有幾何回歸。
- **教訓**：圖片/第一人稱低角度會暴露「表面貼紙」；要測側壁厚度、窗台、光源深度和自遮蔽，不能只看正面。

### PV-011｜綠色陸地封住海口、大礁石擋碼頭、陰影遠離玩家失效

- **類型／狀態**：`HISTORY / RESOLVED-CODE`；**實機與新視角再驗**。
- **紀錄**：PR [#11](https://github.com/waydefu/Pixel-Games/pull/11) 的海岸輪廓、碼頭避石與 sun/shadow follow 做過修正，現有 `tests/coastline.test.mjs` 保護部分地形邊界。
- **教訓**：不要因新研究把已處理的功能再次重做；但**碼頭避石不等於泊船避石**（參 PV-004）。

### PV-012｜網站仍是舊版：PR、main、Pages 與瀏覽器快取是四件事

- **類型／狀態**：`HISTORY / NEEDS-VERIFY`（Owner 曾反映同網址仍顯示舊版；**當時根因未經這份紀錄獨立確認**）。
- **現象**：合併 PR 後打開 GitHub Pages，視覺似乎未更新。
- **預防／修法**：核對 PR merged SHA、main HEAD、Pages deploy workflow 產物、官方 URL、network cache / service worker，再決定是否真的要重新部署；不得為此新增第二入口、隨意刪研究或亂改 Pages 設定。
- **驗收**：比對 deploy commit 和瀏覽器的實際資產 hash／版本；只有證據明確才關閉問題。

### PV-013｜兩份平行研究報告提出互相衝突的建議

- **類型／狀態**：`HISTORY / RESOLVED-CODE`（文件整理層，不是執行 bug）。
- **紀錄**：PR [#12](https://github.com/waydefu/Pixel-Games/pull/12) 已將外部研究整合成唯一研究入口、原始報告標「已整合」；PR [#13](https://github.com/waydefu/Pixel-Games/pull/13) 保留 HD-2D 補充而非開第二套主報告。
- **教訓**：**研究入口 ≠ 工作排程入口**。今天 G1～G6 只在 [唯一總計畫](../plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md) 管理，修改 roadmap 僅指向它；保留歷史，不刪有用證據。

### PV-028｜新增塔樓的外觀基座半徑與碰撞半徑不符
- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（PR #18，仍待實際鏡頭 A/B）。
- **現象**：G3 最初燈塔台基 Cylinder 半徑約 3.5m，碰撞半徑只有 2.85m，玩家可能走入基座。周向窗洞的玻璃板朝向也未對齊圓柱切線。
- **證據**：`src/game/harbour-beacon.ts` 中 `CylinderGeometry(3.1,3.5,.86,12)`、最初 `BEACON_SITE.radius=2.85`；窗片最初 `pane.rotation.y=-angle`。這是程式級核實，未聲稱已親眼看到穿模。
- **修正**：將 authored collider 半徑調到 3.60m，塔樓高度 metadata 與頂端屋頂實高對齊；窗片改 `Math.PI/2-angle` 方向，加入對應回歸測試。
- **驗收限制**：CI 待跑、G2 六視角 PNG 待核、第一人稱實際碰撞與 POCO F8 Ultra 真機 **NOT RUN**。

### PV-029｜移動地形高度實作後，測試仍檢查舊檔位置
- **類型／狀態**：`HISTORY / RESOLVED-CODE`（PR #18 G3-E，CI 測試位置修正）。
- **現象／證據**：地形表面位移由 `fjord.ts` 抽到 `terrain-profile.js` 的 `fjordSurfaceHeight()`，舊 `tests/hero-visual.test.mjs` 仍從原 `fjord.ts` 尋找 `const crack=Math.sin`，導致 GitHub Actions 靜態／單測紅燈。這不等於已證實的渲染錯誤，但會阻斷所有後續驗收。
- **修法**：測試改查共用高度來源，保留 `fjord.ts` 的實際引用與山體岩色契約；新增 `tests/environment-evolution.test.mjs`，驗證地形高度有界、山林坡度過濾、雲影接線、輕量海面限制。
- **驗收**：最終 HEAD CI／六視角 shader 啟動 **須重新 PASS**，不能沿用先前 commit 的綠燈。

### PV-030｜增加山林與雲影後，畫面看似好看卻讓行動端超出預算
- **類型／狀態**：`RISK / RISK-UNVERIFIED`（PR #18 G3-E）。
- **證據**：G2 與初版 G3-E 的 desktop Chromium 固定峽灣鏡頭，draw calls 從 201 增至 265，三角形約從 21.9 萬升至 36.0 萬；SwiftShader 的 RAF p95 不可拿來當真機幀率／GPU time。
- **目前處理**：以 `THREE.InstancedMesh` 的山體分區、坡度遮罩、單份 128px 雲場取樣，不加新雲 Pass；減少灌木細分，建立 `basic/balanced/high` 的山林完整樹木與海岸草叢密度梯度（prefix count 保證樹冠不離開樹幹）。
- **驗收要求**：重新取得 G2 相機同條件 PNG、draw calls/triangles、Shader error；不同畫質檔各記數據。POCO F8 Ultra 真機 60FPS／熱測仍 **NOT RUN**，不得宣稱預算足夠。

### PV-031｜風動植被通過程式測試，仍可能出現 Shader／裁切回歸
- **類型／狀態**：`RISK / RISK-UNVERIFIED`（G3-E2 [PR #19](https://github.com/waydefu/Pixel-Games/pull/19)）。
- **證據**：PR #19 首次完整 CI [41970871098](https://github.com/waydefu/Pixel-Games/actions/runs/41970871098) PASS，但 `visual-audit` 尚未加標籤，因此 PNG 擷取步驟為 **skipped**；這不足以證明材質 `onBeforeCompile` 動畫不會發生視覺錯誤、裁切閃爍或風向不一致。
- **防呆**：標記 PR #19 為 `visual-audit`，在此條目提交之後重新執行 CI，要求真正的六鏡頭 PNG／JSON artifact、Shader error=0；對照已合併 G3-E1 的主線，而非沿用舊版 G3 的截圖。運動畫面尚需時間序列人工確認。
- **驗收界線**：CI 綠燈 ≠ 風動畫自然；SwiftShader ≠ POCO F8 Ultra 實機 FPS，真機測試仍是 **NOT RUN**。未完成前保持 PR 待審。

### PV-032｜天空雲層在地平線形成整齊的垂直方塊
- **類型／狀態**：`HISTORY / RESOLVED-CODE`，**後續新畫面仍待驗收**（PR #20）。
- **實際證據**：[PR #20 CI #41977048393](https://github.com/waydefu/Pixel-Games/actions/runs/41977048393) 六視角的 `shot-04-vista-fjord.png` 可見白色／灰色直立矩形，非自然雲體。人工檢查 `fjord.ts` 發現原本計算 cloud-plane ray intersection 的分母 `max(.11, ray.y)`，使 `ray.y<.11` 一整段視線共用相同高度交點；但原 alpha mask 在 `ray.y≈0.055` 就已完全顯示雲層，因此容易形成垂直窗簾。
- **處理**：將雲層交點分母改成 `max(.035,ray.y)`，將可見 mask 延到 `smoothstep(.075,.205,ray.y)`，利用已存在的物理天空處理近地平線霞霧。新增 `tests/aerial-cloud-integration.test.mjs` 守住交點和遮罩契約。
- **驗收**：需要新版 `shot-04` 及 `shot-05` A/B 實圖確認，舊 artifact 只支持「有問題」與「根因合理」，不支持「新版本已經夠漂亮」。

### PV-033｜官方物理天空預設參數仍可能過白，不能當成自動美術升級
- **類型／狀態**：`HISTORY / NEEDS-VERIFY`（PR #20，調參後尚未復核）。
- **證據**：同一 CI run `shot-04` 高空上緣偏灰白、中央地平線亮度接近純白；雲層缺乏主體色彩對比。這是 **SwiftShader 截圖觀察**，不是 POCO F8 Ultra 的色彩／曝光檢驗。
- **處理**：將 `Sky` 的 turbidity `5.8→2.6`、Rayleigh `2.35→1.8`、Mie `.005→.0028`，向清透的海岸藍天靠攏；新增世界座標岩層紋理明暗與山體濕霧層次，不靠調整全畫面曝光去蓋掉地形缺陷。
- **驗收**：新版六鏡頭中天空頂部應較清澈、海天線不白得刺眼，岩壁仍保留中間調；若 A/B 反而失真或偏灰須回退調參。

## 3. 尚未發生、但 G4／G5／G6 要先防的高風險

| ID | 類型／狀態 | 可能踩坑 | 防護措施與可證實的驗收 |
| --- | --- | --- | --- |
| PV-014 | `RISK / RISK-UNVERIFIED` | 先做 HDR 後製，又讓 Ocean `ShaderMaterial` 包含 `tonemapping_fragment` / `colorspace_fragment`，導致重複 tone map、亮度失真或整片白 | G1 定線性輸出契約，G4 用 `basic` 與 post A/B、檢查線性／sRGB 階段；含海水近景 |
| PV-015 | `RISK / RISK-UNVERIFIED` | Orthographic Quarter View 的 DoF 深度計算當成 Perspective；斜角焦面跟玩家高度偏離，畫面上下整片糊掉 | 分鏡頭模式參數和 depth linearization，按玩家／scene depth 動態設焦；A/B 檢查角色和屋簷不糊 |
| PV-016 | `RISK / RISK-UNVERIFIED` | Bloom 閾值過低，天空、海水、灰泥牆全部泛白；偏移色差破壞 HD-2D 像素輪廓 | 只選擇性處理燭火／窗光，半解析度 mip、強度範圍可控，逐鏡頭調參，成本不合格就降級 |
| PV-017 | `RISK / RISK-UNVERIFIED` | Post FX 多 pass、MSAA、額外 depth texture 在手機爆 GPU bandwidth，熱降頻後 FPS 下降 | high/balanced/basic 各獨立實測冷／熱，畫質可回退；未真機測不可聲稱 60FPS |
| PV-018 | `RISK / RISK-UNVERIFIED` | Three.js r187 和第三方 `postprocessing` API／tone mapping 不相容；setCamera/resize/context lost 後黑屏 | 先做最小 composer proof；獨立 integration test，context restore／dispose／切鏡 headless 實測；必要時自建最小 pass |
| PV-019 | `RISK / RISK-UNVERIFIED` | 角色 billboard castShadow 出現矩形；遮擋網點造成閃爍、alpha order 或花屏 | alpha-tested shadow/depth 與 material compile key；草＋窗／牆遮蔽測試，禁新增透明 draw order 問題 |
| PV-020 | `RISK / RISK-UNVERIFIED` | 風／雲影／草 vertex animation 缺穩定 bounds；鏡頭移動時整片草消失／陰影延遲 | update bounding sphere、可控位移上限、共享 time/wind，切鏡和性能測試 |
| PV-021 | `RISK / RISK-UNVERIFIED` | 使用別人水印照片、itch 展示圖、遊戲音效／模型作素材而未授權 | 來源鏈、License、檔案 SHA256、CC0 或原創、禁止複製他人視覺素材；Nightshoal／Athenaion 僅作參考 |
| PV-022 | `RISK / RISK-UNVERIFIED` | 音訊在手機未經使用者互動就播放、背景持續發聲；前奏或開場阻擋使用者直進世界 | user gesture unlock、靜音、音量控制、page visibility suspend、開場可跳過，不改直接進遊戲入口 |
| PV-023 | `RISK / RISK-UNVERIFIED` | 桌面 SwiftShader CI 綠等同美術 PASS、Mobile viewport 被當真機測試 | 所有 PR 分列 automation、人工 desktop、真 Android、GPU timing、熱測等狀態，未做明寫 NOT RUN |

## 4. Owner 已下的永久性邊界與採用決策

| ID | 類型／狀態 | 界線／起因 | 保證方式 |
| --- | --- | --- | --- |
| PV-024 | `DECISION / DECIDED-DO-NOT-DO` | **不引入重型海水**：WebGPU FFT `ocean.min.html`、多層海浪、SSR、Planar Reflection、水下額外 pass、昂貴白浪；手機幀率與可玩性優先 | 在 G1/G3/G4 PR review 強制對照，不能用技術參考文章當默許實作 |
| PV-025 | `DECISION` | **DoF＋Bloom 已正式核准納入 G4 計畫**；此前 PR #13 的「待 Owner 決策」是歷史文件狀態 | G4 需真效果、能回退、有性能對照；如果做不到，不可假稱完成 |
| PV-026 | `DECISION` | **專案只有一個遊戲入口**：不要 landing page、不恢復被淘汰的地城／平行 prototype；研究與 Skills 保留 | 每 PR check-repository、人工確認；不得將故障修復變成大刪檔 |
| PV-027 | `DECISION` | **休閒、自由探索**：不新增強制主線、戰鬥、時間壓力；夜間／燈塔參考僅取美術構圖 | G6 對開場與明信片做可跳過設計，不把 Nightshoal 的任務壓力複製進來 |

## 5. 複製後即可使用的踩坑回填模板

```md
### PV-034｜<精確標題>
- 類型／狀態：CODE-VERIFIED | HISTORY | RISK | DECISION / OPEN | RESOLVED-CODE | RISK-UNVERIFIED | NEEDS-VERIFY
- 發現日期／相關 PR／檔案與 HEAD SHA：
- 觸發前提：裝置、瀏覽器、畫質、DPR、鏡頭、seed、時間、操作
- 觀察到的現象／實際錯誤訊息：
- 最短重現步驟：
- 證據：原始碼行／console／截圖／影片／frame p50/p95/GPU time（若無填 N/A）
- 根因確定度：已驗證／假說（列出替代解釋）
- 修正方案與本次 PR：
- 風險和可回退步驟：
- 回歸測試及結果：CI / desktop / mobile viewport / 真機 / 人工美術，分別 PASS/BLOCKED/NOT RUN
- 決策或剩餘問題：
```

## 6. 最初紀錄與後續更新方法

- 2026-11-05：從 [整合研究](../reviews/P1-VISUAL-QUALITY-INTEGRATED-RESEARCH-2026-11-05.md)、[HD-2D 補充](../reviews/HD2D-VISUAL-TECH-PLAN-2026-11-05.md)、PR #11～#13 與 `main@a8a504b` 的程式快照建立第一批 PV-001～PV-027。
- **未實施 G1～G6**；初版中任何 `OPEN` 只說明程式級待修／待驗證，而非當天已進行完整桌面與 POCO F8 Ultra 實測。
- 2026-11-09：補錄 PV-035～PV-046（PR #33～#51 期間的天空、渲染、CI、輸入與工具陷阱，見 §7；Issue #87）。
- 後續每次 G PR：先重查證據，修復時補 Commit／測試／對照圖；若調查排除某項，記錄「已證偽」而非抹掉歷史。定期把重複根因合併，ID 保留便於 PR 回溯。

## 7. 2026-11-09 補錄（PR #33～#51 期間的坑）

> 依 §0 規則 1 補錄，Issue #87。**每筆的「真機」欄**：沒有使用者回報或實測就是 NOT RUN；CI 與軟體 GPU（SwiftShader）截圖**不是**真機證據。根因是推論的，寫成假說。

### PV-035｜在場景繪製途中切換渲染目標，手機整幀空白

- **類型／狀態**：`HISTORY / RESOLVED-CODE`（PR #34）；**根因 NEEDS-VERIFY**。
- **觸發前提**：Poco F8 Ultra、高畫質（多重取樣 4×＋海面反射）、斜角與第一人稱都有、遊戲約 10 fps。
- **現象**：約每 2 個遊戲幀有 1 個整幀空白（只剩天空底色，建築、海、樹全部消失），約每秒 5 次，每個空白幀只持續 1 個顯示幀。
- **證據**：使用者螢幕錄影的逐幀分析（60 fps 影片：平穩序列中出現單幀尖峰，前後幀相同、中間一幀異常）。修復前程式：`src/game/ocean.ts` 的 `water.onBeforeRender` 在場景（多重取樣目標）繪製**途中**又呼叫 `renderer.render()` 畫反射（每 2 幀一次）；`src/game/cloud-shadow.ts` 的 hook 也在途中切換目標。three.js 原始碼對 `WEBGL_multisampled_render_to_texture` 註記：中途 flush 時該擴充「doesn't work properly」。
- **根因確定度**：**假說**。節奏與反射的「每兩幀」吻合，且 SwiftShader 沒有該擴充，**無法重現**。替代解釋未排除：這條路徑（多重取樣＋反射）在「平衡」檔也存在，若平衡檔原本不閃，推論不完整。
- **修法／防呆**：`hd2d-pipeline.js` 新增 `prePass`，雲影圖與海面反射改在場景繪製**之前**畫（`world.prePass`、`ocean.mirrorPass`、`cloud-shadow.run`）；`onBeforeRender` 僅留作無管線時的後備。診斷網址參數 `?reflect=0`（關反射）、`?rtt=0`（不用該擴充）。**規則：不得在場景繪製途中切換渲染目標。**
- **回歸證據**：單測 `tests/cloud-shader.test.mjs` 靜態檢查 `prePass` 在 `sceneTarget` 之前；CI PASS。真機：使用者回報「正常網址有效」（2026-11-08，**非逐幀量測**）；`?reflect=0`／`?rtt=0` 對照與逐幀復測 **NOT RUN**（Issue #45、#46）。

### PV-036｜CI 在軟體 GPU 的簡化路徑上，看不到手機專屬問題

- **類型／狀態**：`CODE-VERIFIED / OPEN`（追蹤於 Issue #48）。
- **現象**：CI 全綠，手機卻有空白幀（PV-035）。
- **證據**：`src/game/main.ts` 的 `softwareGpu`／`lowPower`：軟體 GPU 時關海面反射、關雲影圖、天空降到基本檔、解析度固定 0.55 倍。實測 SwiftShader 的 `getExtension('WEBGL_multisampled_render_to_texture')` 為 `false`。
- **根因確定度**：已驗證（設計取捨：慢的軟體渲染要在時限內跑完）。
- **防呆**：審查截圖用 `?mirror=1&fullres=1` 走完整路徑；不把 CI 綠燈當畫面證據（PR 範本與 AGENTS.md 已寫）。可評估非阻擋的完整畫質截圖 smoke（Issue #48）。
- **回歸證據**：不適用（限制本身）；真機 NOT RUN。

### PV-037｜GLSL `smoothstep(edge0, edge1, x)` 的 `edge0 >= edge1` 是未定義行為

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（PR #36；Owner 先修太陽與夕陽，補修其餘 7 處）。
- **現象**：下降式過渡（太陽高度越低越紅等）在不同 GPU 上結果不一致；**是否就是手機夕陽表現不穩的原因：未驗證**。
- **證據**：GLSL 規範；專案內有 `smoothstep(.13,-.02,sy)`、`smoothstep(.42,.14,sunSin)`、星星亮點、夜空點狀精靈、草被推開等寫法。
- **修法／防呆**：改為 `1.0 - smoothstep(小, 大, x)`（數學等價）。`tests/cloud-shader.test.mjs` 掃整個 `src/`，**字面數字**邊界反向就失敗。
- **限制**：邊界是**表達式**、執行時才反向的情況沒有機械式保證。
- **回歸證據**：單測與 CI PASS；夜空截圖（星星、銀河）正常；真機 NOT RUN（Issue #45）。

### PV-038｜平面雲層在低仰角被拉長，雲變成一根一根的細棍

- **類型／狀態**：`HISTORY / RESOLVED-CODE`（PR #34）；殘留見 Issue #47。
- **現象**：天空下半部（仰角低）的雲是細橫條，不像團狀的雲。
- **證據**：使用者手機截圖；`plane = ray.xz / max(ray.y, 0.035)` 在仰角 0.04 時拉長約 25 倍。卷雲原本以 10:1 筆畫繪製。
- **修法／防呆**：共用 `skyPlane()`（`ray.xz / (0.28 + 0.72 * y)`，上限約 3.5 倍），**天空與地面雲影共用同一函式**，頭上那朵雲仍是投下影子的那朵；卷雲改約 3:1；地平線淡出起點略抬高。
- **限制**：積雲在低仰角仍有斜向拖影（平面透視拉長，只壓不消）。
- **回歸證據**：`tests/aerial-cloud-integration.test.mjs` 檢查 `skyPlane` 與兩處使用；SwiftShader 三個時段截圖；使用者後續未再提棒狀，但**未明確確認**，真機 NOT RUN。

### PV-039｜雲飄得太慢，而且逆風

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（PR #36）。
- **現象**：天空的雲幾乎不動，與地面影子的視覺速度不一致。
- **證據**：`uv = P/LS + uCloudWind*(0.02*LW)`：雲高 210 m、風速約 0.9 m/s，角速度約 0.25°/s；且 uv 加上漂移，雲向**反風向**移動，與陣風、煙霧相反。
- **修法／防呆**：`LW` 改為「每單位漂移的世界距離」，低層約 1°/s、高層約 0.25～0.5°/s，順風；天空與雲影 pass 讀**同一行** `uv = (P - uCloudWind*LW[id]) / LS[id]`，必然同步。單測限制各層角速度範圍（太慢或太快都會失敗）。
- **回歸證據**：單測 PASS；**實際飄移速度沒在真機計時**（風速隨天氣變化）：NOT RUN。

### PV-040｜太陽圓盤的亮度乘數過大，被色調映射壓成白色

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（PR #36）。
- **現象**：天空是橘紅，太陽圓盤卻幾乎永遠是白黃色。
- **證據**：圓盤為 `uSunColor * vec3(20, 17, 13)`；HDR 值很大時，AgX 色調映射會把飽和度壓掉。
- **修法／防呆**：圓盤色相隨高度由白黃→橘→橘紅，亮度由 18 降到 2.4（貼近地平線）；日冕同色調；低太陽的主光色鍵值也更紅。
- **教訓**：在 HDR＋色調映射下，要紅就要**降低亮度並提高飽和度**，不是加大亮度。
- **回歸證據**：單測鎖住色階；SwiftShader 四個太陽高度截圖；真機 NOT RUN（Issue #45）。

### PV-041｜光柱（god rays）在白天把亮雲拖成放射狀煙霧

- **類型／狀態**：`HISTORY / RESOLVED-CODE`（PR #36）。
- **現象**：藍天上有白色放射條紋，像煙霧（使用者截圖）。
- **證據**：`host.setRayScale(liveSky.sunRays * (1 + 1.4 * twilight))` 白天恆開，太陽在畫面上方時，後製把亮雲沿徑向拖開。
- **修法／防呆**：只在日出日落（`twilight`）出現：`Math.min(1, sunRays * twilight * 1.6)`。
- **回歸證據**：單測檢查該式；真機 NOT RUN。

### PV-042｜雲邊緣太銳利像黏土；少雲時雲零碎

- **類型／狀態**：`HISTORY / RESOLVED-CODE`（PR #36；**偏主觀**，蓬鬆程度可再調）。
- **現象**：雲像黏土；少雲時是散開的小片，而不是幾大團。
- **證據**：使用者回報；積雲密度 `smoothstep(edge-0.01, edge+0.07, d)` 邊緣窄、明暗落差大。
- **修法／防呆**：邊緣改長而柔的漸層（`edge-0.16 … edge+0.22`）、明暗調柔；新增低頻「群聚場」讓峰值合併成少數大塊；積雲格寬 70→95（仍 ≤100，雲影仍是可走進走出的區塊）。
- **回歸證據**：單測鎖住式子；SwiftShader 只有積雲的三種雲量截圖；真機 NOT RUN。

### PV-043｜被新提交取代而取消的 CI，讓總關卡誤報失敗

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（PR #51）；**待在真實連續推送中確認：NEEDS-VERIFY**（Issue #50）。
- **現象**：連續推送時，舊提交的必要總關卡因 `VERIFY_RESULT: cancelled` 判失敗，產生失敗通知（2026-11-08 連續 3 則假失敗，淹沒真失敗）。
- **證據**：CI 日誌；`.github/workflows/ci.yml` 舊的兩行 shell 判斷。
- **修法／防呆**：`scripts/check-gate.mjs`＋`gateDecision`：只有「被取消且已被更新的提交取代」視為過時；真失敗、最新提交被取消、查不到最新提交**仍失敗**。
- **回歸證據**：單測涵蓋各情況；PR #51 的 CI 以新總關卡跑過（全部成功時通過）；連續推送的實際觀察 NOT RUN。

### PV-044｜WASD：輸入法按鍵值不是 W，低 FPS 下走路變慢

- **類型／狀態**：`CODE-VERIFIED / RESOLVED-CODE`（PR #44）；真機 NOT RUN（Issue #53）。
- **現象**：WASD 走不動（玩家回報）。
- **證據**：`input.ts` 只認 `KeyboardEvent.key`；`main.ts` 每幀移動被夾在 0.05 秒。軟體 GPU（約 2 fps）對照：修復前拉丁 `w` 0.42 m/s（約 10% 速度）、輸入法（key=ㄈ、code=KeyW）0 m/s；修復後 4.15 m/s，輸入法也能走。
- **修法／防呆**：優先認 `event.code`；步行以實際時間推進、50ms 小步進保持碰撞、追趕上限 0.5 秒。
- **限制**：真機低於約 2 fps 時速度仍被限制；根本解法是效能（Issue #46、#52）。
- **回歸證據**：單測與 e2e PASS；實體鍵盤／輸入法／手機 NOT RUN。

### PV-045｜審查截圖的工具陷阱（軟體 GPU）

- **類型／狀態**：`HISTORY / RESOLVED-PROCESS`（本期作業中踩到的錯，皆已處理）。
- **內容**：
  - **shader 編譯錯誤會讓天空安靜地壞掉**：`uHalo` 未宣告，截圖「看起來正常」；審查截圖必須同時看 console 輸出。
  - **兩個軟體 GPU 瀏覽器同時跑會產生空白幀**：一次只跑一個。
  - **審查模式凍結時間**：依 `uTime` 才執行的 pass 只會跑一次；改用幀計數器。
  - **以為的統計值要量**：雜訊平均值假設是 0.37，實測 0.53，閾值要依實測調整。
  - **執行期 id 迴圈在軟體 GPU 慢約 30%**：十層雲改成常數 id 的巨集展開（A/B 交錯量測 1.07 vs 1.09 fps）。
- **回歸證據**：`tests/cloud-shader.test.mjs` 檢查展開順序與保留字；相關效能數字只是軟體 GPU，**不代表真機**。

### PV-046｜以為 repo 設定能把外掛帶進雲端 session

- **類型／狀態**：`HISTORY / RESOLVED-PROCESS`（Issue #79、#81；PR #80、#85）。
- **現象**：Owner 要在雲端啟用 Serena 與 Ponytail。
- **證據**：官方文件（Configure cloud environments）：repo 的 `.claude/settings.json` 的 `enabledPlugins`／`extraKnownMarketplaces` **雲端 session 不會安裝**；可帶入的是 `.claude/skills/`、`.claude/agents/`、`.claude/commands/` 與 `.mcp.json`。Ponytail v5 是外掛（非 MCP），Serena 是 MCP。
- **做法**：Serena 走 `.mcp.json`（釘版 `serena-agent==2.1.0`，實測在合併後的同一 session 載入）；Ponytail 只帶入 skill 本體（釘 v5.3.3、sha256 受測試保護），hook 不帶入。
- **回歸證據**：單測保護釘版；Ponytail 實際行為差異 NOT RUN（Issue #81）。
