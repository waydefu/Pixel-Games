# Pixel-Games — 原創中世紀海岸 HD-2D

只有一個網站入口：**https://waydefu.github.io/Pixel-Games/** 。開啟就進入滿版遊戲，沒有首頁、作品列表、額外 demo 或舊地城版本。

已合併的 **P1-R1 美術重製版（PR #7）**：原創像素角色、手作質感材質、木構石牆聚落、瓦片斜屋頂、海岸碼頭、布帆、船隻、林木與暖色黃昏。沒有任何現代式街燈；光源來自日光、壁掛燭燈及窗戶。視角為固定的 Three.js 3/4 Quarter View，WASD／方向鍵與手機虛擬搖桿自由移動。

目前仍是 **小型可探索視覺切片，不是完整開放世界**；釣魚、NPC 作息、建造、職業、存檔尚未實作。美術以使用者指定的 [Bells of Evermere](https://lumina-static-584822.gitlab.io/game.html?campaign=bells-of-evermere) 作為品質標竿，但**沒有複製其程式、貼圖、角色、劇情或其他作品資產**。來源與美術技術界線見 [ART-DIRECTION](docs/ART-DIRECTION.md)。

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

**驗證邊界：** 桌機／手機 viewport Chromium 成功不等於 Android/iOS 真機及 GPU/熱降頻測試已通過。
