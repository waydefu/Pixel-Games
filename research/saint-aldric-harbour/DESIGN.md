# 聖奧爾德里克港 — 設計規格（給實作代理人）
專案目錄（唯讀基準）：（本機暫存目錄）
技術：three.js r187 + WebGL2 + Vite；單檔輸出（`npx vite build && node inline.mjs out/<名稱>.html`）；全部程式生成，**禁止外部圖片/模型/音檔/字型/網路請求**；介面文字用繁體中文；程式註解用英文或中文皆可。
對標地點：德國波羅的海岸 維斯馬(Wismar)，北緯 53.9°。時代：13–15 世紀漢薩城市。預設季節夏季。

## 0. 工作規則（必讀）
1. **在你自己的副本工作**：`cp -r town <你的目錄>`（排除 out/ dist/ 可），再 `ln -s /home/user/Pixel-Games/node_modules <你的目錄>/node_modules`。不要修改 town/ 原目錄。你的建置輸出用 `out/` 在你自己的目錄。
2. **檔案所有權**（避免合併衝突，只改自己的檔案；其他檔案若必須改，改在自己的新檔並在 CHANGELOG 寫整合說明）：
   - 代理 A（世界與建築）：world.js、houses.js、landmarks.js、harbour.js、boats.js、town.js、textures.js、terrain.js、mesh.js、preview.mjs，以及新檔。
   - 代理 B（生態、季節、玩法）：plants.js、vegetation.js、materials.js、terrainmat.js、townmat.js、water.js、game.js、main.js、weather.js、sky.js、post.js、menu.js、save.js、settings.js、index.html，以及新檔（farm.js、inventory.js…）。
3. **保持既有介面**：`buildWorld()` 回傳的 W 欄位名稱（W.buildings、W.landmarks、W.wall、W.roads、W.square、W.quayPts、W.harbour、W.H、W.coastS、W.roadDistAt、W.inSquare、W.normal、W.grid、W.landmarkSites…）不得刪改，只能新增欄位；A 若改變數值語意須在 CHANGELOG 說明。
4. 截圖測試：`NODE_PATH=$(npm root -g) node shot.cjs out/x.html out/x.png "<query>" <w> <h> <逾時秒> "<eval JS 或空>" <eval後等待ms>`。無頭 Chromium + SwiftShader 很慢（單張 30–150 秒）。**快速測試請用** `autostart=1&still=1&hour=16&q=low&rs=540&noscale=1&cx=..&cy=..&cz=..&tx=..&ty=..&tz=..`（固定相機；cx 參數會讓船隻不會更新，需要時用 eval 呼叫 `window.__game.setStarted(true);window.__game.update(0.02, window.__t, 0.3);window.__game.setStarted(false)` 再設相機）。每個功能最多 2–3 張截圖，不要重複截圖消耗時間。Bash 單次指令逾時 10 分鐘，截圖請一次一張或加 `timeout 550`。
5. 效能預算（手機旗艦）：靜態三角形總量 ≤ 約 250 萬、draw call ≤ 約 250；新增重內容必須掛在畫質檔位 TIER（settings.js 的 low/med/high/ultra）。單檔輸出目標 ≤ 1.2 MB。
6. **不要頻繁回報**。全部做完才用最終訊息回報一次（≤450 字）：做了什麼、通過／失敗／未驗證（誠實，NOT RUN 要寫）、已知問題、CHANGELOG 路徑、截圖路徑。同時在你的目錄寫 CHANGELOG.md（變更檔案清單＋整合說明＋測試方法）。
7. 不確定的決策：選保守方案並寫進 CHANGELOG，不要停下來問。
8. 誠實：沒驗證的不要說驗證過；看不到的畫面不要描述成「看起來很好」。

## 1. 已確認決策
- 完整生態：花/草/灌木/樹木每一層多物種；四季（春夏秋冬）影響植被外觀、作物、天氣、日照。
- 畫質檔位低/中/高/極高，皆可降；低檔可低於 1080p（已實作於 settings.js/main.js，需驗證）。
- 解析度：低 720–1080、其餘 1080–1440（短邊 px）。
- 玩法加入：釣魚加深、種田（中世紀作物＋四季）、背包、存檔（localStorage＋匯出/匯入 JSON，已有 save.js/menu.js 骨架）。
- 水平縮約 1:2、高度保持真實；保留山丘城堡（藝術自由）；排除現代引入種；後世建築換中世紀版本。

