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

/**
 * redirect_uri 的**基址**（不带查询串）。
 *
 * ⚠⚠ 授权时必须拼上 `?login_type=<QC|WX>` —— 这是整个登录的关键：
 *   服务端要靠它知道「用哪个 app 的 client_secret 去换 code」。
 *   少了它，哪怕 code 是真的，也会一律回 `-109 RC_PARAMS_INVALID`
 *   （`RC_PARAMS_INVALID` = 参数无效，不是 code 无效）。
 *
 *   对照 Marvis 渲染层的 `Bpe(e)`：
 *     `${base}/${n}/marvis_oauth?login_type=${e}`   // e = QC | WX
 */
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
      // ⚠ 同样必须带 ?login_type=WX
      redirect_uri: `${REDIRECT}?login_type=${loginType}`,
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
    // ⚠ 必须带 ?login_type=QC，见 REDIRECT 上方说明
    redirect_uri: `${REDIRECT}?login_type=${loginType}`,
    // ⚠ 必须与 Marvis 渲染层逐字一致：`state=${Math.random()*100}`
    //   是**小数**（如 31.1177412），不是整数。服务端会拿它做校验，格式不符会被判参数无效。
    state: String(Math.random() * 100),
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
export async function exchangeCode(code, loginType, _guid, state) {
  // ⚠⚠ 这个端点**不需要任何鉴权头**（它就是在发登录态）。
  //   实测：带上 `Ual-Access-*` 签名头 -> **400 空响应**；不带 -> `200 {code:...}`。
  //   所以千万别在这里复用 businessHeaders()。
  //
  // ⚠ query 里**只能有 login_type 和 code**：多一个参数服务端就 `-109 RC_PARAMS_INVALID`。
  const params = { login_type: loginType, code }
  if (state) params.state = String(state)
  const query = new URLSearchParams(params).toString()
  const url = `${REDIRECT}?${query}`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      // 伪装成 Marvis 自己的浏览器 —— 服务端按 UA 区分客户端
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Marvis/1.60.3300.408 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  })

  const text = await res.text()
  /** @type {any} */
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`登录接口返回的不是 JSON（HTTP ${res.status}）：${text.slice(0, 200) || "空响应"}`)
  }

  const info = body?.user_info ?? body?.data ?? null
  const accessToken = info?.access_token ?? info?.accessToken ?? body?.access_token
  const openid = info?.openid ?? info?.openId ?? info?.open_id

  if (!accessToken || !openid) {
    const errCode = body?.code ?? res.status
    const hint =
      errCode === -109
        ? "（RC_PARAMS_INVALID：授权码无效或已被使用过。一个 code 只能换一次 token，请重新走一遍登录）"
        : ""
    throw new Error(`登录失败（code=${errCode}）：${body?.msg ?? "未返回 access_token / openid"}${hint}`)
  }

  return normalize(info, accessToken, openid)
}

/**
 * 从回调里拿到登录态。
 *
 * **主路径**（推荐，已实测）：回调请求被 CDP 在**跳转前**拦下，我们只拿到 URL，
 * 由自己带上 `login_type` 去换 token。原因见下方 ⚠。
 *
 * **兜底**：如果 URL 里取不到 code、但页面正文是一段 JSON（旧路径），也认。
 *
 * ⚠ 为什么不能依赖那个落地页的响应：实测 QQ 会把 `redirect_uri` 的查询串
 *   **整个丢掉** —— 落地页收到的是 `?code=...&state=...`，**没有 `login_type`**，
 *   服务端因此返回 `-109 RC_PARAMS_INVALID`。所以必须自己取 code 再换。
 *
 * @param {string} callbackUrl 回调地址（含 code）
 * @param {string} [body] 回调页正文（CDP 拦截时为空）
 * @param {{ loginType?: string, guid?: string }} [opts]
 */
export async function parseCallback(callbackUrl, body, opts = {}) {
  const text = String(body ?? "").trim()

  // 主路径：正文就是 JSON。
  // ⚠ 不能只看 `startsWith("{")` —— 浏览器渲染 `application/json` 时会加缩进/包装，
  //   也可能前后带空白。改成「抠第一个 `{` 到最后一个 `}`」再解析。
  const jsonText = (() => {
    const a = text.indexOf("{")
    const b = text.lastIndexOf("}")
    return a >= 0 && b > a ? text.slice(a, b + 1) : ""
  })()
  if (jsonText) {
    /** @type {any} */
    let body0
    try {
      body0 = JSON.parse(jsonText)
    } catch {
      body0 = null
    }
    if (body0) {
      const biz = body0.code
      const info = body0.user_info ?? body0.data ?? body0
      const accessToken = info?.access_token ?? info?.accessToken
      const openid = info?.openid ?? info?.openId ?? info?.open_id
      if (typeof biz === "number" && biz !== 0) {
        throw new Error(
          `登录失败（code=${biz}）：${body0.msg ?? "未返回用户信息"}` +
            (biz === -109
              ? "（授权码无效或已被使用过 —— 一个 code 只能换一次 token，请重新走一遍登录）"
              : ""),
        )
      }
      if (accessToken && openid) return normalize(info, accessToken, openid)
    }
  }

  // 主路径：从 URL 取 code，自己换
  const code = extractCode(callbackUrl)
  if (!code) {
    throw new Error(
      `没能从回调地址里取出授权码（${String(callbackUrl).slice(0, 160) || "空"}）。请重新走一遍登录。`,
    )
  }
  return exchangeCode(code, opts.loginType ?? "QC", opts.guid, undefined)
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
    // ⚠ `Ual-Access-Login-Type` 的真实取值：QC→"1"、WX/WXAPP→"2"
    //   （渲染层 `yct={QC:"1",WX:"2",WXAPP:"2"}`）。不是 6。
    loginType: info?.login_type === "WX" || info?.login_type === "WXAPP" ? "2" : "1",
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

/**
 * 设备 guid。
 *
 * 来源：注册表 `HKCU\SOFTWARE\Tencent\Marvis\Env\svid`。
 * 服务端按 `(openid, guid, token)` 三元组校验，但 guid 是**纯客户端自报**的 ——
 * 换 guid 会 `-101 redis: nil`，所以它必须稳定，跟着 token 一起存。
 *
 * 没有注册表（没装 Marvis）时，用「本机机器名 + 用户名」派生 ——
 * 同一台机器永远算出同一个，不会每次登录变。
 *
 * @returns {string} 32 位小写 hex
 */
export function deviceGuid() {
  try {
    const { execFileSync } = require("node:child_process")
    // ⚠ 必须 String.raw：JS 里 `\S` `\T` 是**无效转义**，反斜杠会被吃掉，
    //   传给 reg 的路径变成 `HKCUSOFTWARETencentMarvisEnv` -> 「无效参数」。
    const out = execFileSync("reg", ["query", String.raw`HKCU\SOFTWARE\Tencent\Marvis\Env`, "/v", "svid"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 3000,
    })
    const m = /svid\s+REG_SZ\s+([0-9a-fA-F]{32})/.exec(out)
    if (m) return m[1].toLowerCase()
  } catch {
    /* 没装 Marvis 或没有这个键，用派生值 */
  }
  const { hostname, userInfo } = require("node:os")
  const seed = `${hostname()}|${userInfo?.().username ?? ""}|marvis`
  return createHash("md5").update(seed).digest("hex")
}
