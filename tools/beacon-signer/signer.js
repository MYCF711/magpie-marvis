// Beacon signer —— 把 Windows 专有的 `beacon_napi.node` 暴露成 HTTP，供 Linux/macOS 上的插件调用。
//
// 为什么需要它：`native/` 里的 4 个文件是 PE / DLL，Linux 上 `require` 会报
// `invalid ELF header`；而 uskey 又必须每次现签（同一个只能用 2 次，第 3 次起 403）。
// 于是把签名放到能跑 Windows 二进制的地方（原生 Windows，或 Linux + Wine），
// 插件用 `MARVIS_BEACON_URL` 走 HTTP 拿。
//
// 用法：
//   node signer.js                     # 原生 Windows：直接跑
//   ./run-wine.sh                      # Linux：wine + node.exe（自动下载 node.exe）
//
// 环境变量：
//   SIGNER_HOST        默认 127.0.0.1（容器访问时用 docker 网关地址，如 172.17.0.1）
//   SIGNER_PORT        默认 9024
//   BEACON_NATIVE_DIR  默认 ../../native（相对本文件）
//   BEACON_STUB        设为 1 时用假签名，不加载任何二进制（只验链路 / CI）
//
// 注意：Wine 下 node 的 stdout 会抛 EINVAL，所以日志一律写文件。

import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))

const NATIVE_DIR = process.env.BEACON_NATIVE_DIR
  ? path.resolve(process.env.BEACON_NATIVE_DIR)
  : path.join(HERE, "..", "..", "native")
const NATIVE = path.join(NATIVE_DIR, "beacon_napi.node")
const LOG = process.env.SIGNER_LOG || path.join(HERE, "signer.log")
const APP_KEY = process.env.BEACON_APP_KEY || "0WIN06Y06DKV1IUQ"
const APP_VERSION = process.env.BEACON_APP_VERSION || "1.60.3300.408"
const HOST = process.env.SIGNER_HOST || "127.0.0.1"
const PORT = Number(process.env.SIGNER_PORT || 9024)

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`
  try {
    fs.appendFileSync(LOG, line)
  } catch {}
}

let beacon = null
let initRc = null
let initError = ""
let served = 0
let lastAt = 0

// BEACON_STUB=1：不加载任何二进制，用假数据跑通链路（自检 / CI / 排网络用）。
// 它签的 uskey 上游不认，只能用来确认「插件 → signer → 响应」这条路是通的。
if (process.env.BEACON_STUB === "1") {
  beacon = {
    init: () => 0,
    getUskey: (businessId) =>
      Buffer.from(
        JSON.stringify({ stub: true, businessId, at: Date.now(), r: Math.random() }),
      ).toString("base64"),
    getQimei: () => "stub0000000000000000000000000000",
  }
  initRc = 0
  log("BEACON_STUB=1：使用假签名，仅用于链路自检")
} else {
  try {
    beacon = require(NATIVE)
    initRc = beacon.init({ appKey: APP_KEY, appVersion: APP_VERSION })
    log(`beacon init rc=${initRc} native=${NATIVE}`)
    if (initRc !== 0) initError = `beacon init returned ${initRc}`
  } catch (err) {
    initError = String(err?.message ?? err)
    log(`beacon load failed: ${initError}`)
  }
}

/** 现签 n 个 uskey。同一个只能用两次，所以请求几次就签几个。 */
function issue(n, businessId) {
  const out = []
  for (let i = 0; i < n; i++) {
    const v = String(beacon.getUskey(businessId, { reqScene: 1, taskType: "user" }) ?? "")
    if (v && v !== "null") out.push(v)
  }
  return out
}

function qimei() {
  try {
    return String(beacon?.getQimei?.() ?? "")
  } catch {
    return ""
  }
}

function send(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  })
  res.end(body)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  const business = url.searchParams.get("business") || "marvis_client"

  if (!beacon || initRc !== 0) {
    return send(res, 503, { error: "beacon unavailable", detail: initError })
  }

  if (url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      initRc,
      stub: process.env.BEACON_STUB === "1",
      nativeDir: NATIVE_DIR,
      qimei: qimei(),
      served,
      lastAt,
    })
  }

  if (url.pathname === "/uskey" || url.pathname === "/uskeys") {
    const n = Math.max(1, Math.min(200, Number(url.searchParams.get("n") || 1)))
    try {
      const list = issue(n, business)
      if (!list.length) return send(res, 502, { error: "empty uskey" })
      served += list.length
      lastAt = Date.now()
      return send(res, 200, n === 1 ? { uskey: list[0] } : { uskeys: list })
    } catch (err) {
      log(`uskey error: ${err?.message ?? err}`)
      return send(res, 502, { error: String(err?.message ?? err) })
    }
  }

  if (url.pathname === "/qimei") {
    return send(res, 200, { qimei: qimei() })
  }

  send(res, 404, { error: "not found", paths: ["/health", "/uskey", "/uskeys", "/qimei"] })
})

server.on("error", (err) => log(`listen error: ${err.message}`))
server.listen(PORT, HOST, () => log(`listening on http://${HOST}:${PORT}`))
