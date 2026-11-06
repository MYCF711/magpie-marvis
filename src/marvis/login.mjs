// Marvis 登录 —— QQ / 微信 OAuth 授权码换 token
//
// 上游只给两种登录：QQ（QC）和微信（WX）。都是标准 OAuth2 授权码。
//
// ⚠ `redirect_uri` **改不了** —— 它固定在 Marvis 服务端
//   （`https://yybadaccess.3g.qq.com/marvis_client_login/marvis_oauth?login_type=QC`），
//   是 QQ 互联里预注册过的。所以不能像别的插件那样起本地 loopback 收回调。
//
// 实际流程：插件打开授权页 → 用户在 QQ/微信里确认 → 浏览器跳到那个 redirect_uri，
//   页面直接吐一段 JSON → 用户把地址栏里的 `code=XXX`（或整段 JSON）粘回来。
//   `ask()` 支持这种两步登录（HOOKS 四·陷阱 5：`prompts` 数组串不起来，必须用 `ask()`）。

import { BASE, QQ_APP_ID, WX_APP_ID, BUSINESS_ID, LOGIN_TYPE } from "../context.mjs"
import { ualSignature } from "./protocol.mjs"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

/** redirect_uri —— 与 Marvis 客户端逐字一致 */
const REDIRECT = `${BASE}/marvis_client_login/marvis_oauth`

/**
 * 拼授权页地址。
 * @param {"QC" | "WX"} loginType
 * @param {string} guid 设备 guid（微信的 state 就是它）
 * @returns {string}
 */
export function authorizeUrl(loginType, guid) {
  if (loginType === "WX") {
    const p = new URLSearchParams({
      appid: WX_APP_ID,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: "snsapi_login",
      state: guid,
    })
    return `https://open.weixin.qq.com/connect/qrconnect?${p}`
  }
  // QQ：which=Login&display=pc 是 Marvis 客户端用的参数，别省
  const p = new URLSearchParams({
    which: "Login",
    display: "pc",
    response_type: "code",
    client_id: QQ_APP_ID,
    redirect_uri: REDIRECT,
    state: String(Math.floor(Math.random() * 1e9)),
  })
  return `https://graph.qq.com/oauth2.0/authorize?${p}`
}

/**
 * 从用户粘贴的内容里抠出授权码。
 * 支持：纯 code / 完整回调 URL / 整段 JSON 里的 code 字段。
 * @param {string} input
 * @returns {string | null}
 */
export function extractCode(input) {
  const s = String(input ?? "").trim()
  if (!s) return null
  // 完整 URL
  try {
    const u = new URL(s)
    const c = u.searchParams.get("code")
    if (c) return c
  } catch {
    /* 不是 URL，往下走 */
  }
  // JSON
  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s)
      const c = j?.code ?? j?.user_info?.code ?? j?.data?.code
      // 注意：失败响应的 code 是数字错误码，成功时才是字符串
      if (typeof c === "string" && c.length > 4) return c
    } catch {
      /* 不是 JSON */
    }
  }
  // 只有 code=xxx
  const m = /(?:^|[?&])code=([^&\s]+)/.exec(s)
  if (m) return decodeURIComponent(m[1])
  // 裸 code：Marvis 的 code 是长串字母数字
  if (/^[A-Za-z0-9_-]{8,}$/.test(s)) return s
  return null
}

/**
 * 用授权码换 token。
 *
 * 这个端点**自己带签名**（`md5(query+timestamp+accessKey+nonce)`），
 * 不需要登录态 —— 它就是在发登录态。
 *
 * @param {string} code
 * @param {"QC" | "WX"} loginType
 * @param {string} guid
 * @returns {Promise<{ openid: string, accessToken: string, refreshToken?: string, nickname?: string, avatar?: string, loginType: string, expiresAt?: number }>}
 */
export async function exchangeCode(code, loginType, guid) {
  const query = new URLSearchParams({ login_type: loginType, code, guid }).toString()
  const timestamp = String(Date.now())
  const nonce = String(1000 + Math.floor(Math.random() * 9000))
  const url = `${REDIRECT}?${query}`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Marvis/1.60.3300.408 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36",
      "Ual-Access-Businessid": BUSINESS_ID,
      "Ual-Access-Timestamp": timestamp,
      "Ual-Access-Nonce": nonce,
      "Ual-Access-Signature": ualSignature(query, timestamp, nonce),
      "Ual-Access-Guid": guid,
      "Ual-Access-Login-Type": LOGIN_TYPE[loginType] ?? "6",
    },
  })

  const text = await res.text()
  /** @type {any} */
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`登录接口返回的不是 JSON（${res.status}）：${text.slice(0, 200)}`)
  }

  const info = body?.user_info ?? body?.data ?? null
  const accessToken = info?.access_token ?? info?.accessToken ?? body?.access_token
  const openid = info?.openid ?? info?.openId ?? info?.open_id

  if (!accessToken || !openid) {
    const code = body?.code ?? res.status
    throw new Error(`登录失败（code=${code}）：${body?.msg ?? "未返回 access_token / openid"}`)
  }

  const expire = Number(info?.access_token_expire_time ?? info?.expires_in ?? 0)
  return {
    openid: String(openid),
    accessToken: String(accessToken),
    refreshToken: info?.refresh_token ? String(info.refresh_token) : undefined,
    nickname: info?.nick_name ? decodeURIComponent(info.nick_name) : undefined,
    avatar: info?.head_img_url ?? undefined,
    loginType: LOGIN_TYPE[loginType] ?? "6",
    // 上游给的是**到期时刻**（秒）；没给就按 30 天算
    expiresAt: expire > 1e9 ? expire * 1000 : Date.now() + 30 * 24 * 3600_000,
  }
}

/**
 * 设备 guid。
 *
 * 来源：注册表 `HKCU\SOFTWARE\Tencent\Marvis\Env\svid`。
 * 服务端按 `(openid, guid, token)` 三元组校验，但 guid 是**纯客户端自报**的 ——
 * 换 guid 会 `-101 redis: nil`，所以它必须稳定，跟着 token 一起存。
 *
 * 没有注册表（没装 Marvis）时，用「本机机器 id 派生」的稳定值兜底 ——
 * 同一台机器永远算出同一个，不会每次登录变。
 *
 * @returns {string} 32 位小写 hex
 */
export function deviceGuid() {
  try {
    // @ts-ignore —— 只在 Windows 上有
    const { execFileSync } = require("node:child_process")
    const out = execFileSync(
      "reg",
      ["query", "HKCU\\SOFTWARE\\Tencent\\Marvis\\Env", "/v", "svid"],
      { encoding: "utf8", windowsHide: true, timeout: 3000 },
    )
    const m = /svid\s+REG_SZ\s+([0-9a-fA-F]{32})/.exec(out)
    if (m) return m[1].toLowerCase()
  } catch {
    /* 没装 Marvis 或没有这个键，用派生值 */
  }
  // 兜底：机器名 + 用户名 + 平台，哈希成 32 hex。跨进程稳定。
  const { hostname, userInfo } = require("node:os")
  const seed = `${hostname()}|${userInfo?.().username ?? ""}|marvis`
  return createHash("md5").update(seed).digest("hex")
}
