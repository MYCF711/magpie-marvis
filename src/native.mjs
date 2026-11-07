// Beacon SDK 封装 —— uskey 的本地签发
//
// ⚠ 这一层是整个插件的**准入门槛**：模型网关要求请求头 `Ual-Access-MarvisExt`
//   里带一个 uskey，而 uskey 由腾讯的 Beacon SDK 本地生成。没有它 → 403 风控。
//
// ⚠ 为什么必须 vendor 二进制：`beacon_napi.node` 的 PE 导入表里**看不到**它依赖谁 ——
//   它运行时按**自己所在目录**去 LoadLibrary 兄弟 DLL。少一个（尤其 `qimei.dll`）
//   不报错，只是 `getQimei()` / `getUskey()` 静默返回 null。这就是为什么
//   「只复制 .node 文件」在别的机器上必然失败。
//
// ⚠ 同一个 uskey 只能成功 **2 次**，第 3 次起 403（等 75 秒仍 403 = 配额不是频率）。
//   所以每次请求都必须现签一个，不能缓存。
//
// ⚠ 这 4 个文件是 **Windows 专有产物**（PE / DLL），Linux/macOS 上 `require` 会报
//   `invalid ELF header`。要在 Linux（服务器、容器、CI）上跑，用**远程签名服务**：
//   把 `tools/beacon-signer/` 跑在任意 Windows（或 Linux + Wine）上，然后设
//   `MARVIS_BEACON_URL=http://<signer-host>:9024`。此时 `newUskey` / `qimei36`
//   改走 HTTP，本地 native/ 不再被加载。

import { createRequire } from "node:module"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)

const HERE = dirname(fileURLToPath(import.meta.url))
/** 插件根目录下的 native/ —— 4 个文件一起才工作 */
export const NATIVE_DIR = join(HERE, "..", "native")

/** 缺哪个文件就报哪个，别让用户猜 */
const REQUIRED = ["beacon_napi.node", "qimei.dll", "beacon_sdk.dll", "beacon_wrapper.dll"]

/** 上游 appKey —— 来自 Marvis 的 resources/.env 的 MARVIS_QIMEI_APPKEY */
const APP_KEY = "0WIN06Y06DKV1IUQ"
const APP_VERSION = "1.60.3300.408"

/**
 * 远程签名服务地址。设置后不再加载 native/，改用 HTTP 现签。
 * 例：`MARVIS_BEACON_URL=http://127.0.0.1:9024`
 */
export const REMOTE_URL = String(process.env.MARVIS_BEACON_URL ?? "")
  .trim()
  .replace(/\/+$/, "")

/** @type {{ init: Function, getUskey: Function, getQimei: Function } | null} */
let beacon = null
let initError = null

/**
 * 加载并初始化 Beacon SDK。**只做一次**，重复调用返回同一个实例。
 * 远程签名模式下不加载本地二进制，直接返回成功。
 * @returns {{ ok: true, beacon: any } | { ok: false, error: string }}
 */
export function loadBeacon() {
  if (beacon) return { ok: true, beacon }
  if (initError) return { ok: false, error: initError }

  if (REMOTE_URL) {
    // 远程模式没有本地实例，调用方一律走 HTTP 分支
    beacon = { remote: true }
    return { ok: true, beacon }
  }

  const missing = REQUIRED.filter((f) => !existsSync(join(NATIVE_DIR, f)))
  if (missing.length) {
    initError =
      `native/ 目录缺少 ${missing.join("、")}。` +
      `这 4 个文件必须一起打包（beacon_napi.node 靠同目录的 DLL 动态加载，缺一个就静默返回 null）。` +
      `在 Linux/macOS 上请改用远程签名服务：设 MARVIS_BEACON_URL 指向 tools/beacon-signer/`
    return { ok: false, error: initError }
  }

  try {
    const mod = require(join(NATIVE_DIR, "beacon_napi.node"))
    // init 返回 0 = 成功。返回非 0 时 getUskey 也会给 null，所以这里就拦住。
    const rc = mod.init({ appKey: APP_KEY, appVersion: APP_VERSION })
    if (rc !== 0) throw new Error(`beacon init 返回 ${rc}`)
    beacon = mod
    return { ok: true, beacon }
  } catch (err) {
    initError =
      `Beacon SDK 加载失败：${err?.message ?? err}` +
      (process.platform !== "win32"
        ? `（当前是 ${process.platform}，native/ 里的 4 个文件是 Windows 二进制，请改用 MARVIS_BEACON_URL 远程签名）`
        : "")
    return { ok: false, error: initError }
  }
}

/**
 * 调远程签名服务。只处理 HTTP 层错误，业务错误交给调用方。
 * @param {string} path 以 / 开头的路径（含 query）
 * @returns {Promise<any>}
 */
async function remoteJson(path) {
  let res
  try {
    res = await fetch(`${REMOTE_URL}${path}`, { signal: AbortSignal.timeout(15_000) })
  } catch (err) {
    throw new Error(`远程签名服务不可用：${REMOTE_URL}（${err?.message ?? err}）`)
  }
  if (!res.ok) {
    throw new Error(`远程签名服务返回 HTTP ${res.status}：${REMOTE_URL}${path}`)
  }
  return res.json()
}

/**
 * 现签一个 uskey。**每次请求都要调**（同一 uskey 只给 2 次）。
 * @param {string} [businessId] 业务 id，模型网关固定 `marvis_client`
 * @returns {Promise<string>}
 * @throws 加载失败或上游返回空
 */
export async function newUskey(businessId = "marvis_client") {
  if (REMOTE_URL) {
    const j = await remoteJson(`/uskeys?n=1&business=${encodeURIComponent(businessId)}`)
    const uskey = String((j?.uskeys?.[0] ?? j?.uskey) ?? "")
    if (!uskey || uskey === "null") {
      throw new Error(`远程签名服务返回空 uskey：${REMOTE_URL}`)
    }
    return uskey
  }

  const r = loadBeacon()
  if (!r.ok) throw new Error(r.error)
  const uskey = String(r.beacon.getUskey(businessId, { reqScene: 1, taskType: "user" }) ?? "")
  if (!uskey || uskey === "null") {
    throw new Error("Beacon SDK 返回空 uskey（通常是 native/ 目录缺 qimei.dll 或没初始化成功）")
  }
  return uskey
}

/** qimei36 在同一台设备上是稳定的，远程模式下缓存 6 小时，别把签名服务打爆 */
let qimeiCache = ""
let qimeiAt = 0
const QIMEI_TTL_MS = 6 * 3600_000

/**
 * 设备 qimei36。MarvisExt 里要用。
 * @returns {Promise<string>} 取不到时返回空串（服务端接受空串，不会因此 403）
 */
export async function qimei36() {
  if (REMOTE_URL) {
    if (qimeiCache && Date.now() - qimeiAt < QIMEI_TTL_MS) return qimeiCache
    try {
      const j = await remoteJson("/qimei")
      qimeiCache = String(j?.qimei ?? "")
      qimeiAt = Date.now()
    } catch {
      return ""
    }
    return qimeiCache
  }

  const r = loadBeacon()
  if (!r.ok) return ""
  try {
    return String(r.beacon.getQimei() ?? "")
  } catch {
    return ""
  }
}

/** 拿不到 uskey 时给用户看的说明（登录页 / 错误提示用） */
export function nativeHint() {
  if (REMOTE_URL) return `远程签名服务 ${REMOTE_URL}（tools/beacon-signer）`
  return "需要 native/ 下的 4 个文件（beacon_napi.node + qimei.dll + beacon_sdk.dll + beacon_wrapper.dll）"
}
