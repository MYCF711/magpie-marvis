// 远程签名模式的契约 —— 这条路径决定「Linux 上能不能用」。
//
// 锁四件事：
//   1. 设了 MARVIS_BEACON_URL 就不再碰本地 native/（否则 Linux 上必然 invalid ELF header）
//   2. uskey 走 /uskeys?n=1&business=…，且 business 真的被带过去
//   3. 空 uskey 要抛，不能把 "null" 当令牌发出去
//   4. qimei36 有缓存（否则每个请求都打签名服务），失败降级成空串而不是抛
//
// 注意：REMOTE_URL 是模块加载时读的常量，所以每个场景都要带不同的 import query 重新加载。
import { test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { once } from "node:events"
import { pathToFileURL } from "node:url"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const NATIVE_MJS = join(HERE, "..", "src", "native.mjs")

/** 起一个假 signer，记录收到的请求 */
async function fakeSigner(handler) {
  const hits = []
  const srv = createServer((req, res) => {
    hits.push(req.url)
    const out = handler(req)
    if (out === undefined) {
      res.writeHead(500).end("{}")
      return
    }
    const body = JSON.stringify(out)
    res.writeHead(200, { "content-type": "application/json" }).end(body)
  })
  srv.listen(0, "127.0.0.1")
  await once(srv, "listening")
  return { url: `http://127.0.0.1:${srv.address().port}`, hits, close: () => srv.close() }
}

/** 带缓存破坏参数重新 import，保证读到新的 env */
let seq = 0
async function loadNative(url) {
  if (url) process.env.MARVIS_BEACON_URL = url
  else delete process.env.MARVIS_BEACON_URL
  return import(`${pathToFileURL(NATIVE_MJS).href}?case=${++seq}`)
}

test("设了 URL 时 loadBeacon 直接成功，不 require 本地二进制", async () => {
  const s = await fakeSigner(() => ({ qimei: "abc" }))
  try {
    const m = await loadNative(s.url)
    assert.equal(m.REMOTE_URL, s.url)
    const r = m.loadBeacon()
    assert.equal(r.ok, true)
    assert.match(m.nativeHint(), /beacon-signer/)
  } finally {
    s.close()
  }
})

test("newUskey 打 /uskeys?n=1 并带上 business", async () => {
  const s = await fakeSigner((req) => {
    if (req.url.startsWith("/uskeys")) return { uskeys: ["U1"] }
    return undefined
  })
  try {
    const m = await loadNative(s.url)
    assert.equal(await m.newUskey(), "U1")
    assert.equal(s.hits.length, 1)
    assert.match(s.hits[0], /^\/uskeys\?n=1&business=marvis_client$/)

    assert.equal(await m.newUskey("other_biz"), "U1")
    assert.match(s.hits[1], /business=other_biz$/)
  } finally {
    s.close()
  }
})

test("兼容只返回 { uskey } 的服务端", async () => {
  const s = await fakeSigner(() => ({ uskey: "SOLO" }))
  try {
    const m = await loadNative(s.url)
    assert.equal(await m.newUskey(), "SOLO")
  } finally {
    s.close()
  }
})

test("空 uskey / 'null' 必须抛，不能当令牌发出去", async () => {
  const s = await fakeSigner(() => ({ uskeys: ["null"] }))
  try {
    const m = await loadNative(s.url)
    await assert.rejects(() => m.newUskey(), /返回空 uskey/)
  } finally {
    s.close()
  }
})

test("signer 挂了要给出可读错误（含地址）", async () => {
  const m = await loadNative("http://127.0.0.1:1")
  await assert.rejects(() => m.newUskey(), /远程签名服务不可用：http:\/\/127\.0\.0\.1:1/)
})

test("qimei36 缓存：连调三次只打一次", async () => {
  const s = await fakeSigner((req) => (req.url === "/qimei" ? { qimei: "Q36" } : undefined))
  try {
    const m = await loadNative(s.url)
    assert.equal(await m.qimei36(), "Q36")
    assert.equal(await m.qimei36(), "Q36")
    assert.equal(await m.qimei36(), "Q36")
    assert.equal(s.hits.filter((u) => u === "/qimei").length, 1)
  } finally {
    s.close()
  }
})

test("qimei 取不到时降级成空串（服务端接受空串）", async () => {
  const s = await fakeSigner(() => undefined) // 500
  try {
    const m = await loadNative(s.url)
    assert.equal(await m.qimei36(), "")
  } finally {
    s.close()
  }
})

test("没设 URL 时 hint 指向 native/ 四个文件", async () => {
  const m = await loadNative(null)
  assert.equal(m.REMOTE_URL, "")
  assert.match(m.nativeHint(), /beacon_napi\.node/)
})
