# 素材來源與可追溯性

這輪全部為原創程序紋理、Geometry、Shader、像素圖集；不匯入第三方遊戲素材。《Bells of Evermere》僅作美術參考，不代表本專案取得對方素材再散布授權。

若日後匯入 GLB/glTF、圖像或音效：
- 在 `assets/manifest.json` 登記 id/path/author/license/source/sha256。
- `npm run assets` 驗證 Hash、未註冊素材、非法路徑與 glTF 外部檔案。
- 授權須另外查驗；manifest 自填不是法律證明。
- 角色用近鄰像素放大；3D 表面遠距離使用 mipmap/filter，避免閃爍。
