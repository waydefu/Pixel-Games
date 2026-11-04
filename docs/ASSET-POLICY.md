# 像素素材、授權與來源

現階段沒有遊戲素材。任何未來新增的圖片、音樂、字型、Shader、模型或地圖，都須附上 **來源 URL、作者、授權文件或取得方式、使用與再散布權、核實日期**。

- 不從商業遊戲、素材站、GitLab/GitHub 專案直接抓圖就使用。
- MIT 原始碼授權不自動涵蓋第三方音樂／模型／圖像；需檢查具體資產條款。
- 生成式圖像或音效亦需標示生成流程／使用權證據，避免無法追溯。
- 選定遊戲後，定義 logical resolution、PPU、色盤、tile 大小、圖層排序、動畫 FPS、透明邊緣、閃光與過敏風險。
- 畫面放大優先 nearest-neighbor，螢幕小時保留 UI 可讀性；特效層若需要線性取樣須與像素層分離。
- 不上傳 token、購買證明個資、來源不明的版權素材。
- 導入素材後建立 manifest（asset/id/path/author/license/source/hash），並以 CI 驗證檔案覆蓋。

參考：[Research- Luminati 研究](https://github.com/waydefu/Research-/blob/main/research/2026-11-universal-web-engine/26-luminati-hd2d-browser-engine.md)；此 Repo 沒有複製上游資產。
