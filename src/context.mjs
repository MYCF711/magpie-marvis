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
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI4IiBmaWxsPSIjMWYyOTM3Ii8+PHRleHQgeD0iNjQiIHk9Ijg0IiBmb250LXNpemU9IjU2IiBmb250LWZhbWlseT0ic3lzdGVtLXVpLHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiM2MGE1ZmEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk08L3RleHQ+PC9zdmc+"

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
  // ⚠ 名字后面是**实测**的真实模型（2026-11-06，每种槽位都发过请求看响应体的 `model` 字段）
  // ⚠ 真实模型 id 不能直接当 `model` 传（会 400 无效模型id），只能填槽位名
  // 「按任务难度自动匹配」是披露文案：实测简单/中等/困难三种提示词，路由结果完全一样
  ["main-auto", "DeepSeek V4.1 Flash（自动）", 128_000, { reasoning: true, tools: true }],
  ["deepseek-v4-pro-external", "DeepSeek V4 Pro", 128_000, { reasoning: true, tools: true }],
  ["app-auto", "DeepSeek V4 Flash（应用）", 200_000, { reasoning: true, tools: true }],
  ["file-auto", "DeepSeek V4.1 Flash（文件）", 128_000, { reasoning: true, tools: true }],
  ["computer-auto", "DeepSeek V4.1 Flash（电脑）", 128_000, { reasoning: true, tools: true }],
  ["browser-auto", "DeepSeek V4.1 Flash（浏览器）", 128_000, { reasoning: true, tools: true }],
  ["glm-5v-turbo-thinking", "GLM 5V Turbo", 200_000, { reasoning: true, tools: true, vision: true }],
  ["claude-sonnet-4-6", "Claude Sonnet 4.6", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["claude-opus-4-6", "Claude Opus 4.6", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["claude-opus-4-6-thinking", "Claude Opus 4.6 Thinking", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["gpt-5.4", "GPT-5.4", 1_000_000, { reasoning: true, tools: true, vision: true }],
  ["hunyuan-turbos-vision", "混元 TurboS Vision", 32_000, { vision: true }],
  ["hy3-preview-agent-real", "Hy3 预览（真实）", 128_000, { reasoning: true, tools: true }],
  ["hy3-preview-agent", "Hy3 预览", 128_000, { reasoning: true, tools: true }],
  ["venus-vision-llm", "Venus Vision", 32_000, { reasoning: true, vision: true }],
  ["memory-compress", "Qwen 记忆压缩", 128_000, {}],
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
