// tests/legacy-model-config.test.mjs —— 0.2.21 配置合并策略回归锁
//
// 背景：0.2.21 的 mergeModels 只保留能归一进 defaults（TABLE）的条目，
//   把所有 defaults 外的条目一律删除。但严格审核确认 app-auto / file-auto /
//   computer-auto / browser-auto 这些旧真实槽位**上游仍返回 200**，它们只是
//   不在对外展示目录里。无差别删除会误伤用户已有的可用槽位。
//
// 新规则（不可用 denylist + 其余保留）—— 不是「所有未知都无脑保留」：
//   · 只有 `isUnavailableModel`（context.mjs）明确判为不可用的条目被删除
//     （当前只有 `kimi-k2.5`）
//   · 候选值先 **trim** 再归一：手工配置里常见的 `"main-auto "` / `" kimi-k2.5"` 不能
//     因为首尾空白绕过归一或绕过 denylist；`isUnavailableModel` 对大小写不敏感
//   · 合并必须**幂等**：`mergeModels(defaults, mergeModels(defaults, user))` 与原结果一致
//     （否则第二次合并会把第一次留下的 `main-auto` 键再归一一次，用户看到模型漂移）
//   · 其余 defaults 外条目**原样保留**：键 / id / name 不改写成别的模型
//   · 能归一到 defaults 的（旧数字下标 `0`…`7` / 槽位名 `main-auto` /
//     真实显示名）仍归一成真实显示名，apiId 保留上游槽位名
//   · `staticModels()` / `providerModels()` 对外仍只有 8 个真实显示模型，
//     内部槽位名 `main-auto` 不得出现在 key / id / name
//   · 用户改过的字段优先，插件只补缺

import test from "node:test"
import assert from "node:assert/strict"

import {
  staticModels,
  providerModels,
  UNAVAILABLE_MODEL_IDS,
  isUnavailableModel,
} from "../src/context.mjs"
import { mergeModels } from "../src/hooks/config.mjs"

const defaults = staticModels()
const defaultKeys = Object.keys(defaults).sort()

/** 旧真实槽位：上游仍 200，但不在对外展示目录（TABLE）里 */
const LEGACY_REAL_SLOTS = ["app-auto", "file-auto", "computer-auto", "browser-auto"]

/** 造一条旧真实槽位的配置（形状与 staticModels 的条目一致） */
function legacyModel(slot, context = 1_000_000) {
  return {
    id: slot,
    apiId: slot,
    name: slot,
    attachment: false,
    modalities: { input: ["text"], output: ["text"] },
    tool_call: true,
    reasoning: true,
    limit: { context, output: 32_000 },
  }
}

// ── 1. 旧真实槽位必须保留（对象形态）──────────────────────────────

test("对象形态：app-auto 保留，且键 / id / name 不被改名成其他模型", () => {
  const user = { ...defaults, "app-auto": legacyModel("app-auto") }
  const merged = mergeModels(defaults, user)

  assert.ok(merged["app-auto"], "app-auto 必须保留")
  assert.equal(merged["app-auto"].id, "app-auto", "id 不能被改写成默认模型")
  assert.equal(merged["app-auto"].name, "app-auto", "name 不能被改写成默认模型")
  assert.equal(merged["app-auto"].apiId, "app-auto", "apiId 保留上游槽位名")
  assert.equal(merged["app-auto"].limit.context, 1_000_000, "用户字段原样保留")
})

test("对象形态：四个旧真实槽位都在，默认 8 条一条不少", () => {
  const user = Object.fromEntries(LEGACY_REAL_SLOTS.map((s) => [s, legacyModel(s)]))
  const merged = mergeModels(defaults, user)

  for (const slot of LEGACY_REAL_SLOTS) {
    assert.ok(merged[slot], `${slot} 必须保留`)
    assert.equal(merged[slot].id, slot)
    assert.equal(merged[slot].name, slot)
  }
  for (const key of defaultKeys) {
    assert.ok(merged[key], `默认模型 ${key} 不能被旧槽位挤掉`)
  }
  assert.deepEqual(
    Object.keys(merged).sort(),
    [...defaultKeys, ...LEGACY_REAL_SLOTS].sort(),
    "可见键集合 = 默认表 + 保留的旧真实槽位",
  )
})

