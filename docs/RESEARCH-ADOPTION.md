> **研究快照／歷史採用紀錄**：原始條目已從 PR #7 找回。下文涉及 `lab/`、舊首頁、PR 待合併與 Pages 未部署等敘述是 2026-11-04 的過去狀態，**不應當作現在架構**；請先看 [現行文件索引](INDEX.md)，並依 GitHub 實際 CI/Deploy 紀錄確認。

# Research- → Pixel-Games 技術採用對照

參考 repo：[waydefu/Research-](https://github.com/waydefu/Research-)（檢閱日期：2026-11-04）。**引用研究不代表工具已安裝、方案已啟用或效能已驗證**。

| 原研究 | 本專案做法 | 採用狀態 |
| --- | --- | --- |
| [Agent 權限與治理](https://github.com/waydefu/Research-/blob/main/research/2026-11-agent-repository-operations/01-governance-and-authority.md) | 精簡 AGENTS、工作分支、PR 審查、拒絕越權 | 已寫入文件 |
| [精確搜尋路由](https://github.com/waydefu/Research-/blob/main/research/2026-11-agent-repository-operations/02-search-routing.md) | `rg/git grep` → 讀最小檔案；大型索引以後再說 | 已寫入指南；未安裝索引 |
| [Agent 工作流](https://github.com/waydefu/Research-/blob/main/research/2026-11-agent-repository-operations/06-agent-workflows.md) | Locate→Verify→Plan→Test→PR；不開自動子代理 | 已寫入指南 |
| [Repo 工具治理](https://github.com/waydefu/Research-/blob/main/docs/governance/REPO-TOOLING.md) | Node 原生測試、按需 Skill、唯讀 CI | 部分已落地 |
| [Web 渲染兼容](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/06-graphics-and-compatibility.md) | Three.js/WebGL2 優先 PoC；需測實際設備與回退 | **Three.js 依賴與技術實驗已在 PR #5；真機尚未驗證** |
| [畫質效能／可及性](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/07-performance-and-accessibility.md) | 幀時間、DPR、掉幀率、手機與 reduced motion 驗收 | 已寫入檢驗規格，未真機測 |
| [安全測試部署](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/08-security-testing-and-deployment.md) | SHA-pinned checkout/setup-node、read-only CI、無外部 script | 已寫入 CI |
| [創意工具庫](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/12-github-creative-ecosystem.md) | **Three.js 優先**；Phaser／PixiJS 作比較與替代，不混裝 | Three.js 已導入 PR #5；替代 2D/3D 引擎未導入 |
| [設計與效能架構](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/13-design-performance-and-architecture.md) | 動效有意義、手機優先、避免純濾鏡堆疊 | 已寫入準則 |
| [Luminati HD-2D](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/26-luminati-hd2d-browser-engine.md) | Three.js HD-2D 首選視覺參考；保持 renderer／asset／scene／test 分層，不搬原始碼／素材 | **優先研究方向** |
| [前端開發選型](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/05-runtime-build-and-dx.md) | 保留原生首頁，同時導入 Vite 8、TypeScript 7、Node Test 與 lockfile | PR #5 工程修復及建置方案 |

## 為什麼現在不照搬 Research- ？

- 它主要是 Markdown 研究館＋Astro 作品館，遊戲的即時更新、輸入、素材和 FPS 問題不同。
- `research_search.py` 的 SQLite FTS5 對大量 Markdown 有效；本 repo 現在檔案少且偏 JS，先 `rg` + 原始檔。
- Serena MCP 需要支援的宿主、語言、版本與最小權限驗證；光放設定檔並不代表它有啟動。
- Three.js/Vite/TypeScript 已隨 PR #5 導入；仍需分開驗證 WebGL2 Chromium、手機真機畫質、GPU context lost 的還原品質。
- 已引入正式 npm 套件 Three.js/Vite/TypeScript/Playwright，但沒有引入上游遊戲圖片、音樂、Shader 或第三方模型；每項新資產仍須核對授權。

關於時效：表格是 2026-11-04 的研究採納快照，官方功能、版本與授權需在實際使用前重新查證。

## 2026-11-05｜正式採用 Three.js r187 官方後製與天空元件

| 模組 | 上游來源、許可／版本 | 本次用途與保留差異 |
| --- | --- | --- |
| `EffectComposer`、`RenderPass`、`UnrealBloomPass`、`ShaderPass`、`OutputPass` | [mrdoob/three.js r187](https://github.com/mrdoob/three.js/tree/r187/examples/jsm/postprocessing)，Three.js 官方 **MIT License**；與本 repo 相同套件 `three@0.187.0` | 直接 `three/addons/...` 引入，未複製其原始碼；組合高亮閾值 HDR Bloom、可控的斜角焦平面 DoF。品質 basic／balanced 直出；額外 render targets 的成本由測試評估 |
| `Sky`（Preetham daylight atmosphere） | [mrdoob/three.js r187 / Sky.js](https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Sky.js)，Three.js 官方 **MIT License** | 替換初版的手搓顏色漸層，採用單一 sun 方向和 Rayleigh/Mie 散射；關閉 Sky 內建獨立雲噪聲，保留 Pixel-Games **共用雲場**做可見雲和山坡雲影，避免「天空雲與地上雲影不同步」 |
| HDR 燈塔發光 | 自有 `harbour-beacon.ts` | 只改原創石造地標 emissive 值，保留原樣板，Bloom 不靠增加對整片海面的昂貴反射 |
| 業界其他 WebGPU 物理天空 | [pmndrs/sky](https://github.com/pmndrs/sky)（WebGPU 專用，非本輪依賴） | **僅研究，不採用**：現有手機 WebGL2 專案，切換 WebGPU 渲染器會放大相容性與風險；官方 Sky 是更直接的成熟路線 |

**源頭驗收**：官方 API 規格為可採用依據；真正畫面請看 PR #20 six-shot A/B，不能把 Three.js 官方元件「能編譯」當成遊戲美術已達標。


## 2026-11-05｜VIPER 11 Key West「飛行場景」環境渲染參考（未直接移植）

**Owner 提供網址**：[VIPER 11 · Key West · Fly](https://viperoneone.com/?theater=keywest&mode=fly)。這是 **Web 3D 畫面與技術案例**，並非要把自由探索小鎮改成戰鬥機模擬器。官方遊戲入口在目前文件擷取器無法完整渲染；以下結論以**作者正式技術筆記／公開套件原始碼**為依據，而非宣稱已用 Pixel-Games 同裝置跑過 VIPER 11。

| 技術證據 | 作者實際用法 | Pixel-Games 的具體採用決策 |
| --- | --- | --- |
| [Key West 三維地景](https://viperoneone.com/notes/airfields/) + [真實地形](https://viperoneone.com/notes/nellis/) | 海島地形結合高程資料、航拍影像 tile pyramid、CDLOD 四叉樹 geomorph、資料驅動植被；近海湛藍淺水與天際線有明確地形／色階 | **採用技法而非地圖/照片**。優先改善原創小鎮的海岸侵蝕／岩壁輪廓、分坡度生態、不同距離的 mesh/texture detail；遠距地形超過需求才做 CDLOD，先檢查現有材質式全場景合批的可見性代價 |
| [穿透雲層](https://viperoneone.com/notes/clouds/) | 使用 Shota Matsuda 的 **`@takram/three-clouds` + `@takram/three-atmosphere`**、Beer shadow maps、時間取樣重用與大氣視距；作者筆記提到最多 500 步的遠距 march、4×4 像素交錯 16 幀和三個 512² 雲影 cascade，並以畫質 governor 降級 | **先在獨立實驗驗證，不能整套直接替換手機預設**。本 repo G3 已共享低成本雲場／投影山坡雲影；在 high 可另試**半／四分之一解析度的少量體積雲層、時間重投影、可關閉陰影**，先比較 A/B 與真機 GPU 成本；若缺乏量測，保持現有廉價路線 |
| [影像鏡頭與後製](https://viperoneone.com/notes/lens/) | HDR 保持至最後**單次 ACES tone map**，Bloom 高於白點才發光，局部高光/陰影分色，有限曝光平滑與鏡頭現場感 | **直接用於 G4 審查**：Bloom 必須只處理 emissive/高亮光源，天空／雲／海面不能整片泛白；DoF 焦點需有意義。明暗和色溫由美術 A/B 確認，沒有 LUT 影像資料不憑空套一張 |
| 同篇的超廣角攝影 | VIPER 11 為 165° 鏡頭會渲染中心＋兩側三視圖，作者稱多約 45% frame time | **不採用**三視野疊圖和 165° 魚眼：我們的近景建築、POCO F8 Ultra 與第一人稱不需要這種變形/費用；可借鑑平滑相機、明信片構圖和不遮 HUD 的取景方式 |

### 可稽核的第三方來源／許可
- [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial)：官方 `LICENSE` **MIT (©2024 Shota Matsuda)**，包 `@takram/three-clouds@0.7.6`、`@takram/three-atmosphere@0.19.1` 均在 README／套件 metadata 識別為 MIT；後續若複製實質原始碼，保留原版授權及 copyright，先檢查版本相容。
- **目前 PR #20 未安裝上述 Takram 套件、未引入 VIPER 11 或 Key West 的遊戲程式、地圖、貼圖、音效／模型**。技術研究不等於素材授權；仍需確認來源、是否適合手機 WebGL2 與可重現的圖形量測。
- 參考真正的下一步：先修 [PR #20 的 High 截圖驗收](https://github.com/waydefu/Pixel-Games/pull/20)／Bloom 管線，再用 G2 六視角檢查雲密度、光影方向、大氣遠景與表面材質；**不用新增第二條執行 Roadmap**。
