# P1-R3｜峽灣美術及渲染獨立審查（2026-11-05）

**範圍：**以真實手機截圖暴露的近景、海洋、山脈與天空缺點為修正對象，直接使用 Three.js 官方架構及 Research- 已歸檔的第 27–29 篇研究建立判斷，不假稱昂貴功能已完成。此文件描述 **PR #11 的待驗收修改**，不是正式發布報告。

## 1. 修正內容與可重現來源

| 原始問題 | 根因 | 修正位置 | 檢查重點 |
| --- | --- | --- | --- |
| 窗戶整塊凸出牆外 | `architecture.ts` 把實心牆＋玻璃＋十字木條全部做成前向 `BoxGeometry` | `architecture.ts`＋`facade-geometry.js`：外牆 cells 挖孔、凹入窗扇／玻璃／窗台、`ShapeGeometry` 山牆實孔 | `facade.test` 不重疊與截圖低角度檢查 |
| 只有空白藍天空 | `fjord.ts` 只有 Sky gradient | 雙層不同速度的 fBm 雲，太陽暖色散射近似 | 三視角雲形、背景分層，畫面 A/B |
| 海洋是規律塑膠條紋 | 低頂點密度＋在整片 UV 上使用高頻 `sin` | `ocean.ts` 多方向可見幾何波面、解析式法線、Fresnel＋天空反射近似、世界空間泡沫 | 海港第一人稱近景、遠景、無條紋、GPU 負擔 |
| 山壁像巨大低多邊形牆 | 高度過快躍升，平面法線與同質色彩 | `terrain-profile.js`／`fjord.ts` 平滑山麓、坡度／高度控制草岩、平滑法線 | 峽灣風景視角，仍需實際確認 |
| 大型礁石卡住碼頭 | 近岸石塊以全地圖隨機分佈而未扣碼頭空間 | `environment.ts` 在碼頭行走區排除超大岩石 | 斜角與第一人稱碼頭截圖 |
| 村落邊緣陰影消失 | DirectionalLight shadow camera 不跟隨玩家 | 跟隨玩家平移太陽光與 target、保持照明方向 | 街道邊緣、遠離村中心時的陰影 |

## 2. 來源與採用決策

- Three.js 官方 [WebGPURenderer Manual](https://threejs.org/manual/pages/webgpurenderer)：`WebGLRenderer` 對純 WebGL2 是維護中的可靠選擇；`WebGPURenderer` 的 TSL、RenderPipeline 更進階，但原本 GLSL `ShaderMaterial` 無法不修改就直接搬過去，且官方仍標註為實驗性。
- Three.js [ShapeGeometry](https://threejs.org/docs/pages/ShapeGeometry.html)／[Shape](https://threejs.org/docs/pages/Shape.html)：真正的幾何孔洞由外輪廓／內孔三角剖分產生，不能只用陰影貼圖做假窗。
- Three.js 官方 [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)、[Color Management](https://threejs.org/manual/pages/color-management.html)：建築保持一致的物理材質與 sRGB；水與天空的自訂 GLSL 顏色轉換要獨立驗證。
- [Research- #27](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/27-threejs-r187-ultra-rendering-ceiling.md)：能力／後端分級，不推斷任何裝置已穩定 60/120 FPS。
- [Research- #28](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/28-advanced-shader-pipeline-and-hd2d-recipes.md)：海洋波浪、Fresnel、岸線泡沫、峽灣雲霧的分級配方與效果界線。
- [Research- #29](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/29-rendering-ceiling-benchmark-and-adoption-gates.md)：以 GPU／CPU 分別量測、mobile fallback、視覺 A/B 建立證據，不用理論像素數冒充加速率。
- 原作者專案參考：Three.js 官方案例館有 WebGL 水面、WebGPU sky/cloud、SSGI/SSR 等實驗頁；本 PR **沒有複製第三方水體貼圖、雲樣本、HDRI 或美術素材**，而是依原理撰寫原創 GLSL。

## 3. 不可跳過的未完成驗收

- 本 PR 必須先通過 CI TypeScript、Node 單元測試、完整 Playwright。尚需要**實際 Desktop/Mobile Chromium 截圖人工比較**，不是 console 無錯就算美術達標。
- 長時間 GPU、溫度、電量及 POCO F8 Ultra／iOS Safari 真機 **NOT RUN**。SwiftShader 不代表手機 GPU。
- 目前仍沒有 SSR／SSGI／FFT 波浪、動態體積雲、glTF 高精度資產、海浪／船隻物理耦合、山區路徑碰撞。
- 當前幾何窗口的後方仍是封閉屋內空間的替代立面，並非已實作可進入室內；第一人稱室內需要另一階段的門窗／室內場景架構。
- 第一人稱大場景遠景品質仍與目標參考有差距；不可把本次工程修復標示為商業級美術完工。

**Repo 保留原則：**只變更仍在使用的遊戲場景與本輪驗收；研究文件、通用模組、ADR、Skills 都保留，不會恢復舊遊戲或另外建立 Landing Page。

## 4. 第二輪實際畫面審查與追加修正

最初的桌機及 mobile Chromium 截圖確認：雲層可見、海水 Shader 真正運作，但第一輪水面在低角度太亮、整個峽灣被東端山壁堵住、村莊地面和海水露出矩形平面邊界。

後續追加：
- 加深深海的藍綠色，降低 Grazing sky reflection 與日光 glint；減弱白色泡沫和過寬的海岸遮罩。
- 東端山體開一條**海底高度低於水面的峽灣出海口**，避免形成阻斷海灣的細長陸地障礙。
- 擴大海域 mesh 覆蓋範圍；改用 `coastal-outline.js` 的自然頭岬收尖邊緣及 `coastline.ts` 的曲線草岸、沙岸，不再以 3 張矩形平面拼湊海島。
- 第一輪截圖曾顯示過度亮青的海水、灰色大片背景邊界，**不是已達標畫面**；需再擷取後續實際截圖並請 Owner 視覺驗收。

> 本報告使用 GitHub Actions 的 Chromium/SW SwiftShader 截圖，**不等於 POCO F8 Ultra GPU 性能或實際攝影級環境品質**。
