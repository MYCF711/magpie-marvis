// signer 的 HTTP 契约 —— 用 BEACON_STUB=1 跑，不需要 Windows 二进制。
//
// 这一层锁的是「插件和 signer 之间的形状」：路径、字段名、n 的上限、错误码。
// 真机上的 uskey 内容测不了（要腾讯 SDK），但接口一旦改名，这里立刻红。
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"

const HERE = dirname(fileURLToPath(import.meta.url))
const SIGNER = join(HERE, "..", "tools", "beacon-signer", "signer.js")

/** 拿一个空闲端口，避免和真的 9024 撞 */
async function freePort() {
  const srv = createServer()
  srv.listen(0, "127.0.0.1")
  await once(srv, "listening")
  const { port } = srv.address()
  srv.close()
  await once(srv, "close")
  return port
}

let child
let base

before(async () => {
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  child = spawn(process.execPath, [SIGNER], {
    env: {
      ...process.env,
      BEACON_STUB: "1",
      SIGNER_HOST: "127.0.0.1",
      SIGNER_PORT: String(port),
      SIGNER_LOG: join(tmpdir(), `magpie-signer-test-${process.pid}.log`),
    },
    stdio: "ignore",
  })
  // 等它起来：最多 10 秒
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error("signer 没起来")
})

after(() => {
  child?.kill()
})

test("/health 报告 stub 与 fed 计数", async () => {
  const j = await (await fetch(`${base}/health`)).json()
  assert.equal(j.ok, true)
  assert.equal(j.initRc, 0)
  assert.equal(typeof j.served, "number")
})

test("/uskey 返回单个 uskey", async () => {
  const r = await fetch(`${base}/uskey`)
  assert.equal(r.status, 200)
  const j = await r.json()
  assert.equal(typeof j.uskey, "string")
  assert.ok(j.uskey.length > 0)
})

test("/uskeys?n=2 返回两个不同的串（每次现签）", async () => {
  const j = await (await fetch(`${base}/uskeys?n=2`)).json()
  assert.equal(j.uskeys.length, 2)
  assert.notEqual(j.uskeys[0], j.uskeys[1])
})

test("served 随签发递增", async () => {
  const a = (await (await fetch(`${base}/health`)).json()).served
  await fetch(`${base}/uskeys?n=3`)
  const b = (await (await fetch(`${base}/health`)).json()).served
  assert.equal(b, a + 3)
})

test("n 超上限被夹到 200", async () => {
  const j = await (await fetch(`${base}/uskeys?n=999`)).json()
  assert.equal(j.uskeys.length, 200)
})

test("/qimei 返回非空", async () => {
  const j = await (await fetch(`${base}/qimei`)).json()
  assert.match(j.qimei, /^[0-9a-z]+$/i)
})

test("未知路径 404 且列出可用路径", async () => {
  const r = await fetch(`${base}/nope`)
  assert.equal(r.status, 404)
  const j = await r.json()
  assert.ok(Array.isArray(j.paths) && j.paths.includes("/uskey"))
})
