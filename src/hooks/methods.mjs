// ② auth.methods —— 两条登录路
//
//   A. QQ / 微信 授权页（默认）：打开浏览器 → 用户在 QQ/微信里确认 →
//      浏览器跳到 Marvis 的 redirect_uri 并显示一段 JSON → 用户把 `code=XXX` 粘回来。
//   B. 从本机 Marvis 导入：装了客户端且登录过的人，一条命令读出来，不用走浏览器。
//
// ⚠ `authorize()` 必须**立刻**返回 —— 真正等用户的是 `callback()`。
//   在这里 await 登录会和 magpie 双向死锁（HOOKS §四·陷阱1）。
//
// ⚠ 为什么不能像别的插件那样起本地 loopback：redirect_uri 是 QQ 互联里
//   预注册死的，改不了（详见 src/marvis/login.mjs 顶部）。

import { PROVIDER } from "../context.mjs"
import { authorizeUrl, exchangeCode, extractCode, deviceGuid } from "../marvis/login.mjs"
import { resolveAccount } from "../account-name.mjs"
import { importFromDesktop, desktopAvailable } from "../marvis/desktop.mjs"

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
      loginType: acct.loginType ?? "6",
      nickname: acct.nickname ?? "",
    },
  }
}

/** 授权页登录（QQ / 微信） */
function oauthLogin(loginType, label, instructions) {
  return {
    type: "oauth",
    label,
    async authorize() {
      const guid = deviceGuid()
      return {
        url: authorizeUrl(loginType, guid),
        instructions,
        // 用户在浏览器里确认后，地址栏会变成
        //   https://yybadaccess.3g.qq.com/marvis_client_login/marvis_oauth?login_type=QC&code=XXX
        // 把整条 URL（或只 code）粘回来即可。
        async callback(_url, input) {
          const code = extractCode(input) ?? extractCode(_url)
          if (!code) {
            throw new Error("没识别出授权码。请把浏览器地址栏里的整条 URL 贴进来（形如 ...?login_type=QC&code=XXXX）")
          }
          const acct = await exchangeCode(code, loginType, guid)
          return authOf({ ...acct, guid })
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
      "1) 浏览器会打开 QQ 授权页，用你的 QQ 登录并确认授权\n" +
        "2) 授权后页面会显示一段 JSON（或跳到 marvis_client_login 地址）\n" +
        "3) 把**地址栏里的整条 URL** 粘贴回来（含 code=…）",
    ),
    oauthLogin(
      "WX",
      "微信登录",
      "1) 浏览器会打开微信扫码页，用微信扫码并确认\n" +
        "2) 扫码后页面会显示一段 JSON（或跳到 marvis_client_login 地址）\n" +
        "3) 把**地址栏里的整条 URL** 粘贴回来（含 code=…）",
    ),
    {
      type: "oauth",
      label: "从本机 Marvis 导入（需已安装并登录）",
      async authorize() {
        const ok = await desktopAvailable()
        return {
          url: ok ? "about:blank" : "about:blank",
          instructions: ok
            ? "已检测到本机 Marvis 客户端，正在读取登录态…"
            : "本机没找到 Marvis 客户端（需要安装并登录过）。请改用上面的 QQ / 微信登录。",
          async callback() {
            const acct = await importFromDesktop()
            return authOf(acct)
          },
        }
      },
    },
  ]
}

export { PROVIDER }