## 2. 曆法與光線（已在 game.js/sky.js）
- 一年 32 遊戲日（每季 8 日），一日 = 24 分鐘真實時間。`game.calendar()` 回傳 {yd, season(0春1夏2秋3冬), seasonName, dayOfYear, seasonT(0..1), day}。dayOfYear=(80+yd/32*365)%365。預設起始 yd0=9（初夏）。
- 太陽：緯度 53.9。夏至正午仰角 59.5°、日長約 17.1h、整夜航海暮光（最低約 −12.7°，天空不全黑，地平線北邊暗藍）；冬至正午 12.7°、日長約 7.4h。
- 光色：日出日落約 2000K 橙；金色時刻約 3500K；正午 5500–6000K；陰天約 6500K。陰影被藍天照亮偏藍。夜間 Purkinje（紅色變暗、偏藍、降飽和）— post.js 的 uDark。
- 季節天氣權重 [晴,多雲,雨,暴風雨]：春[.34,.36,.27,.03]、夏[.50,.30,.15,.05]、秋[.18,.36,.34,.12]、冬[.15,.55,.30,0]；冬季下雨處改為下雪（待實作：雪粒、積雪 uniform）。

## 3. 生態對標（維斯馬海岸，物種存在多為文獻可信，高度/花期為估計）
群落由「離岸距離 L=-coastS、高度 H、坡度、濕度(近水低地)、雜訊」決定。排除：Rosa rugosa、刺槐、花旗松；平地大片雲杉＝近代造林，**不要**；松與樺只在沙質／高處／沙丘後方。
| 地帶 | 條件(約) | 物種(中文/拉丁) | 外觀 |
|---|---|---|---|
| 沙灘 | 岸線 0–12m | 海灘芥 Cakile、海濱山嵛菜 Honckenya | 稀疏匍匐，黃綠、粉紫小花(6–9月) |
| 白沙丘 | L 10–40 | 濱麥 Ammophila(高0.5–1.3m,藍綠捲葉,5–7月花序)、Leymus、海濱刺芹 Eryngium(藍灰刺葉,7–8月藍紫)、沙棘 Hippophae(銀灰葉,0.5–5m灌叢,橙果8–12月) | 叢狀，覆蓋10–30% |
| 灰沙丘/荒地 | L 20–100,沙質 | 銀須草 Corynephorus、Sedum acre(黃花6–7月)、匍匐柳、石楠 Calluna(粉紫8–9月)、樺 Betula pendula、歐洲赤松(僅此處) | 低灌＋疏林 |
| 鹽草甸 | L<40,H<2.2,平坦 | Puccinellia、Juncus gerardii、海薰衣草 Limonium(紫7–9月)、海紫菀 Aster tripolium(淡紫8–10月)、Glaux(粉白6–8月)、車前 | 5–30cm 矮草皮(放牧) |
| 蘆葦帶 | 水深0–1m 或水邊 | 蘆葦 Phragmites(高到4m,近單種,葉青綠,花序褐紫7–9月)、香蒲 Typha(高2m) | 高草牆 |
| 赤楊濕林 | 低窪濕地 H<3,L30–90 | 黑赤楊(20–25m,暗綠橢圓冠)、灰柳、黃菖蒲(黃5–6月)、沼澤金盞(黃4–5月) | 水邊林 |
| 草地 | 開闊平地(預設) | 燕麥草/鴨茅(禾草)、雛菊 Leucanthemum(白黃,5–7月成群)、毛茛(黃)、紅三葉(紅紫)、野豌豆(藍紫)、蓍草(白)、矢車菊(藍)、罌粟(紅,田緣)、百脈根(黃)、蒲公英(黃)、野胡蘿蔔/白傘形花 | 花成叢(以低頻雜訊分區，每叢一主色) |
| 樹籬 Knick | 田界線 | 榛、山楂(白5月)、黑刺李、野薔薇 Rosa canina(粉白6月)、接骨木(白傘房6月)、黑莓；少量山毛櫸/櫟作高樹 | 土埂高約1m寬2m＋灌木 |
| 庭園/果園 | 城內與近屋 | 蘋果、梨、甜櫻桃、李(行距6–8m)；花壇:矢車菊、錦葵、薰衣草、蜀葵、金盞花 | 小樹＋花壇 |
| 山毛櫸林 | 內陸 H>6 或 L>150，雜訊密度 | 山毛櫸 Fagus(30m+,枝下高10–20m)、櫟 Quercus robur(寬圓冠)、鵝耳櫪、椴(卵形密冠)；林下春季銀蓮/野蒜(3–5月白花,6月後枯)、車葉草；樹冠閉合後6–8月林下暗，只有苔蕨落葉；倒木、蕈(8–10月) | 主林相 |
| 櫟-鵝耳櫪林 | 山毛櫸不佔優處 | 櫟上層、鵝耳櫪第二層、野櫻、血紅槭、榛 | 混交 |
樹種參考（冠幹比/形狀）：橡 寬圓頂寬≈高、粗曲枝；椴 卵形密、枝向上45–60°；樺 窄卵疏、白皮黑斑、小枝下垂；楊 柱形高寬比4–5:1；柳 短幹傘形、枝條垂近地；蘋果 低矮開展(高約4m)；歐洲赤松 老樹幹長冠偏上；雲杉(僅高處/小群，非平地主林)。
葉色(sRGB約)：橡(60,85,35)、樺(95,130,55)、雲杉(30,60,40)；樹皮：橡深灰褐(70,60,50)、樺(215,210,200)+黑斑。PBR：葉 albedo 線性 0.05–0.15、粗糙度 0.5–0.7；樹皮 0.05–0.2、粗糙度 0.8–0.95。
**四季外觀**：春—新葉淡黃綠、花多(銀蓮/蘋果花/山楂)；夏—深綠、草甸花；秋—山毛櫸銅黃褐、樺黃、橡褐、楊黃，部分落葉、石楠/紫菀；冬—落葉樹光禿(只剩枝幹)、常綠(松/雲杉)保留、草枯黃/積雪、花消失。以季節 uniform（uSeason 0..3 + seasonT）在著色器調色與丟棄部分葉片(用每片葉的隨機值 vs 落葉進度)。
植被技術清單(研究)：葉卡法線由樹冠中心外推(球化)＋雙面照明；頂點色 AO(內暗外亮)；背光透光 pow(saturate(dot(V,-L)),4)×黃綠色＋包裹漫射；alpha-to-coverage(MSAA)；風分層：樹幹彎曲/枝條相位/葉片高頻，50 單位外停用；**分格視錐剔除**(每 64m 一個 InstancedMesh，frustumCulled=true 並設正確 boundingSphere)；LOD：近景完整樹、中景交叉卡片、遠景低面數替身；草：刀片 3–5 段、遠處減量加寬、根部 AO、法線 25–60% 混向上、風只推葉尖、側視加寬、背光透光；野花成叢(低頻雜訊分區＋少數色盤＋抖動)。

