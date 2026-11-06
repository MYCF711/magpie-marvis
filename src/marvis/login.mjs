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
 * @param {string} guid 只用于 `Ual-Access-Guid` 请求头
 * @param {string} [state] QQ 回调带回来的 state（原样回传）
 * @returns {Promise<{ openid: string, accessToken: string, refreshToken?: string, nickname?: string, avatar?: string, loginType: string, expiresAt?: number }>}
 */
export async function exchangeCode(code, loginType, guid, state) {
  // ⚠ query 必须**逐字**等于 QQ 回调时的 redirect_uri 查询串 ——
  //   QQ 在换 token 时校验 `redirect_uri` 一致性，多一个参数（比如 guid）就 `-109 RC_PARAMS_INVALID`。
  //   guid 只在 authorize 的 state 里传递，不进这里。
  const params = { login_type: loginType, code }
  if (state) params.state = String(state)
  const query = new URLSearchParams(params).toString()
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
    const errCode = body?.code ?? res.status
    const hint =
      errCode === -109
        ? "（RC_PARAMS_INVALID：授权码无效或已被使用过。每次登录都会拿到一个新 code，一个 code 只能换一次 token，请重新走一遍登录）"
        : ""
    throw new Error(`登录失败（code=${errCode}）：${body?.msg ?? "未返回 access_token / openid"}${hint}`)
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

/**
 * 从回调页里解析登录态。
 *
 * **主路径**：回调页本身就是换 token 的响应，正文是一段 JSON：
 *   `{"code":0,"msg":"","user_info":{"openid":"...","access_token":"mv_..."},"ext_info":{...}}`
 * 所以直接读正文，**不要重发请求** —— 重发就是用第二个 code，必然 `-109 RC_PARAMS_INVALID`。
 *
 * **兜底**：正文取不到（页面被拦截 / 白屏）时，从地址栏抠 code 再换一次。
 *
 * @param {string} callbackUrl 回调页地址
 * @param {string} [body] 回调页正文
 * @returns {{ openid: string, accessToken: string, refreshToken?: string, nickname?: string, avatar?: string, loginType: string, expiresAt?: number }}
 */
export function parseCallback(callbackUrl, body) {
  const text = String(body ?? "").trim()

  // ① 主路径：正文就是 JSON
  if (text.startsWith("{")) {
    /** @type {any} */
    let body0
    try {
      body0 = JSON.parse(text)
    } catch {
      body0 = null
    }
    if (body0) {
      const biz = body0.code
      if (typeof biz === "number" && biz !== 0) {
        throw new Error(
          `登录失败（code=${biz}）：${body0.msg ?? "未返回用户信息"}` +
            (biz === -109
              ? "（授权码无效或已被使用过 —— 一个 code 只能换一次 token，请重新走一遍登录）"
              : ""),
        )
      }
      const info = body0.user_info ?? body0.data ?? body0
      const accessToken = info?.access_token ?? info?.accessToken
      const openid = info?.openid ?? info?.openId ?? info?.open_id
      if (accessToken && openid) return normalize(info, accessToken, openid)
    }
  }

  // ② 兜底：从地址栏抠 code 再换
  const code = extractCode(callbackUrl)
  if (!code) {
    throw new Error(
      `回调页没有返回登录态（正文：${text.slice(0, 160) || "空"}）。请重新走一遍登录。`,
    )
  }
  throw new Error(
    `回调页没有直接返回 token（正文：${text.slice(0, 120) || "空"}），` +
      `请重新走一遍登录。`,
  )
}

/** 把上游 user_info 归一成插件内部形状 */
function normalize(info, accessToken, openid) {
  const expire = Number(info?.access_token_expire_time ?? info?.expires_in ?? 0)
  return {
    openid: String(openid),
    accessToken: String(accessToken),
    refreshToken: info?.refresh_token ? String(info.refresh_token) : undefined,
    nickname: info?.nick_name ? safeDecode(info.nick_name) : undefined,
    avatar: info?.head_img_url ?? undefined,
    loginType: "6",
    expiresAt: expire > 1e9 ? expire * 1000 : Date.now() + 30 * 24 * 3600_000,
  }
}

function safeDecode(s) {
  try {
    return decodeURIComponent(String(s))
  } catch {
    return String(s)
  }
}
