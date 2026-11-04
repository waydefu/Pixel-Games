# Pixel-Games 架構（2026-11-05）｜唯一玩家入口，研究及工具可獨立保留

```text
index.html / styles.css (唯一玩家入口)
      ↓
src/game/main.ts (WASD、手機搖桿、相機、UI 與 RAF)
      ├── world.ts (目前唯一海岸世界與角色)
      │     ├── art.ts (原創像素紋理與角色圖集)
      │     ├── kit.ts (程序建模工具)
      │     ├── architecture.ts (木構村莊與中世紀道具)
      │     ├── environment.ts (海洋、岸線、船、植被)
      │     └── batch.ts (靜態 geometry 合批與資源釋放)
      ├── input.ts / navigation.js (輸入、碰撞、步行邊界)
      └── src/rendering/ (renderer-port、quality、frame-metrics、resource-scope)
      ↓
Vite + TypeScript → dist/index.html → GitHub Pages Actions
```

**不屬於玩家 bundle，但屬於可保留的工程資產：**

- `src/platform/`：clock、scene-controller、viewport、registry 與資產描述，用於後續可測工程共用能力。
- `src/integrations/tool-registry.js`：進程內 Host adapter 路由，**不是自動 MCP 工具或 OS sandbox**。
- `src/rendering/three-host.js`：歷史 WebGL 相容封裝，現行玩家入口使用 `renderer-port.js`；未經獨立測試不將其宣稱為 WebGPU 支援。
- `.agents/skills/`：按需求使用的程式、素材、性能和視覺研究技能；不會進玩家 JS。
- `docs/`：美術規格、研究來源、ADR、工具與部署治理、歷史審查；舊文標明當時時間，**不拿過去進度當最新狀態**。

只移除確定退場的舊遊戲和技術展示：`src/app.js` 的 Landing Page、`lab/` 第二頁、未使用的舊場景。**移除舊遊戲不等於刪掉研究知識或可重用模組。**

## 遊戲與渲染邊界

- `world.ts` 只組裝當前小型原創中世紀海岸；物件與海域邊界的碰撞資料另由 `navigation.js` 決定。
- Quarter View OrthographicCamera 是玩家指定視角；可調效能／解析度不等於有多後端引擎。
- `batch.ts` 只合併共享材質與渲染狀態的靜態 Mesh；合併後原 Geometry 須經 `resource-scope.release()` 釋放且不可影響仍被引用的幾何。
- `environment.ts` 將船殼、船帆和桅杆放在同一個 Group，再做小幅上下晃動，避免動畫拆散船隻。
- Vite 只建構單頁，GitHub Pages base 為 `/Pixel-Games/`；研究文件保留不會生成第二張網頁。
- 真機散熱、GPU time、遮擋、畫質與對照遊戲視覺差距仍需另行驗收。

參見 [現行文件索引](INDEX.md)、[程式審查](reviews/INDEPENDENT-AUDIT-2026-11-05.md) 及 [歷史 Three.js 研究](research/THREEJS-ENGINEERING-2026-11-04.md)。


## P1-R2 景觀／鏡頭分離（待 PR 合併）

`src/game/terrain-profile.js` 是可單測的 deterministic 峽灣高度函數。 `fjord.ts` 生成遠景山脈、兩側山壁與天空穹頂，與聚落美術/碰撞互不侵犯。這些**山脈目前不是玩家可步行地形**，不能將透視觀景鏡頭當作登山系統。

`camera.ts` 同時管理正交斜角與透視攝影機，`renderer-port.js` 用 `setCamera()` 更換活動攝影機，避免重建 WebGLRenderer。第一人稱移動跟隨 yaw，碰撞仍走現有 `navigation.js`，視角向量不改變世界碰撞規則。手機的右側拖曳負責環視，左側虛擬搖桿負責移動。觀景模式為獨立高處攝影機，禁止誤讓玩家角色瞬移過去。
