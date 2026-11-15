// tests/loader-model-support.test.mjs 鈥斺€?妯″瀷涓嶅彲鐢ㄥ悕鍗曢椄锛堝彧鎷︽槑纭笉鍙敤鐨勬ā鍨嬶級
//
// 浜嬫晠鐜板満锛氭墜宸ラ厤缃垨闄堟棫璺敱閲屽啓鐫€ `marvis/kimi-k2.5`锛堜笂娓哥ǔ瀹?5104002 RPC 500锛夆€斺€?
// 杩欎笉鏄?401/403/404锛屽涓绘妸瀹冨綋**鍙噸璇曠殑涓婃父鏁呴殰**锛屽悓涓€涓姹傝繛鎵?8 娆℃墠鏀惧純锛?
// 鐢ㄦ埛鐪嬪埌鐨勬槸銆屽崱寰堜箙鐒跺悗 500銆嶃€?
//
// 闂搁棬瑙勫垯锛?.2.22 璧凤紝TABLE allowlist 宸插簾寮冿級锛?
//   路 鍙湁 context.mjs 鐨?`isUnavailableModel` 鍛戒腑鐨勬ā鍨嬶紙褰撳墠鍙湁 `kimi-k2.5`锛夋墠鏈湴鎷︺€?
//     TABLE 鏄?*瀵瑰灞曠ず鐩綍**锛屼笉鏄€屼笂娓稿彲鐢ㄩ泦鍚堛€嶏細`app-auto` / `file-auto` /
//     `computer-auto` / `browser-auto` 绛夋棫鐪熷疄妲戒綅涓婃父浠嶇劧 200锛屽繀椤荤户缁嚭缃戙€?
//   路 鍛戒腑鍚嶅崟 鈫?**鏈湴** 404 `model_unavailable`锛屼竴娆?fetch 閮戒笉鍙戯紝缁濅笉闈欓粯 fallback 鍒伴粯璁ゆā鍨嬨€?
//   路 TABLE 澶栫殑鍏朵粬妯″瀷锛堝惈闅忔墜缂栫殑 ID锛変竴寰嬪嚭缃戯紝鐢变笂娓稿搷搴斿喅瀹氥€?
//   路 `main-auto` 浣滀负鍐呴儴涓婃父妲戒綅缁х画鍙敤锛堝吋瀹规棫璺敱锛夛紝浣嗗崱鐗囨樉绀哄悕浠嶆槸鐪熷疄妯″瀷鍚嶃€?
//   路 涓婃父 `4130001` / `鏃犳晥妯″瀷id` 褰掑叆妯″瀷绾?404锛沗5104002` **涓?*鍋氬叏灞€ 404 鏄犲皠
//     锛堥偅鏄?RPC 鏁呴殰锛屾槧灏勬垚 404 浼氭妸鑳界敤鐨勬ā鍨?璐﹀彿璇爣鎴愬け鏁堬級銆?
//
// 鍏ㄩ儴绂荤嚎锛歮ock 鎺?globalThis.fetch锛屼笉闇€瑕佺湡瀹炲嚟鎹€佷笉纰扮湡瀹炰笂娓搞€?

import test from "node:test"
import assert from "node:assert/strict"

import { loaderHook, DEFAULT_MODEL } from "../src/hooks/loader.mjs"
import { DISPLAY_BY_SLOT, MODEL_ALIASES } from "../src/context.mjs"

const CHAT_URL = "https://yybadaccess.3g.qq.com/v1/chat/completions"

/** 鍋囧嚟鎹細鍙槸褰㈢姸瀵癸紝鍊煎叏閮ㄦ槸娴嬭瘯鐢ㄧ殑鍋囦覆锛屼笉浼氬彂鍒颁换浣曠湡瀹炰笂娓?*/
const AUTH = Object.freeze({
  access: "mv_test_offline_only",
  uid: "0123456789abcdef0123456789abcdef",
  metadata: {
    openid: "fedcba9876543210fedcba9876543210",
    guid: "0".repeat(32),
    loginType: "1",
  },
})

/** 鏇挎崲 globalThis.fetch 骞惰褰曡皟鐢紱杩斿洖 { calls, restore } */
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

