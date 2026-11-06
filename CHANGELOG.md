# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.1.5 — 2026-11-06

**修复**

- **浏览器登录失效（`-109 RC_PARAMS_INVALID`）**：换 token 时往 query 里多加了一个 `guid`，
  而 QQ 校验 `redirect_uri` 逐字一致 —— 多一个参数就判无效。现在只发 `login_type` + `code`
- **改成直接读回调页**：授权后浏览器跳到 `marvis_oauth` 时，服务端响应体**就是** token JSON。
  原来又发一次请求去换 = 用第二个 code，必然 `-109`。现在只读页面正文，不重发
- **本机导入弹 OS 对话框**：method 少了 `opened: true` + `method: "auto"`，
  magpie 会去打开 `about:blank`；补上后整个登录就是「点一下 → 读内存 → 成功」
- **本机导入 PowerShell 语法错误**（`MissingEndParenthesisInMethodCall`）：C# 代码经
  `-Command` 参数传递时引号被命令行解析吃掉。改成落临时 `.cs` + `.ps1`，走 `-File`

**新增**

- **隔离浏览器登录**：自己起一次性 Chromium（不复用日常浏览器 profile），
  带 `--disable-blink-features=AutomationControlled` / `--exclude-switches=enable-automation` /
  正常 Chrome UA + 补齐 `sec-ch-ua` client hints —— 去自动化痕迹、补指纹，防风控拦截
- 浏览器探测结果进程内缓存（注册表查询同步阻塞，否则 `authorize()` 会慢到 1 秒以上）

