# 2026-11-04 工程修復交付清單（PR #5）

目的：修復 7 項架構缺口及 Repo 治理可追溯性，先支援通用 Three.js 技術實驗，不建立未核准的遊戲。

| 原審查問題 | 修正檔案／方法 | 驗證層 |
| --- | --- | --- |
| P0 舊 host 只適合 WebGLRenderer | `src/rendering/renderer-port.js`，統一 async initialize/draw、context state、resize、render scale；舊 host 僅相容 adapter | Node mock；WebGL2 browser lab |
| P0 缺真正 WebGL 畫面與 Playwright | `lab/index.html`、`lab/main.ts`、`e2e/lab.spec.mjs` | Vite build + Chromium desktop/mobile viewport |
| P0 tool registry 沒有驗證／timeout／cancel | `src/integrations/tool-registry.js` input/output validator、AbortSignal、TimeoutError、unregister abort、major version | Node contract regression |
| P1 scene 初始化失敗可能留下 active 的錯誤狀態 | `src/platform/scene-controller.js` 先準備新場景，commit 前 rollback | Node lifecycle regression |
| P1 glTF companion 和未登錄資產缺檢查 | `src/platform/asset-manifest.js`、`scripts/check-assets.mjs`、manifest | Node + SHA256/URI |
| P1 畫質只有固定 preset | `src/rendering/quality.js` adaptive scale with hysteresis；lab 提供觀察 | Node deterministic + browser |
| P1 尚無 build／typecheck／瀏覽器測試 | `package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.mjs`、Playwright + read-only GitHub Actions | CI 逐階段實際執行 |
| 治理可能未強制 PR/Checks | `docs/governance/BRANCH-PROTECTION.md` 保留查證與人工 Gate | GitHub 設定待 Owner 證實 |

## 正確的驗收用語

- **S0/S1**：Node tests 只證明主程式及 adapter 契約。
- **S2**：Vite/TS 成功才叫可建置；main/(root) 不等於 lab 已部署。
- **S3**：Playwright 是 Chromium 真瀏覽器，手機測試為 viewport 模擬。若 runner 無 WebGL2，通過 fallback 測試**不能冒充 GPU render pass**。
- **S4**：POCO/Android Chrome、iOS Safari 真機的 GPU/熱/耗電均 **NOT RUN**。
- **WebGPU + TSL**：已保留可換後端的 Port，但尚未接入第二個實際 GPU adapter。

## 後續刻意不做

不強制引入 ECS、完整大世界 Streaming、物理、釣魚系統、NPC、自動更新神經網路、Serena MCP 或第三方資產。新遊戲的提案仍需 Owner 審批，避免技術架構先替玩法做決策。

## 研究與更新來源

- [Three.js WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer)
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer)
- [Vite 靜態部署](https://vite.dev/guide/static-deploy)
- [TypeScript module resolution](https://www.typescriptlang.org/tsconfig/moduleResolution)
- [Playwright CI](https://playwright.dev/docs/ci)
- [Node.js 發版週期](https://nodejs.org/en/about/previous-releases)
- [Research- 原始研究](https://github.com/waydefu/Research-)

依賴版號以 `package-lock.json` 所記錄的實際 resolved 為準，不使用浮動 `latest` 發布。