// ── 2. 旧真实槽位必须保留（数组形态）──────────────────────────────

test("数组形态：末尾的 app-auto 保留，不被丢弃", () => {
  const user = [...Object.values(defaults), legacyModel("app-auto")]
  const merged = mergeModels(defaults, user)

  assert.ok(merged["app-auto"], "数组形态的 app-auto 也必须保留")
  assert.equal(merged["app-auto"].id, "app-auto")
  assert.equal(merged["app-auto"].apiId, "app-auto")
  assert.deepEqual(
    Object.keys(merged).sort(),
    [...defaultKeys, "app-auto"].sort(),
  )
})

// ── 3. 不可用 denylist 仍然生效 ───────────────────────────────────

test("denylist：对象形态的 kimi-k2.5 仍被删除", () => {
  assert.deepEqual([...UNAVAILABLE_MODEL_IDS], ["kimi-k2.5"], "denylist 当前只有 kimi-k2.5")
  const user = { ...defaults, "kimi-k2.5": legacyModel("kimi-k2.5", 128_000) }
  const merged = mergeModels(defaults, user)

  assert.equal(merged["kimi-k2.5"], undefined, "不可用模型必须被删除")
  assert.deepEqual(Object.keys(merged).filter((k) => /kimi/i.test(k)), [], "不得残留任何 kimi 条目")
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
})

test("denylist：数组形态的 kimi-k2.5 仍被删除", () => {
  const user = [...Object.values(defaults), legacyModel("kimi-k2.5", 128_000)]
  const merged = mergeModels(defaults, user)

  assert.equal(merged["kimi-k2.5"], undefined)
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
})

test("denylist：不可用条目不得被改写成 app-auto 或其他模型", () => {
  const merged = mergeModels(defaults, { "kimi-k2.5": legacyModel("kimi-k2.5") })
  assert.equal(merged["app-auto"], undefined, "kimi 不能借 app-auto 的形状活下来")
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
})

test("denylist 与保留共存：混合输入下 kimi 走、app-auto 留", () => {
  const user = {
    ...defaults,
    "app-auto": legacyModel("app-auto"),
    "file-auto": legacyModel("file-auto"),
    "kimi-k2.5": legacyModel("kimi-k2.5"),
  }
  const merged = mergeModels(defaults, user)
  assert.ok(merged["app-auto"])
  assert.ok(merged["file-auto"])
  assert.equal(merged["kimi-k2.5"], undefined)
  assert.deepEqual(
    Object.keys(merged).sort(),
    [...defaultKeys, "app-auto", "file-auto"].sort(),
  )
})

// ── 4. 数字 0..7 仍归一真实显示名 ────────────────────────────────

test("旧数字下标 0..7 归一成真实显示名，apiId 保留槽位名", () => {
  const list = Object.values(defaults)
  const user = Object.fromEntries(
    list.map((m, i) => [String(i), { ...m, id: String(i), name: String(i) }]),
  )
  const merged = mergeModels(defaults, user)

  assert.deepEqual(Object.keys(merged).filter((k) => /^\d+$/.test(k)), [], "输出不得残留纯数字键")
  assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
  for (const key of defaultKeys) {
    assert.equal(merged[key].id, key, `${key} 的 id 必须是真实显示名`)
    assert.equal(merged[key].name, key, `${key} 的 name 必须是真实显示名`)
  }
  assert.equal(merged["deepseek-v4-1-flash-261017"].apiId, "main-auto")
  assert.equal(merged["HY-Vision-2.0-instruct"].apiId, "hunyuan-turbos-vision")
})

test("旧槽位名 main-auto 归一成真实显示名，apiId 保留 main-auto", () => {
  const merged = mergeModels(defaults, {
    "main-auto": { id: "main-auto", name: "main-auto", limit: { context: 2_000_000 } },
  })
  assert.equal(merged["main-auto"], undefined, "不能以槽位名作模型键")
  const model = merged["deepseek-v4-1-flash-261017"]
  assert.ok(model, "main-auto 必须归一成 deepseek-v4-1-flash-261017")
  assert.equal(model.id, "deepseek-v4-1-flash-261017")
  assert.equal(model.name, "deepseek-v4-1-flash-261017", "name 不能显示成槽位名")
  assert.equal(model.apiId, "main-auto")
})

