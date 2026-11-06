# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.2.5 — 2026-11-06

**修复**

- **`state` 格式与客户端不一致**：app 是 `state=${Math.random()*100}`（**小数**，如 `31.1177412`），
  我写成了 `Math.floor(Math.random()*1e9)`（整数）。抓包确认服务端收到的是 `845583851` 这种
- **`loginType` 映射错了**：渲染层 `yct={QC:"1",WX:"2",WXAPP:"2"}`，
  `Ual-Access-Login-Type` 应该是 `1`/`2`，我写的是 `6`/`5`

**修复（`-109` 的最终根因）**

- **`marvis_oauth` 会被请求两次**：QQ 的 `self_redirect` + 页面自身重载，
  让同一个 code 打两遍 —— 第一次成功返回 token，第二次因为 code 已消耗而回
  `-109 RC_PARAMS_INVALID`。我之前读的是**页面最终状态**，拿到的正是第二次。
  客户端主进程用 `[oauth-dedup]`（"reuse first request"）处理这件事；
  插件改成监听 `Network.responseReceived`，**只认第一个响应体**，抓到立刻返回
- **`authorize()` 阻塞 1.4 秒**：里面调了 `findBrowser()`（15 次注册表查询），
  违反 HOOKS 四·陷阱 1。挪进 `callback()`

**修复**

- **响应解析对格式不敏感**：浏览器渲染 `application/json` 会加缩进/包装，
  原来只看 `startsWith("{")` 会漏判。改成「抠第一个 `{` 到最后一个 `}`」再解析

**修复**

- **授权页卡在「正在完成授权…」，magpie 加不进号**：上一版用 `Fetch.fulfillRequest`
  把回调换成静态页再在页面里 `fetch` 换取 —— 但执行上下文会随导航销毁，`Runtime.evaluate`
  拿不到结果。改成**完全不拦截**：让浏览器自己走完换取（TLS 指纹 / Cookie / Referer 天然齐全），
  只轮询 `location.href` 等它跳到回调地址，再读 `document.body.innerText`

**变更**

- **上下文窗口声明改为 1,000,000**（除 `hunyuan-turbos-vision` 仍 32k）。
  依据：实测 `main-auto` 发 **400,000 字符 = 190,511 tokens** 返回 200，
  远超 `config_defaults.yaml` 声明的 128k —— 那个 128k 是客户端自己的保守值
- **用户设置优先**：`config()` 不再整块覆盖 provider。改成**逐模型、逐字段合并** ——
  用户在 magpie 设置里改过的 `limit.context` / `limit.output` / `name` / `api` 一律保留，
  插件只补缺失字段和新增模型

**修复（逆向客户端主进程后对齐）**

- **换取请求改在页面上下文里发**：`yybadaccess` 的 WAF 做 TLS 指纹校验，
  Node 的 undici（OpenSSL）和 Chromium（BoringSSL）指纹不同 ——
  带头的请求从 Node 发出去一律 **400 空响应**。
- **补 `Referer`**：客户端重放时会把原始请求头整份复制（`reqHeaders` / `cookies` / `referer`），
  缺 referer 服务端判来源不合法。
- **去掉 `Ual-Access-Businessid`**：实测它会让 WAF 直接 400（这是我这轮踩的最大坑——
  加头反而更糟，不加头时至少还能拿到 `-109` JSON）。
- 浏览器先开 `about:blank`、装好钩子再 `Page.navigate` —— 否则首次请求漏过去，拦截永远不触发。

**修复（这是 `-109` 的真正根因）**

- **`redirect_uri` 少了 `?login_type=QC`**。Marvis 渲染层的 `Bpe(e)` 返回的是
  `.../marvis_oauth?login_type=${e}`，我写成了 `.../marvis_oauth`。
  服务端靠这个参数知道「用哪个 app 的 `client_secret` 去换 code」——
  少了它，**哪怕 code 是真的也一律 `-109 RC_PARAMS_INVALID`**（是参数无效，不是 code 无效）。
- 浏览器登录改为**正常走完回调请求**（带 Cookie、带正确 `redirect_uri`），
  只读第一个响应体；不再拦截后用 Node 重放（重放丢 Cookie，同样 `-109`）
- 微信登录同步修正

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

