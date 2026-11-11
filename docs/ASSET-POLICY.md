# 素材來源與可追溯性

既有場景主要使用原創程序紋理、Geometry、Shader 和像素圖集。局部海岸草地試景另使用登錄於 manifest 的 Poly Haven CC0 材質。

**例外（已登記）：** `assets/models/polyfork/` 內的 Polyfork 免費低多邊形 GLB 網格，以 CC BY 4.0 使用並署名，見 [ASSET-CREDITS](ASSET-CREDITS.md)；它們不是遊戲素材，也不含 ES module。《Bells of Evermere》僅作美術參考，不代表本專案取得對方素材再散布授權。

若日後匯入 GLB/glTF、圖像或音效：
- 在 `assets/manifest.json` 登記 id/path/author/license/source/sha256。
- `npm run assets` 驗證 Hash、未註冊素材、非法路徑與 glTF 外部檔案。
- 授權須另外查驗；manifest 自填不是法律證明。
- 角色用近鄰像素放大；3D 表面遠距離使用 mipmap/filter，避免閃爍。

局部試景使用 [Leafy Grass](https://polyhaven.com/a/leafy_grass)（Charlotte Baglioni）及 [Sparse Grass](https://polyhaven.com/a/sparse_grass)（Amal Kumar）的 1K JPG 色彩、OpenGL 法線與粗糙度貼圖；CC0 授權於 2026-11-10 核對，逐檔 SHA256 見 manifest。

試驗用 [Grass Medium 01](https://polyhaven.com/a/grass_medium_01)（Rico Cilliers、Rob Tuytel）1K glTF 及貼圖為 CC0，2026-11-11 核對，逐檔 SHA256 見 manifest；目前用於局部試景；2K 色彩與遮罩衍生的 RGBA 貼圖填補透明邊緣色彩以減少縮圖黑邊；遠景採用同一草叢圖集的裁切版本。