## 4. 維斯馬城鎮平面（設計，非實測）
真實：老城約 1000×800m(88ha)、近 1800 棟房；Markt 約 100×100m；規劃式格網街道；1276 圍牆、5 座城門(僅存 Wassertor 約 1450 磚哥德)；港口在城牆外近 St. Nikolai(水手教堂，中殿高 37m)；St. Marien(中殿拱頂 32.2m、塔 80.5m)在 Markt 旁；Grube 運河(13 世紀中)從東邊引水穿過城北；Alter Hafen 約 1775 才定型，中世紀港池只能推想；波羅的海近無潮汐。
**本專案取 1:2 水平縮放、高度真實**：
- 城牆環約 500×400m(目前世界座標中心附近，現有牆 R≈128m 需擴大到約 R_x 250 / R_z 200 的橢圓或不規則環，5 座城門，外有約 12–15m 護城壕(乾壕即可，水位問題見下)，磚砌塔)。
- 市集約 70×70m；中央中世紀井亭(開放式木/石天篷罩井，取代 1602 的 Wasserkunst)；北側磚造市政廳/行會廳(拱廊)；Marien 型大教堂靠近市集(中殿高≥30m、塔 60–80m、磚哥德、飛扶壁/扶壁、尖拱高窗)；Nikolai 型教堂靠近港口(中殿高 35m)；再一座小教堂/修道院(Heiligen-Geist)。
- 房屋：北德磚造山牆房(Giebelhaus，階梯形山牆、紅褐磚、黑釉磚線、紅陶瓦)與 Dielenhaus(窄正面 6–10m、長進深 20–30m(縮放後)、3–4 層＋閣樓、前屋面街、後院 Speicher)為主；半木構(Fachwerk)為輔(後屋與小街)；城外農舍用蘆葦(Reet)屋頂。層高：底層約 3.2m、上層約 2.6m，山牆頂 15–22m。目標建築數 350–450 棟(視效能)。
- 港口在城牆外：港池＋棧橋＋兩道防波堤(已有)＋橫欄木 Baumhaus(港口入口兩堤頭之間的浮木欄，夜間封港)＋Speicher 倉庫列＋魚市＋網架＋斜坡船台＋木製踏輪起重機(塔高 25–28m，雙輪直徑 4–6m)＋燈塔(已有)。
- 水位限制：目前水面是全域 y=0 的海面；**不要**嘗試高於海面的水(Grube/護城壕水)——若要做，須另做獨立水帶網格(扁平條帶＋流動法線)，否則改為乾壕/石砌溝。

