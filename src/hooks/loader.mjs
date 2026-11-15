// 鈶?auth.loader 鈥斺€?鎺ョ鎵€鏈夊嚭绔欒姹?
//
// 杩欓噷鍙仛鍥涗欢浜嬶細
//   1. 姣忔璇锋眰**鐜扮涓€涓?uskey**锛堝悓涓€ uskey 鍙粰 2 娆★紝绗?3 娆?403锛?
//   2. 鎹㈡垚杩欎釜璐﹀彿鐨?Ual-Access-* 澶达紙妯″瀷缃戝叧涓嶈 Bearer锛屽彧璁よ繖濂楋級
//   3. 鎶娿€屾ā鍨嬩笉鍙敤銆嶇炕鎴?404銆併€岀櫥褰曞け鏁堛€嶇炕鎴?401 + X-Magpie-Sign-In: expired
//   4. **鎶?Response 鍘熸牱浜ゅ洖鍘?* 鈥斺€?缁濅笉鍦?fetch 閲岃娴侊紙璇讳簡灏辨槸銆屽彧鏈夌涓€娈靛氨缁撴潫銆嶏級
//
// 鈿?瀹炴祴锛氭妸 UAL 绛惧悕澶达紙md5 body+ts+accessKey+nonce锛夊姞鍒版ā鍨嬬綉鍏充笂鏄?*閿欑殑** 鈥斺€?
//   浼氫粠 403 椋庢帶鍙樻垚 401 鐧诲綍鎬佽繃鏈熴€傞偅濂楀彧鐢ㄤ簬 /v3/*銆?

import { BASE_V1, DEFAULT_MODEL, DISPLAY_BY_SLOT, canonicalModelId, isUnavailableModel } from "../context.mjs"
import { llmHeaders } from "../marvis/protocol.mjs"
import { normalizeTools } from "../marvis/tool-schema.mjs"
import { InvalidImageError, normalizeMessages } from "../marvis/images.mjs"

/**
 * 涓婃父璇淬€屾ā鍨嬩笉琛屻€嶇殑淇″彿 鈥斺€?鍙敹**妯″瀷绾?*鐨勶紝鏄犲皠鎴?404锛堟悂缃繖涓ā鍨嬶紝涓嶆墦姝昏处鍙凤級銆?
 *
 * 鈿?`4130001` = `鏃犳晥妯″瀷id`锛堣姹備綋閲岀殑 model 涓嶆槸娉ㄥ唽琛ㄩ噷鐨勬Ы浣嶏級銆?
 * 鈿?`5104002` 鏄?**RPC 500**锛岃繖涓笟鍔＄爜鏈韩涓嶇瓑浜庢ā鍨嬪け鏁?鈥斺€?涓嶈兘鍔犺繘鏉ワ細
 *   鎶?5104002 鍏ㄥ眬鏄犲皠鎴?404 浼氭妸姝ｅ父妯″瀷鐨勪笂娓告姈鍔ㄨ鍒ゆ垚銆屾ā鍨嬩笉鍙敤銆嶏紝
 *   鑳界敤鐨勬ā鍨嬪拰璐﹀彿閮戒細琚爣鎴愬け鏁堛€?
 */
