# 架構：一個乾淨的遊戲，不是兩套 demo

```text
index.html → src/game/main.ts
                   │
        src/game/world.ts
        ├── art.ts (原創像素筆刷／角色圖集)
        ├── kit.ts (建模／材質與幾何)
  ├── batch.ts (靜態物件依材質合批，減少 Draw Calls)
        ├── architecture.ts (中世紀村落)
        ├── environment.ts (海與自然)
        ├── input.ts / navigation.js
        └── src/rendering/* (renderer-port, quality, frame, resource)

src/platform/asset-manifest.js ← scripts/check-assets.mjs
npm ci → TS7 + Vite8 → dist/ → GitHub Pages Actions
```

**不保留**舊 `lab/`、V1 場景、MCP Tool Registry、與現行遊戲無關的 Platform Clock/Registry/SceneController/Viewport、舊技能和研究交接文件。刪除的是工作樹，而非 Git 歷史。未使用的抽象不可只因「未來可能需要」就常駐 Repo。

## 邊界

- `main.ts` 統一 Bootstrapping、HUD、輸入與畫面縮放；`world.ts` 是遊戲世界唯一組裝入口。
- 美術層只持有 Three.js 場景/資源與原創材質；動線／碰撞維持純函數，可獨立測試。
- `renderer-port.js` 負責 WebGL renderer 生命周期，不誤稱已支援 WebGPU TS L 材質或物理引擎。
- Vite 保持單頁入口及 Pages `/Pixel-Games/` 子路徑，原有 deployment workflow 不改設定。
- 不引入外部資產、模型、字體、音樂；後續新增時必須在 `assets/manifest.json` 註冊來源與 SHA256。
- 性能、視覺、版權三者獨立驗收。GPU context 恢復及手機真機限制不能用 Node 測試結果抵銷。