## 5. 港口與船建模規則（研究，部分推測）
1 柯格船長 22–24m、寬 7.6m(約3:1)、舷高 4m、空載吃水 1.25m；2 桅高約 21m 位於船中偏前，單面方帆 150–200m²；3 船尾中置舵、首尾樓、搭接舷側、橡木深棕；4 小柯格長 15–18m寬5m，漁船/渡船長 6–8m寬 1.6–2.5m、4 槳；5 棧橋寬 2.5–4m長 15–40m、垂直於岸、間隔拉開；6 木樁每 1.5–2m 一根，樁頂高於水位約 1m，外側貼水平護木；7 石砌壓頂寬約 0.6m，每 6–8m 一個繫纜柱/環，台階入水；8 踏輪起重機立於碼頭邊緣(塔高 25–30m)；9 倉庫為窄面向水的木構山牆，地窖石砌；10 色板：焦油黑木、石灰白牆、紅陶瓦或茅草、魚網曬架、斜坡船台。

## 6. 玩法規格（代理 B）
### 背包 inventory
`G.inv = { coins:number, items:{ [itemId]:count } }`，已在存檔 schema（save.js `inv`）。UI：按 I 或選單開關的面板，顯示種子、作物、魚、材料、金幣；手機有按鈕。物品 id 例：`seed_barley`、`crop_barley`、`fish_cod`…。上限不設或 200/格。
### 釣魚加深
魚獲進背包（不再只記錄）；魚種依季節/時段/水深/天氣調整機率（夜晚鰻魚↑、雨天咬鉤↑、冬季種類減少、鮭魚秋季↑）；魚圖鑑（已釣種類、最大體長）顯示在選單；保留現有蓄力拋竿→等待→咬鉤→收線張力流程；加入簡單餌（蚯蚓，無限）與「魚簍」不用做。
### 種田（中世紀作物，禁止馬鈴薯/番茄/玉米等新大陸作物）
農地：玩家的農場位於城牆外緣陸側的平坦草地（程式搜尋：坡度<0.08、離道路與建築>8m、離岸>40m、離城牆 20–80m），6×6 格、每格 2×2m（可再擴）。
作物表（成長日數為遊戲日，播種季、收成量、單價金幣）：
| 作物 | 播種季 | 成長日 | 收成 | 單價 |
|---|---|---|---|---|
| 大麥 | 春 | 6 | 4 | 3 |
| 燕麥 | 春 | 5 | 4 | 2 |
| 黑麥 | 秋(越冬) | 8(冬季慢速) | 4 | 3 |
| 亞麻 | 春 | 6 | 2 | 5 |
| 豌豆 | 春,夏 | 4 | 3 | 4 |
| 蕪菁 | 夏,秋 | 3 | 2 | 3 |
| 甘藍 | 春,夏 | 5 | 2 | 5 |
| 韭蔥 | 春,夏 | 5 | 2 | 4 |
規則：冬季地凍不生長(黑麥例外慢速)；雨天自動澆水，未澆水者成長減半；霜(冬)使嫩苗枯死(黑麥除外)；非播種季不能播(提示)。工具：鋤(翻土)、種子袋(選擇種子)、水桶(從井或海邊取水)、鐮刀(收成)——做成「情境互動 E」：面對一格時依狀態自動執行(未翻→翻土；已翻→播所選種子；已播未澆→澆水；成熟→收成)，另有按鍵切換選擇種子。
視覺：翻土格(犁溝地面)、作物用實例化小網格依成長階段(種子丘→嫩芽→生長→成熟黃/綠/紫，各作物顏色不同)。商人：市集攤位 E 賣出全部作物/魚換金幣；種子在攤位購買。
存檔：`G.farm = { plots:[{i,j,crop,tilled,watered,progress(0..1)}], site:{x,z}, seedSel }`，載入後還原並依離線時間不推進(簡化)。
### 季節對玩法
季節由 `game.calendar()` 提供；HUD 顯示「季・第N日 時間」(已有)。