// ── 5. main-auto 的 key / id / name 不可见 ────────────────────────

test("mergeModels 输出里 main-auto 只允许出现在 apiId", () => {
  const user = {
    ...defaults,
    "app-auto": legacyModel("app-auto"),
    "main-auto": { id: "main-auto", name: "main-auto" },
  }
  const merged = mergeModels(defaults, user)
  for (const [key, model] of Object.entries(merged)) {
    assert.notEqual(key, "main-auto", "键不能是内部槽位名")
    assert.notEqual(model.id, "main-auto", "id 不能是内部槽位名")
    assert.notEqual(model.name, "main-auto", "name 不能是内部槽位名")
  }
  assert.equal(merged["deepseek-v4-1-flash-261017"].apiId, "main-auto", "apiId 才允许是槽位名")
})

test("staticModels() / providerModels() 仍只有 8 个真实显示模型且 main-auto 不可见", () => {
  const statics = staticModels()
  const providers = providerModels()
  assert.equal(Object.keys(statics).length, 8, "对外静态目录仍是 8 条")
  assert.equal(Object.keys(providers).length, 8, "provider 模型目录仍是 8 条")
  assert.deepEqual(Object.keys(statics).sort(), defaultKeys)

  for (const [key, model] of [...Object.entries(statics), ...Object.entries(providers)]) {
    assert.notEqual(key, "main-auto")
    assert.notEqual(model.id, "main-auto")
    assert.notEqual(model.name, "main-auto")
    assert.ok(LEGACY_REAL_SLOTS.includes(key) === false, "展示目录不包含旧真实槽位")
  }
  assert.ok(
    Object.values(statics).some((m) => m.apiId === "main-auto"),
    "apiId 允许是上游槽位名 main-auto",
  )
  assert.ok(
    Object.values(providers).some((m) => m.api?.id === "main-auto"),
    "api.id 允许是上游槽位名 main-auto",
  )
})

// ── 6. 用户字段优先 ──────────────────────────────────────────────

test("用户字段优先：保留条目的用户值不被默认值覆盖", () => {
  const user = {
    "app-auto": {
      ...legacyModel("app-auto"),
      limit: { context: 640_000, output: 16_000 },
      reasoning: false,
    },
  }
  const merged = mergeModels(defaults, user)
  assert.equal(merged["app-auto"].limit.context, 640_000)
  assert.equal(merged["app-auto"].limit.output, 16_000)
  assert.equal(merged["app-auto"].reasoning, false)
})

test("用户字段优先：默认条目的用户值保留，没改的字段被补缺", () => {
  const merged = mergeModels(defaults, {
    "deepseek-v4-1-flash-261017": {
      id: "deepseek-v4-1-flash-261017",
      name: "我的 V4.1 Flash",
      limit: { context: 2_000_000 },
    },
  })
  const model = merged["deepseek-v4-1-flash-261017"]
  assert.equal(model.name, "我的 V4.1 Flash", "自定义 name 保留")
  assert.equal(model.id, "deepseek-v4-1-flash-261017")
  assert.equal(model.limit.context, 2_000_000)
  assert.equal(typeof model.limit.output, "number", "用户没改的 output 不能被吃掉")
  assert.equal(model.apiId, "main-auto")
})

test("自定义显示名只去掉首尾空白，不退回模型 id", () => {
  const merged = mergeModels(defaults, {
    hy3: { id: "hy3", name: "  我的模型  " },
  })
  assert.equal(merged.hy3.name, "我的模型")
  assert.equal(merged.hy3.id, "hy3")
})

// ── 7. 首尾空白：归一 + 不泄漏槽位名（F1）────────────────────────

/** 带首尾空白的候选写法：手工配置里最常见的形态 */
const PADDED_MAIN = ["main-auto ", " main-auto", "\tmain-auto\n", "main-auto\t"]

