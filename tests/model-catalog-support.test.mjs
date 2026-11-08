// tests/model-catalog-support.test.mjs —— 配置合并保留失效模型的回归锁
//
// 背景：用户配置可能因手工配置或陈旧路由包含 `kimi-k2.5`；该槽位
// 未出现在已发布 TABLE 中，且实测上游返回 500。旧 mergeModels 只做
// 「用户字段优先 + 缺失追加」，从不删用户表里已不支持的条目 —— 于是
// 失效模型会一直留在模型列表里。
//
// 硬要求（用户指定，不许妥协）：
//   1. Magpie 的模型**键 / id / name** 必须是真实模型名，绝不能出现内部槽位名 `main-auto`
//   2. `main-auto` 只允许作为上游 `apiId` / `api.id`
//   3. 失效模型（defaults 里没有、且 displayModelId 归一不到默认表）必须被清除，
//      不得静默改成 main-auto 或其他模型
//   4. 旧数组 / 数字下标 / 槽位名 → 真实显示名的兼容不能回归

import test from "node:test"
import assert from "node:assert/strict"

import {
  staticModels,
  providerModels,
  canonicalModelId,
  displayModelId,
} from "../src/context.mjs"
import { mergeModels } from "../src/hooks/config.mjs"

const defaults = staticModels()
const defaultKeys = Object.keys(defaults).sort()

// ── 1. 失效模型清除 ────────────────────────────────────────────────

test("mergeModels 清除 defaults 中不存在的失效条目 kimi-k2.5（对象形态）", () => {
  const user = {
    ...defaults,
    "kimi-k2.5": {
      id: "kimi-k2.5",
      name: "kimi-k2.5",
      apiId: "kimi-k2.5",
      limit: { context: 128_000, output: 32_000 },
      tool_call: true,
      reasoning: true,
    },
  }
  const merged = mergeModels(defaults, user)
  assert.equal(merged["kimi-k2.5"], undefined, "失效模型 kimi-k2.5 必须被清除")
  assert.deepEqual(
    Object.keys(merged).filter((k) => /kimi/i.test(k)),
    [],
    "输出里不应残留任何 kimi 条目",
  )
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys, "输出键集合应等于默认表")
})

test("mergeModels 清除数组形态末尾多出来的失效条目", () => {
  // 旧数组带多一条 kimi：位置超出默认表长度，必须丢弃
  const user = [...Object.values(defaults), { id: "kimi-k2.5", name: "kimi-k2.5", apiId: "kimi-k2.5" }]
  const merged = mergeModels(defaults, user)
  assert.equal(merged["kimi-k2.5"], undefined, "数组末尾的失效条目也必须被清除")
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
})

test("失效模型不会被静默改写成 main-auto 或其他真实模型", () => {
  const user = { "kimi-k2.5": { id: "kimi-k2.5", name: "kimi-k2.5" } }
  const merged = mergeModels(defaults, user)
  // 不能凭空多出一个指向 main-auto 的伪造条目
  assert.equal(Object.keys(merged).includes("kimi-k2.5"), false)
  // main-auto 的真实显示名那条只能是默认自带的，不能被当成 kimi 的替身多出来
  assert.equal(merged["deepseek-v4-1-flash-261017"].apiId, "main-auto")
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
})

// ── 2. 真实显示名 / 槽位归一保留 ──────────────────────────────────

test("真实显示名保留：默认合并后 key、id、name 三者一致且是真实模型名", () => {
  const merged = mergeModels(defaults, {})
  for (const [key, model] of Object.entries(merged)) {
    assert.equal(model.id, key, `id 必须等于真实显示名（${key}）`)
    assert.equal(model.name, key, `name 必须等于真实显示名（${key}）`)
    assert.notEqual(key, "main-auto", "键不能是内部槽位名 main-auto")
    assert.notEqual(model.id, "main-auto", "id 不能是内部槽位名 main-auto")
    assert.notEqual(model.name, "main-auto", "name 不能是内部槽位名 main-auto")
  }
  assert.equal(
    merged["deepseek-v4-1-flash-261017"].apiId,
    "main-auto",
    "apiId 才允许是上游槽位名 main-auto",
  )
})

