# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.1.7 — 2026-11-06

**修复**

- **浏览器登录「授权码已被使用过」（`-109`）**：根因是 **QQ 会把 `redirect_uri` 的查询串整个丢掉** ——
  落地页收到的是 `?code=...&state=...`，**没有 `login_type`**，服务端因此判参数无效。
  改成用 CDP `Fetch.requestPaused` 在**跳转前**拦下回调，自己从 URL 取 `code` 再带 `login_type` 换。
  页面同时显示「授权完成」，用户不用对着 `-109` 的 JSON 发愣
- **换 token 带了鉴权头**：`marvis_oauth` 是**免鉴权**端点，带 `Ual-Access-*` 签名头会直接 400 空响应
- **`deviceGuid()` 永远取不到注册表**：JS 里 `\S` `\T` 是无效转义，反斜杠被吃掉，
  `reg` 收到 `HKCUSOFTWARETencentMarvisEnv` → 「无效参数」。改用 `String.raw`
- **本机导入的 guid 与 token 不同源**：服务端按 `(openid, guid, token)` 三元组校验，
  现在优先从**同一段内存**里取 `guid=`
- 去掉 `--disable-blink-features=AutomationControlled`（Edge 会弹「不受支持的命令行标记」警告条），
  改用 CDP `Page.addScriptToEvaluateOnNewDocument` 抹掉 `navigator.webdriver`

