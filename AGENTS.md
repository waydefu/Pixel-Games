# Pixel-Games Agent 指引

目標：**進入 GitHub Pages 根網址就看到全視窗的原創 2.5D 海岸探索場景**。鏡頭參考《棕色塵埃 2》常見斜上方 Quarter View，但不重用其任何角色／場景資產。遊戲入口已從作品列表改為單頁，未來不得在未授權情況下恢復 Landing Page。

1. 先讀 [docs/INDEX.md](docs/INDEX.md)、[ADR-0003](docs/decisions/ADR-0003-direct-game-root.md)，再用 git/rg 精確查檔案。
2. `src/game/` 管理 player input/world/camera，`src/rendering/` 管理渲染契約與品質，`src/integrations/` 是可信 host 的工具 adapter；新增工具不應侵入 gameplay。
3. 玩家按 `index.html` 直接看到 100dvh 3D 場景。主要操作：WASD／方向鍵及手機搖桿。真正 Fullscreen API 需要使用者點擊觸發，不能假設頁面載入自動隱藏瀏覽器工具列。
4. 所有外部參考僅作視覺／技術研究，禁止無授權搬用素材、音效、Shader 或原始碼。不要自行新增大型遊戲／任務／職業系統。
5. `npm ci && npm run validate && npm run test:e2e`，實測結果分 Node/Build/Chromium/真機，不要互相混淆。
6. 如需更改 Pages、Ruleset、MCP、Secrets、合併 PR 或部署權限，先取得 Owner 明確批准；只在分支開 PR。
7. 主要技術 Three.js r187 + Vite8 + TS7，固定 lockfile；不要為了追最新盲升版本。

共用 Skills 在 `.agents/skills/`，新畫面要遵守像素清晰、可閱讀、safe-area、碰撞位置與視覺一致。