## 7. 畫質檔位（已實作骨架）
settings.js TIERS：low(720–1080,無 MSAA,2 級聯 1024,無泛光,草90,veg0.4,tex256)、med(1080–1440,MSAA2,3級聯1536)、high(MSAA4,3級聯2048,草170,veg1,tex512)、ultra(4級聯,草210,veg1.4,tex1024)。所有新重內容必須讀 TIER 參數縮放。

## 8. 技術教學（程式碼怎麼運作、怎麼加東西、踩過的坑）
### 8.1 座標與世界
- +x 東、−z 北、+z 南、y 向上，海平面 y=0。海在東南(SEA_N≈(0.62,0.78))。`W.coastS(x,z)`：>0 是海、<0 是陸；`W.H(x,z)` 含道路雕刻、地塊整平、碼頭平台、疏浚海灣的高度。`W.roadDistAt(x,z)`<0 在路上。
- 建築記錄 `b`：{kind, x, z, ax, az(寬度軸單位向量), hw, hd(半寬/半深), w, d, floors, front:{nx,nz}(指向街道), y0(地基高), road, seed}。地標 `W.landmarks.{church,guildhall,tavern}`。`W.wall={pts,gates,...}`，`W.harbour={moleS,moleN,centre}`，`W.quayPts`(岸線輪廓點)。
### 8.2 幾何建造 mesh.js（最重要）
- `MeshBuilder`：`quad(p0,p1,p2,p3,{mat,tint,ao|aoB,aoT,uvFn})` **四點必須從「外側看」為逆時針**，法線 = (p1−p0)×(p3−p0)；寫錯會整面消失(背面剔除)。判斷法：站在要被看見的那一側，p0 左下→p1 右下→p2 右上→p3 左上。`triFace(a,b,c)` 法線 = (b−a)×(c−a)。`box(cx,cy,cz,sx,sy,sz,{faces:"+x-x+y-y+z-z"})`、`beam(a,b,w,h,{up,faces:"ABCD"})`(A=up 面,B/D=側面,C=下面)、`cyl(cx,y0,cz,r0,r1,h,sides,{cap})`。`setFrame(cx,cz,ax,az,fx,fz,y0)` 讓你用局部座標(x 沿 a、z 沿 f、y 上)建房，`resetFrame()` 還原；用完一定 reset。
- `mat` 欄位＝材質層編號(textures.js 的 `L.名稱`)，glass builder 用 `mat:0` 且 `ao` 當作「亮窗」亮度(夜間發光)。UV 單位是公尺，貼圖每層有自己的平鋪尺寸(LAYERS 第二欄)。`uvFn(p)=>[u,v]` 可讓同一面牆的多塊 quad 對齊紋理。
- 一個區塊(64m)一組 MeshBuilder：`C.at(x,z)` 回傳 {T,G}。toGeometry() 屬性：position, normal, aUv, aMat, color(vec4: rgb 色調, a=AO)。
### 8.3 材質層 textures.js
- 在 `LAYERS` 陣列**尾端**加 `["名稱", 每塊公尺, 防重複(0/1)]`；在 RECIPES 的 GLSL 加 `M 名稱(vec2 uv){ M m; ...; m.a=反照率(線性); m.r=粗糙度; m.h=高度; m.ao=AO; m.b=凹凸強度; return m; }` 並在 `evalLayer` 加 `if (id == N) return 名稱(uv);`(N=陣列索引)。必須 tileable：用 `fbm(uv,P,oct)`、`gnoise(uv*P,vec2(P))`、`voro(uv,P,jit)` 這些整數週期函式，P 要是整數。`L.名稱` 自動可用。反照率值用線性(例 0.05–0.4)，不要超過 0.9。
### 8.4 著色器補丁 materials.js
- `patch(mat, edit, "唯一字串key")`：**key 必須是手寫的唯一字串**(打包器會改函式名，用 function.name 會讓不同材質共用同一程式→取樣器衝突錯誤 "Two textures of different types use the same sampler location")。`csmify(csm, mat)` 要在 patch 之後呼叫(CSM 會覆寫 onBeforeCompile)；所有受光的材質都要 csmify，否則太陽強度會被 3 個級聯光累加。
- 共用 uniform 在 `AU`(uTime、uWet、uNight、uSkyLUT、uSunDirW、uHaze、uCamW)。新增全域 uniform：加到 AU，並在需要的 shader 內宣告(`uniform float uXxx;`)。**頂點著色器要用的 uniform 也要在頂點著色器內另行宣告**(uTime 在 vertex 內要自己宣告)。
- 插入點：`#include <common>`(宣告)、`<begin_vertex>`(頂點變形，`transformed`)、`<map_fragment>`(設 diffuseColor)、`<roughnessmap_fragment>`、`<normal_fragment_maps>`、`<aomap_fragment>`。
### 8.5 實例化與草
- 樹/灌木用 `THREE.InstancedMesh`：幾何(樹幹用 townMat 的 builder 幾何，葉用 foliage 材質)。**InstancedMesh 的 frustumCulled 預設 true 但 boundingSphere 要涵蓋所有實例**；分格(每 64m 一個 mesh)才能真正剔除。草在 `plants.js makeGrass2`：頂點著色器用 gl_InstanceID 在鏡頭周圍網格放置、從高度貼圖取高度，不用 CPU 逐幀更新。
- 葉子貼圖在 vegetation.js 的 `FOL_FS` 於啟動時 GPU 烘焙(kind 0 闊葉/1 針葉/2 開花)；要新增種類就加 kind 並在 bakeFoliage 迴圈加一次。
### 8.6 遊戲迴圈
- main.js `boot()`：建 world→sky/CSM→貼圖→地形→城鎮→植被→水→天氣→game→主迴圈 frame()。`game.update(dt,time,sea)` 負責玩家、船、釣魚、HUD；**船的位置只在 game.update 內更新**。`ctx` 物件傳遞共用資源。HUD 元素 id 見 index.html。存檔 `game.collect()/restore(s)`、`save.js` 驗證版本(SAVE_VERSION，新增欄位要加驗證預設值與遷移)。
- 季節：`game.calendar()`；把 season、seasonT 傳給著色器請加 AU.uSeason/AU.uSeasonT 並在 main frame 內每幀設定。
### 8.7 驗證與除錯
- 看 console：shot.cjs 會印出 console 錯誤與 `[` 開頭日誌；著色器編譯錯誤會印出 `ERROR: 0:行號: 訊息`。行號是組合後的 shader，搜尋你的注入文字定位。
- `?dbg=1` 無；需要時在頁面內 `window.__game / __ctx / __sky / __weather` 可在 eval 呼叫。
- 邏輯測試用 eval 直接呼叫 `__game.update(...)`、`__game.keys.add('w')` 等模擬輸入(參考 DESIGN 既有範例：走路 80 步、船划行、釣魚狀態機)。
- 常見坑：①quad 繞序錯→面消失；②缺少 `#include` 注入點字串拼錯→replace 沒作用(之後用 grep 確認新 shader 字串確實出現在輸出)；③uniform 陣列大小=LAYERS.length；④GLSL ES 3.00 沒有隱式 int→float 轉換；⑤SwiftShader 很慢，不要在迴圈裡重複截圖；⑥改 W 的高度函式會連動牆/路/碼頭位置，改完先跑 preview.mjs 檢查俯視地圖。
### 8.8 不確定時的流程
1) 先自己查：WebSearch / WebFetch(three.js 文件、three.js discourse、Stack Overflow、GLSL 參考、維基)，把結論與來源寫進 CHANGELOG 的「查證」段。2) 查不到或查到互相矛盾 → 把**所有**待決問題彙整成「一則」訊息(每題附你查過什麼、你的建議答案)，用 SendMessage 傳給主指揮(名稱 main；若無法傳訊，就採保守方案並寫在 CHANGELOG 與最終回報的「待確認」)。3) 不要因為小事停下來問；不要連續多次發問。
