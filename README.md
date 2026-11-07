# Pixel-Games — 原創中世紀海岸 HD-2D

只有一個網站入口：**https://waydefu.github.io/Pixel-Games/** 。開啟就進入滿版遊戲，沒有首頁、作品列表、額外 demo 或舊地城版本。

已合併的 **P1-R1 美術重製版（PR #7）**：原創像素角色、手作質感材質、木構石牆聚落、瓦片斜屋頂、海岸碼頭、布帆、船隻、林木與暖色黃昏。沒有任何現代式街燈；光源來自日光、壁掛燭燈及窗戶。視角為固定的 Three.js 3/4 Quarter View，WASD／方向鍵與手機虛擬搖桿自由移動。

目前仍是 **小型可探索視覺切片，不是完整開放世界**；房屋內部、NPC 作息、建造、職業、存檔尚未實作。美術以使用者指定的 [Bells of Evermere](https://lumina-static-584822.gitlab.io/game.html?campaign=bells-of-evermere) 作為品質標竿，但**沒有複製其程式、貼圖、角色、劇情或其他作品資產**。來源與美術技術界線見 [ART-DIRECTION](docs/ART-DIRECTION.md)。

## 開發和測試

需要 Node.js 26 LTS（CI；本機 Node >=24）、`npm ci`：

```sh
npm ci
npm run dev
npm run validate     # JS syntax + assets + Node tests + TS7 + Vite8 + size budget
npm run test:e2e     # Chromium desktop / mobile viewport；需先 install Playwright browser
npm run graphics:matrix  # 渲染 buffer 預算試算，不是 FPS benchmark
```

GitHub Pages 由 `.github/workflows/deploy-pages.yml` 在經審核合併後進行 `dist/` 部署；不會自動更改 Pages Settings。

## 現行程式結構

```text
index.html / styles.css   # 玩家唯一入口與 HUD
src/game/
  main.ts                 # 啟動／渲染迴圈／相機／設定
  world.ts                # 單一原創遊戲場景、角色移動
  art.ts                  # 程式原創像素材質與角色圖集
  kit.ts / batch.ts       # 共用建模／靜態物件合批
  architecture.ts         # 砌石、木構建築、屋瓦與生活道具
  environment.ts          # 地形、海岸、海水、自然、碼頭、船
  input.ts / navigation.js# 觸控／鍵盤與可測的碰撞
src/rendering/             # renderer-port／畫質／資源追蹤
src/platform/              # 共用 clock / registry / scene / viewport / asset metadata
src/integrations/           # 可信 Host 使用的工具契約（非瀏覽器自動接入）
.agents/skills/             # 按需的開發／素材／驗收 Skills
scripts/                   # 靜態／資產／建置驗證
tests/ + e2e/             # Unit／Playwright
.github/workflows/         # CI／Pages deployment
docs/                     # 現行規範／研究／歷史 ADR／部署治理
```

已淘汰的**遊戲首頁、舊地城場景與 lab 技術展示頁**不再存在。原本誤刪的研究紀錄、架構 ADR、部署治理、Agent Skills 與通用工程模組已恢復；它們歸在 `docs/`、`.agents/skills/`、`src/platform/`、`src/integrations/`，**不會變成第二個遊戲入口**。請見 [文件索引](docs/INDEX.md)。

## 操作

WASD／方向鍵移動，Shift 加速。手機使用左下角搖桿。右上角選單能選擇基本／平衡／高畫質，以及請求瀏覽器全螢幕（瀏覽器不能在頁面載入時自動強制隱藏工具列）。

P1-R2 將峽灣遠景、可切換的斜角／第一人稱／高處觀景三模式整合到同一個遊戲入口；鍵盤 `C`／`1`／`2`／`3` 或右上角按鈕切換視角，第一人稱可用滑鼠／觸控拖曳環視。峽灣山脈目前是遠景，並非已完成可登山地形。

**驗證邊界：** 桌機／手機 viewport Chromium 成功不等於 Android/iOS 真機及 GPU/熱降頻測試已通過。

海港漁船另由 `src/game/boats.ts` 建立具有收尖船首、木船舷、內部甲板、桅杆、帆布與繩索的原創模型；不再用壓扁球體假裝船體。


## P1-R3｜峽灣視覺品質重建（已合併 PR #11；歷史階段）

本輪不改單一遊戲入口，也不刪除研究、ADR、Agent Skills 或工程工具；聚焦第一人稱實際可見的近景與山海背景。

- 房屋 **真正的內凹窗**：`facade-geometry.js` 依門／窗孔洞分割外牆，窗框、玻璃與木條退進牆內，屋頂山牆採具開口的 `ShapeGeometry`；原本整面實心牆貼凸玻璃的做法已替換。
- **動態雙層雲**：`fjord.ts` 以 4-octave fBm 程序 Shader 呈現低雲和高層絲雲，依時間緩慢移動。不是昂貴的真體積雲或天氣模擬。
- **海洋新基線**：`ocean.ts` 在分段網格上做方向性波面位移、解析式法線、Fresnel 與天空近似反射及非規律海岸泡沫，替代原本整片重複的條紋貼片。**目前沒有宣稱已實作 SSR、FFT、真實折射或高品質環境反射探針。**
- **柔化峽灣與碼頭**：山麓坡形、分海拔岩草材質色彩及連續法線；排除碼頭上的大型礁石；陰影視域跟隨玩家。

官方與研究依據／未完成事項詳見 [P1-R3 美術與渲染審查](docs/reviews/P1-R3-RENDERING-REVIEW-2026-11-05.md)。正式畫面、POCO F8 Ultra GPU 時間及長時間熱測試，仍以人工與真機驗收為準。

海岸邊界由 `coastal-outline.js` 和 `coastline.ts` 產生**有自然收尖弧度的草地／沙灘地形**，不再是一張突然中斷的矩形平面；峽灣東端改為有水深的出海水道，避免山壁直接封死海平線。

## 最新 HD-2D 狀態（2026-11-05）

- **已合併 [PR #21](https://github.com/waydefu/Pixel-Games/pull/21)**：統一 `src/rendering/hd2d-pipeline.js`（取代先前單獨的 `cinematic-post.js`、`effects-on-demand.js`）、HD-2D 像素材質、開放海灣、漁夫角色、日夜循環、Polyfork 合法授權資產與近城鎮樹木。作者自評約 **5～6/10**，仍有山體材質、遠山植被及曝光缺口，真機 GPU/FPS/熱測試 **NOT RUN**。
- **待合併 [PR #22](https://github.com/waydefu/Pixel-Games/pull/22)**：修正非窗戶物件錯誤發光、增加火把／掛燈實際光照、房屋比例一致性。本次核對 CI 已通過，但人工與真機畫面尚未驗收，**不視為 main 已有功能**。
- 目前**唯一現行狀態入口**：[docs/ROADMAP.md](docs/ROADMAP.md)。G1～G6 初版技術規劃保留為歷史背景，不能據此推定新版尚未開工。
