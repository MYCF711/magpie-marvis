// ① config —— 声明 provider 与静态模型表
//
// ⚠ `config.models` 必须有内容：它是**没人登录时**模型列表的唯一来源，
//   空了就是「插件装上了但显示 0 models」。
//
// ⚠⚠ **用户在 magpie 设置里改过的值优先，插件不许覆盖。**
//   宿主把用户改过的 provider 配置原样传进来（`cfg.provider[PROVIDER]`），
//   我们要做的是「**补齐缺失**」，不是「重置成默认」。
//   踩过的坑：早期直接 `??=` 整个 provider —— 用户改了上下文窗口，
//   插件一加载又变回默认值，用户以为没生效。
//
// 合并规则（逐模型、逐字段）：
//   · 用户有的字段 → 保留用户的（`limit.context` / `limit.output` / `capabilities` / `name` …）
//   · 用户没有的字段 → 用默认值补
//   · 用户删掉的模型 → 不恢复（尊重用户意图）
//   · 默认表里有、用户配置里没有的模型 → 追加（新版本新增模型能自动出现）

import { PROVIDER, PROVIDER_NAME, SDK, BASE_V1, staticModels } from "../context.mjs"

/** 合并一个模型：用户字段优先，缺的用默认值补 */
function mergeModel(userModel, defaultModel) {
  const merged = { ...defaultModel, ...userModel }

  // limit 逐字段合并 —— 只改 context 的用户不该把 output 也吃掉
  merged.limit = { ...(defaultModel.limit ?? {}), ...(userModel.limit ?? {}) }

  // config 形状用 modalities 数组 + tool_call 下划线；用户可能只改了其中一个
  if (userModel.modalities || defaultModel.modalities) {
    merged.modalities = {
      ...(defaultModel.modalities ?? {}),
      ...(userModel.modalities ?? {}),
    }
  }
  return merged
}

/**
 * 合并模型表。
 * @param {any[]} defaults 插件内置的默认表
 * @param {any[] | undefined} user 宿主里用户改过的表
 * @returns {any[]}
 */
export function mergeModels(defaults, user) {
  if (!Array.isArray(user) || user.length === 0) return defaults

  const byId = new Map(user.map((m) => [m?.id, m]).filter(([id]) => Boolean(id)))
  const out = []

  // 按用户顺序，逐条合并
  for (const um of user) {
    if (!um?.id) continue
    const dm = defaults.find((d) => d.id === um.id)
    out.push(dm ? mergeModel(um, dm) : um)
  }

  // 默认表里有、用户没有的 → 追加（新版本新增的模型）
  for (const dm of defaults) {
    if (!byId.has(dm.id)) out.push(dm)
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
