# Tool Integrations v0.2｜逐步接入，不污染遊戲核心

本 Repo 的 `src/integrations/tool-registry.js` 是**具可測契約的進程內能力路由**；不是 MCP Host、OS 沙盒或自動連接器。工具需由可信宿主明確接入，且實際檔案／網路權限要由宿主執行。

## 能力路由流程

```text
Human approval / CI policy / trusted host permissions
             ↓
  Asset Importer / QA Runner / IDE / MCP adapter
             ↓
    register(id, semver, handlers)
             ↓
  allowedCapabilities [default deny]
             ↓
  validateInput → run(input, {signal}) → validateOutput
             ↓
  Timeout / AbortSignal / unregister cancellation
             ↓
     caller receives result OR error
```

## 已存在的 API

`createToolRegistry({ allowedCapabilities })`：

- `register({id,version,handlers,dispose})` 註冊 adapter，驗證 namespaced capability、major semantic version；**不會自動讀取硬碟或安裝工具**。
- `handlers[capability]` 可用函式或 `{run, validateInput, validateOutput}`；validator 必須回傳 `true`（或直接 throw）。這是輕量 runtime 合約，正式複雜 payload 可以讓 adapter 自行使用 Zod/JSON Schema 等，但不要在此硬塞複雜通用 schema 引擎。
- `call({id,capability,input,signal,timeoutMs,requiredMajorVersion})` 必須在 allowlist 中，檢查提供者、major compatibility、input，然後執行；完成後檢查 output。
- 每次呼叫預設 `timeoutMs=10000`，可設為 1–60000；caller AbortSignal、逾時與 unregister 都會觸發內部 abort 並拒絕 caller Promise。
- **JS Promise 無法強制殺掉完全無視 AbortSignal 的 OS 子程序或網路請求**。adapter 必須合作處理 signal；CLI adapter 需要宿主程序管理和隔離。
- `list()` 和 `providersFor(capability)` 只提供靜態能力清單，不包含 secrets，也不自動選 provider。
- `unregister(id)`：先停止新呼叫，取消執行中的工具，再呼叫 adapter 自有 dispose()。

## 未來接入工具的正確位置

| Tool | Host 層 | 何時接入 |
| --- | --- | --- |
| Tiled／Aseprite／LibreSprite | 開發 CLI、build pipeline；輸出原創 asset manifest | 有被核准的地圖、sprite 工作 |
| glTF-Transform／KTX2 | CI 或 build adapter；驗證輸入與可回退產物 | 真正有 glTF 模型與尺寸／啟動成本問題 |
| Playwright | **已直接加入 CI**；測試 runner 不透過遊戲 runtime 的 registry 操作 | 現在的 Three.js 技術場景 |
| Three.js 觀測工具 | Browser devtools adapter（只讀 performance counters） | 有明確渲染實驗後 |
| Serena／MCP / 外部 LSP | Agent 宿主；工具憑證與存取界線在 Host | 核准版本、權限與測資後 |

## Adapter PR 驗收

1. 記錄必要性、授權、精確版本、功能與回退，不因看到 Skill 就自動安裝。
2. 定義 capability、input/output 契約、錯誤、timeout、取消、清理。
3. 狀態變更與讀取功能要分開權限，不允許工具回傳文字直接升權。
4. 先跑 mock contract test，再對真正工具做 sandboxed integration test，避免只交成功的 Stub。
5. 更新本文件與工具狀態；高風險能力保持人類審核與 PR Gate。
