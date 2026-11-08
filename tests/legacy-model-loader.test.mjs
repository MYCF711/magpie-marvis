// tests/legacy-model-loader.test.mjs —— 旧真实槽位必须继续出网（0.2.21 allowlist 误伤回归锁）
//
// 事故现场：0.2.21 的 loader 用 TABLE allowlist 拦模型。TABLE 是**对外展示目录**，
// 不是「上游可用集合」：`app-auto` / `file-auto` / `computer-auto` / `browser-auto`
// 上游仍然 200，却被本地 404，一次 fetch 都没发 —— 旧路由整批废掉，
// 而文案还说它们「已失效或未知」。
//
// 新策略（0.2.22）：
//   · 只用 context.mjs 的 `isUnavailableModel` 拦**明确不可用**的模型（当前只有 `kimi-k2.5`）；
//   · 其余模型（含 TABLE 外的旧真实槽位、随手编的 ID）一律出网，由上游响应决定；
//   · 上游 `4130001` / `无效模型id` → 模型级 404（此时 fetch 已经是 1 次：真的问过上游）；
//   · `5104002` 是 RPC 故障，**不**做全局 404 映射；
//   · TABLE 8 条 + 旧数字下标 0..7 不回归；`main-auto` 仍是内部槽位，显示名不变。
//   · denylist 判定对首尾空白 / 大小写不敏感：`"kimi-k2.5 "` / `"Kimi-K2.5"` 这类
//     手工配置写法同样本地 404、fetch 0（`isUnavailableModel` 先 trim + toLowerCase）。
//
// 全部离线：mock 掉 globalThis.fetch，不需要真实凭据、不碰真实上游。
//
// 这个文件先于实现落地（红）：旧实现把 TABLE 外全部本地 404、fetch 0 次。

import test from "node:test"
import assert from "node:assert/strict"

import { loaderHook, DEFAULT_MODEL } from "../src/hooks/loader.mjs"
import { DISPLAY_BY_SLOT, MODEL_ALIASES } from "../src/context.mjs"

const CHAT_URL = "https://yybadaccess.3g.qq.com/v1/chat/completions"

/** 假凭据：只是形状对，值全部是测试用的假串，不会发到任何真实上游 */
const AUTH = Object.freeze({
  access: "mv_test_offline_only",
  uid: "0123456789abcdef0123456789abcdef",
  metadata: {
    openid: "fedcba9876543210fedcba9876543210",
    guid: "0".repeat(32),
    loginType: "1",
  },
})

/** 替换 globalThis.fetch 并记录调用；返回 { calls, restore } */
function stubFetch(handler) {
  const calls = []
  const real = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({ url: typeof input === "string" ? input : String(input), init: init ?? {} })
    return handler(input, init ?? {})
  }
  return {
    calls,
    restore: () => {
      globalThis.fetch = real
    },
  }
}

/** 取 loader 描述符（loaderHook 的形状是 getAuth => { fetch, baseURL, apiKey }） */
async function loaderOf() {
  const describe = await loaderHook()(async () => AUTH)
  assert.equal(typeof describe.fetch, "function", "loader 必须返回 fetch")
  return describe
}

/** 组一个 /v1/chat/completions 请求（OpenAI 形状，stream 由参数决定） */
function requestFor(model, stream = false) {
  return {
    url: CHAT_URL,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream,
        messages: [{ role: "user", content: "ping" }],
      }),
    },
  }
}

