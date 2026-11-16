# Issues 主線分流台帳｜#148

原有 open Issues 43 張（不含本次新建 #148）逐項讀 body 審查；此表與 GitHub 標籤／附註對應，不覆寫原文、不宣稱舊缺陷已修復、不批次關閉。正式上線與完整願景不同，#146／#120 持續 open。舊版限定可以暫留 open 作歷史索引，不代表要在新主線重做。

| 分類 | 數量 | GitHub 標籤／處置 |
|---|---:|---|
| carry | 1 | `mainline:requirement`；保留原優先級與 labels |
| revalidate | 21 | `mainline:needs-verification`；保留原優先級與 labels |
| legacy | 7 | `scope:legacy-hd2d`；保留原優先級與 labels |
| governance | 9 | `mainline:governance`；保留原優先級與 labels |
| acceptance | 5 | `mainline:acceptance`；保留原優先級與 labels |

**沿用不等於已驗收；重驗不等於已證實 bug；治理／驗收仍需新 SHA 證據。** 歷史 Issue 不自動擴增當次遷移範圍。

| Issue | 分流 | 逐項理由 |
|---|---|---|
| [#45](https://github.com/waydefu/Pixel-Games/issues/45) [Task] 真機驗收：PR #34／#36 的空白幀、高畫質天空、雲與太陽（Poco F8 Ultra） | revalidate | body驗收對象是舊PR #34/#36及cloud-shader.ts等舊渲染路徑；雲、天空、畫質檔與真機品質可作新主線驗收目標，但空白幀根因和舊網址參數不可視為新主線缺陷。 |
| [#46](https://github.com/waydefu/Pixel-Games/issues/46) [Task] 手機高畫質效能與空白幀根因確認（歷史基線約 10 fps；2026-11-09 實測 High 約 60 fps） | revalidate | 手機真GPU、p50/p95/p99、熱穩定與防止空白畫面仍是新主線必要證據；body中的10fps/60fps、反射RT假說及hd2d-pipeline舊路徑都不是新主線基線。 |
| [#47](https://github.com/waydefu/Pixel-Games/issues/47) [Task] 天空：低仰角斜向拖影、積雨雲砧狀雲塔／乳房雲／雲內閃電、拉開高檔差異 | revalidate | body指出的問題針對舊2D雲層和雲影共用shader；天空層次、暴風雲、各畫質差異可依新主線視覺目標重新評估，但不應沿用舊uGen索引或2D層修補方案。 |
| [#48](https://github.com/waydefu/Pixel-Games/issues/48) [Task] CI：軟體 GPU 盲區、flaky 靜默通過、shader 檢查範圍（總關卡誤報已由 #50 處理） | governance | CI不得把SwiftShader或靜態regex當真機/渲染正確性的證明、重試成功須可見等治理要求跨主線有效；具體workflow及舊shader測試範圍需按新單檔建置與Pages Gate重新設計。 |
| [#49](https://github.com/waydefu/Pixel-Games/issues/49) [Task] 文件：功能台帳與決策效力表補登記雲／天空／渲染規則 | governance | 功能台帳新鮮度、ACTIVE/SUPERSEDED決策一致和不以歷史文件冒充即時狀態仍適用；body所列feature-status舊項和渲染規則須按新主線重新盤點，不能照抄。 |
| [#52](https://github.com/waydefu/Pixel-Games/issues/52) P1｜WebGL2 高畫質效能與無縫大世界：Benchmark、Spatial Culling／LOD／Chunk Streaming 研究及驗收 | revalidate | 真實裝置效能量測和樹LOD等可能適用，但舊batch/Three渲染架構、Chunk Streaming與世界擴張是研究/候選而非當次已授權；新主線已明列treeLOD，須先確認差距並避免多做大世界功能。 |
| [#53](https://github.com/waydefu/Pixel-Games/issues/53) [驗收] WASD：實體鍵／中文輸入法／低 FPS 走路速度（#43／PR #44 的真實裝置驗收） | acceptance | 走路/操作是新主線明列玩法，真鍵盤、IME、焦點與低FPS行為值得驗收；body中的具體修復和input.ts/main.ts路徑屬舊版，應以新操作模型重新測，不宣稱舊測試結果自動適用。 |
| [#54](https://github.com/waydefu/Pixel-Games/issues/54) [Task] 第一人稱滑鼠鎖定：Esc 後立即重新點擊若被瀏覽器拒絕，會永久退回拖曳環視（讀程式發現，待實測） | revalidate | 這是讀舊main.ts後提出、尚未在真實瀏覽器重現的Pointer Lock推測；新主線若保留桌面第一人稱鎖定，應測UX/瀏覽器限制，但不移植lockFailed修法或假設同一實作。 |
| [#57](https://github.com/waydefu/Pixel-Games/issues/57) [驗收] 背包、拾取與本機備份的手機真機與視覺驗收 | acceptance | 背包與本機存檔是Owner明列的新主線系統；Android/iOS方向、拾取、焦點、匯入匯出和視覺檢查可以沿用為測試目標，但須在新遷移版本重新執行。 |
| [#59](https://github.com/waydefu/Pixel-Games/issues/59) [P1][F-01] 統一 GameClock：低 FPS 固定步長與背景恢復時間契約 | revalidate | 低FPS與背景恢復時行走、船、天氣、日夜、農田各時間域一致性仍與新玩法相關；createFixedStepClock/main.ts等舊路徑及農田Date.now()契約不可直接改寫到新架構。 |
| [#60](https://github.com/waydefu/Pixel-Games/issues/60) [P1][F-02] 海面反射例外安全：還原 visible 並加入故障注入 | revalidate | try/finally與故障後恢復是通用安全性，但body修的是舊Water callback/outer.visible程式且PR #143仍在舊路徑；新主線是否有同類反射物件要先核實，尤其反射選項尚未實作。 |
| [#61](https://github.com/waydefu/Pixel-Games/issues/61) [P1][F-03] Water Reflection RT 所有權與 dispose 契約 | revalidate | GPU資源建立/釋放與Context恢復仍是渲染健全性要求；body僅指出Three.js Water RT所有權不明且未證實VRAM洩漏，新主線反射未實作，不能把舊RT契約當成遷移需求。 |
| [#62](https://github.com/waydefu/Pixel-Games/issues/62) [P1][F-04] WebGL Context Loss/Restore 完整功能層恢復驗收 | revalidate | 新主線瀏覽器GPU遊戲也應驗證context lost/restore；空restoreResources及舊Three.js pass列表是舊實作問題，需按新renderer/單檔資源模型重新建立測試。 |
| [#63](https://github.com/waydefu/Pixel-Games/issues/63) [P1][F-05] AudioContext／Soundscape 成對初始化與釋放 | revalidate | 若新主線保留程序聲景，AudioContext和節點生命週期/卸載安全仍適用；舊main.ts pagehide與Soundscape.dispose具體缺口須按新音訊架構核對。 |
| [#64](https://github.com/waydefu/Pixel-Games/issues/64) [P1][F-06/F-17] 逐步拆分 main.ts 與可逆監聽器生命週期 | legacy | Issue中心是舊src/game/main.ts大型編排器、匿名boating keydown及舊檔案拆分；新主線已在另一source scope並保留模組化，不能把拆main.ts的架構改造任務搬過去。僅有實際觀察到的新事件洩漏另立檢查。 |
| [#65](https://github.com/waydefu/Pixel-Games/issues/65) [P1][F-07] 漸進擴大 JavaScript 渲染與平台模組型別檢查 | revalidate | 靜態型別契約可能有跨主線價值，但tsconfig include/checkJs與src/rendering/platform路徑描述的是舊應用；應先看新source的語言、build和CI，再決定工作是否仍存在。 |
| [#66](https://github.com/waydefu/Pixel-Games/issues/66) [P2][F-11] GLB 冷啟動與模板幾何資源生命週期 | legacy | body聚焦GLB、village-kit、clone Geometry與分區模板；新主線明定離線單檔、程序生成且不依賴外部模型，這一套資產載入問題不應移植。 |
| [#67](https://github.com/waydefu/Pixel-Games/issues/67) [P2][F-14] 依賴弱點掃描、分級修補與例外期限 | governance | 依賴掃描、漏洞分級、期限與可追溯豁免屬供應鏈安全基線，應套用新主線實際build/runtime依賴；不因靜態審查缺掃描而宣稱已存在CVE。 |
| [#68](https://github.com/waydefu/Pixel-Games/issues/68) [P2][B6] 訂立遊戲程式碼授權與公開散布政策 | governance | 程式碼授權、第三方素材/程式權利、公開展示與再利用界線直接適用新主線；尤其遷移決策要求只吸收研究方法、不複製授權未釐清程式，應持續作為Release治理。 |
| [#69](https://github.com/waydefu/Pixel-Games/issues/69) [P2][C3] PR 變更風險 R0/R1/R2 與渲染／效能證據契約 | governance | PR風險分級、固定SHA、回退、渲染/效能證據及Owner核准的發行Gate對遷移仍有用；必須用新主線真實CI/Pages/人工/真機條件重設，不改Ruleset或放寬Gate。 |
| [#70](https://github.com/waydefu/Pixel-Games/issues/70) [P1][D1/D2] 港口美術基準：六鏡頭畫面與人工品質 Gate | acceptance | 固定鏡頭、畫質/時間/天氣一致、人工品質評分及不以shader或PBR名詞宣稱美術過關，直接適用新Saint Aldric；六個舊場景點位需在新世界重新取景。 |
| [#71](https://github.com/waydefu/Pixel-Games/issues/71) [P1][C4/D1] 中世紀漁港建築與街景可信度：內凹窗洞、街道接合與用途差異 | carry | 13–15世紀漢薩漁港、建築/街景比例、窗洞、道路和可通行性與Owner明列的新主線時空及港口目標直接一致；保留為產品品質要求，但新世界須重新取景驗收，不沿用舊模型/路徑。 |
| [#72](https://github.com/waydefu/Pixel-Games/issues/72) [P1][C8/D3] 無強制任務的十分鐘自由探索與港灣地標垂直切片 | revalidate | body提出的10分鐘探索、地標與無任務導引尚非當次Owner遷移決策明確核准的新功能；現有港口可達性/操作體驗可納入驗收，但不要據此擴地圖或新增任務/地標內容。 |
| [#73](https://github.com/waydefu/Pixel-Games/issues/73) [P2][C4/C8] 自由取景與景點收藏：先設計小型非強制攝影體驗 | legacy | 攝影、景點收藏、相片存檔是額外玩法，未列入Owner目前確認的新主線功能，不應因舊Issue而增做；保留作未核准的產品提案，不影響遷移。 |
| [#74](https://github.com/waydefu/Pixel-Games/issues/74) [P1][C4/C8/D4] 第一條生活閉環：釣魚成果→背包→交易／料理／展示其一→存檔 | revalidate | 釣魚、背包、存檔明確屬新主線，但商販交易/料理/展示是未在Owner清單核准的擴充回饋；只把既有捕魚到背包與存檔恢復列入回歸，不自動實作新消費環節。 |
| [#75](https://github.com/waydefu/Pixel-Games/issues/75) [P2][C8/D4/F-16] 小鎮 NPC 作息、職業場所與雨天反應垂直切片 | legacy | NPC作息、職業狀態機、避雨與路徑是額外Gameplay AI範圍，未見於目前Owner核准的新主線功能清單；舊life.ts及PR #132的品質問題不可假定存在於新遊戲。 |
| [#76](https://github.com/waydefu/Pixel-Games/issues/76) [P2][C5/C6/D4] 共享風浪世界狀態：海浪、船、植被、旗幟與聲音一致 | revalidate | 新主線有FFT海洋、船、天氣/植被等系統，跨系統風浪語意一致可能仍是產品品質需求；舊weather/wind/wave shader資料契約不可照搬，聲景或旗幟需先確認新scope。 |
| [#77](https://github.com/waydefu/Pixel-Games/issues/77) [P2][C6/D4] 分區聲景與室內外音訊過渡：海岸、街道、市集、山坡 | revalidate | #146曾將合成聲景列入升級方法，但Owner目前公布的新主線功能清單未明確保證分區音效已交付；先核對新版本既有音訊，再決定是否為品質驗收或新增範圍。 |
| [#78](https://github.com/waydefu/Pixel-Games/issues/78) [追蹤索引] 2026-11-09 全面審查：F-01～F-17 與遊戲產品工作包對照（非實作） | governance | 這是日期固定的審查映射索引，不是新主線工作清單；歷史依據與CONFIRMED/RISK/NOT RUN分類原則值得保留，但F項與各舊Issue映射不能當成新主線適用性判定。 |
| [#81](https://github.com/waydefu/Pixel-Games/issues/81) [Task] 開發工具：Ponytail 在雲端 session 的可行做法（外掛無法載入；可行的是帶入 skill 檔案） | governance | 這是Claude雲端工具/協作設定而非遊戲功能；只在Owner仍希望把工具規則寫入repo時有治理價值，且需在當前工具鏈重新核實，與本次遊戲遷移不應耦合。 |
| [#111](https://github.com/waydefu/Pixel-Games/issues/111) [驗收] 農田種植與收割的真機和美術檢查 | acceptance | 種田是新主線明列玩法，Android/iOS、可達性、作物辨識、生長/收割/背包/存檔及人工美術驗收可轉用；#108等舊實作結果不能替新主線測試。 |
| [#115](https://github.com/waydefu/Pixel-Games/issues/115) [P1][海岸 R2] High 動態濕沙、水膜與殘泡：NeuralSpecOcean MIT 條件導入與真機驗收 | revalidate | 近岸濕沙/水膜品質可能有新主線價值，但具體RGBA16F ping-pong RT、NeuralSpecOcean程式導入與高檔效能都是需Owner核准和重新驗證的方案；新主線離線程序材質/FFT不能直接加入此實作。 |
| [#116](https://github.com/waydefu/Pixel-Games/issues/116) [P1][海岸] 修正沙面平板感與海水交界鋸齒：緩坡＋乾濕沙材質 | revalidate | 沙灘輪廓、乾濕過渡及海岸接合可能仍是新港口品質問題；Issue指定舊coastline.ts與固定地形/UV方案，需對新程序地形重新確認，不能假設同樣缺陷或移植舊幾何。 |
| [#118](https://github.com/waydefu/Pixel-Games/issues/118) [Task] 2026-11-10 全 repo 優化點盤點報告（含具體修法，對照 #78 不重複） | legacy | 報告基準是舊main 0fa888d並針對舊repo路徑/行號，既有優化清單不能視為新程序單檔主線的待辦；可留作歷史技術記錄，不重做同一份盤點或按舊建議直接修改。 |
| [#120](https://github.com/waydefu/Pixel-Games/issues/120) [驗收] 真機與人工驗收總清單（一次測完，逐列回填） | acceptance | 單一真機/人工驗收索引、原始證據與NOT RUN紀律適用新主線；清單目前大量是舊PR/舊功能，必須以遷移後新SHA和Owner列明玩法重建，不得照勾舊項或認為實作合併即驗收。 |
| [#121](https://github.com/waydefu/Pixel-Games/issues/121) [Task] 每幀配置清理（O-05～O-10）：移除每幀的暫時物件、重複輸入讀取與多餘 DOM 寫入 | legacy | 六項工作明確綁定舊camera/main/fishing/input及舊優化報告O-05到O-10；新主線模組不同且未有同類量測證據，不應搬入遷移或宣稱提升FPS。 |
| [#122](https://github.com/waydefu/Pixel-Games/issues/122) [Task] 陰影相機對齊紋素與按需更新（O-11，排在 #112 之後） | revalidate | 新主線使用CSM，陰影穩定/更新成本可能值得驗收；body提出的Three.js shadowMap.autoUpdate、environment.ts與舊#112 helper不是可直接套用的CSM方案。 |
| [#123](https://github.com/waydefu/Pixel-Games/issues/123) [Task] CI 與部署加速：部署只等建置、純文件 PR 跳過瀏覽器測試、不重裝字型套件（O-34、O-35、O-27） | governance | CI/Pages發布品質和部署後E2E風險對新主線仍適用；此Issue已按舊workflow實作#124，且body記錄部署可先於E2E成功的真實風險，不應把e2e:false策略直接複製到遷移版。 |
| [#125](https://github.com/waydefu/Pixel-Games/issues/125) [Task] 美術 P1：暗部下限、海水隨時段變色、移軸與暗角減弱、夜間地面光池 | revalidate | 可讀光照、時段水色、後製節制和夜間燈光是可能適用的新主線品質目標；原Issue根據舊HD2D截圖並指向舊pipeline/光源，不應在新程序視覺中預設相同問題或複製調色值。 |
| [#126](https://github.com/waydefu/Pixel-Games/issues/126) [P1][環境美術] 樹木與地表材質升級、海水穿地及沙紋方向修復 | revalidate | 樹木/地表材質、海水岸線約束和沙紋是新主線自然環境可能相關的畫面品質，但舊Issue所列資產及#128–#131已合併的HD2D改動不等於新主線問題；需在新場景重驗。 |
| [#133](https://github.com/waydefu/Pixel-Games/issues/133) [Task] 釣魚：以 CC0 的 World Fish GLB 取代五種程序魚（鯖、鯡、鱈、鰈、鮭） | legacy | 新主線明確是全程序離線單檔且不依賴外部模型/資產，已合併的五魚GLB與Meshopt/資產載入方案不符合新主線技術邊界；釣魚視覺/操作可重驗，但不可搬運GLB。 |
| [#141](https://github.com/waydefu/Pixel-Games/issues/141) [P0][CI/Release Gate] main@5903236 載入畫面 E2E 失敗，但 Pages 已成功部署 | governance | 同SHA發布/CI一致性和失敗回退責任是新主線Release治理必須處理的風險；boot-splash ?splash=hold缺陷和PR #142只對舊index/測試有效，不能當作新入口已存在同樣故障。 |
| [#146](https://github.com/waydefu/Pixel-Games/issues/146) [P1] Saint Aldric 超進化：原創程序材質、統一擬真環境與離線單檔驗收 | revalidate | 願景中的單檔離線、程序生成、港灣環境、遊戲玩法和嚴格驗收與新主線高度相關；但Issue原定目錄research/saint-aldric-harbour及原分支/範圍已被Owner的新遷移決策取代，須由新遷移Issue重設scope與實際驗收，不能認為已完成。 |

## Open PR 分流

#137（舊每幀配置／CI視覺稽核）、#142（舊啟動載入畫面）及 #143（舊海洋反射錯誤恢復）不自動合併、覆寫或關閉。保留作者工作；新主線需重新確認其產品需求或根因，不能把舊 index／Water／HD-2D renderer 的修補直接搬入。與 #147 的交集見 PR body，現行 source/CI 以 #148 決策及新回歸為準。

## 後續

#120 留存舊證據並新增 Saint Aldric 的固定 SHA 驗收，不覆寫舊 PASS／FAIL。#123／#141 的發布風險由新流程改為 E2E 完成才部署，但在正式 Pages 驗證前不宣稱任務全部完成。完整功能與真機效能繼續分批驗收，不因遷移自動關單。
