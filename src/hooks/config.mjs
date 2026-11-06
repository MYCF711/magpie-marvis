// ① config —— 声明 provider 与静态模型表
//
// ⚠ `config.models` 必须有内容：它是**没人登录时**模型列表的唯一来源，
//   空了就是「插件装上了但显示 0 models」。
// ⚠ 用 `??=`，不要覆盖用户在 plugins.json 里改过的配置。

import { PROVIDER, PROVIDER_NAME, SDK, BASE_V1, staticModels } from "../context.mjs"

export function configHook() {
  return async (cfg) => {
    cfg.provider ??= {}
    cfg.provider[PROVIDER] ??= {
      name: PROVIDER_NAME,
      npm: SDK,
      api: BASE_V1,
      models: staticModels(),
    }
  }
}
