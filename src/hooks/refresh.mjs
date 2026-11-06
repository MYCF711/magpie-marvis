// ③ auth.refresh —— 续期
//
// Marvis 的 token 是 **30 天**，且 `refresh` 会**成对轮换**：
// 换一次，旧的 accessToken 和 refreshToken 都立刻失效。
//
// 所以这里的刷新必须**串行**（同账号同时只允许一次），否则两次并发刷新
// 会让后拿到的那份把先拿到的打掉，表现是「登录偶尔莫名失效」（AGENTS 坑 7）。
//
// 上游刷新端点（`/v3/marvis_refresh_token`）需要 UAL 签名，走 businessHeaders。

import { createRefreshLock } from "../refresh-lock.mjs"
import { BASE } from "../context.mjs"
import { businessHeaders } from "../marvis/protocol.mjs"

const lock = createRefreshLock()

/**
 * @param {() => Promise<any>} getAuth 拿到当前账号
 * @returns {Promise<Record<string, unknown>>}
 */
export function refreshHook() {
  return async (getAuth) => {
    const auth = await getAuth()
    const meta = auth?.metadata ?? {}
    const refreshToken = String(auth?.refresh ?? "")
    if (!refreshToken) return {}

    const key = String(meta.openid ?? auth?.uid ?? auth?.access ?? "")

    return lock.run(key, async () => {
      const acct = {
        openid: String(meta.openid ?? ""),
        accessToken: String(auth?.access ?? auth?.key ?? ""),
        guid: String(meta.guid ?? ""),
        loginType: String(meta.loginType ?? "6"),
      }
      const query = new URLSearchParams({ refresh_token: refreshToken }).toString()
      const url = `${BASE}/v3/marvis_refresh_token?${query}`

      const res = await fetch(url, { method: "GET", headers: businessHeaders(acct, { query }) })
      const text = await res.text()

      /** @type {any} */
      let body
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error(`续期接口返回的不是 JSON（${res.status}）：${text.slice(0, 200)}`)
      }

      const info = body?.data ?? body?.user_info ?? body
      const access = info?.access_token ?? info?.accessToken
      const refresh = info?.refresh_token ?? info?.refreshToken ?? refreshToken
      const expire = Number(info?.access_token_expire_time ?? info?.expires_in ?? 0)

      if (!access) {
        // 拿不到新 token 就当登录失效 —— 让宿主引导重登
        const err = new Error(`续期失败：${body?.msg ?? text.slice(0, 200)}`)
        err.signIn = "expired"
        throw err
      }

      // ⚠ **合并**语义：只给新字段会覆盖掉 metadata 里的 openid/guid（AGENTS 坑 4）
      return {
        access: String(access),
        refresh: String(refresh),
        expires: expire > 1e9 ? expire * 1000 : Date.now() + 30 * 24 * 3600_000,
        metadata: { ...meta },
      }
    })
  }
}
