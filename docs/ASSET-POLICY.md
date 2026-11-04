# 像素美術與資產治理

目前沒有任何遊戲素材。新增時須以 `assets/manifest.json` 登錄檔案，填入：

- `id`：唯一 kebab-case。
- `path`：repo 根目錄底下 `assets/` 的相對路徑，禁止路徑跳脫、絕對路徑及外部 URL。
- `author`：創作者／公司標示。
- `license`：明確可追溯的授權識別或自有權利說明，**非空不等於合法**。
- `source`：自有原創使用 `original`，外部來源為 HTTPS 上游連結。
- `sha256`：實體檔案 SHA-256 小寫 hex，用來辨別內容漂移。

例如（**只是 schema 展示，不要在資產不存在時加入 manifest**）：

```json
{
  "id": "sample-original",
  "path": "assets/sprites/example.png",
  "author": "Project author",
  "license": "CC0-1.0",
  "source": "original",
  "sha256": "<fill actual 64-char lowercase sha256>"
}
```

`npm run assets` 會驗證登錄檔案是否存在、digest 是否匹配。它不會掃描檔案是否合法取得、也不會替未登錄檔案做版權審查。

像素材質導入 Three.js 時，檢查透明邊緣、nearest filtering、atlas padding、顏色空間；不同 sprite 光照方式（SpriteMaterial 不受 3D 光）與 Mesh/Plane 需在原創場景中比較。

不從商業遊戲、GitLab、GitHub、商業素材站直接搬用未審核資產。研究內容不能當成資產再散布的許可。
