// auth 对象装配 —— 各钩子摆到一起
//
// 数据字段（不是钩子，但决定 UI）：
//   icon           两处必须一致：这里 + package.json 的 magpie.icon
//   maxConcurrency 上游对 uskey 是按次扣的，并发 2 就够（多了只会互相抢配额）
//   refreshLead    距到期多久开始调 refresh（token 30 天，提前 1 天）

import { PROVIDER, ICON, REFRESH_LEAD_MS, HIDE_DSH } from "./context.mjs"
import { methods } from "./hooks/methods.mjs"
import { refreshHook } from "./hooks/refresh.mjs"
import { loaderHook } from "./hooks/loader.mjs"
import { usageHook } from "./hooks/usage.mjs"

export function authHooks(input) {
  return {
    provider: PROVIDER,
    icon: ICON,
    maxConcurrency: 2,
    refreshLead: REFRESH_LEAD_MS,
    methods: methods(),
    refresh: refreshHook(),
    loader: loaderHook(input),
    usage: usageHook(),
    // magpie 自己的开关，显示在供应商卡片的「插件选项」里。
    // 关掉之后 loader 一个字节都不改，请求与未安装本插件时完全一致。
    options: [
      {
        key: HIDE_DSH,
        label: "Hide upstream-blocked identity lines",
        description:
          "Replaces the identity line Tencent Marvis filters out (DeepSeek Harness, Claude Code / Claude Desktop, Codex) with a neutral one. Only the first line of the system prompt is touched; turn it off to send every request exactly as the agent wrote it.",
        default: true,
        labels: {
          zh: "隐去会被上游拦截的身份句",
          "zh-TW": "隱去會被上游攔截的身份句",
          ja: "上流に拒否される身元の一文を隠す",
          de: "Vom Upstream blockierte Identitätszeilen ausblenden",
        },
        descriptions: {
          zh: "把腾讯 Marvis 会拦的身份首行（DeepSeek Harness、Claude Code / Claude Desktop、Codex）换成一句中性表述。只动 system 提示的第一行；关掉后请求原样发出。",
          "zh-TW": "把騰訊 Marvis 會攔的身份首行（DeepSeek Harness、Claude Code / Claude Desktop、Codex）換成一句中性表述。只動 system 提示的第一行；關掉後請求原樣送出。",
          ja: "Tencent Marvis が拒否する身元の先頭行（DeepSeek Harness、Claude Code / Claude Desktop、Codex）を中立的な一文に置き換えます。system プロンプトの先頭行だけが対象で、オフにするとリクエストはそのまま送信されます。",
          de: "Ersetzt die Identitätszeile, die Tencent Marvis ablehnt (DeepSeek Harness, Claude Code / Claude Desktop, Codex), durch eine neutrale Formulierung. Nur die erste Zeile des System-Prompts wird angefasst; ausgeschaltet geht jede Anfrage unverändert hinaus.",
        },
      },
    ],
  }
}
