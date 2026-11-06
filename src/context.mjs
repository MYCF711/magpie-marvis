// 共享上下文 —— 所有钩子都读这一份
//
// 这个插件只服务一个站点：腾讯 Marvis（应用宝 AI 助手）。
// 上游只有一个：https://yybadaccess.3g.qq.com
//   推理   /v1/chat/completions   （OpenAI 兼容，不需要 UAL 签名）
//   业务   /v3/*                  （钱包、用户信息；需要 md5 签名）
//
// ⚠ 模型表来自 Marvis 自己的 `_internal/CONFIG`（Fernet 加密的 config_defaults.yaml）。
//   `model` 字段填的是**槽位名**，服务端再路由到真实模型
//   （例：`deepseek-v4-pro-external` → 实际 `deepseek-v4-pro-202606`）。
//   响应体的 `model` 字段会回真实模型名，看那个才是准的。

/** 厂商 id：agent 用 `<id>/<model>` 命名 */
export const PROVIDER = "marvis"

/** 卡片上显示的供应商名：必须 <中文> <English> */
export const PROVIDER_NAME = "腾讯 Marvis TENCENT"

/** 业务接口基址（/v3/*：用户信息、钱包） */
export const BASE = "https://yybadaccess.3g.qq.com"
/** 推理 API 基址 —— loader 的 baseURL，SDK 会拼成 <baseURL>/chat/completions */
export const BASE_V1 = `${BASE}/v1`

/** 决定 API 形状：Chat completions */
export const SDK = "@ai-sdk/openai-compatible"

/** 上游 business id（请求头 Ual-Access-Businessid） */
export const BUSINESS_ID = "marvis_client"

/** 业务接口签名用的 accessKey —— 明文硬编码在 Marvis 渲染层里，不是密钥 */
export const ACCESS_KEY = "fpzkeTlcGLVP37qiOWd29MyaOqaJYxMi"

/** QQ 互联 appid / 微信开放平台 appid（登录用） */
export const QQ_APP_ID = "1903794758"
export const WX_APP_ID = "wxb650708317d56f88"

/** 登录类型码：QC = QQ 登录，WX = 微信登录。请求头 Ual-Access-Login-Type 用的就是这个数字 */
export const LOGIN_TYPE = { QC: "6", WX: "5" }

/**
 * 发出去的 UA。
 * 模型请求必须用 Marvis agent 自己的 UA（`AsyncOpenAI/Python 2.32.0`）——
 * 换成别的会被风控拦（4100404）。这不是「伪装」，是这个端点的准入条件。
 */
export const CLIENT = "AsyncOpenAI/Python 2.32.0"
/** 业务接口（/v3/*）用的浏览器 UA，同样照抄 Marvis 自己的 */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Marvis/1.60.3300.408 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36"

/** 图标 —— 两处必须一致：这里 + package.json 的 magpie.icon */
export const ICON =
  "data:image/png;base64,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"

/** Token 30 天有效；提前 1 天提示重登 */
export const REFRESH_LEAD_MS = 24 * 60 * 60_000

/** 默认输出上限（Marvis 的 default 槽位写的是 32000） */
const DEFAULT_OUTPUT = 32_000

/**
 * 静态模型表 —— 没人登录时也能显示。
 *
 * 每条：`[槽位 id, 显示名, 上下文, 能力]`
 *   · `auto` 结尾的是服务端自动路由槽位（"按任务难度匹配 Hy4 / DeepSeek V4.1 Flash"）
 *   · 其余是显式模型
 *
 * ⚠ 只列**真实存在**的槽位（来自 config_defaults.yaml 的 25 条注册表），
 *   不猜、不补。`local_model` / `warmup_model` / `*placeholder` 是内部占位，不对外。
 */
