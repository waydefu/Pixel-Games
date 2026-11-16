# Rust / wgpu × 純程式 3D：Abyssal Garden、Crimson Loong 技術研究

> 日期：2026-11-17（繁中）｜性質：**研究提案／來源稽核，未採用、未移植、未驗證真機**  
> 對應任務：[Pixel-Games #146](https://github.com/waydefu/Pixel-Games/issues/146)；真機／人工驗收索引：[ #120 ](https://github.com/waydefu/Pixel-Games/issues/120)。  
> 基準：Pixel-Games main @ [3c8fb18](https://github.com/waydefu/Pixel-Games/commit/3c8fb18fbaab95ddef7825ba3688ec71a3f52464)。正在進行的 [PR #147](https://github.com/waydefu/Pixel-Games/pull/147) 為主線遷移，不在本研究 PR 更動其程式、部署或 CI。  
> 原則：畫質先決，但**真機長時穩定性、相容性及 GPU 成本必須量測**；沒有測到就寫 NOT RUN。本文不構成放棄現有 Three.js、改用 Rust 的架構決策。

## 0. 研究問題與決策摘要

目標是為「聖奧爾德里克港 / Pixel-Games」確認可行的高品質程序化 3D 路線：擬真建築、植被、地形、海面、天空、材質與光影；網頁直接遊玩；Android（特別是 POCO F8 Ultra）與 iPhone 不得因為追求極致畫質而失去可玩性。評估 **原生 WebGPU**、**Three.js/WebGL2** 與 **Rust + wgpu + WGSL / Wasm** 的優劣。

**結論（研究階段）：**
- Abyssal Garden 證明：原生 WebGPU + WGSL 可用純程式生成密集景觀、GPU Compute 地形、明確畫質檔位與測試飛行路徑；但低階手機作者公布的結果仍只有約 20 FPS／670×372 Low，不能推論手機 1080p High 60 FPS。
- Crimson Loong 證明：成熟的 Three.js / WebGL2 也能以純程式幾何、程序材質、合批、精細水體與後製產出很高的美術密度；但是 **90 秒固定敘事攝影**，不是可自由探索的完整遊戲。
- Rust + wgpu 可以共享原生及 WebAssembly 渲染核心（原生 Android Vulkan、iOS Metal 等；瀏覽器 WebGPU，另有功能不完全相等的 WebGL2 路徑），值得做**獨立、可回退的微型 PoC**；Rust 本身不會讓 GPU 陰影、像素著色或頻寬成本自動下降。
- **暫不建議立刻把主線從 Three.js 全面重寫成 Rust**。先以相同鏡頭、同等畫質與真裝置 frame time 比較，確認收益，再作 Owner 選型決策。

## 1. 來源和版本（查核於 2026-11-17）

| 參考 | 查核版本（固定 SHA） | 性質 | 授權證據 |
| --- | --- | --- | --- |
| [Noniv/abyssal-garden](https://github.com/Noniv/abyssal-garden) | [a596354](https://github.com/Noniv/abyssal-garden/tree/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf) | 可自由探索的水下 WebGPU 場景 | 根目錄 [LICENSE](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/LICENSE)：MIT |
| [ChetasLua/crimson-loong](https://github.com/ChetasLua/crimson-loong) | [264b9d1](https://github.com/ChetasLua/crimson-loong/tree/264b9d1c63f298a206f53d18ddc1e49d0b10c334) | 90 秒即時 3D 電影；Three.js r180 | 根目錄**未發現專案整體 LICENSE**；[vendor/LICENSE](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/vendor/LICENSE) 僅證明 Three.js 的 MIT 授權，**不可推論作者程式可直接複製** |
| [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) | 官方 [wgpu Web 平台文件](https://wgpu.rs/doc/wgpu/documentation/platforms/web/index.html)（文件版本會更新） | Rust 多後端 GPU API | 官方 repo 的 Apache-2.0 / MIT 授權請以使用版本中的檔案逐一核對 |

**來源分類：** 本文的「程式碼已確認」為讀取上游指定 SHA 的 README、目錄與模組；「作者聲稱」是上游自述之性能；「設計提案」未在 Pixel-Games 實作或測試。下列連結都可回溯原始碼，不依賴模糊二手摘要。

## 2. 案例 A｜Abyssal Garden

入口：[README](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/README.md)｜[index.html](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/index.html)｜[Demo 使用方式](https://github.com/Noniv/abyssal-garden#try-it)。

- **實作方式（已查證）**：以瀏覽器原生 navigator.gpu / WGSL 直接建立 render/compute pipelines，**不使用 Godot、Three.js 或外部 3D 引擎**。發布的單一 HTML 約 99,514 bytes（作者稱 96 KB，計量方式不同），不下載圖像、模型或聲音素材；但載入後建立大量 GPU buffers/textures，**檔案小不代表 RAM/VRAM 小**。
- [source/src/shaders.js](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/shaders.js)：明確存在 WGSL **@compute** 密度場與 FBM/Worley noise，支持程序地形、岩壁、洞穴等設計研究。
- [source/src/world.js](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/world.js)：程序世界布局、植被與海底生態；README 自述約 200 萬片海藻／植物葉片。**數量不是場景畫質分數，也不等於每幀都完整繪製**。
- [source/src/quality.js](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/quality.js)：High / Medium / Low；降植被密度、陰影 4096→2048、MSAA 4→1、部分光束取樣 34→12；依觸控裝置與 deviceMemory 選預設，記錄載入失敗並嘗試下一次降檔。
- [source/src/main.js](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/main.js)：WebGPU adapter/裝置、timestamp-query（有支援時）、GPU 失效處理及畫面尺寸管控。
- [source/src/dev.js](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/dev.js) 與 README：固定飛行路徑／benchmark 只在 dev build 中，用於重複測試整個世界，而不是只挑一個便宜視角。

**可借鏡（不直接移植）：** GPU 程序生成、密集植被成批渲染、環境光影一致性、畫質品質階梯、GPU 裝置恢復與固定攝影路線。對中世紀建築近景、陰影陰面、室內光、物件互動與 NPC 幾乎不能直接套用。

**性能證據等級＝作者報告，非本專案測量：** RTX 5070 Ti 1440p 約 180 FPS；Galaxy A16 Low、670×372 約 20 FPS；**POCO F8 Ultra / iPhone 實測 NOT RUN**。不以任何一個桌機 benchmark 推論手機 High 1080p 可行。

## 3. 案例 B｜Crimson Loong

入口：[README](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/README.md)｜[線上動畫](https://chetaslua.github.io/crimson-loong/)。

- **實作方式（已查證）**：Three.js r180 + WebGL2。所有可見網格、材質、天空圖與音樂由程式建構；[tools/build.py](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/tools/build.py) 把 Three.js 與模組整合進約 2,013,558 bytes（約 1.92 MiB）的 index.html，支援離線 file://。不是 Rust、wgpu 或原生 WebGPU。
- **建築**：[src/35_arch.js](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/src/35_arch.js) 的木構架、屋頂、瓦片、燈籠、布料、幾何合批／材質分類，比「重複盒子拼建築」更適合研究近距離擬真立面。
- **植被**：[src/40_flora.js](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/src/40_flora.js) 的 InstancedMesh、樹冠由近到遠細節縮減、陰影專用幾何與頂點風動，適合研究 GPU budget。
- **天空**：[src/20_sky.js](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/src/20_sky.js)：Ray-marched 雲層在載入時烘成漂移層，避開每個顯示幀對整片天空重新高成本 marching。
- **水體**：[src/68_water.js](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/src/68_water.js)：湖面平面鏡像、細波紋、岸邊泡沫、瀑布、動態飛濺；針對小於畫素的波紋降低反射 aliasing。
- **後製**：[src/80_post.js](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/src/80_post.js)：HDR render targets、AO、Bloom、God rays 與色彩分級，有明確 pass 成本。
- **效能控制**：[src/90_main.js](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/src/90_main.js)：渲染像素上限約 370 萬，動態品質倍率 1 / 0.86 / 0.74 / 0.636 / 0.547 / 0.5，低檔陰影 4096→2048、MSAA 4→2、可縮減部分植被、陰影每 2 或 4 幀更新；GPU timer query 可用時參考 GPU frame cost。
- **驗證方法**：[tools/perf.py](https://github.com/ChetasLua/crimson-loong/blob/264b9d1c63f298a206f53d18ddc1e49d0b10c334/tools/perf.py) 使用指定 film time、多次重複渲染、輸出 draw calls / triangles / frame cost；這種固定成本探針很值得重做成自己的 CI 或本機 benchmark。

**必要區分：** 作者聲稱在 Apple Silicon 筆電約 370 萬像素 60 FPS，是其場景/裝置的自述。鏡頭與事件為固定 90 秒時間軸（只有有限 pointer 偏移），不能代表自由移動、任意鏡頭、開放場景 streaming、碰撞、玩家存檔與動態 NPC 的穩定成本。

**授權紅線：** 只有 Three.js vendor 的 MIT 可被核實。除非作者另外提供完整的授權，**不複製 Crimson Loong 作者實質的 JS、GLSL、幾何表格或其整合動畫原始碼**；僅研究公開演算法、設計手法與介面概念，再自行獨立撰寫。

## 4. 選型矩陣：只比較可證實的能力

| 指標 | Three.js / WebGL2（現有主要路線） | 直接 WebGPU（Abyssal） | Rust + wgpu / WGSL（候選） |
| --- | --- | --- | --- |
| 網頁 GitHub Pages 部署 | 已有基礎，較容易整合 | 可，須 HTTPS／WebGPU 能力 | 可，Wasm + JS glue + 網頁靜態檔；不代表 Rust 直接跑在 Pages 伺服器 |
| 運算密集程序生成 | 可以在 CPU/Shader 實作；WebGL2 無標準 Compute | 支援 GPU Compute | WebGPU／原生可使用 Compute；WebGL2 fallback 不保證同等功能 |
| Android/iPhone | WebGL2 相容範圍通常較廣，仍要真機核對 | 特定 Browser / OS / GPU 支援才行 | WebGPU 網頁同受瀏覽器限制；原生路徑可用 Vulkan / Metal 等 |
| GPU 畫質、耗能、FPS | 取決於實際管線、pass、shader、解析度 | 同左 | 同左；**Rust 不是 GPU 自動加速器** |
| 既有場景移轉成本 | 最低 | 重寫 renderer 和材質 | 另須重寫 renderer、網頁整合、部分遊戲系統；維護成本高 |
| 程序化美術可學之處 | Crimson Loong 最有針對性 | Abyssal 的 Compute / 密集世界生成 | 可承接兩者方法，但不能直接無成本轉譯 |

技術依據：[wgpu Web 平台說明](https://wgpu.rs/doc/wgpu/documentation/platforms/web/index.html)、[wgpu feature flags](https://wgpu.rs/doc/wgpu/documentation/features/index.html)、[wgpu Rust 原始碼及例子](https://github.com/gfx-rs/wgpu)、[WebGPU browser support](https://caniuse.com/webgpu)。wgpu 的 WebGL2 後端功能較少，且透過 Naga 翻譯 WGSL；WebGPU/WebGL2 不是「切個參數就能跑完全相同的 GPU Compute」。iOS Safari 支援程度會隨版本變更，必須在實機用 adapter / features / limits 逐項查核。

**與既有規格的衝突：** #146 仍要求單一離線 HTML；後續 Owner 討論有「放到 GitHub 後可不堅持單檔」的新偏好，但尚未在現行受審規格中完成變更。本 PR **不修改既有交付契約**。Rust/Wasm 最直接的網頁產物通常是 HTML + JS + .wasm 多檔；若將來仍要求單檔且 file:// 可啟動，必須專門驗證封裝、MIME、Wasm 初始化、CSP 與 WebGPU secure context，不能預設通過。

**與「桌機光追等級」願景的差別：** 對等的畫面觀感可透過光照烘焙、螢幕空間技術、程序材質與精準美術控制接近，但不能宣稱行動瀏覽器已具備桌機 RTX 等級的即時硬體光追效能。需要逐項拿對照圖與 frame time 驗證。

## 5. 對 Saint Aldric 的可操作映射（優先級是研究次序，不是已核准實作）

| 優先級 | 區塊 | 來源與可用技法 | 必須保護的現有功能／風險 |
| --- | --- | --- | --- |
| P0 | 港鎮建築 | Crimson 35_arch：實尺度參數化、梁柱/窗洞/瓦檐、共享幾何緩衝、材質合批、老化 PBR | 門洞碰撞、第一人稱近牆、釣魚與 NPC 動線；中古漢薩建築形式不可直接用中式屋脊取代 |
| P0 | 自然植被 | Crimson 40_flora + Abyssal quality / WGSL：Instancing、分物種密度、簡化影子、距離與像素級反閃爍 | 近景材質、樹冠變化、季節/海岸生態；不能靠大砍密度換「高畫質」數字 |
| P1 | 海水與岸線 | Crimson 68_water：平面鏡像取樣與波紋抗 aliasing；Abyssal 水下光束/焦散設計 | 海面與陸地穿插、反射二次繪製、手機 tile GPU 記憶體成本 |
| P1 | 雲／大氣與光照 | Crimson 20_sky 預烘動雲與雲影；Abyssal 程序光束 | 天空雲形／地面雲影方向一致、日夜／天氣同步 |
| P1 | 渲染品質調度 | 兩案：動態 DPR、陰影與密度分級、GPU 時間採樣、失效後降檔 | 不能用降低實際解析度卻宣稱仍然 1080p/2K |
| P2 | Rust + wgpu PoC | 先做獨立離線演示：同一組程序建築 + 草地 + 海水 + 受控鏡頭 | 不碰主線 src/harbour/、存檔格式、CI、Pages，與 #147 零交集 |

## 6. 驗證計畫與判準（尚未執行）

**A. 靜態核驗／可重現：**
1. 固定上游 SHA 與工具版本；逐來源記錄 LICENSE/NOTICE、是否只讀技術概念、是否可合法複製。保留 Pixel-Games 原創資產來源檔。
2. 若開 Rust PoC，先驗證 wasm32-unknown-unknown 編譯、WGSL shader validation、WebGPU adapter/features/limits、緩衝區上限與掉裝置恢復；再看是否需要/可行 WebGL2 fallback。**不得把不同功能集的降級畫面當成相同渲染品質比較。**
3. 錄相同固定 6 視角（建築近景、草地、港口、海面逆光、遠景、手機 UI），相同時間/氣候、同 DPR、固定畫質檔，比較原版與候選；保留未修圖截圖、程式提交與測試環境。
4. 對程序網格／Shader 建單元與快照測試：固定 seed、world-space 尺度、NaN/Infinity、接縫裂縫、碰撞入口、遠景 LOD pop、材質能量、雲與雲影一致性。只有 compile PASS 不代表畫質 PASS。

**B. 裝置實測（目前全部 NOT RUN）：**
- POCO F8 Ultra：Android Chrome，橫向／直向、1080p 與高畫質（2K 如裝置與需求可行）；另外一部性能中等 Android 手機。
- iPhone：實際 iOS Safari 版本、WebGPU 支援及降級行為；檢查 Metal 原生版本（若有獨立原生 PoC），不可用 Android 數據代替。
- 桌機：獨顯與內顯至少一台；相同視野，不拿固定動畫與自由移動直接比較 FPS。
- 統一紀錄：可見畫面尺寸、**實際 drawing buffer 解析度**、像素數、FPS/CPU 幀時間 p50/p95/p99、可取得的 GPU timestamp、draw calls、triangles、VRAM/RAM（僅在可量測時）、首次載入與重建時間、長時 10–20 分鐘熱降頻/耗電、context/device loss 及恢復是否成功。
- 分離 **GPU-bound（著色、RT、頻寬）**、**CPU-bound（場景／GC／Wasm）** 和 **載入期峰值記憶體**；不能以 HTML 96 KB 與 1.92 MiB 比執行時資源消耗。
- 對標 1080p 真輸出／60 FPS 是研究驗收**目標**而不是已達到結果；若需降為 30 FPS 或低解析度要明說，不能標記成功。

**C. 採用決策 Gate：** 只有當 PoC 在 POCO F8 Ultra、iPhone 與桌機上，以同等/更好的實際可視品質，證明 frame-time p95、功耗與記憶體無不可接受回歸，並通過離線部署、授權、存檔/玩法隔離測試，才提議獨立 ADR 變更正式引擎；否則維持現有 Three.js 路線，只逐步吸收合法技法。

## 7. 明確不做

- 不將外部 repo 當子模組/依賴加入、**不複製**其授權未釐清之程式、模型/音訊/貼圖；本 PR 只加來源與研究文件。
- 不直接切換 Godot、Rust、WebGPU 或 Three.js 版本，不改遊戲主入口、renderer、Pages、CI、package lock 或效能品質預設。
- 不合併 #147、#137、#142、#143，不修改 Owner 尚未確認的架構決策及規格。
- 不聲稱任何 Android/iPhone 上已經「比桌機 RTX 更好」或「通過 2K/60FPS」；所有真機測試為 NOT RUN。

## 8. 交接與下一步（等待單獨授權）

研究已能回答「兩個 repo 怎麼做到大量純程式畫面」與「Rust 能否寫」。若後續另行核准 PoC：先建立最小場景＋相同固定鏡頭的 Rust/wgpu WebGPU 演示，在真機基線前絕不重寫主線；如果瀏覽器/WebGPU 不可用，須明確列相容與視覺降級，不得暗中替換品質標準。

**研究評估完成 ≠ 程式整合完成 ≠ 可玩性／美術驗收完成。**


## 9. 高效能混合引擎候選架構（Owner 2026-11-17 補充）

> **範圍：效能優先的架構研究，不是已採用設計或已通過實測。** 候選：**TypeScript + Rust/Wasm + WebGPU/WGSL + Web Workers**。依運算特性、平行度、資料所有權、搬移成本與能源限制分工，而非追求 Rust/WGSL 使用率。既有 #146/#148 單檔、離線、Pages、玩法和品質要求暫不修改。

### 9.1 元件責任與資料所有權

| 元件 | 優先責任 | 不應做的事 / 主要風險 |
| --- | --- | --- |
| TypeScript Main Thread | DOM、HUD、輸入、可及性、事件與生命週期、Worker 指令、網路/資源調度 | 逐實體 JS 物件搬運、同步等待大量模擬或 GPU 回讀 |
| Rust/Wasm Simulation Core | Archetype ECS / SoA、NPC AI、路徑尋找、物理、空間索引、區塊狀態、確定性運算 | 未分析熱點就將所有邏輯跨語言搬入；小任務的 FFI 成本可能超過計算 |
| Simulation Worker（可選） | 執行 CPU 高成本模擬，將已發佈狀態快照交給渲染器 | 阻塞主執行緒、每幀 postMessage 大物件、無界工作佇列 |
| Render Worker（可選） | 在支援的平台以 WorkerNavigator.gpu、OffscreenCanvas 擁有 WebGPU device、buffers、render graph 與 command submission | 把 Render Worker 當所有瀏覽器必備；跨 Worker 傳 GPUBuffer；GPU context 復原不明 |
| WebGPU + WGSL | GPU Compute、植被/粒子更新、可見性篩選、實例動畫、Raster/PBR、陰影、水體與後製 | 將高分歧、相依性強或需要頻繁 GPU→CPU 讀回的工作硬塞 Compute |
| 資料交換層 | 發布固定布局 TypedArray 或共享環狀緩衝區，序號/版本號管理，批次寫入 GPU buffer | 錯把 Wasm Linear Memory 與 GPUBuffer 視為同一塊零拷貝共享記憶體 |

**推薦初始拓樸（尚未實作）：** Main Thread (TypeScript DOM/UI) → Simulation Worker (單執行緒 Rust/Wasm ECS、物理/AI) → 版本化 SoA snapshot → Render Worker (若支援 OffscreenCanvas + WebGPU；否則主執行緒渲染) → WebGPU Compute + Render Graph → Present。額外 Workers 視可平行的任務與真機熱限制增減，不硬設 4 個。渲染元件擁有 GPU 資源並提交 commands，CPU 模擬元件只發佈必要差量及 snapshot。

**CPU/GPU 運算依特性選擇，而不以物件數直接決定：**

| 工作 | 預設候選 | 條件式替代與測量重點 |
| --- | --- | --- |
| 少量玩家/相機、UI、互動 | TypeScript | 若已在 Wasm 的權威世界狀態中，維持資料一致性優先；勿為語言拆分製造跨境更新 |
| ECS、AI、A*、Chunk、BVH/Octree | Rust/Wasm | 小型純 TS 也可很快；觀察 CPU p95、cache locality、跨境呼叫 |
| 剛體、窄相碰撞與複雜依賴 | Rust/Wasm | GPU 碰撞僅考慮特定高度同質的批次任務，且需避免 GPU→CPU readback |
| 程序地形/建築預生成 | Rust/Wasm 或 WGSL | 看編輯頻率、CPU collision mesh 需求、生成和上傳/讀回峰值成本；兩者可互補 |
| 草/葉片/粒子/骨骼動畫 | WGSL/Vertex Shader | 小數量不一定值得 Compute；盡量讓狀態 GPU-resident |
| Frustum / Occlusion Culling | CPU Chunk 粗剔除 + GPU Instance 細剔除 | 先測 draw count、工作量與 GPU occupancy；Occlusion 需深度資訊，勿讓 readback 阻塞 |
| Render Graph、批次 draw 指令 | TypeScript 控制 WebGPU（可在 Render Worker） | 研究 CPU 命令成本與平台 limits；避免頻繁極小 dispatch |
| 光照、陰影、水體、後製 | WGSL GPU Pipeline | 設 pass/RT/帶寬預算，避免多層 full-res HDR 消耗手機記憶體頻寬 |

### 9.2 GPU-resident data + Render Graph

- 靜態建築、地形、材質/Instance 參數和大量低頻植物應盡量常駐 GPU；只上傳改變部分。以 Render Graph 管理 Upload → Visibility/Culling → Animation/Effects → Shadow → Opaque → Water/Transparent → Post → Present 的依賴，並視設備合併/重用短命 render targets。
- GPU-driven rendering 是候選，而非萬靈丹；Compute 更新可見實例列表/Indirect Draw arguments，Render Pass 消費相同 GPUBuffer，盡量不回傳 CPU。**GPU→CPU readback（例如 mapAsync）不得每幀成為同步點**。
- WebGPU 的 drawIndirect / drawIndexedIndirect 是標準機制，但當 firstInstance 非零時，依賴可選的 indirect-first-instance feature；須檢查 adapter.features / limits 並設計降級。不要假設所有手機都具備無限制的 multi-draw、完整 Bindless 或桌機級硬體光追。
- CPU 負責大區塊及實體可見性粗篩，GPU 負責大批次同質細節；對 occlusion 應先有可重現的 depth / Hi-Z 管線及 GPU 時間證據，不得只因「GPU Culling」名稱就宣布較快。
- 資源池/aliasing 與暫存紋理格式都要按 Render Graph 生命週期處理。手機 tile-based GPU 對 full-screen pass、平面水鏡反射與大量 render target 的頻寬非常敏感；時間/品質均要真機測量。

來源：[WebGPU API / WorkerNavigator.gpu（MDN）](https://developer.mozilla.org/en-US/docs/Web/API/WorkerNavigator/gpu)、[drawIndirect / indirect-first-instance（MDN）](https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/drawIndirect)。

### 9.3 CPU / GPU Pipeline、資料交換與同步

1. 模擬端固定時間步長（例 60 Hz 作為候選，不是所有 NPC 每幀同頻）；render loop 可消費最近一份**完整且一致**的 snapshot，做插值或以受控預測降低觀感延遲。不要讓 GPU 畫第 N 幀時強制等待 CPU 完成第 N+1 幀。
2. 使用 SoA、Archetype Chunk、預分配 Buffer、Dirty Ranges、批次更新，不為每個 NPC 建立新的 JS 物件。Rust 單次執行更新大量實體，TS 建立或重用 Wasm linear memory 上的 TypedArray view，再以 queue.writeBuffer 批量提交；**writeBuffer 仍是到 GPU 的資料傳輸，不可宣稱 GPU 零拷貝**。
3. 若共享記憶體可用，以 SharedArrayBuffer + Atomics 的版本號/寫入完成標誌發布雙/三緩衝快照；先驗證一致性、讀寫競爭、延遲及記憶體壓力。缺少 SharedArrayBuffer 時，使用 transferable ArrayBuffer、雙佇列或單 Worker 的 message 通道，避免 Structured Clone 大量深拷貝。
4. Wasm linear memory 若發生 memory.grow，既有 TypedArray view 可能失效，需要重建；大型共享資料結構應在初始化就規劃容量，並測量增長、內部對齊、更新 dirty range 與峰值記憶體。
5. 雙/三緩衝可降低爭用但增加記憶體占用、緩衝深度與輸入延遲。評估 frame pacing、buffered frames、latest-complete-snapshot 政策以及主執行緒的 input-to-photon latency；**CPU/GPU 並行有機會重疊，但不是保證完全互不等待**。
6. 若遊戲同時需要 CPU 碰撞與 GPU 程序地形，須界定權威地形資料來源、固定 seed 與可重現的碰撞代理；頻繁將 GPU 三角形讀回來做 CPU 碰撞可能抵銷 GPU Compute 收益。

### 9.4 Web Workers、Wasm Threads、SIMD：相容性 Gate

- **一般 Web Workers ≠ Wasm Threads**。普通 Worker 可用 postMessage + transferable Buffer，不等於共享 Rust/Rayon 執行緒池。Rust Wasm 多執行緒通常需 SharedArrayBuffer、Atomics、cross-origin isolated 與對應的編譯工具鏈。
- 跨來源隔離由伺服器回應 HTTP headers 建立，例如 Cross-Origin-Opener-Policy: same-origin 與 Cross-Origin-Embedder-Policy: require-corp（或符合條件的 credentialless）；請於每個支援瀏覽器讀取 self.crossOriginIsolated，不能以 localhost 成功推論 GitHub Pages 成功。
- **目前 GitHub Pages 靜態託管沒有一般可設定任意 COOP/COEP HTTP header 的正式途徑**；若 Wasm threads 是必要性能條件，需另行對照可控制 headers 的靜態託管（例如 Cloudflare Pages _headers），或維持無共享執行緒降級。任何改託管均需另提 Owner/部署授權；不在本 PR 變更 Pages。
- wasm-bindgen-rayon 的實作文件列出 Wasm shared-memory、特定工具鏈/構建旗標、bundler 與 Worker 啟動限制；**不能直接把桌面 Rayon 用法視為可編譯到瀏覽器**。正式採用前須固定版本、在 CI 做線程版及單線程版分別編譯並於真機啟動/回退。
- Wasm SIMD 需要檢查編譯 target feature、程式能否被有效向量化、實際 SIMD 路徑是否執行；不要將 SIMD 支援視為必然加速。手機同時開太多 Workers 會增加排程/耗電/熱降頻。
- WebGPU 在 Worker 上可用但瀏覽器/OS/裝置存在差異；先 feature-detect WorkerNavigator.gpu、OffscreenCanvas、GPUAdapter，再決定 Render Worker 或主執行緒實作及 WebGL2 備援。

來源：[MDN crossOriginIsolated](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)、[MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)、[wasm-bindgen-rayon 官方 crate 文件](https://docs.rs/wasm-bindgen-rayon/latest/wasm_bindgen_rayon/)、[GitHub Pages headers 討論（GitHub 社群）](https://github.com/orgs/community/discussions/54257)、[Cloudflare Pages 自訂 headers（官方文件）](https://developers.cloudflare.com/pages/configuration/headers/)。

### 9.5 Simulation LOD 與空間索引：不等於只有模型 LOD

| 範圍（示例） | 模擬頻率候選 | 工作類型 |
| --- | --- | --- |
| 近景互動圈 | 60 Hz | 玩家/NPC 完整碰撞、局部戰鬥、即時事件 |
| 中景 | 10–20 Hz | 簡化決策/尋路、跨影格插值、按需局部碰撞 |
| 遠景/不可見 | 1–5 Hz 或事件驅動 | 群體與聚落統計、狀態推進、區塊卸載 |

以上更新頻率只是**實驗候選，不是所有系統的固定值**。須保護可觀察的遊戲語義：玩家附近逐漸喚醒、NPC 不能瞬間跳位、遠處任務與種田/天氣/存檔的時間邏輯一致。採取 spatial hash / grid 作近距離查詢、BVH 或樹結構處理複雜空間；實測查詢複雜度和增量更新負擔再決定選型。對幾萬 NPC 不只看單幀 FPS，還要測存檔、跨區塊遷移和長時資料膨脹。

### 9.6 四組公平效能實驗：A / B / C / D

| 版本 | 比較目標 | 唯一主要變因 |
| --- | --- | --- |
| A：現有 Three.js / WebGL2 | 正式遊戲性能/畫質基準 | 維持現況；固定 scene snapshot |
| B：TypeScript + 直接 WebGPU | 測 GPU 管線本身的收益 | 用相等場景/實際 buffer pixels 改 API 與 GPU pipeline |
| C：TypeScript + Rust/Wasm + WebGPU | 測 Data-Oriented Rust CPU 核心增益 | 相同 B GPU 管線，只更換明確熱點的 CPU 模擬 |
| D：C + Worker/SIMD/Threading | 測並行與向量化總體收益 | 同 C，逐項開/關 Worker、SIMD、Rayon threads；勿將其混為一個不透明效果 |

**實驗中的非控制變數禁止偷換：** 相同建築/草葉/海面幾何、同 seed、固定六鏡頭、相同 shading/RT 格式、陰影品質、實際 drawing buffer 像素、動態解析度開關狀態、可視距離、NPC 數及行為；記錄不同 backend 功能無法對等時的品質差距，**不得用更低畫質聲稱更快**。若 A 與 B 後製本質不等價，先報告視覺差異與管線成本，再做近似等價版本。

**D 組還需拆解微基準：**
- D0 單執行緒 / Main Render；D1 Simulation Worker；D2 Render Worker；D3 Wasm SIMD；D4 Wasm Threads（僅在 crossOriginIsolated 可用）；D5 GPU Culling + GPU-resident animation；每項單獨量測，再測選定組合及相互作用。
- 測資料交換：10k / 100k（只作合成壓力測試）NPC；分別量測 ECS tick、JS-Wasm 邊界、snapshot 發布、CPU→GPU bytes/frame、GPU pipeline time、Worker 同步/傳輸與三種佇列深度。這些是**測試工作量，不是遊戲預定 NPC 數量**。
- 每種模式包含冷啟動/暖機/穩態/連續 10–20 分鐘、快速鏡頭旋轉、區塊切換與資源重建；記錄 CPU main-thread blocking、GPU frame time（若裝置可提供）、p50/p95/p99 frame time、99th input latency、WebGPU limits/features、context loss/恢復、裝置溫度/功耗（有量測能力才填數字）、RAM/VRAM（不可得則 N/A）。
- 目標 **1080p 真輸出 / 60 FPS** 對應 16.67ms/frame 畫面預算；評估渲染/模擬的並行階段時不可把各階段毫秒數天真相加或相減。若 2K 無法通過，應明確區分畫質與解析度政策；30 FPS 時也需說明取捨。
- 先以 POCO F8 Ultra 和實體 iPhone 為重點，另外桌機獨顯/內顯與中階 Android；取真瀏覽器版本、真 GPU，CI SwiftShader 僅做功能 smoke。結果不可提前標 PASS。

### 9.7 建議的技術優先研究序（收益假說，不是實測排行）

1. Data-Oriented Design / SoA / Buffer Reuse：先找 CPU 與傳輸的重複工作。
2. GPU-resident instance data / GPU-driven visibility：先減少不必要的上傳與 Draw Calls。
3. Simulation LOD：避免所有 NPC、物理、AI 同時以最高頻率工作。
4. Spatial Partitioning / Chunk Streaming：控制可見、互動與載入工作集。
5. Render Graph / Frame Pacing / 多幀資源生命週期：降低 pass 互依與手機 bandwidth。
6. Archetype ECS：當實體數/查詢模式足夠大才值得。
7. Rust/Wasm SIMD / Workers：基於 profiling 改造 CPU 熱點。
8. 多執行緒 Rust/Rayon：跨來源隔離與維護成本先過 Gate，不以 threads 越多越好。
9. 選用 async pipeline 和 memory pools：驗證少分配/少等待，而非只增加抽象層。
10. glTF/KTX2 僅作可選**匯入/快取資產管線**；純程式生成仍是本專案主要方向，沒有必要強加模型與貼圖下載。

### 9.8 風險、採用條件與交接

- **可證實的能力 ≠ 實測勝利**。資料結構、CPU/GPU 分工、傳輸與並行程度比語言比例重要。更複雜的混合架構也可能因 Worker 同步、Wasm 初始化與渲染管線重複，慢於精心優化的 TypeScript 或純 Rust 架構。
- 本節只給出**候選最佳化模型**。不得根據表格直接宣稱 Rust/Wasm + WebGPU 最快，也不預設超越 UE、桌機 RTX、遊戲引擎整體品質。
- 當前 PR 僅編輯本文；**不開新 PoC、不改主線、不改 Pages hosting/COOP/COEP、不改部署與受保護配置、不合併 PR**。需有 Owner 的新一輪實作授權才能建立 A/B/C/D 對照實驗。
- 未執行：Rust/Wasm 編譯、Workers 測試、各實驗基準、手機真機、電腦 GPU 測試、畫質人工 A/B，全部 **NOT RUN**。
