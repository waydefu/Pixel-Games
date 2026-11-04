# 素材來源、授權與完整性

素材必須在 `assets/manifest.json` 登錄 `id/path/author/license/source/sha256`。目前未引入任何第三方圖像、音效、模型或 Shader，Three.js Lab 紋理由程式即時生成。

- `npm run assets` 對登錄檔案做 SHA256、相對路徑與實體位置檢查；拒絕跳出 repo 的 symlink、未登錄檔和不在 manifest 的 glTF 依賴。
- 支援 GLTF/GLB、`.bin`、PNG/JPEG/WebP、KTX2/Basis、HDR/EXR、音效等。若 glTF 引用外部圖片或 bin，**每個外部檔也要登錄並有 hash**；外部 http、absolute URI、URL Query/Fragment 不允許。
- data URI 的 inline glTF payload 無外部檔可查；依然需對整體 glTF 做 hash，且需另外做模型／大小／授權審查。
- 原始作者、license metadata 必填**不代表授權已法律確認**。外部作品及 npm package/Shader 的許可須依實際原始版本各自核對。
- 遊戲像素 sprite 可 nearest filter；3D 高品質材質不可強迫全部 nearest。異常透明邊緣、遠景 shimmering、atlas bleed 要在實際光影場景比較。
- 未核准前不得複製他人商業遊戲素材、Luminati 專案資產或公開素材網站下載結果進正式作品。
