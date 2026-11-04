# Tool Integration Architecture｜讓後續接工具不必重做核心

狀態：**已加入可執行的能力路由契約與單元測試，沒有接入任何真實第三方程式／MCP server／雲端服務。**

## 目標與邊界

未來可以接入 Tiled、Aseprite／LibreSprite、glTF-Transform、Playwright、Three.js debug tools、GitHub／MCP、Serena 等，但不強迫每個工具使用相同 Runtime，也不因新增工具就改寫 gameplay 或 renderer。工具資料、控制能力和編輯器 UI 應在介面層分開。

```text
外部使用者批准 / trusted host / 宿主真實 ACL
                          |
CLI / IDE / CI / Browser Devtools / MCP（各自獨立 adapter）
                          |
                Integration adapter
                   id + version
                  capabilities + handlers
                          |
              src/integrations/tool-registry.js
                          |
           Explicit host capability allowlist
                  /             \
       assets.inspect       qa.capture        (examples)
                  |             |
   asset pipeline / scene tests / QA reports
                  |
           core/rendering/game modules
```

**注意：** 此 registry 不是 security sandbox，`allowedCapabilities` 只防止意外呼叫，無法阻止具 OS 權限的惡意適配器直接存取檔案／網路。真實安全必須由**宿主**限制權限、工具白名單、檔案掛載、憑證和人工審批。不可把 Issue 或外部 JSON 視為批准依據。

## 穩定契約（已實作）

`createToolRegistry({allowedCapabilities})` 建立一個**空、預設拒絕**的 registry。

- `register({id,version,handlers,dispose?})`：加入可信宿主已顯式載入的工具 adapter，僅登記函式，沒有掃描磁碟、下載 package、啟動伺服器或執行 handler。
- `list()`：只回傳 id、語義版本、能力名稱，便於檢視；**不包含 credentials 或 handler**。
- `providersFor("assets.inspect")`：列出實作該能力的 adapters，**不會自動選擇提供者**。
- `call({id,capability,input})`：由宿主指明提供者與能力，通過 allowlist 才呼叫。未批准、未註冊、不支援、執行失敗一律拋錯。
- `unregister(id)`：先取消登記再執行 dispose（可為 async），即使 cleanup 失敗也保持 fail-closed。

Capabilities 以小寫命名空間形式命名，例如：`assets.inspect`、`assets.import`、`scene.export`、`qa.capture`、`code.symbols`、`render.metrics`；新增能力不需要修改中央 registry，不使用任意字串執行 shell 指令。正式引入每項能力時要定義 **payload / result schema / error / timeout**。

## 接入新工具的最小示例

```js
import { createToolRegistry } from "./src/integrations/tool-registry.js";

// 只有可信 host 能制定 allowlist。這只是示例，沒有啟用真實 Tiled。
const registry = createToolRegistry({ allowedCapabilities: ["assets.inspect"] });
registry.register({
  id: "my-tiled-adapter",
  version: "1.0.0",
  handlers: {
    "assets.inspect": async ({ path }) => ({ path, valid: true }),
  },
});
const result = await registry.call({
  id: "my-tiled-adapter",
  capability: "assets.inspect",
  input: { path: "assets/maps/sample.json" },
});
await registry.unregister("my-tiled-adapter");
```

**真工具轉接器必須**處理自身輸入驗證、檔案位置、沙盒、程序 timeout、啟動失敗及權限；上方 `valid: true` 是示範輸出，不是檔案真的通過檢查。正式 Adapter 不得以此 Mock 取代實際檢查。

## 接不同類型工具的方式

| 工具族群 | Adapter 放哪一層 | 什麼時候加 |
| --- | --- | --- |
| Sprite 編輯器／地圖編輯器（Aseprite、Tiled） | **開發端** assets import/export、schema/授權與 hash 檢查 | 確定素材管線與真正遊戲類型後 |
| glTF-Transform／KTX2 壓縮 | **建置端**、不輸出到瀏覽器運行程式碼 | 真的有 3D 素材與實測瓶頸後 |
| Playwright／profiling | **CI／Devtools** browser QA；輸出可追溯報告，不能改 main | PoC 可載入 Three.js 時 |
| Three.js DevTools／renderer.info | **渲染診斷層**，依賴已選 renderer 的可信介面 | 3D PoC 已啟動後 |
| Serena／Context7／MCP | **Agent 宿主**，不透過遊戲 runtime 自動啟動；分開設定 read-only、批准與 credential | 有實際價值且審查宿主權限後 |
| 新玩法或新遊戲 | `games/<slug>`，不是通用 adapter | Owner 核准玩法後 |

## 後續增加一個 Adapter 的 PR checklist

1. 說明解決什麼需求、版本、License、資料位置與可替代方案。
2. 選擇 `devtools`／`build`／`browser-runtime`；**禁止把 CLI/MCP Token 打包到前端**。
3. 增加 `id`、`version` 與命名空間能力；提供輸入輸出契約、錯誤行為、timeout／取消處理。
4. 在該工具適用的受信宿主裝配 adapter；不得從 README、Issue、任意 URL 動態載入未審查程式碼。
5. 補 mock contract test，再加真工具 integration test（若能取得）；註明真正沒跑過的環境。
6. 更新本文件與工具狀態，工作分支提交 PR；涉及 Secrets、網路服務、安裝、權限或部署另經 Owner 批准。

## 不是目前已完成的事

- 這不是 MCP client、npm plugin loader，也不是自動發現新工具的市場。
- 尚無 Tiled／Aseprite／Playwright／Serena 的真正 adapter。
- 目前沒有外部依賴、沒有 tool execution server、沒有自動下載、沒有授權系統或人類確認介面。