test("带首尾空白的 main-auto 归一成真实显示名，不露出槽位名", () => {
  for (const key of PADDED_MAIN) {
    const merged = mergeModels(defaults, {
      [key]: { id: key, name: key, limit: { context: 2_000_000 } },
    })
    assert.equal(merged[key], undefined, `键 ${JSON.stringify(key)} 不能保留空白形态`)
    assert.equal(merged["main-auto"], undefined, "不能以 main-auto 作为模型键")
    assert.equal(merged["main-auto "], undefined)

    const model = merged["deepseek-v4-1-flash-261017"]
    assert.ok(model, `${JSON.stringify(key)} 必须归一成真实显示名`)
    assert.equal(model.id, "deepseek-v4-1-flash-261017")
    assert.equal(model.name, "deepseek-v4-1-flash-261017", "name 不能是 main-auto / 带空白")
    assert.equal(model.apiId, "main-auto", "apiId 才保留上游槽位名")
    assert.equal(model.limit.context, 2_000_000, "用户改过的 context 必须保留")
    assert.equal(typeof model.limit.output, "number", "用户没改的 output 不能被吃掉")
  }
})

test("二次合并幂等：带空白的主观配置不会在第二次合并里漂移", () => {
  const user = {
    "main-auto ": { id: "main-auto ", name: "main-auto ", limit: { context: 2_000_000 } },
    "app-auto ": legacyModel("app-auto "),
    "kimi-k2.5 ": legacyModel("kimi-k2.5 "),
  }
  const once = mergeModels(defaults, user)

  assert.equal(once["main-auto"], undefined, "一次合并后就不能残留 main-auto 键")
  assert.equal(once["main-auto "], undefined, "一次合并后就不能残留带空白的键")
  assert.ok(once["deepseek-v4-1-flash-261017"], "main-auto 的空白变体必须已经归一到真实显示名")
  assert.ok(once["app-auto"], "app-auto 的空白变体按 trim 后的键保留")
  assert.equal(once["kimi-k2.5"], undefined, "denylist 的空白变体一次合并就删掉")

  const twice = mergeModels(defaults, once)
  assert.deepEqual(twice, once, "第二次合并必须与第一次完全一致（不许键 / id / name 漂移）")

  const thrice = mergeModels(defaults, twice)
  assert.deepEqual(thrice, twice, "第三次合并同样稳定")
})

// ── 8. denylist 对空白 / 大小写不敏感（F2）──────────────────────

test("isUnavailableModel 对首尾空白 / 大小写不敏感，且不误伤旧槽位", () => {
  const variants = [
    "kimi-k2.5 ",
    " kimi-k2.5",
    "\tkimi-k2.5\n",
    "Kimi-K2.5",
    "KIMI-K2.5",
    "Kimi-K2.5 ",
  ]
  for (const model of variants) {
    assert.equal(isUnavailableModel(model), true, `${JSON.stringify(model)} 必须判为不可用`)
  }
  for (const model of ["", "app-auto", "file-auto", "main-auto", "deepseek-v4-1-flash-261017", "HY-Vision-2.0-instruct", "0", "7"]) {
    assert.equal(isUnavailableModel(model), false, `${JSON.stringify(model)} 不能被误判为不可用`)
  }
})

test("denylist 变体（对象形态）：空白 / 大小写 kimi 全部删除", () => {
  const variants = [
    "kimi-k2.5 ",
    " kimi-k2.5",
    "\tkimi-k2.5\n",
    "Kimi-K2.5",
    "KIMI-K2.5",
    "Kimi-K2.5 ",
  ]
  for (const key of variants) {
    const merged = mergeModels(defaults, { ...defaults, [key]: legacyModel(key) })
    assert.deepEqual(
      Object.keys(merged).filter((k) => /kimi/i.test(k)),
      [],
      `${JSON.stringify(key)} 必须被 denylist 拦下`,
    )
    assert.deepEqual(Object.keys(merged).sort(), defaultKeys, `${JSON.stringify(key)} 不应改变其余键`)
  }
})

test("denylist 变体（数组形态）：空白 / 大小写 kimi 全部删除", () => {
  for (const variant of ["kimi-k2.5 ", "Kimi-K2.5", "\tKIMI-K2.5\n"]) {
    const user = [...Object.values(defaults), legacyModel(variant)]
    const merged = mergeModels(defaults, user)
    assert.deepEqual(
      Object.keys(merged).filter((k) => /kimi/i.test(k)),
      [],
      `${JSON.stringify(variant)} 必须被 denylist 拦下`,
    )
    assert.deepEqual(Object.keys(merged).sort(), defaultKeys)
  }
})