/** 鍙?loader 鎻忚堪绗︼紙loaderHook 鐨勫舰鐘舵槸 getAuth => { fetch, baseURL, apiKey }锛?*/
async function loaderOf() {
  const describe = await loaderHook()(async () => AUTH)
  assert.equal(typeof describe.fetch, "function", "loader 蹇呴』杩斿洖 fetch")
  return describe
}

/** 缁勪竴涓?/v1/chat/completions 璇锋眰锛圤penAI 褰㈢姸锛宻tream 鐢卞弬鏁板喅瀹氾級 */
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

/** 涓婃父姝ｅ父鍥炲寘锛?00锛岄潪娴佸紡 JSON锛?*/
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

/** 涓婃父閿欒鍥炲寘锛歴tatus 鏄?HTTP 鐘舵€侊紝body 閲屽甫涓氬姟鐮?/ 鏂囨 */
function upstreamError(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** 鏂█銆屾湰鍦?404銆佹病鏈夊嚭缃戙€嶅苟妫€鏌ュ紩瀵兼枃妗?*/
async function assertLocalModelUnavailable(res, calls) {
  assert.equal(res.status, 404, "鏈煡/澶辨晥妯″瀷蹇呴』鍦ㄦ湰鍦板洖 404")
  const body = await res.json()
  assert.equal(body.error.code, "model_unavailable")
  assert.equal(body.error.type, "upstream_error")
  assert.match(body.error.message, /閲嶆柊閫夋嫨/, "鏂囨瑕佸紩瀵肩敤鎴峰洖妯″瀷鍒楄〃閲嶆柊閫?)
  assert.match(body.error.message, /鐪熷疄妯″瀷鍚?, "鏂囨瑕佹寚鏄庨€夈€岀湡瀹炴ā鍨嬪悕銆嶆潯鐩?)
  assert.equal(calls.length, 0, "涓嶆敮鎸佹ā鍨嬩竴娆?upstream 閮戒笉鑳借闂?)
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 鈶?鏈煡 / 宸插け鏁堟ā鍨嬶細鏈湴 404锛屼笉鍑虹綉
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("kimi-k2.5锛坰tream:true锛夆啋 鏈湴 404锛宖etch 0 娆★紙鏃у疄鐜颁細鍑虹綉骞堕€忓嚭 500锛?, async () => {
  // 涓婃父瀵?kimi-k2.5 鐨勭湡瀹炲弽搴旓細5104002 RPC 500 鈥斺€?瀹夸富浼氬綋鍙噸璇曟晠闅滐紝杩炴墦 8 娆?
  const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
  try {
    const req = requestFor("kimi-k2.5", true)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    await assertLocalModelUnavailable(res, s.calls)
  } finally {
    s.restore()
  }
})

test("kimi-k2.5锛坰tream:false锛夆啋 鏈湴 404锛宖etch 0 娆?, async () => {
  const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
  try {
    const req = requestFor("kimi-k2.5", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    await assertLocalModelUnavailable(res, s.calls)
  } finally {
    s.restore()
  }
})

test("TABLE 澶栧叾浠栨ā鍨嬩笉鏈湴鎷︽埅锛氬嚭缃?1 娆★紝鐢变笂娓?4130001 褰掑叆 404", async () => {
  // 杩欎簺鍙槸銆屼笉鍦ㄥ睍绀虹洰褰曢噷銆嶏紝涓嶇瓑浜庝笂娓稿け鏁?鈥斺€?蹇呴』鐪熺殑闂笂娓搞€?
  for (const model of ["not-a-model", "glm-5v-turbo-thinking", "memory-compress"]) {
    const s = stubFetch(() => upstreamError(400, { code: 4130001, msg: "鏃犳晥妯″瀷id" }))
    try {
      const req = requestFor(model, false)
      const res = await (await loaderOf()).fetch(req.url, req.init)
      assert.equal(s.calls.length, 1, `${model} 涓嶅湪鏄庣‘涓嶅彲鐢ㄥ悕鍗曢噷锛屽繀椤诲厛鍑虹綉`)
      assert.equal(res.status, 404)
      assert.equal((await res.json()).error.code, "model_unavailable")
    } finally {
      s.restore()
    }
  }
})

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 鈶?鍚堟硶妯″瀷浠嶇劧鎸夊師璺緞锛氭樉绀哄悕 / 鏃т笅鏍?/ 妲戒綅鍚?鈫?妲戒綅 鈫?鍑虹綉
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("鏄剧ず鍚?deepseek-v4-1-flash-261017 鈫?褰掍竴鎴?main-auto 鍚庢甯稿嚭缃?, async () => {
  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("deepseek-v4-1-flash-261017", true)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 200)
    assert.equal(s.calls.length, 1, "鍚堟硶妯″瀷蹇呴』姝ｅ父鍑虹綉")
    assert.equal(JSON.parse(s.calls[0].init.body).model, "main-auto", "涓婃父鍙妲戒綅鍚?)
  } finally {
    s.restore()
  }
})

test("鏃ф暟瀛椾笅鏍?0 鈫?main-auto 姝ｅ父鍑虹綉锛堟棫璺敱涓嶄綔搴燂級", async () => {
  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("0", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 200)
    assert.equal(s.calls.length, 1)
    assert.equal(JSON.parse(s.calls[0].init.body).model, "main-auto")
  } finally {
    s.restore()
  }
})

test("鍐呴儴妲戒綅 main-auto 鏈韩浠嶈鎺ュ彈锛堝吋瀹癸級锛屼絾鏄剧ず鍚嶄笉鏄?main-auto", async () => {
  assert.equal(DEFAULT_MODEL, "main-auto")
  assert.notEqual(DISPLAY_BY_SLOT["main-auto"], "main-auto", "鍗＄墖鏄剧ず鍚嶅繀椤绘槸鐪熷疄妯″瀷鍚?)

  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("main-auto", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 200)
    assert.equal(s.calls.length, 1)
    assert.equal(JSON.parse(s.calls[0].init.body).model, "main-auto")
  } finally {
    s.restore()
  }
})

test("TABLE 閲?8 鏉℃Ы浣?/ 鏄剧ず鍚?/ 鏃т笅鏍囧叏閮ㄦ斁琛岋紙褰撳墠姝ｅ父鐨?8 涓ā鍨嬩笉璁歌闂告帀锛?, async () => {
  assert.equal(Object.keys(DISPLAY_BY_SLOT).length, 8)
  assert.equal(Object.keys(MODEL_ALIASES).length, 8)

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
      assert.equal(res.status, 200, `妯″瀷 ${model} 搴旀斁琛宍)
      assert.equal(s.calls.length, 1, `妯″瀷 ${model} 搴斿嚭缃慲)
      assert.equal(JSON.parse(s.calls[0].init.body).model, expectedSlot, `妯″瀷 ${model} 搴斿綊涓€鎴?${expectedSlot}`)
    } finally {
      s.restore()
    }
  }
})

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 鈶?涓婃父閿欒鐮佸垎绫伙細4130001 / 鏃犳晥妯″瀷id 鈫?404锛?104002 涓嶈鍏ㄥ眬 404
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("涓婃父 4130001锛堟棤鏁堟ā鍨媔d锛夆啋 404 model_unavailable锛屼笉鎵撴璐﹀彿", async () => {
  const s = stubFetch(() => upstreamError(400, { code: 4130001, msg: "invalid request" }))
  try {
    const req = requestFor("main-auto", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(s.calls.length, 1, "杩欐槸涓婃父杩斿洖鐨勫垎绫伙紝蹇呴』鐪熺殑璇锋眰杩囦笂娓?)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.error.code, "model_unavailable")
  } finally {
    s.restore()
  }
})

test("涓婃父鍙銆屾棤鏁堟ā鍨媔d銆嶆病鏈変笟鍔＄爜鏃朵篃褰掑叆 404", async () => {
  const s = stubFetch(() => upstreamError(400, { error: { message: "鏃犳晥妯″瀷id: xxx" } }))
  try {
    const req = requestFor("main-auto", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 404)
    assert.equal((await res.json()).error.code, "model_unavailable")
  } finally {
    s.restore()
  }
})

test("涓婃父 5104002 RPC 500 鍘熸牱閫忓嚭锛堜笉鍏ㄥ眬鏄犲皠鎴?404锛?, async () => {
  const s = stubFetch(() => upstreamError(500, { code: 5104002, msg: "RPC error" }))
  try {
    const req = requestFor("main-auto", false)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(s.calls.length, 1)
    assert.equal(res.status, 500, "5104002 鏄?RPC 鏁呴殰锛屼笉鑳藉綋妯″瀷澶辨晥")
    assert.equal((await res.json()).code, 5104002)
  } finally {
    s.restore()
  }
})

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// system prompt 鍚?DSH 鏍囪瘑璇彞鏃剁殑 403 璇婃柇锛坕ssue #22锛?
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("system prompt 鍛戒腑 DSH 鏍囪瘑鍙?+ 涓婃父 403 鈫?鏀瑰垽鎴愬彲璇荤殑 content_filtered", async () => {
  const s = stubFetch(() => upstreamError(403, { code: 403, msg: "闈炴硶璇锋眰", type: "permission_error" }))
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [
      { role: "system", content: "You are an AI agent powered by DeepSeek Harness." },
      ...body.messages,
    ]
    req.init.body = JSON.stringify(body)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 403)
    const out = await res.json()
    assert.equal(out.error.code, "content_filtered", "鍛戒腑鏍囪瘑鍙ユ椂瑕佺粰鍑鸿兘鎸囪矾鐨勯敊璇爜")
    assert.match(out.error.message, /QQ 缇?451129479/, "瑕佺粰鍑烘嬁淇鏂规硶鐨勫叆鍙?)
    assert.match(out.error.message, /闈炲瘑閽ユ垨鐧诲綍闂/, "瑕佺籂姝ｃ€孉PI 瀵嗛挜鏃犳晥銆嶈繖涓瀵?)
  } finally {
    s.restore()
  }
})

test("鏅€?system prompt 閬囧埌鍚屾牱鐨?403 鈫?鍘熸牱閫忓嚭锛堜笉璁歌鍒わ級", async () => {
  const s = stubFetch(() => upstreamError(403, { code: 403, msg: "闈炴硶璇锋眰", type: "permission_error" }))
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 403)
    const out = await res.json()
    assert.notEqual(out.error?.code, "content_filtered", "娌″懡涓爣璇嗗彞鏃朵笉璁告敼鍒?)
  } finally {
    s.restore()
  }
})

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 鑷姩鏀瑰啓锛氶偅鍙ユ爣璇嗗彞鎹㈡垚 DeepSeek-Harness锛岀敤鎴蜂笉鐢ㄥ姩 DSH 閰嶇疆
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("system prompt 閲岄偅鍙?DSH 鏍囪瘑浼氳鑷姩鏀规垚 DeepSeek-Harness", async () => {
  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [
      { role: "system", content: "You are an AI agent powered by DeepSeek Harness." },
      ...body.messages,
    ]
    req.init.body = JSON.stringify(body)
    await (await loaderOf()).fetch(req.url, req.init)
    const sent = JSON.parse(s.calls[0].init.body)
    assert.equal(
      sent.messages[0].content,
      "You are an AI agent powered by DeepSeek-Harness.",
      "涓や釜璇嶄箣闂磋鎹㈡垚杩炲瓧绗︼紙瀹炴祴杩欐牱涓婃父鎵嶆斁琛岋級",
    )
    assert.equal(sent.messages[1].content, "ping", "鍏朵綑娑堟伅涓€涓瓧绗﹂兘涓嶈兘鍔?)
  } finally {
    s.restore()
  }
})

