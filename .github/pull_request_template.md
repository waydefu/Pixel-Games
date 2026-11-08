## 協作資訊（新 PR 必填；兩個 Agent 即使共用帳號也需各自填）
- 任務: #<Issue 號碼>（緊急修復用唯一 HOTFIX-YYYYMMDD-代號）
- 執行端: A / B
- 影響模組: 例 game/input、render/clouds、governance
- 相依 PR: 無（或 #N）
- 起始 main: main@<起始 SHA>
- 交集處理: 待檢查 open PR 的重疊檔案；若動到共同核心，附整合順序和跨模組驗證

## 目標與範圍
- 用戶要求／Issue：
- 這次**做**什麼、**不做**什麼：
- 是否更動功能狀態台帳／決策效力表（若否說明原因）：

## 驗收（PASS / FAIL / NOT RUN，不能把 viewport 當真機）
- [ ] npm run validate
- [ ] Chromium 桌面及手機 viewport
- [ ] 共同檔案和相依 PR 已確認
- [ ] 人工場景／視覺／音訊驗收（或明確 NOT RUN）
- [ ] Android 真機與效能驗收（或明確 NOT RUN）
- [ ] 外部素材授權來源已記錄（或無新增素材）

## 風險與回退
- 已知限制／相依：
- 回退方式：

## 交接
- 本 PR 完成後另一端需要知道：
- 尚未完成／下一個可認領 Issue：
