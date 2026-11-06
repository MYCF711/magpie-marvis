// ② auth.methods —— 两条登录路
//
//   A. QQ / 微信 授权：自己起一个**隔离浏览器**（一次性 profile、伪装客户端 UA、
//      抹掉 navigator.webdriver），用户在窗口里授权，插件从 CDP 抓回调响应。
//      → `{ url, opened: true, method: "auto", callback }`
//        `opened: true` 让 magpie **不要**再开系统默认浏览器（否则弹两个窗口）。
//
//   B. 从本机 Marvis 导入：装了客户端且登录过的人，直接读进程内存里的登录态。
//      → 同样 `opened: true` + `method: "auto"`，整个登录就是「点一下 → 读内存 → 成功」。
//
// ⚠ `authorize()` 必须**立刻**返回 —— 真正等用户的是 `callback()`。
//   在这里 await 登录会和 magpie 双向死锁（HOOKS §四·陷阱1）。
//   `findBrowser()` 要查十几次注册表（实测 1.4 秒），必须放在 callback 里。
//
// ⚠ 已知问题：浏览器扫码这条路的换取服务端一直回 `-109 RC_PARAMS_INVALID`，
//   参数已逐字对齐官方客户端（redirect_uri / login_type / state / UA / Cookie / Referer）
//   仍然被拒 —— 判断是服务端对该入口有额外校验，插件侧无法绕过。
//   失败时给出可执行的替代路径，不让用户对着 109 干瞪眼。

import { PROVIDER, LOGIN_TYPE } from "../context.mjs"
import { authorizeUrl, parseCallback, deviceGuid } from "../marvis/login.mjs"
import { openIsolatedLogin, findBrowser } from "../marvis/browser.mjs"
import { resolveAccount } from "../account-name.mjs"
import { importFromDesktop, desktopAvailable } from "../marvis/desktop.mjs"

/** 回调地址判据：跳到 marvis_oauth 且带 code= */
const CALLBACK = /marvis_client_login\/marvis_oauth\?[^#]*\bcode=/i

/** 服务端拒绝浏览器登录时的提示 */
const BROWSER_LOGIN_HINT =
  "  [提示] 浏览器登录路服务端目前不接受（换取参数已逐字对齐官方客户端仍被拒）。" +
  "请改用「从本机 Marvis 导入」——装了 Marvis 客户端并在里面登录过就能一键导入。"

/**
 * 登录成功时给宿主的字段。
 * `accountId` 是**名字**（卡片上显示），`uid` 是身份（HOOKS §八）。
 * ⚠ `refresh` 必须有 —— 缺了它 magpie 不会把账号写进 plugin-auth.json，
 *   表现是「登录显示成功，但界面说无法列出账号」。
 */
export function authOf(acct) {
  const { accountId, uid } = resolveAccount({
    name: acct.nickname ?? "",
    phone: "",
    urn: acct.openid,
  })
  return {
    type: "success",
    access: acct.accessToken,
    // token 30 天有效，refresh 会成对轮换 —— 这里存自己，refresh 钩子负责换新
    refresh: acct.refreshToken ?? acct.accessToken,
    expires: acct.expiresAt ?? 0,
    ...(accountId ? { accountId } : {}),
    ...(uid ? { uid } : {}),
    // 落盘的额外字段：模型请求随时要用
    metadata: {
      openid: acct.openid,
      guid: acct.guid ?? deviceGuid(),
      loginType: acct.loginType ?? "1",
      nickname: acct.nickname ?? "",
    },
  }
}

/** 授权页登录（QQ / 微信），走隔离浏览器 */
function oauthLogin(loginType, label, instructions) {
  return {
    type: "oauth",
    label,
    async authorize() {
      const guid = deviceGuid()
      // ⚠ 不要在这里 findBrowser() —— 它要查 15 次注册表（实测 1.4 秒），
      //   而 authorize() 必须**立刻**返回（HOOKS 四·陷阱 1）。
      const url = authorizeUrl(loginType, guid)

      return {
        url,
        // 我们自己开隔离浏览器，magpie 不要再开系统默认浏览器
        opened: true,
        method: "auto",
        instructions,
        async callback(_url, _input, signal) {
          const browser = findBrowser()
          if (!browser) {
            throw new Error(
              "没有找到可用的 Chromium 内核浏览器（Chrome / Edge / 360 / QQ 浏览器都行）。" +
                "请装一个，或改用「从本机 Marvis 导入」。",
            )
          }

          // 起隔离浏览器 → 等它跳到回调地址，读第一个响应体
          const { url: callbackUrl, body } = await openIsolatedLogin({
            browser,
            url,
            match: CALLBACK,
            timeoutMs: 5 * 60_000,
            signal,
          })

          /** @type {any} */
          let acct
          try {
            acct = await parseCallback(callbackUrl, body, { loginType })
          } catch (err) {
            const msg = String(err?.message ?? err)
            throw new Error(/-109|RC_PARAMS_INVALID/.test(msg) ? msg + BROWSER_LOGIN_HINT : msg)
          }
          return authOf({ ...acct, guid, loginType: acct.loginType ?? LOGIN_TYPE[loginType] ?? "1" })
        },
      }
    },
  }
}

export function methods() {
  return [
    oauthLogin(
      "QC",
      "QQ 登录",
      "1) 会打开一个**独立的**浏览器窗口（不碰你日常浏览器）\n" +
        "2) 用你的 QQ 登录并确认授权\n" +
        "3) 授权完成后窗口会自己关掉，回到 magpie 即可",
    ),
    oauthLogin(
      "WX",
      "微信登录",
      "1) 会打开一个**独立的**浏览器窗口（不碰你日常浏览器）\n" +
        "2) 用微信扫码并确认\n" +
        "3) 授权完成后窗口会自己关掉，回到 magpie 即可",
    ),
    {
      type: "oauth",
      label: "从本机 Marvis 导入（需已安装并登录）",
      async authorize() {
        const ok = await desktopAvailable()
        return {
          // ⚠ 必须 opened: true + method: "auto"，否则 magpie 会去开这个 url
          //   （之前给 about:blank 弹了一次「没有可打开此链接的应用」）
          url: "",
          opened: true,
          method: "auto",
          instructions: ok
            ? "已检测到本机 Marvis 客户端，正在读取登录态…"
            : "本机没找到运行中的 Marvis 客户端。请先打开 Marvis 并登录，或改用 QQ / 微信 登录。",
          async callback() {
            const acct = await importFromDesktop()
            return authOf(acct)
          },
        }
      },
    },
  ]
}

export { PROVIDER, CALLBACK }
