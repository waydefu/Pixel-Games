> **HISTORICAL：2026-11-05 工具快照**。現行套件／CI／功能請核對 `package.json`、`.github/workflows/verify.yml`、[FEATURE-STATUS](FEATURE-STATUS.json) 與 main；勿以此頁的「未接入」推斷 11/8 後狀態。

# 工程工具與技術狀態（2026-11-05）

此頁描述 2026-11-05 `main` 的工程配置；新 PR 及部署仍須查 GitHub 實際狀態。原 2026-11-04 工具盤點保留於 [歷史快照](history/TOOLING-2026-11-04.md)，不可拿當作今天的實作證據。

| 項目 | 目前用途 | 判定 |
| --- | --- | --- |
| Three.js `0.187.0` | WebGL2 Quarter-View、程序美術與燈光 | 已導入 |
| TypeScript `7.0.2` + Vite `8.3.5` | 單一遊戲入口，編譯到 `dist/` | 已導入 |
| Playwright `1.64.1` | Chromium 桌機與手機 viewport 基本操作及 Shader console | 已導入 |
| Node 26 LTS / npm ci | CI 建置及單元測試 | 已導入 |
| `src/rendering/` | Renderer Port、品質、資源回收與幀間隔量測 | 已導入 |
| `src/platform/` | 資產、clock、viewport、scene-controller 等可重用工程能力 | 已恢復；不是遊戲自動載入模組 |
| `src/integrations/tool-registry.js` | 可信 Host 的能力註冊與 timeout／AbortSignal 契約 | 已恢復；**沒有自動接入 MCP** |
| `scripts/graphics-matrix.mjs` | 畫面 Buffer 預算試算，不是 GPU benchmark | 已恢復 |
| `.agents/skills/` | 按需的程式、研究、素材、WebGL QA 操作指引 | 已恢復；不等於自動執行 |
| GitHub Pages | Actions 透過 `dist/` 發布 `/Pixel-Games/` | GitHub Actions 單入口發布；最新部署 SHA 另行查證，不以合併成功代替部署驗收 |
| WebGPU+TSL、glTF-Transform、Tiled | 候選研究 | **未接入** |
| Serena MCP（**開發用工具，不屬於遊戲**） | repo 根目錄 `.mcp.json` 以 `uvx` 啟動，**釘版 `serena-agent==2.1.0`**（`--context claude-code --project-from-cwd`）；Issue #79。`.serena/` 不進版控。停用：移除 `.mcp.json` 的 `serena` 項。雲端 session 只在啟動時載入 MCP，合併後要開新 session | 已設定；**新 session 實際載入與工具集：NOT RUN**。Ponytail（Claude Code 外掛，非 MCP）**未啟用**，待 Owner 決定 |
| 真 Android／iOS、溫度、耗電與長時間 GPU 時間 | 真機 QA | **未驗收** |

```sh
npm ci
npm run validate
npm run test:e2e
npm run graphics:matrix
```

**工具與研究應有生命週期註記，不應因更換世界美術就刪掉。** 可重用核心與歷史決策不會進入 Vite 玩家 bundle，除非遊戲入口明確 import。
