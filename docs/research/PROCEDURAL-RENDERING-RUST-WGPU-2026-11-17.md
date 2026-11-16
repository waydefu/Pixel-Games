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
- Rust + wgpu 可以共享原生及 WebAssembly 渲染核心（原生 Android Vulkan、iOS Metal 等；瀏覽器 WebGPU，另有功能不完全相等的 WebGL2 路徑），值得做**獨立、可回退的微型 PoC**；Rust 本身不會讓 GPU 阴影、像素著色或頻寬成本自動下降。
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
