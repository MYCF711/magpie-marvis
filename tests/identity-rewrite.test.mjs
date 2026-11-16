// tests/identity-rewrite.test.mjs —— 身份首行的改写面（形状 + 开关）
//
// 2026-11-16 现场（Claude Desktop → magpie 网关 → chat completions）：
//   身份句落在 `messages[role=system].content` 的**数组**里，
//   而 0.2.37 的改写只认字符串 —— 请求带着原句出网，上游回 403 非法请求。
//   Anthropic Messages 形状的 `system` 字段同理（字符串 / 文本块数组）。
//
// 这里锁住三件事：
//   ① 三种 system 承载（字符串 / 文本块数组 / 单块对象）都要改到；
//   ② 只动首行，行内其余内容、其它消息、tool 结果一个字节都不动；
//   ③ `hide_dsh` 关掉之后，请求与未安装本插件时**完全一致**。
//
// 全部离线：mock 掉 globalThis.fetch，不需要真实凭据、不碰真实上游。

import test from "node:test"
import assert from "node:assert/strict"

import { loaderHook } from "../src/hooks/loader.mjs"

const CHAT_URL = "https://yybadaccess.3g.qq.com/v1/chat/completions"

const AUTH = Object.freeze({
  access: "mv_test_offline_only",
  uid: "0123456789abcdef0123456789abcdef",
  metadata: { openid: "fedcba9876543210fedcba9876543210", guid: "0".repeat(32), loginType: "1" },
})

const BLOCKED = "You are Claude Code, Anthropic's official CLI for Claude."

function stubFetch() {
  const calls = []
  const real = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({ url: typeof input === "string" ? input : String(input), init: init ?? {} })
    return new Response(JSON.stringify({ id: "cmpl_test", choices: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  return { calls, restore: () => (globalThis.fetch = real) }
}

/** input 就是插件函数的第二个参数：magpie 把用户的开关值从这里交给插件 */
function pluginInput(hideDsh) {
  return {
    magpie: {
      option: (_provider, key) => (key === "hide_dsh" ? hideDsh : undefined),
    },
  }
}

async function send(body, hideDsh) {
  const s = stubFetch()
  try {
    const describe = await loaderHook(hideDsh === undefined ? undefined : pluginInput(hideDsh))(async () => AUTH)
    await describe.fetch(CHAT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    return JSON.parse(s.calls[0].init.body)
  } finally {
    s.restore()
  }
}

test("system 内容数组：首行身份句被换掉，非文本块原样保留", async () => {
  const image = { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } }
  const sent = await send({
    model: "deepseek-v4-1-flash-261017",
    messages: [
      { role: "system", content: [{ type: "text", text: BLOCKED + "\n\nSecond line." }, image] },
      { role: "user", content: "ping" },
    ],
  })
  assert.equal(sent.messages[0].content[0].text, "You are an AI agent.\n\nSecond line.")
  // 图片块本身不被本特性改动（`image` → `image_url` 的归一是既有的 normalizeMessages 行为）
  assert.match(JSON.stringify(sent.messages[0].content[1]), /data:image\/png;base64,AAAA/, "图片数据必须原样保留")
  assert.equal(sent.messages[1].content, "ping")
})

test("Anthropic Messages 的 system 字段（数组）同样处理", async () => {
  const sent = await send({
    model: "deepseek-v4-1-flash-261017",
    system: [{ type: "text", text: BLOCKED, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: "ping" }],
  })
  assert.equal(sent.system[0].text, "You are an AI agent.")
  assert.deepEqual(sent.system[0].cache_control, { type: "ephemeral" }, "cache_control 不能被丢掉")
})

test("Anthropic Messages 的 system 字段（字符串 / 单块对象）同样处理", async () => {
  const asString = await send({
    model: "deepseek-v4-1-flash-261017",
    system: BLOCKED,
    messages: [{ role: "user", content: "ping" }],
  })
  assert.equal(asString.system, "You are an AI agent.")

  const asObject = await send({
    model: "deepseek-v4-1-flash-261017",
    system: { type: "text", text: BLOCKED },
    messages: [{ role: "user", content: "ping" }],
  })
  assert.equal(asObject.system.text, "You are an AI agent.")
})

test("首行行内其余内容保留，第二行起的同句不动", async () => {
  const sent = await send({
    model: "deepseek-v4-1-flash-261017",
    messages: [
      { role: "system", content: BLOCKED + "\n" + BLOCKED },
      { role: "user", content: "ping" },
    ],
  })
  assert.equal(sent.messages[0].content, "You are an AI agent.\n" + BLOCKED, "只动首行")
})

test("user / assistant / tool 里的同一句不动", async () => {
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: BLOCKED },
    { role: "assistant", content: BLOCKED },
    { role: "tool", content: BLOCKED },
  ]
  const sent = await send({ model: "deepseek-v4-1-flash-261017", messages })
  assert.deepEqual(sent.messages, messages, "上游本来就放行的位置不许改")
})

test("hide_dsh 关掉 → 请求与未安装插件时完全一致", async () => {
  const body = {
    model: "deepseek-v4-1-flash-261017",
    system: [{ type: "text", text: BLOCKED }],
    messages: [{ role: "system", content: BLOCKED }, { role: "user", content: "ping" }],
  }
  const sent = await send(body, false)
  // 只比对本特性负责的两处；`model` 的归一（显示名 → 槽位名）是既有行为，与本开关无关
  assert.deepEqual(sent.messages, body.messages, "关掉之后 messages 一个字节都不能改")
  assert.deepEqual(sent.system, body.system, "关掉之后 system 一个字节都不能改")
})

test("hide_dsh 默认开启（插件没拿到开关值时也要改写）", async () => {
  const viaNoInput = await send({
    model: "deepseek-v4-1-flash-261017",
    messages: [{ role: "system", content: BLOCKED }, { role: "user", content: "ping" }],
  })
  assert.equal(viaNoInput.messages[0].content, "You are an AI agent.")
})
