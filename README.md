# Pixel-Games — 原創中世紀海岸 HD-2D

只有一個網站入口：**https://waydefu.github.io/Pixel-Games/** 。開啟就進入滿版遊戲，沒有首頁、作品列表、額外 demo 或舊地城版本。

這是 **P1-R1 美術重製 PR**：原創像素角色、手作質感材質、木構石牆聚落、瓦片斜屋頂、海岸碼頭、布帆、船隻、林木與暖色黃昏。沒有任何現代式街燈；光源來自日光、壁掛燭燈及窗戶。視角為固定的 Three.js 3/4 Quarter View，WASD／方向鍵與手機虛擬搖桿自由移動。

目前仍是 **小型可探索視覺切片，不是完整開放世界**；釣魚、NPC 作息、建造、職業、存檔尚未實作。美術以使用者指定的 [Bells of Evermere](https://lumina-static-584822.gitlab.io/game.html?campaign=bells-of-evermere) 作為品質標竿，但**沒有複製其程式、貼圖、角色、劇情或其他作品資產**。來源與美術技術界線見 [ART-DIRECTION](docs/ART-DIRECTION.md)。

## 開發和測試

需要 Node.js 26 LTS（CI；本機 Node >=24）、`npm ci`：

```sh
npm ci
npm run dev
npm run validate     # JS syntax + assets + Node tests + TS7 + Vite8 + size budget
npm run test:e2e     # Chromium desktop / mobile viewport；需先 install Playwright browser
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
src/platform/asset-manifest.js
scripts/                   # 靜態／資產／建置驗證
tests/ + e2e/             # Unit／Playwright
.github/workflows/         # CI／Pages deployment
docs/                     # 美術基準、架構與品質門檻
```

所有舊首頁、`lab/`、實驗用地城、未使用 platform registry／MCP adapter、舊研究彙總和過期 Agent Skills 已從目前工作樹移除；**Git 歷史仍保存先前提交，可追溯而不污染目前原始碼**。

## 操作

WASD／方向鍵移動，Shift 加速。手機使用左下角搖桿。右上角選單能選擇基本／平衡／高畫質，以及請求瀏覽器全螢幕（瀏覽器不能在頁面載入時自動強制隱藏工具列）。

**驗證邊界：** 桌機／手機 viewport Chromium 成功不等於 Android/iOS 真機及 GPU/熱降頻測試已通過。