test("涓嶆秹鍙婇偅鍙ョ殑 system prompt 鍘熸牱鍙戝嚭", async () => {
  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [{ role: "system", content: "You are a helpful assistant." }, ...body.messages]
    req.init.body = JSON.stringify(body)
    await (await loaderOf()).fetch(req.url, req.init)
    const sent = JSON.parse(s.calls[0].init.body)
    assert.equal(sent.messages[0].content, "You are a helpful assistant.")
  } finally {
    s.restore()
  }
})

test("鐢ㄦ埛宸茬粡鍦?DSH 渚т慨濂斤紙杩炲瓧绗?/ 鐮存姌鍙?/ 鍏虫帀鏁村彞锛夆啋 鎻掍欢涓€涓瓧鑺傞兘涓嶆敼", async () => {
  // 杩欐槸銆岄棬绂併€嶈€屼笉鏄€屾棤宸埆鏇挎崲銆嶇殑鍏抽敭锛氬彧璁や細琚嫤鐨勫師濮嬪舰鎬侊紝鐢ㄦ埛鐨勪慨澶嶅繀椤诲師鏍蜂繚鐣?
  const alreadyFixed = [
    "You are an AI agent powered by DeepSeek-Harness. Your working directory is /repo.",
    "You are an AI agent powered by DeepSeek 鈥?Harness. Your working directory is /repo.",
    "You are a coding agent powered by the deepseek model.",
  ]
  for (const text of alreadyFixed) {
    const s = stubFetch(() => upstreamOk())
    try {
      const req = requestFor("deepseek-v4-1-flash-261017")
      const body = JSON.parse(req.init.body)
      body.messages = [{ role: "system", content: text }, ...body.messages]
      req.init.body = JSON.stringify(body)
      await (await loaderOf()).fetch(req.url, req.init)
      const sent = JSON.parse(s.calls[0].init.body)
      assert.equal(
        sent.messages[0].content,
        text,
        `宸茬粡淇繃鐨勫舰鎬佷笉璁稿啀鍔細${text.slice(0, 42)}鈥,
      )
    } finally {
      s.restore()
    }
  }
})
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// Claude Code 韬唤鍙ョ殑 403 璇婃柇锛坕ssue #26锛岄敊璇爜 4100406锛?
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("Claude Code 韬唤鍙?+ 403 鈫?鏀瑰啓鎴?Claude-Code锛屼笖璇婃柇鎸囧洖鍘熷韬唤鍙?, async () => {
  const s = stubFetch(() => upstreamError(403, { code: 4100406, msg: "闈炴硶璇锋眰" }))
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    const claudeIdentity = "You are Claude Code, Anthropic's official CLI for Claude."
    body.messages = [{ role: "system", content: claudeIdentity }, ...body.messages]
    req.init.body = JSON.stringify(body)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 403)
    const out = await res.json()
    assert.equal(out.error.code, "content_filtered", "鍛戒腑 Claude 韬唤鍙ユ椂瑕佺粰鍑鸿兘鎸囪矾鐨勯敊璇爜")
    assert.match(out.error.message, /QQ 缇?451129479/, "瑕佺粰鍑烘嬁淇鏂规硶鐨勫叆鍙?)
    const sent = JSON.parse(s.calls[0].init.body)
    assert.equal(
      sent.messages[0].content,
      "You are Claude-Code, Anthropic's official CLI for Claude.",
      "0.2.32 璧蜂細鍦ㄦ湰鍦版妸韬唤鐭鏀瑰啓鎴愯繛瀛楃褰㈡€侊紙鏀瑰啓鍚庝粛 403 鏃舵墠璧颁笂闈㈤偅鏉¤瘖鏂級",
    )
  } finally {
    s.restore()
  }
})

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 鍚屼竴绫诲唴瀹硅繃婊わ細Codex Desktop / Claude Desktop 鐨勮韩浠藉彞
// 2026-11-15 鐩存墦涓婃父瀹炴祴锛堝彧鎹?system prompt 绗竴鍙ワ紝鍏朵綑瀹屽叏涓€鏍凤級锛?
//   Codex 鍘熷彞 鈫?403锛沗Codex-CLI` 鈫?200
//   Claude 鍘熷彞 鈫?403锛沗Claude-Code` 鈫?200
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("Codex Desktop 鐨勮韩浠藉彞浼氳鑷姩鏀瑰啓鎴?Codex-CLI", async () => {
  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [
      {
        role: "system",
        content:
          "You are a coding agent running in the Codex CLI, a terminal-based coding assistant. " +
          "Codex CLI is an open source project led by OpenAI.",
      },
      ...body.messages,
    ]
    req.init.body = JSON.stringify(body)
    await (await loaderOf()).fetch(req.url, req.init)
    const sent = JSON.parse(s.calls[0].init.body)
    assert.equal(
      sent.messages[0].content,
      "You are a coding agent running in the Codex-CLI, a terminal-based coding assistant. " +
        "Codex CLI is an open source project led by OpenAI.",
      "鍙敼寮€澶磋韩浠界煭璇噷鐨勯偅涓┖鏍硷紝鍚庨潰鐨?`Codex CLI` 鍘熸牱淇濈暀",
    )
    assert.equal(sent.messages[1].content, "ping", "鍏朵綑娑堟伅涓€涓瓧绗﹂兘涓嶈兘鍔?)
  } finally {
    s.restore()
  }
})

test("Claude Desktop 鐨勮韩浠藉彞浼氳鑷姩鏀瑰啓鎴?Claude-Code", async () => {
  const s = stubFetch(() => upstreamOk())
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [
      {
        role: "system",
        content:
          "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
      },
      ...body.messages,
    ]
    req.init.body = JSON.stringify(body)
    await (await loaderOf()).fetch(req.url, req.init)
    const sent = JSON.parse(s.calls[0].init.body)
    assert.equal(
      sent.messages[0].content,
      "You are Claude-Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
      "鍙敼 `Claude Code` 杩欎竴澶勶紝绗簩澶?`Claude` 涓嶅姩",
    )
    assert.equal(sent.messages[1].content, "ping", "鍏朵綑娑堟伅涓€涓瓧绗﹂兘涓嶈兘鍔?)
  } finally {
    s.restore()
  }
})

test("瀹㈡埛绔凡缁忓啓鎴?Codex-CLI / Claude-Code 鈫?涓€涓瓧鑺傞兘涓嶆敼", async () => {
  const alreadyFixed = [
    "You are a coding agent running in the Codex-CLI, a terminal-based coding assistant.",
    "You are Claude-Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
  ]
  for (const text of alreadyFixed) {
    const s = stubFetch(() => upstreamOk())
    try {
      const req = requestFor("deepseek-v4-1-flash-261017")
      const body = JSON.parse(req.init.body)
      body.messages = [{ role: "system", content: text }, ...body.messages]
      req.init.body = JSON.stringify(body)
      await (await loaderOf()).fetch(req.url, req.init)
      const sent = JSON.parse(s.calls[0].init.body)
      assert.equal(sent.messages[0].content, text, `宸茬粡淇繃鐨勫舰鎬佷笉璁稿啀鍔細${text.slice(0, 42)}鈥)
    } finally {
      s.restore()
    }
  }
})
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 涓枃 / 鏈湴鍖栬韩浠藉彞锛?026-11-16 澶嶆祴锛?
//
// 鍒ゆ嵁鏄€?*system 棣栬 + 璇嶅 + 鍗曚釜绌烘牸**銆嶏紝涓嶆槸銆屼笁鍙ヨ嫳鏂囨ā鏉裤€嶏細
//   system 绗?1 琛?`浣犳槸涓€涓敱 DeepSeek Harness 椹卞姩鐨?AI 鏅鸿兘浣撱€俙   鈫?403 闈炴硶璇锋眰
//   system 绗?1 琛?鍏ㄥ皬鍐?/ 鍙ユ湯鍔?!                               鈫?403
//   system 绗?2 琛?/ user 瑙掕壊閲岀殑鍚屼竴鍙?                           鈫?200
// 鈬?鏃х増鍙鑻辨枃鏁村彞锛屼腑鏂囧啓娉曟棦涓嶆敼鍐欎篃涓嶈瘖鏂紝鐢ㄦ埛鐪嬪埌鐨勬槸鍘熷 403
//   锛堝涓诲啀缈绘垚銆孉PI 瀵嗛挜鏃犳晥銆嶏級鈥斺€?杩欏氨鏄湰鏉＄敤渚嬭閿佷綇鐨勫洖褰掋€?
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

test("涓枃韬唤鍙ュ啓鍦?system 棣栬 鈫?鑷姩鏀瑰啓锛屼笖 403 鏀瑰垽鎴?content_filtered", async () => {
  const s = stubFetch(() => upstreamError(403, { code: 403, msg: "闈炴硶璇锋眰", type: "permission_error" }))
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [{ role: "system", content: "浣犳槸涓€涓敱 DeepSeek Harness 椹卞姩鐨?AI 鏅鸿兘浣撱€? }, ...body.messages]
    req.init.body = JSON.stringify(body)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    const sent = JSON.parse(s.calls[0].init.body)
    assert.equal(sent.messages[0].content, "浣犳槸涓€涓敱 DeepSeek-Harness 椹卞姩鐨?AI 鏅鸿兘浣撱€?, "涓枃鍐欐硶鍚屾牱瑕佹妸璇嶉棿绌烘牸鎹㈡垚杩炲瓧绗?)
    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, "content_filtered", "涓枃鍐欐硶涓嶈閫€鍖栨垚鍘熷 403")
  } finally {
    s.restore()
  }
})

test("韬唤鍙ヤ笉鍦?system 棣栬锛堢 2 琛?/ user 瑙掕壊锛夆啋 涓€涓瓧鑺傞兘涓嶆敼", async () => {
  const cases = [
    [{ role: "system", content: "浣犳槸涓€涓姪鎵嬨€俓n浣犳槸涓€涓敱 DeepSeek Harness 椹卞姩鐨?AI 鏅鸿兘浣撱€? }, { role: "user", content: "ping" }],
    [{ role: "user", content: "浣犳槸涓€涓敱 DeepSeek Harness 椹卞姩鐨?AI 鏅鸿兘浣撱€? }],
    [{ role: "system", content: "You are a helpful assistant." }, { role: "assistant", content: "You are an AI agent powered by DeepSeek Harness." }, { role: "user", content: "ping" }],
  ]
  for (const messages of cases) {
    const s = stubFetch(() => upstreamOk())
    try {
      const req = requestFor("deepseek-v4-1-flash-261017")
      const body = JSON.parse(req.init.body)
      body.messages = messages
      req.init.body = JSON.stringify(body)
      await (await loaderOf()).fetch(req.url, req.init)
      const sent = JSON.parse(s.calls[0].init.body)
      assert.deepEqual(sent.messages, messages, "涓婃父鏈潵灏辨斁琛岀殑浣嶇疆锛屼笉璁告敼锛堟敼浜嗘槸澶氫綑鏀瑰姩锛?)
    } finally {
      s.restore()
    }
  }
})

test("鍏ㄥ皬鍐?/ 鍙ユ湯鍔犳劅鍙瑰彿鐨勮韩浠藉彞鐓ф牱浼氳鎷︼紝涔熺収鏍疯鏀瑰啓", async () => {
  const variants = [
    ["you are an ai agent powered by deepseek harness.", "you are an ai agent powered by deepseek-harness."],
    ["You are an AI agent powered by DeepSeek Harness!", "You are an AI agent powered by DeepSeek-Harness!"],
  ]
  for (const [input, expected] of variants) {
    const s = stubFetch(() => upstreamOk())
    try {
      const req = requestFor("deepseek-v4-1-flash-261017")
      const body = JSON.parse(req.init.body)
      body.messages = [{ role: "system", content: input }, ...body.messages]
      req.init.body = JSON.stringify(body)
      await (await loaderOf()).fetch(req.url, req.init)
      const sent = JSON.parse(s.calls[0].init.body)
      assert.equal(sent.messages[0].content, expected)
    } finally {
      s.restore()
    }
  }
})

test("Codex 韬唤鍙ヨ鎷︽椂涔熻缁?content_filtered 璇婃柇锛堟棫鐗堝彧鏈?DSH 涓?Claude 涓ゆ潯鍒嗘敮锛?, async () => {
  const s = stubFetch(() => upstreamError(403, { code: 403, msg: "闈炴硶璇锋眰", type: "permission_error" }))
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [{ role: "system", content: "You are a coding agent running in the Codex CLI, a terminal-based coding assistant." }, ...body.messages]
    req.init.body = JSON.stringify(body)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, "content_filtered")
  } finally {
    s.restore()
  }
})

test("system 棣栬娌℃湁韬唤鐭鏃讹紝403 浠嶇劧鍘熸牱閫忓嚭锛堜笉璁告妸鏅€?403 璇垽鎴愬唴瀹硅繃婊わ級", async () => {
  const s = stubFetch(() => upstreamError(403, { code: 403, msg: "闈炴硶璇锋眰", type: "permission_error" }))
  try {
    const req = requestFor("deepseek-v4-1-flash-261017")
    const body = JSON.parse(req.init.body)
    body.messages = [{ role: "system", content: "You are a helpful assistant." }, ...body.messages]
    req.init.body = JSON.stringify(body)
    const res = await (await loaderOf()).fetch(req.url, req.init)
    assert.equal(res.status, 403)
    assert.notEqual((await res.json()).error?.code, "content_filtered")
  } finally {
    s.restore()
  }
})
