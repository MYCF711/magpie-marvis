// ① config —— 声明 provider 与静态模型表
//
// ⚠ `config.models` 必须有内容：它是**没人登录时**模型列表的唯一来源，
//   空了就是「插件装上了但显示 0 models」。
//
// ⚠⚠ **模型表是对象，键是真实模型显示名**（`cfg.models[<id>]`），不是内部槽位名。
//   写成数组会被 magpie 存成数组下标 `"0"…"7"`，路由里显示 `0`、请求发 `model:"0"`，上游 400。
//
// ⚠⚠ **用户在 magpie 设置里改过的值优先，插件不许覆盖。**
//   宿主把用户改过的 provider 配置原样传进来（`cfg.provider[PROVIDER]`），
//   我们要做的是「**补齐缺失**」，不是「重置成默认」。
//
// 合并规则（逐模型、逐字段）：
//   · 用户有的字段 → 保留用户的（`limit.context` / `limit.output` / `modalities` / `name` …）
//   · 用户没有的字段 → 用默认值补
//   · 默认表里有、用户配置里没有的模型 → 追加（新版本新增模型能自动出现）
//   · 旧版数组形态（下标 `"0"…"7"`）→ 按 TABLE 顺序认回槽位名

import { PROVIDER, PROVIDER_NAME, SDK, BASE_V1, staticModels, canonicalModelId, displayModelId } from "../context.mjs"

/** 给定值 → 真实显示名（槽位名 / 旧数字下标 / 真实模型名都能归一；未知原样返回） */
function toDisplayName(value) {
  return displayModelId(canonicalModelId(value))
}

/**
 * 在默认表里找一个匹配的键。
 *
 * 依次尝试每个候选值：先按 `displayModelId` 直接归一，再经 `canonicalModelId`
 * 把旧数字下标 / 槽位名换成显示名。全部匹配不到 → 返回 undefined（=失效条目）。
 *
 * @param {Record<string, any>} defaults
 * @param {...unknown} values
 * @returns {string | undefined}
 */
function matchDefaultKey(defaults, ...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue
    const direct = displayModelId(value)
    if (defaults[direct]) return direct
    const aliased = toDisplayName(value)
    if (defaults[aliased]) return aliased
  }
  return undefined
}

/** 合并一个模型：用户字段优先，缺的用默认值补；键 / id / name 一律用真实显示名 */
function mergeModel(userModel, defaultModel, id) {
  const merged = { ...(defaultModel ?? {}), ...(userModel ?? {}) }
  merged.id = id
  merged.apiId = canonicalModelId(userModel?.apiId ?? defaultModel?.apiId ?? id)

  // limit 逐字段合并 —— 只改 context 的用户不该把 output 也吃掉
  merged.limit = { ...(defaultModel?.limit ?? {}), ...(userModel?.limit ?? {}) }

  // config 形状用 modalities 数组 + tool_call 下划线；用户可能只改了其中一个
  if (userModel?.modalities || defaultModel?.modalities) {
    merged.modalities = {
      ...(defaultModel?.modalities ?? {}),
      ...(userModel?.modalities ?? {}),
    }
  }

  // name 必须是真实显示名：缺省、或是内部槽位名（main-auto）、或旧数字下标
  // 都回落到真实显示名；用户自定义的真实名字保留。
  const rawName = merged.name == null ? "" : String(merged.name)
  merged.name = rawName === "" || toDisplayName(rawName) !== rawName ? id : rawName
  return merged
}

/**
 * 合并模型表。
 *
 * @param {Record<string, any>} defaults 插件内置的默认表（对象）
 * @param {Record<string, any> | any[] | undefined} user 宿主里用户改过的表（对象；旧版可能是数组）
 * @returns {Record<string, any>}
 */
export function mergeModels(defaults, user) {
  const defaultIds = Object.keys(defaults)
  /** @type {Record<string, any>} */
  const out = {}
  const seen = new Set()

  if (Array.isArray(user)) {
    // 旧版：数组下标就是 TABLE 顺序。按位置认回槽位名，字段仍用用户的。
    // ⚠ 条目自带可归一的 id（数字下标 / 槽位名 / 显示名）→ 用它；否则用位置；
    //   两者都落不到默认表 → 失效条目（如被移除的 kimi-k2.5），丢弃。
    user.forEach((um, index) => {
      if (!um || typeof um !== "object") return
      const positional = defaultIds[index]
      const hasOwnId = um.id !== undefined && um.id !== null && um.id !== ""
      const id = hasOwnId
        ? matchDefaultKey(defaults, um.id, um.apiId)
        : positional && defaults[positional]
          ? positional
          : undefined
      if (!id) return // 失效模型不得静默保留 / 改写成别的模型
      out[id] = mergeModel(um, defaults[id], id)
      seen.add(id)
    })
  } else if (user && typeof user === "object") {
    for (const [key, um] of Object.entries(user)) {
      if (!um || typeof um !== "object" || Array.isArray(um)) continue
      // 键可能是显示名、旧槽位名（main-auto）、旧数字下标；都归一成显示名。
      // 归一不到默认表 → 失效条目，丢弃（不能静默改成 main-auto 或其他模型）。
      const id = matchDefaultKey(defaults, key, um.id, um.apiId)
      if (!id) continue
      out[id] = mergeModel(um, defaults[id], id)
      seen.add(id)
    }
  }

  // 默认表里有、用户没有的 → 追加（新版本新增的模型）
  for (const id of defaultIds) {
    if (!seen.has(id)) out[id] = mergeModel(undefined, defaults[id], id)
  }
  return out
}

export function configHook() {
  return async (cfg) => {
    cfg.provider ??= {}
    const existing = cfg.provider[PROVIDER]

    if (!existing) {
      cfg.provider[PROVIDER] = {
        name: PROVIDER_NAME,
        npm: SDK,
        api: BASE_V1,
        models: staticModels(),
      }
      return
    }

    // 已有配置：只补缺，用户改过的优先
    existing.name ??= PROVIDER_NAME
    existing.npm ??= SDK
    existing.api ??= BASE_V1
    existing.models = mergeModels(staticModels(), existing.models)
  }
}