test("旧槽位名 main-auto 归一成真实显示名，apiId 保留 main-auto，用户字段优先", () => {
  const user = {
    "main-auto": {
      id: "main-auto",
      name: "main-auto", // 即使是槽位名，也不能显示到 name
      limit: { context: 2_000_000 },
    },
  }
  const merged = mergeModels(defaults, user)
  assert.equal(merged["main-auto"], undefined, "不能以 main-auto 作为模型键")
  const model = merged["deepseek-v4-1-flash-261017"]
  assert.ok(model, "main-auto 必须归一成 deepseek-v4-1-flash-261017")
  assert.equal(model.id, "deepseek-v4-1-flash-261017")
  assert.equal(model.name, "deepseek-v4-1-flash-261017", "name 不能显示成槽位名 main-auto")
  assert.equal(model.apiId, "main-auto", "apiId 保留上游槽位名")
  assert.equal(model.limit.context, 2_000_000, "用户改过的 context 必须保留")
  assert.equal(typeof model.limit.output, "number", "用户没改的 output 不能被吃掉")
})

test("用户自定义 name 保留，不会被改回默认显示名", () => {
  const user = {
    "deepseek-v4-1-flash-261017": { id: "deepseek-v4-1-flash-261017", name: "我的 V4.1 Flash" },
  }
  const merged = mergeModels(defaults, user)
  assert.equal(merged["deepseek-v4-1-flash-261017"].name, "我的 V4.1 Flash")
  assert.equal(merged["deepseek-v4-1-flash-261017"].id, "deepseek-v4-1-flash-261017")
})

// ── 3. staticModels() / providerModels() 可见面不含 main-auto ─────

test("staticModels() 可见 key/id/name 均不含 main-auto；apiId 可以是 main-auto", () => {
  const models = staticModels()
  for (const [key, model] of Object.entries(models)) {
    assert.notEqual(key, "main-auto")
    assert.notEqual(model.id, "main-auto")
    assert.notEqual(model.name, "main-auto")
  }
  assert.ok(
    Object.values(models).some((m) => m.apiId === "main-auto"),
    "apiId 允许是上游槽位名 main-auto",
  )
})

test("providerModels() 可见 key/id/name 均不含 main-auto；api.id 可以是 main-auto", () => {
  const models = providerModels()
  for (const [key, model] of Object.entries(models)) {
    assert.notEqual(key, "main-auto")
    assert.notEqual(model.id, "main-auto")
    assert.notEqual(model.name, "main-auto")
    assert.equal(model.id, model.name, "对外 id 与 name 都应是真实模型名")
  }
  assert.ok(
    Object.values(models).some((m) => m.api?.id === "main-auto"),
    "api.id 允许是上游槽位名 main-auto",
  )
})

// ── 4. 旧数字映射不回归 ──────────────────────────────────────────

test("旧数字下标对象键归一成真实显示名（旧路由不回归）", () => {
  // 旧版把模型表持久化成 {"0":..,"1":..}，且 id 也是数字
  const list = Object.values(defaults)
  const user = Object.fromEntries(
    list.map((m, i) => [String(i), { ...m, id: String(i), name: String(i) }]),
  )
  const merged = mergeModels(defaults, user)
  assert.deepEqual(
    Object.keys(merged).filter((k) => /^\d+$/.test(k)),
    [],
    "输出不应残留纯数字键",
  )
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
  assert.equal(merged["deepseek-v4-1-flash-261017"].apiId, "main-auto")
  assert.equal(merged["HY-Vision-2.0-instruct"].apiId, "hunyuan-turbos-vision")
})

test("canonicalModelId / displayModelId 的数字与槽位映射不回归", () => {
  assert.equal(canonicalModelId("0"), "main-auto")
  assert.equal(canonicalModelId("7"), "hunyuan-turbos-vision")
  assert.equal(canonicalModelId("deepseek-v4-1-flash-261017"), "main-auto")
  assert.equal(displayModelId("main-auto"), "deepseek-v4-1-flash-261017")
  assert.equal(displayModelId("deepseek-v4-1-flash-261017"), "deepseek-v4-1-flash-261017")
})
