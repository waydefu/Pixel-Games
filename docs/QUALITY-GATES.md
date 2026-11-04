# 測試門檻與證據分類（2026-11-04）

不同層級不可混為一談：

| Level | 具體驗證 | 本 PR 提供 |
| --- | --- | --- |
| S0 | JavaScript syntax、必要檔案、素材登錄與 SHA256、glTF companion | `npm run check`、`npm run assets` |
| S1 | Node 單元／契約：renderer-port、scene rollback、tool timeout/cancel/schema、畫質 | `npm test` |
| S2 | TS 7 strict typecheck，Vite 8 build，多頁 GitHub Pages base | `npm run typecheck`、`npm run build` |
| S3 | Chromium desktop + mobile viewport 的真瀏覽器、console/pageerror、WebGL2 成功或可用錯誤畫面 | `npm run test:e2e` |
| S4 | 真正 Android Chrome / iOS Safari 影格、熱、記憶體、輸入與耗電 | **NOT RUN，需要實機** |
| S5 | WebGPU+TSL 第二後端實測／失敗回退 | **NOT IMPLEMENTED** |

## 渲染 PoC 最低標準

- 技術場景無外部素材，不含舊地城、海港遊戲任務或未核准玩法。
- 有原創像素 Sprite、受光材質、陰影、色彩管理；Viewport/相機同步、兩個尺寸與 CSS 不裁切。
- WebGL2 無法初始化時顯示 DOM 中文說明；頁面不因 WebGL 失敗變空白。
- `renderer.info` 僅可聲稱 draw calls、triangles、textures／geometries，不能估計真 VRAM。
- RAF p95 間距是 CPU/browser 間隔，**不是 GPU time**；自適應畫質需要等長時間測試才可給不同硬體預設。
- Playwright 行動 viewport 是布局驗收，不等於 POCO 真機熱／驅動測試。
- 沒跑完的測試標 NOT RUN，不可因 YAML 已編輯就聲稱 CI SUCCESS。

## 必要回報欄位

```text
Commit SHA / CI job:
Browser engine / 版本:
裝置（模擬/真機）:
CSS viewport / DPR / render buffer:
Scene / quality / duration:
RAF p50/p95; draw calls; geometries; textures:
Console / screenshot / Trace:
Tests: S0 / S1 / S2 / S3 / S4 / S5:
Unverified risks & rollback:
```
