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

/** @type {{ init: Function, getUskey: Function, getQimei: Function } | null} */
let beacon = null
let initError = null

/**
 * 加载并初始化 Beacon SDK。**只做一次**，重复调用返回同一个实例。
 * @returns {{ ok: true, beacon: any } | { ok: false, error: string }}
 */
export function loadBeacon() {
  if (beacon) return { ok: true, beacon }
  if (initError) return { ok: false, error: initError }

  const missing = REQUIRED.filter((f) => !existsSync(join(NATIVE_DIR, f)))
  if (missing.length) {
    initError =
      `native/ 目录缺少 ${missing.join("、")}。` +
      `这 4 个文件必须一起打包（beacon_napi.node 靠同目录的 DLL 动态加载，缺一个就静默返回 null）`
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
    initError = `Beacon SDK 加载失败：${err?.message ?? err}`
    return { ok: false, error: initError }
  }
}

/**
 * 现签一个 uskey。**每次请求都要调**（同一 uskey 只给 2 次）。
 * @param {string} [businessId] 业务 id，模型网关固定 `marvis_client`
 * @returns {string}
 * @throws 加载失败或上游返回空
 */
export function newUskey(businessId = "marvis_client") {
  const r = loadBeacon()
  if (!r.ok) throw new Error(r.error)
  const uskey = String(r.beacon.getUskey(businessId, { reqScene: 1, taskType: "user" }) ?? "")
  if (!uskey || uskey === "null") {
    throw new Error("Beacon SDK 返回空 uskey（通常是 native/ 目录缺 qimei.dll 或没初始化成功）")
  }
  return uskey
}

/**
 * 设备 qimei36。MarvisExt 里要用。
 * @returns {string} 取不到时返回空串（服务端接受空串，不会因此 403）
 */
export function qimei36() {
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
  return "需要 native/ 下的 4 个文件（beacon_napi.node + qimei.dll + beacon_sdk.dll + beacon_wrapper.dll）"
}
