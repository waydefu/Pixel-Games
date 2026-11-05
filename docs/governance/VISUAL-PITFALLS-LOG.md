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
### PV-032｜<精確標題>
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
- 後續每次 G PR：先重查證據，修復時補 Commit／測試／對照圖；若調查排除某項，記錄「已證偽」而非抹掉歷史。定期把重複根因合併，ID 保留便於 PR 回溯。