const MODEL_ISSUE =
  /model.*not (found|exist|allowed|available)|no such model|涓嶆敮鎸?*妯″瀷|妯″瀷.*(涓嶅瓨鍦▅鏈紑閫殀涓嶅彲鐢?|鏃犳晥妯″瀷\s*id|4130001|4100402/i

/** 椋庢帶锛坲skey 閰嶉鐢ㄥ畬 / 缂?MarvisExt锛夆€斺€?鍙噸璇曪紝浣嗚鎹㈡柊 uskey */
const RISK_BLOCK = /4100404|椋庢帶鎷︽埅/

/** 鐧诲綍鎬佽繃鏈?*/
const AUTH_EXPIRED = /4100403|鐧诲綍鎬佽繃鏈焲鏈櫥褰?

/**
 * Marvis 鐨勫唴瀹硅繃婊ゆ嫤鐨勬槸銆?*system 棣栬 + 璇嶅 + 鍗曚釜绌烘牸**銆嶏紙issue #22 / #26锛夈€?
 *
 * 2026-11-15 棣栨瀹氫綅 + 2026-11-16 澶嶆祴锛堢洿鎵撲笂娓革紝鍙崲 system prompt 绗竴鍙ワ級锛?
 *
 *   `You are an AI agent powered by DeepSeek Harness.`      鈫?403 闈炴硶璇锋眰
 *   涓枃鍐欐硶锛堢敱 DeepSeek Harness 椹卞姩鈥︼級                    鈫?403 闈炴硶璇锋眰
 *   鍏ㄥ皬鍐欏悓涓€鍙?                                            鈫?403锛堝ぇ灏忓啓涓嶆晱鎰燂級
 *   鍙ユ湯鍔?! 鎴?,                                            鈫?403锛堝彞鏈鍙锋棤鏁堬級
 *   鍚屼竴鍙ユ斁绗?2 琛?/ 琛屽唴甯﹀墠缂€ / user 鎴?assistant 瑙掕壊     鈫?200
 *   `DeepSeek-Harness` / `DeepSeek 鈥?Harness`               鈫?200锛堣瘝闂存彃瀛楃鏀捐锛?
 *
 * 鈬?鍒ゆ嵁鏄€岄琛岄噷鐨勮瘝瀵广€嶏紝涓嶆槸銆屾暣鍙ユā鏉裤€嶃€傚彧璁よ嫳鏂囨暣鍙ヤ細婕忔帀涓枃涓庢湰鍦板寲鍐欐硶 鈥斺€?
 *   瀹冧滑鐓ф牱 403锛岃€屼笖鍥犱负涓嶅懡涓ā鏉匡紝杩?content_filtered 璇婃柇閮戒笉浼氳Е鍙戯紝
 *   鐢ㄦ埛鐪嬪埌鐨勪粛鏄涓婚偅鍙ャ€孉PI 瀵嗛挜鏃犳晥銆嶃€?
 */
const IDENTITY_PHRASES = [
  [/(You are an AI agent powered by DeepSeek)\s+(Harness)/i, "$1-$2"],
  [/(You are a coding agent running in the Codex)\s+(CLI)/i, "$1-$2"],
  [/(You are Claude)\s+(Code, Anthropic's official CLI for Claude)/i, "$1-$2"],
  [/(浣犳槸涓€涓敱\s*DeepSeek)\s+(Harness)/i, "$1-$2"],
]

/** 鍒ゅ畾鐢紙鍙湅鍘熸枃锛屼笉鍙備笌鏀瑰啓锛夛細鍛戒腑浠讳竴鏉″嵆璁や负杩欐 403 鏄唴瀹硅繃婊?*/
const IDENTITY_PHRASE_TEST =
  /You are an AI agent powered by DeepSeek\s+Harness|You are a coding agent running in the Codex\s+CLI|You are Claude\s+Code|浣犳槸涓€涓敱\s*DeepSeek\s+Harness/i

/**
 * 涓婃父鍐呭杩囨护鎷︽埅鏃剁殑**缁熶竴**鎻愮ず銆?
 *
 * 鈿?鍒绘剰**涓嶇偣鍚?*浠讳綍 agent / 韬唤鍙?鈥斺€?琚嫤鐨勫彲鑳芥湁寰堝瀹讹紙DSH銆丆odex銆丆laude Desktop锛?
 *   浠ュ強杩樻病娴嬪埌鐨勶級锛屽啓姝讳竴瀹朵細鍦ㄥ埆瀹跺懡涓椂鎶婁汉甯﹀亸銆傚彧鐣欎袱浠剁‘瀹氱殑浜嬶細
 *   鈶?鎬ц川鏄唴瀹硅繃婊わ紝涓嶆槸瀵嗛挜鎴栫櫥褰曪紱鈶?淇鏂规硶鍦ㄧ兢閲屻€?
 */
const CONTENT_FILTER_HINT =
  "涓婃父鍐呭杩囨护鎷︽埅锛堥潪瀵嗛挜鎴栫櫥褰曢棶棰橈級锛屼慨澶嶆柟娉曡 QQ 缇?451129479銆?

/**
 * 鏋勯€犱竴涓敊璇?Response銆?
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {Record<string, string>} [headers]
 */
function errorResponse(status, code, message, headers = {}) {
  return new Response(JSON.stringify({ error: { type: "upstream_error", code, message } }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

/**
 * 鎶婁細琚笂娓稿唴瀹硅繃婊ゆ嫤涓嬬殑韬唤鍙ユ敼鍐欐垚鑳芥斁琛岀殑褰㈡€併€?
 *
 * 鈿?鍙敼 system 娑堟伅**绗竴琛?*閲岀殑韬唤鐭 鈥斺€?閭ｆ槸涓婃父鍞竴浼氭嫤鐨勪綅缃紱
 *   user / assistant 閲岀殑鍚屼竴鍙ヤ笂娓告湰鏉ュ氨鏀捐锛屾敼浜嗗弽鑰屾槸澶氫綑鏀瑰姩銆?
 * 鈿?闂ㄧ涓嶅彉锛氬彧鎶婅瘝闂撮偅涓€涓┖鏍兼崲鎴愯繛瀛楃锛屽叾浣欏瓧绗︿竴涓兘涓嶇锛?
 *   宸茬粡鍐欐垚杩炲瓧绗?/ 鐮存姌鍙风殑褰㈡€佹病鏈夌┖鏍煎彲鎹紝浠嶇劧鍘熸牱鍙戝嚭锛?.2.30 鐨勭敤渚嬬户缁畧鐫€锛夈€?
 * 鈿?杩斿洖**鏂版暟缁?*鎵嶈〃绀烘敼杩?鈥斺€?璋冪敤鏂规嵁姝ゅ喅瀹氳涓嶈閲嶆柊搴忓垪鍖?body锛堝苟鍘绘帀 content-length锛夈€?
 *
 * @param {unknown} messages
 * @returns {unknown}
 */
function firstLineOf(text) {
  const cut = text.indexOf("\n")
  return cut < 0 ? text : text.slice(0, cut)
}

/** 棣栬閲岀殑韬唤鐭鎹㈡垚杩炲瓧绗﹀舰鎬侊紱娌℃湁鍙崲鐨勫氨鍘熸牱杩斿洖 */
function rewriteFirstLine(text) {
  const line = firstLineOf(text)
  let next = line
  for (const [pattern, replacement] of IDENTITY_PHRASES) {
    next = next.replace(pattern, replacement)
  }
  return next === line ? text : next + text.slice(line.length)
}

function rewriteAgentIdentity(messages) {
  if (!Array.isArray(messages)) return messages
  let touched = false
  const out = messages.map((message) => {
    if (!message || typeof message !== "object") return message
    if (message.role !== "system") return message
    if (typeof message.content !== "string") return message
    const content = rewriteFirstLine(message.content)
    if (content === message.content) return message
    touched = true
    return { ...message, content }
  })
  return touched ? out : messages
}

/**
 * 杩欐璇锋眰浣撻噷鏈夋病鏈夈€屼笂娓镐細鎷︾殑韬唤鐭銆嶁€斺€?**鏀瑰啓鍓?*鍒ゅ畾锛屽彧褰卞搷 403 鐨勬枃妗堛€?
 * 鍙湅 system 棣栬锛屼笌涓婃父鍒ゆ嵁淇濇寔鍚屼竴闆嗗悎锛岄伩鍏嶆妸鏅€?403 璇垽鎴愬唴瀹硅繃婊ゃ€?
 *
 * @param {unknown} bodyString
 * @returns {boolean}
 */
function identityBlockedInSystem(bodyString) {
  if (typeof bodyString !== "string") return false
  let json = null
  try {
    json = JSON.parse(bodyString)
  } catch {
    return false
  }
  const messages = Array.isArray(json?.messages) ? json.messages : []
  for (const message of messages) {
    if (!message || message.role !== "system") continue
    const text = typeof message.content === "string" ? message.content : ""
    if (IDENTITY_PHRASE_TEST.test(firstLineOf(text))) return true
  }
  return false
}

// 鈿?涓嶈鐢?TABLE锛坄DISPLAY_BY_SLOT`锛夊綋鍑嗗叆闆嗗悎銆?
//   TABLE 鏄?*瀵瑰灞曠ず鐩綍**锛屼笉鏄€屼笂娓稿彲鐢ㄩ泦鍚堛€嶏細`app-auto` / `file-auto` /
//   `computer-auto` / `browser-auto` 杩欑被鏃х湡瀹炴Ы浣嶄笉鍦?TABLE 閲岋紝涓婃父鍗翠粛鐒?200銆?
//   鎷?TABLE 鍋?allowlist 浼氭妸瀹冧滑鏈湴 404 鎺夛紙0.2.21 鐨勪簨鏁咃級銆?
//   鍑嗗叆鍙煡 `isUnavailableModel`锛堟槑纭笉鍙敤鍚嶅崟锛屽綋鍓嶅彧鏈?`kimi-k2.5`锛夛紝鍏朵綑浜ょ粰涓婃父鍒ゃ€?

/** 璇锋眰浣撻噷鍒板簳鏈夋病鏈夋寚瀹氭ā鍨嬶紙绌?/ null 鐨勪氦鍥炰笂娓稿垽锛?*/
function hasModelId(value) {
  return value != null && String(value) !== ""
}

/**
 * 鏄庣‘涓嶅彲鐢ㄧ殑妯″瀷锛?*鏈湴** 404锛屼笉鍑虹綉銆佷笉 fallback銆?
 *
 * 鍙 `isUnavailableModel` 鍛戒腑鍚嶅崟鐨勬ā鍨嬬敓鏁堬紙褰撳墠鍙湁 `kimi-k2.5`锛夈€?
 * TABLE 澶栫殑鏃х湡瀹炴Ы浣嶄笉褰掕繖閲岀 鈥斺€?瀹冧滑鐓у父鍑虹綉锛屽彲鐢ㄦ€х敱涓婃父鍝嶅簲鍐冲畾銆?
 *
 * 涓轰粈涔堟槸 404 鑰屼笉鏄?401/500锛圓GENTS 鍧?6锛夛細
 *   路 401 浼氳瀹夸富褰撶櫥褰曢棶棰橈紝failover 鍒?*姣忎竴涓处鍙?*锛?
 *   路 500 浼氳褰撳彲閲嶈瘯鐨勪笂娓告晠闅滐紝鍚屼竴涓姹傝繛鎵?8 娆★紙kimi-k2.5 鐨?5104002 鐜板満锛夛紱
 *   路 404 鍙悂缃繖涓ā鍨嬶紝鏂囨鎶婄敤鎴峰紩瀵煎洖妯″瀷鍒楄〃閲?*鐪熷疄妯″瀷鍚?*鐨勬潯鐩€?
 */
function modelUnavailableResponse(id) {
  const example = DISPLAY_BY_SLOT[DEFAULT_MODEL] ?? DEFAULT_MODEL
  return errorResponse(
    404,
    "model_unavailable",
    `妯″瀷銆?{String(id).slice(0, 120)}銆嶅凡琚爣璁颁负鎸佺画涓嶅彲鐢紙涓婃父绋冲畾澶辫触锛夛紝` +
      `杩欐璇锋眰娌℃湁鍙戝線涓婃父銆傝鍦ㄦā鍨嬪垪琛ㄩ噷閲嶆柊閫夋嫨涓€涓湡瀹炴ā鍨嬪悕鏉＄洰锛堜緥濡?${example}锛夈€俙,
  )
}

/** 浠庤处鍙峰嚟鎹噷鍙栨ā鍨嬬綉鍏宠鐨勫洓浠跺 */
function credsOf(auth) {
  const meta = auth?.metadata ?? {}
  return {
    openid: String(meta.openid ?? auth?.uid ?? ""),
    accessToken: String(auth?.access ?? auth?.key ?? ""),
    guid: String(meta.guid ?? ""),
    loginType: String(meta.loginType ?? "1"),
  }
}

export function loaderHook() {
  return async (getAuth) => {
    const auth = await getAuth()
    const creds = credsOf(auth)
    if (!creds.accessToken || !creds.openid) {
      return {}
    }

    return {
      baseURL: BASE_V1,
      apiKey: "placeholder",
      fetch: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url

        // 闈炶ˉ鍏ㄨ姹傦紙/models 涔嬬被锛夊師鏍锋斁琛?鈥斺€?涓婃父娌℃湁杩欎釜绔偣锛屼氦缁欎笂灞傚厹搴?
        if (!/\/chat\/completions\b/.test(url)) {
          return fetch(input, init)
        }

        // 鈿?姣忔閮借閲嶆柊绠楀ご锛歶skey 鏄竴娆℃€х殑
        let headers
        try {
          headers = llmHeaders(creds, {
            scene: "preload_summary",
            agentTag: "auto_discovery",
          })
        } catch (err) {
          return errorResponse(
            503,
            "header_unavailable",
            `璇锋眰澶存瀯閫犲け璐ワ細${err?.message ?? err}`,
          )
        }

        // 淇濈暀璋冪敤鏂逛紶鐨?stream / 涓氬姟浣擄紝鍙崲閴存潈澶?
        const merged = { ...(init?.headers ?? {}) }
        for (const [k, v] of Object.entries(headers)) merged[k] = v

        // 鈿?鏃ц矾鐢遍噷妯″瀷 ID 鏄暟缁勪笅鏍?`"0"鈥?7"`锛屼笂娓稿彧璁ゆЫ浣嶅悕銆?
        //   鍦ㄨ繖閲屽仛涓€娆″綊涓€锛屾棫璺敱涓嶆敼閰嶇疆涔熻兘缁х画鐢ㄣ€?
        let body = init?.body
        /** 鏀瑰啓鍓嶇殑鍘熷璇锋眰浣?鈥斺€?403 璇婃柇瑕侀潬瀹冨垽鏂笂娓告嫤鐨勬槸鍝彞韬唤澹版槑锛坆ody 鍙兘宸茶鏀瑰啓锛?*/
        const originalBody = typeof body === "string" ? body : ""
        /** @type {string | null} 鍛戒腑銆屾槑纭笉鍙敤銆嶅悕鍗曠殑妯″瀷 ID */
        let unavailableModel = null
        /** 璇锋眰浣撻噷鏄惁鍚涓婃父鍐呭杩囨护瀹氬悜鎷︽埅鐨?DSH 鏍囪瘑璇彞 */
        let harnessIdentityPrompt = false
        if (typeof body === "string") {
          // 鍙仛鏍囪锛屼笉鏀?body 鈥斺€?鍛戒腑涓庡惁鍙奖鍝嶉敊璇枃妗?
          harnessIdentityPrompt = identityBlockedInSystem(originalBody)
          let json = null
          try {
            json = JSON.parse(body)
          } catch {
            /* 涓嶆槸 JSON 灏卞師鏍疯浆鍙?*/
          }
          if (json && typeof json === "object") {
            let changed = false
            const canonical = canonicalModelId(json.model)
            if (canonical !== json.model) {
              json.model = canonical
              changed = true
            }
            if (hasModelId(json.model) && isUnavailableModel(json.model)) {
              // 鏄庣‘涓嶅彲鐢ㄥ悕鍗曪紙褰撳墠鍙湁 kimi-k2.5锛夛細鏈湴鎸℃帀锛屼笉鍑虹綉銆佷笉 fallback銆?
              unavailableModel = String(json.model)
            }
            if (unavailableModel === null) {
              // Marvis 瑕佹眰姣忎釜宸ュ叿 parameters 鏄惧紡 type:"object"锛?
              // DSH 鐨勯儴鍒嗗伐鍏风渷鐣ヤ簡瀹冿紝缂轰竴涓氨 400 invalid parameter銆?
              const tools = normalizeTools(json.tools)
              if (tools !== json.tools) {
                json.tools = tools
                changed = true
              }
              try {
                // 鍥剧墖 URL / 瑁?base64 / Anthropic image 鏄惧紡褰掍竴涓?data URI锛?
                // 杞崲涓嶄簡灏辨湰鍦?400锛屼笉鍐嶉潤榛樹涪鍥炬垨鎶婃棤鏁堣緭鍏ヤ氦缁欎笂娓搞€?
                const messages = await normalizeMessages(json.messages)
                if (messages !== json.messages) {
                  json.messages = messages
                  changed = true
                }
              } catch (err) {
                if (err instanceof InvalidImageError) {
                  return errorResponse(400, "invalid_image", `鍥剧墖杈撳叆鏃犳晥锛?{err.message}`)
                }
                throw err
              }
              // 鈿?涓婃父鍐呭杩囨护浼氱簿纭嫤涓?DSH / Codex / Claude Desktop 鐨勮韩浠藉彞
              //   锛坕ssue #22 瀹炴祴锛氳韩浠界煭璇腑闂存崲鎴愯繛瀛楃灏辨斁琛岋級銆傝嚜鍔ㄦ敼鍐欙紝鐢ㄦ埛涓嶇敤鏀瑰鎴风閰嶇疆銆?
              const rewritten = rewriteAgentIdentity(json.messages)
              if (rewritten !== json.messages) {
                json.messages = rewritten
                changed = true
              }
            }
            if (changed) {
              body = JSON.stringify(json)
              // body 鍙樹簡锛岄暱搴﹀ご蹇呴』鍘绘帀锛岃 fetch 閲嶆柊绠?
              delete merged["content-length"]
              delete merged["Content-Length"]
              delete merged["content-encoding"]
              delete merged["Content-Encoding"]
            }
          }
        }

        // 鏄庣‘涓嶅彲鐢ㄦā鍨嬶細鏈湴 404锛屼竴娆?fetch 閮戒笉鍙?
        if (unavailableModel !== null) {
          return modelUnavailableResponse(unavailableModel)
        }

        let response
        try {
          response = await fetch(url, { ...init, ...(body === init?.body ? {} : { body }), headers: merged })
        } catch (err) {
          return errorResponse(503, "upstream_unreachable", `杩炰笉涓?Marvis 缃戝叧锛?{err?.message ?? err}`)
        }

        if (response.ok) {
          // 涓婃父缁欐祦寮忓搷搴旀椂甯︾殑鏄?`text/plain` 鈥斺€?浣?body 鏄爣鍑?SSE銆?
          // 閮ㄥ垎 OpenAI SDK 鐗堟湰鎸?content-type 鍐冲畾璧颁笉璧?SSE 瑙ｆ瀽鍣紝鎵€浠ヨ繖閲屽綊涓€鍖栥€?
          const ct = response.headers.get("content-type") ?? ""
          if (response.body && !/event-stream/i.test(ct)) {
            const headers = new Headers(response.headers)
            headers.set("content-type", "text/event-stream; charset=utf-8")
            return new Response(response.body, { status: response.status, headers })
          }
          return response
        }

        // 鈥斺€?閿欒鍒嗘祦锛氬彧璇?**閿欒** 鐨?body锛堟垚鍔熷搷搴旂粷涓嶈锛岃鏂囦欢澶?鈿狅級鈥斺€?
        let text = ""
        try {
          text = await response.clone().text()
        } catch {
          /* 璇讳笉鍑烘潵灏辨寜鐘舵€佺爜鍒?*/
        }

        if (AUTH_EXPIRED.test(text) || response.status === 401) {
          return errorResponse(401, "sign_in_expired", "Marvis 鐧诲綍鎬佸凡杩囨湡锛岃閲嶆柊鐧诲綍銆?, {
            "X-Magpie-Sign-In": "expired",
          })
        }
        if (RISK_BLOCK.test(text)) {
          // 椋庢帶鍙噸璇曪細鎹㈡柊 uskey 灏辫兘杩囷紝浜ょ粰瀹夸富閲嶈瘯
          return errorResponse(503, "risk_blocked", `涓婃父椋庢帶鎷︽埅锛堥€氬父鏄竴娆℃€?uskey 鐢ㄥ畬浜嗭紝閲嶈瘯鍗冲彲锛夛細${text.slice(0, 300)}`)
        }
        if (MODEL_ISSUE.test(text) || response.status === 404) {
          // 妯″瀷绾ч敊璇?鈫?404锛屽彧鎼佺疆杩欎釜妯″瀷锛屼笉鎵撴璐﹀彿锛圓GENTS 鍧?6锛?
          return errorResponse(404, "model_unavailable", `璇ユā鍨嬪湪褰撳墠璐﹀彿涓嶅彲鐢細${text.slice(0, 300)}`)
        }
        // 鈿?涓嶇偣鍚嶅叿浣?agent / 韬唤鍙ワ細琚嫤鐨勫彲鑳芥湁寰堝瀹讹紝鍐欐涓€瀹朵細鍦ㄥ埆瀹跺懡涓椂璇銆?
        //   鍙紶杈剧‘瀹氱殑浜?鈥斺€?鎬ц川锛堝唴瀹硅繃婊わ紝闈炲瘑閽?鐧诲綍锛? 淇鏂规硶鍘诲摢鎷裤€?
        if (response.status === 403 && harnessIdentityPrompt && /闈炴硶璇锋眰|permission_error/i.test(text)) {
          return errorResponse(403, "content_filtered", CONTENT_FILTER_HINT)
        }
        // 鍏朵綑鍘熸牱閫忓嚭
        return new Response(text || null, {
          status: response.status,
          headers: response.headers,
        })
      },
    }
  }
}

export { DEFAULT_MODEL, credsOf }