/** 上游正常回包（200，非流式 JSON） */
function upstreamOk(model = "deepseek-v4-1-flash-261017") {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      model,
      choices: [{ index: 0, message: { role: "assistant", content: "pong" }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )
}

/** 上游错误回包：status 是 HTTP 状态，body 里带业务码 / 文案 */
function upstreamError(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** 断言「本地 404、没有出网」并检查引导文案（只对明确不可用名单生效） */
async function assertLocalModelUnavailable(res, calls) {
  assert.equal(res.status, 404, "明确不可用的模型必须在本地回 404")
  const body = await res.json()
  assert.equal(body.error.code, "model_unavailable")
  assert.equal(body.error.type, "upstream_error")
  assert.match(body.error.message, /不可用/, "文案要说明这个模型持续不可用")
  assert.match(body.error.message, /重新选择/, "文案要引导用户回模型列表重新选")
  assert.match(body.error.message, /真实模型名/, "文案要指明选「真实模型名」条目")
  assert.equal(calls.length, 0, "明确不可用模型一次 upstream 都不能访问")
}

// ─────────────────────────────────────────────────────────────
// ① allowlist 误伤回归：TABLE 外的旧真实槽位仍然出网
//    （上游实测 200；旧实现本地 404、fetch 0 —— 这个用例就是它的红）
// ─────────────────────────────────────────────────────────────

const LEGACY_REAL_SLOTS = ["app-auto", "file-auto", "computer-auto", "browser-auto"]

test("旧真实槽位 app-auto/file-auto/computer-auto/browser-auto 上游 200 → 出网 1 次、返回 200", async () => {
  for (const model of LEGACY_REAL_SLOTS) {
    const s = stubFetch(() => upstreamOk(model))
    try {
      const req = requestFor(model, false)
      const res = await (await loaderOf()).fetch(req.url, req.init)
      assert.equal(res.status, 200, `${model} 上游 200，loader 必须透出 200`)
      assert.equal(s.calls.length, 1, `${model} 必须出网 1 次（旧实现被 allowlist 本地拦掉，fetch 0）`)
      assert.equal(JSON.parse(s.calls[0].init.body).model, model, `${model} 是真实槽位名，原样发给上游`)
    } finally {
      s.restore()
    }
  }
})

test("旧真实槽位 stream:true 同样出网 1 次（流式与非流式走同一条路）", async () => {
  for (const model of LEGACY_REAL_SLOTS) {
    const s = stubFetch(() => upstreamOk(model))
    try {
      const req = requestFor(model, true)
      const res = await (await loaderOf()).fetch(req.url, req.init)
      assert.equal(res.status, 200)
      assert.equal(s.calls.length, 1, `${model} stream 也必须出网`)
      assert.equal(JSON.parse(s.calls[0].init.body).stream, true)
    } finally {
      s.restore()
    }
  }
})

// ─────────────────────────────────────────────────────────────
// ② 明确不可用名单（当前只有 kimi-k2.5）：两种 stream 都本地 404、fetch 0
// ─────────────────────────────────────────────────────────────

test("kimi-k2.5（stream:true）→ 本地 404，fetch 0 次", async () => {
  const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
  try {
    const req = requestFor("kimi-k2.5", true)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    await assertLocalModelUnavailable(res, s.calls)
  } finally {
    s.restore()
  }
})

test("kimi-k2.5（stream:false）→ 本地 404，fetch 0 次", async () => {
  const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
  try {
    const req = requestFor("kimi-k2.5", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    await assertLocalModelUnavailable(res, s.calls)
  } finally {
    s.restore()
  }
})

test("kimi-k2.5 上游即使 200 也不出网（名单是硬的，不靠上游兜底）", async () => {
  const s = stubFetch(() => upstreamOk("kimi-k2.5"))
  try {
    const req = requestFor("kimi-k2.5", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    await assertLocalModelUnavailable(res, s.calls)
  } finally {
    s.restore()
  }
})

// ─────────────────────────────────────────────────────────────
// ③ 随机不存在的模型：出网 1 次，上游 4130001 → 模型级 404
// ─────────────────────────────────────────────────────────────

test("随手编的模型出网 1 次；上游 4130001 → 404 model_unavailable（不是本地拦）", async () => {
  const model = "totally-made-up-model-xyz"
  const s = stubFetch(() => upstreamError(400, { code: 4130001, msg: "无效模型id" }))
  try {
    const req = requestFor(model, false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(s.calls.length, 1, "未知模型必须先问上游，由上游响应决定")
    assert.equal(JSON.parse(s.calls[0].init.body).model, model, "未知模型 ID 原样发出")
    assert.equal(res.status, 404, "上游 4130001 归入模型级 404")
    const body = await res.json()
    assert.equal(body.error.code, "model_unavailable")
  } finally {
    s.restore()
  }
})

test("上游只说「无效模型id」没有业务码时也归入 404（fetch 仍是 1 次）", async () => {
  const s = stubFetch(() => upstreamError(400, { error: { message: "无效模型id: xxx" } }))
  try {
    const req = requestFor("another-unknown-model", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(s.calls.length, 1)
    assert.equal(res.status, 404)
    assert.equal((await res.json()).error.code, "model_unavailable")
  } finally {
    s.restore()
  }
})

// ─────────────────────────────────────────────────────────────
// ④ TABLE 8 条 + 旧数字 0..7 不回归；main-auto 仍是内部槽位
// ─────────────────────────────────────────────────────────────

test("TABLE 8 条槽位 / 显示名 / 旧下标 0..7 全部放行且出网", async () => {
  assert.equal(Object.keys(DISPLAY_BY_SLOT).length, 8)
  assert.equal(Object.keys(MODEL_ALIASES).length, 8)
  assert.equal(DEFAULT_MODEL, "main-auto", "main-auto 仍是内部槽位")
  assert.notEqual(DISPLAY_BY_SLOT["main-auto"], "main-auto", "卡片显示名仍是真实模型名")

  const cases = []
  for (const [slot, display] of Object.entries(DISPLAY_BY_SLOT)) {
    cases.push([slot, slot], [display, slot])
  }
  for (const [index, slot] of Object.entries(MODEL_ALIASES)) {
    cases.push([index, slot])
  }

  for (const [model, expectedSlot] of cases) {
    const s = stubFetch(() => upstreamOk(DISPLAY_BY_SLOT[expectedSlot]))
    try {
      const req = requestFor(model, false)
      const res = await (await loaderOf()).fetch(req.url, req.init)
      assert.equal(res.status, 200, `模型 ${model} 应放行`)
      assert.equal(s.calls.length, 1, `模型 ${model} 应出网`)
      assert.equal(JSON.parse(s.calls[0].init.body).model, expectedSlot, `模型 ${model} 应归一成 ${expectedSlot}`)
    } finally {
      s.restore()
    }
  }
})

// ─────────────────────────────────────────────────────────────
// ⑤ 5104002 不做全局 404 映射
// ─────────────────────────────────────────────────────────────

test("上游 5104002 RPC 500 原样透出（不全局映射成 404）", async () => {
  const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
  try {
    const req = requestFor("main-auto", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(s.calls.length, 1)
    assert.equal(res.status, 500, "5104002 是 RPC 故障，不能当模型失效")
    assert.equal((await res.json()).code, 5104002)
  } finally {
    s.restore()
  }
})

// ─────────────────────────────────────────────────────────────
// ⑥ denylist 变体：首尾空白 / 大小写也必须本地 404、fetch 0（F2）
//    isUnavailableModel 先 trim + toLowerCase 再 canonical
// ─────────────────────────────────────────────────────────────

const UNAVAILABLE_VARIANTS = [
  "kimi-k2.5 ",
  " kimi-k2.5",
  "\tkimi-k2.5\n",
  "Kimi-K2.5",
  "KIMI-K2.5",
  "Kimi-K2.5 ",
]

test("kimi-k2.5 的空白 / 大小写变体（stream:true）→ 本地 404，fetch 0 次", async () => {
  for (const model of UNAVAILABLE_VARIANTS) {
    const s = stubFetch(() => upstreamOk(model))
    try {
      const req = requestFor(model, true)
      const res = await (await loaderOf()).fetch(req.url, req.init)
      await assertLocalModelUnavailable(res, s.calls)
    } finally {
      s.restore()
    }
  }
})

test("kimi-k2.5 的空白 / 大小写变体（stream:false）→ 本地 404，fetch 0 次", async () => {
  for (const model of UNAVAILABLE_VARIANTS) {
    const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
    try {
      const req = requestFor(model, false)
      const res = await (await loaderOf()).fetch(req.url, req.init)
      await assertLocalModelUnavailable(res, s.calls)
    } finally {
      s.restore()
    }
  }
})