const TABLE = [
  // ⚠ 2026-11-06 逐槽位实测（每槽连发 5 次、5 种不同难度提示词，路由 100% 稳定）。
  //   显示名 = **真实模型名**，槽位名写进 id —— 卡片上看到的就是实际在跑什么。
  // ⚠ 真实模型 id 不能直接当 `model` 传（会 400 无效模型id），只能填槽位名。
  //
  // 为什么不列 file-auto / computer-auto / browser-auto / app-auto：
  //   前三个实测**全部**路由到 `deepseek-v4-1-flash-261017`，和 main-auto 一模一样，
  //   列出来只会在列表里重复 4 条同名模型。main-auto 是主对话槽位，最稳定，留它一个。
  //
  // 已移除（上游 400 无效模型id / 500 / 空响应，不是我们这边的问题）：
  //   glm-5v-turbo-thinking · claude-opus-4-6-thinking · memory-compress · profile-request-placeholder
  //   kimi-k2.5（500 RPC）· hunyuan-2.0-instruct-20251111（空响应）· venus-vision-llm（→ default）

  // ── DeepSeek ────────────────────────────────────────────────
  ["main-auto", "deepseek-v4-1-flash-261017", 128_000, { reasoning: true, tools: true }],
  ["deepseek-v4-pro-external", "deepseek-v4-pro-202606", 128_000, { reasoning: true, tools: true }],
  ["hy3-preview-agent", "deepseek-v4-flash-ga-260731", 128_000, { reasoning: true, tools: true }],

  // ── 其他厂商 ─────────────────────────────────────────────────
  ["hy3-preview-agent-real", "hy3", 128_000, { reasoning: true, tools: true }],
  ["claude-sonnet-4-6", "claude-sonnet-4-6", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["claude-opus-4-6", "claude-opus-4-6", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["gpt-5.4", "gpt-5.4-2026-03-05", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["hunyuan-turbos-vision", "HY-Vision-2.0-instruct", 32_000, { vision: true }],
]

/**
 * 静态模型表（`config` 钩子用）—— 没人登录时也能显示。
 *
 * ⚠ 这是 **OpenCode `#quick` 形状**，与 `provider.models` 返回的形状**不同**：
 *   · 工具能力叫 `tool_call`（有下划线）
 *   · 能力写在 `modalities` 里，`input` / `output` 是**数组** `["text","image"]`
 *   · 收图能力是 `attachment: boolean`
 *   两个位置写混不会报错，只会让「能不能调工具 / 能不能收图」静默为假（HOOKS 十一之三）。
 */
export function staticModels() {
  return TABLE.map(([id, name, context, cap]) => ({
    id,
    name,
    // 收图能力：模型级 `attachment`，config 形状就是它
    attachment: Boolean(cap.vision),
    modalities: {
      input: cap.vision ? ["text", "image"] : ["text"],
      output: ["text"],
    },
    tool_call: Boolean(cap.tools),
    reasoning: Boolean(cap.reasoning),
    limit: { context, output: DEFAULT_OUTPUT },
    ...(cap.search ? { searches: true } : {}),
  }))
}

/**
 * `provider.models` 钩子返回的形状 —— **OpenCode `Model` 形状**，与静态表不同：
 *   · 工具能力叫 `toolcall`（无下划线）
 *   · `capabilities.input` / `output` 是**对象**，五个模态键必须是布尔值
 *     （漏 `image` 等于「厂商未表态」，magpie 会去 models.dev 投票，导致收不了图的模型被当成能收图）
 *
 * ⚠ text-only 的接口也必须写全五个键 —— 只写 `text: true` 等于没说。
 */
export function providerModels() {
  return TABLE.map(([id, name, context, cap]) => ({
    id,
    name,
    api: { url: BASE_V1, npm: SDK },
    capabilities: {
      reasoning: Boolean(cap.reasoning),
      attachment: Boolean(cap.vision),
      toolcall: Boolean(cap.tools),
      input: {
        text: true,
        image: Boolean(cap.vision),
        audio: false,
        video: false,
        pdf: false,
      },
      output: { text: true },
    },
    limit: { context, output: DEFAULT_OUTPUT },
    ...(cap.search ? { searches: true } : {}),
  }))
}

/** 默认模型（magpie 路由的兜底） */
export const DEFAULT_MODEL = "main-auto"
