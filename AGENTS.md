# AGENTS.md 鈥斺€?缁?AI 鎵ц鑰呯殑鍏ュ彛

> 浜虹被璇疯 [README](./README.md)銆傝繖浠藉彧鍥炵瓟涓や欢浜嬶細
> **浣犵幇鍦ㄨ璇诲摢涓€浠?*锛屼互鍙?*蹇樹簡鍝竴鏉′細闈欓粯鍑洪敊**銆?
>
> 浠庢湰妯℃澘娲剧敓鍑哄幓鐨勬彃浠朵粨搴擄紝璇锋妸杩欎唤涓€璧峰甫璧?鈥斺€?涓嬮潰姣忎竴鏉″娲剧敓浠撳簱鍚屾牱鎴愮珛銆?

---

## 涓€銆佸厛瀹氫綅浣犲湪鍝竴姝?

鍒粠澶磋鍒板熬銆傚厛鐪嬭嚜宸卞湪鍝竴鏍硷紝鍙閭ｄ竴鏍兼寚鐨勬枃浠躲€?

| 浣犲湪鍋氫粈涔?| 蹇呰锛堟寜椤哄簭锛?| 鍋氬畬鐨勫垽鎹?|
|---|---|---|
| **杩樻病寮€宸?*锛屾墜涓婂彧鏈変竴鍙?magpie | [GUIDE.md](./GUIDE.md)锛?0 鍒嗛挓涓荤嚎锛屾瘡姝ュ甫瀹樻柟閿氱偣锛夆啋 鏈枃浠?鈫?[README](./README.md) 鐨勩€屽繀璇讳簲浠姐€嶃€屾渶灏忎氦浠橀潰銆嶃€屼笁鏉￠搧寰嬨€?| 鑳借娓呫€屽摢浜涗簨 magpie 宸茬粡鍋氫簡銆佹彃浠朵笉璇ラ噸鍋氥€?|
| **鍐冲畾瑕佷笉瑕佹媶鎴愪袱涓緵搴斿晢**锛堝浗鍐呯増 / 鍥介檯鐗堬級 | [MULTI-PROVIDER.md](./MULTI-PROVIDER.md)锛堝彧鏈変竴涓珯鐐癸細璺宠繃锛?| 涓ゅ紶鍗°€佷袱缁勭櫥褰曟€侊紝浜掍笉瑕嗙洊 |
| **濉偅浜斾釜 TODO / 鏀归挬瀛?* | [HOOKS.md](./HOOKS.md) 鈥斺€?**鎸夐挬瀛愭煡绔犺妭锛屼笉瑕侀€氳** | 姣忎釜閽╁瓙鐨勮繑鍥炲€煎舰鐘朵笌绗?21 绔犱竴鑷?|
| **浠ｇ爜鍐欏畬锛屽噯澶囦氦浠?* | [CHECKLIST.md](./CHECKLIST.md) 鐨?**A 琛?* | A 琛ㄥ叏鍕?+ `node scripts/check.mjs` 閫€鍑?0 |
| **瑕佸彂涓€涓増鏈?* | **[UPDATING.md](./UPDATING.md) 鍏ㄦ枃** | [CHECKLIST.md](./CHECKLIST.md) 鐨?**B 琛?*鍏ㄥ嬀 + 浜旀潯楠岃瘉 |
| **鐢ㄦ埛璇淬€屾湁鏂扮増鏈絾鎴戣繖杈规病鍔ㄩ潤銆?* | UPDATING 鐨勩€屼竴銆乵agpie 鎬庝箞鍙戠幇鏂扮増鏈€?| 鍒嗘竻鏄?npm 婧愶紙姣?`version`锛夎繕鏄?git 婧愶紙姣?HEAD commit锛?|

**鏈€瀹规槗婕忕殑鏄 5 琛屻€?* 鑰屼笖瑕佽浣忓垎鏀拰 `main` 鏄?*涓ゆ潯鍒嗗彂閫氶亾**锛屼笉鏄€屽厛鏀剧潃銆嶅拰銆屾寮忋€嶏細
- **鍒嗘敮 = 娴嬭瘯鐗堥€氶亾**锛氱敤鎴峰啓 `magpie plugin add owner/repo#feat-x` 鎵嶆嬁寰楀埌锛屼笉褰卞搷鐢?`main` 鐨勪汉
- **`main` = 绋冲畾鐗堥€氶亾**锛歡it 婧愯窡闅忛粯璁ゅ垎鏀?HEAD锛岃繘浜嗗氨鏄墍鏈変汉

鎵€浠ャ€屾€曟妸鍒汉鍦ㄧ敤鐨勬彃浠剁偢浜嗐€嶇殑瑙ｆ硶鏄?*鎺ㄥ垎鏀?*锛屼笉鏄€屾櫄鐐规帹銆嶃€?
PR 鏄?GitHub 瀵瑰彈淇濇姢鍒嗘敮鐨勬妧鏈姹傦紙鐩存帹鎶?`GH006`锛夛紝鎵瑰噯鏁?0銆佽嚜宸卞氨鑳藉悎銆?

---

## 浜屻€佸崄涓夋潯浼氶潤榛樺嚭閿欑殑鍧?

銆岀棁鐘躲€嶅垪鐓х潃浣犵湅鍒扮殑鐜拌薄鏌ワ紱銆屽垽鎹€嶆槸姝ｇ‘鍋氭硶锛涖€屽嚭澶勩€嶆槸瀹屾暣璁鸿瘉銆?

| # | 鐥囩姸锛堝嚭闂鏃朵綘鐪嬪埌浠€涔堬級 | 鍒ゆ嵁 | 鍑哄 |
|---|---|---|---|
| 1 | 棰濆害鏉℃案杩滄槸 100%锛涚┖璐﹀彿鍙嶈€屾帓鍒伴槦棣?| `usage.used` **蹇呭～**涓旀槸鏈夐檺鏁板瓧 鈥斺€?瀹冧篃鏄矾鐢辨帓搴忚緭鍏ワ紝婕忎簡鎸?0% 绠?| HOOKS 涔?|
| 2 | 鍏嶈垂妯″瀷琚弽澶嶆淳鍙戯紱鎴栨敹璐规ā鍨嬭鏍囨垚鍏嶈垂 | `free` 鍙鍘傚晢鑷繁鐨勫０鏄庯細鍒楄〃浠?$0锛屾垨鍘傚晢鑷繁鐨勮璐圭鐐规槑纭 0銆?*`rate: 0` 鐨勬剰鎬濇槸銆屾病缁欏€嶇巼銆嶏紝涓嶆槸鍏嶈垂** 鈥斺€?magpie 涓嶄細浠?`rate` 鎺?`free`锛?468 鏇存锛?026-10-29锛夈€傚弽杩囨潵锛屾妸銆屽椁愬唴涓嶆寜娆¤璐逛絾鍚冮搴︺€嶇殑妯″瀷鏍囨垚 `free: true`锛孎ree first 浼氫竴鐩存淳鍙戝畠浠?| HOOKS 鍗佷竴涔嬩簩 |
| 3 | 鐐圭櫥褰曞悗鐣岄潰杞湀寰堜箙锛屾垨妯″瀷鍒楄〃鏁翠釜鍗′綇 | `authorize()` 蹇呴』**绔嬪埢**杩斿洖锛涚綉缁滆姹備竴寰嬫尓鍒?`loader` | README 閾佸緥 2 |
| 4 | 鍒锋柊涓€娆?token 鍚庢煇涓瓧娈靛彉绌猴紝鎴栫敤鎴疯瑕佹眰閲嶇櫥 | `refresh` 杩斿洖鐨勬槸**鍚堝苟**缁撴灉锛屽彧缁欐柊瀛楁浼氳鐩栨帀鏃х殑 | README 閾佸緥 3 |
| 5 | 鎻掍欢瑁呬笂浜嗭紝浣嗘ā鍨嬪垪琛ㄧ┖銆佺晫闈㈡病鍙嶅簲 | `config.models` 蹇呴』鏈夊唴瀹癸紙鍙互鏄潤鎬佸崰浣嶏級 | README 閾佸緥 1 |
| 6 | 鏌愪竴涓ā鍨嬫姤閿欙紝**鏁翠釜璐﹀彿锛堢敋鑷虫墍鏈夎处鍙凤級**琚仠鐢?| 妯″瀷绾ч敊璇繑鍥?**403 / 404**锛屼笉鏄?401銆?01 鍙噸璇?鈬?浼?failover 鍒?*姣忎竴涓处鍙?*锛屾瘡涓兘鏍囩櫥褰曞け鏁堛€俶agpie 鈮?0.1.1934锛坄3ec25523c`锛夎捣锛屾彃浠?401 鐨?body 鍙妯″瀷涓嶅彲鐢ㄣ€佷笉鎻?token/key/sign-in/session 鏃朵笉鏍囪处鍙凤紱浣嗘彃浠朵粛搴斿洖 403/404锛?468锛?| README 甯歌鍧?2 |
| 7 | 鐧诲綍鍋跺皵銆岃帿鍚嶅け鏁堛€嶏紝澶氳处鍙峰悓鏃跺埛鏂版椂鏇村父瑙?| 涓€娆℃€?`refresh_token` 蹇呴』**涓茶**锛堝悓璐﹀彿鍚屾椂鍙厑璁镐竴娆″埛鏂帮級 | README 甯歌鍧?4 |
| 8 | 娴佸紡杈撳嚭鍗′綇 / 鍙湁绗竴娈靛氨缁撴潫 | 涓嶈鍦?`fetch` 閲岃娴侊紝鎶?`Response` 鍘熸牱浜ゅ洖鍘?| README 甯歌鍧?5 |
| 9 | GitHub 鎶?license 鏍囨垚 `NOASSERTION`锛屽崱鐗囦笂娌℃湁璁稿彲閭ｄ竴鏍?| `LICENSE` 鏈€濂藉啓**閫愬瓧 MIT 姝ｆ枃**锛屽綊灞炶鏄庡彟鏀?`NOTICE.md`銆俶agpie 鈮?0.1.1934锛坄5957d45ac`锛夎捣锛宍NOASSERTION` 鐨?listing 鍥為€€鍒?`package.json` 鐨?`license` 鈥斺€?澶瑰綊灞炶鏄庝笉鍐嶅繀鐒舵病璁稿彲锛屼絾 GitHub 浠嶄笉璁ら偅浠?LICENSE锛?468锛?| README 椤堕儴鍥涗欢 |
| 10 | 鏀逛簡浠ｇ爜閲嶈锛岃涓轰竴鐐规病鍙?| 鍚岀増鏈彿閲嶆墦鍖呬細鍛戒腑 bun 缂撳瓨锛坄no changes`锛夆€斺€?蹇呴』 bump `version` | UPDATING 绗?1 姝?|
| 11 | `magpie plugin add xxx.tgz` 璺戝畬鍍忔垚鍔燂紝瀹為檯娌¤涓?| 杩欎釜鍛戒护鏈?bug锛屾敼 `plugins.json` + `plugins/package.json` 涓ゅ | README 甯歌鍧?1 |
| 12 | 鎯宠鍗＄墖鏍囬/鏂囨瀵癸紝鍘绘敼浜?magpie 鐨勭紦瀛樻枃浠?| 鎻掍欢瀵?magpie 鐨勭洰褰?*鍙湁璇荤殑浠?*锛涘敮涓€杞戒綋鏄?`registry-entry.json` | README銆屼笉瑕佸啓 magpie 鐨勭紦瀛樸€?|
| 13 | 鐢ㄦ埛閭ｈ竟娌℃洿鏂?/ Release 椤甸潰鏄┖鐨?/ 銆屾殏鏃犲彂甯冪増鏈€?| 璧峰姛鑳藉垎鏀?鈫?CHANGELOG + bump 鈫?妫€鏌?/ 娴嬭瘯 / pack 鈫?鎺ㄥ垎鏀?鈫?鎻?PR 绛?`rules` 缁?鈫?鍚堝苟 鈫?npm / tag / Release 鈫?浜旀潯楠岃瘉銆?*鐩存帴鎺?main 浼氳鍒嗘敮淇濇姢鎷掔粷** | UPDATING 浜?路 CHECKLIST B |

琛ュ厖涓ゆ潯鍙湪鍙戝竷渚у嚭鐜扮殑锛?

| # | 鐥囩姸 | 鍒ゆ嵁 | 鍑哄 |
|---|---|---|---|
| 14 | 鎺ㄤ簡鍒嗘敮锛宮agpie 杩樿娌℃洿鏂?| git 婧愭瘮鐨勬槸**榛樿鍒嗘敮** HEAD 鐨?commit锛涙帹鍒殑鍒嗘敮涓嶇畻銆傝€?`plugin add` 涓嶄細鏇存柊宸叉湁鐨勯攣 | UPDATING 涓€ / 鍏?|
| 15 | magpie 鐨?Discover 閲屾悳涓嶅埌鑷繁鐨勫寘 | `keywords` 瑕佸惈 `opencode` + `plugin`/`auth`/`provider` + `magpie`锛涗粨搴撹鎵?`magpie-plugin` topic | README 椤堕儴鍥涗欢 |

鍐嶄笁鏉′笌浠ｇ爜缁撴瀯鏈夊叧鐨?鈥斺€?瀹冧滑涓嶆姤閿欙紝浣嗕細璁╂彃浠跺湪澶氳处鍙?/ 閮ㄥ垎鎴愬姛 / 闀垮ぇ鍚庡嚭闂锛?

| # | 鐥囩姸 | 鍒ゆ嵁 | 鍑哄 |
|---|---|---|---|
| 16 | 鍔犱簡绗簩涓处鍙凤紝绗竴涓处鍙风殑鏁版嵁鍙樹簡 / 涓插彿 | 涓€鍒囨寜璐﹀彿钀界洏鐨勪笢瑗匡紝鏂囦欢鍚嶅繀椤诲甫璐﹀彿锛坄<plugin>-<siteId>__<account>.json`锛夛紱**涓嶈鐢ㄦā鍧楃骇鍙橀噺瀛?per-account 鐘舵€?* 鈥斺€?瀹夸富鏄悓涓€涓繘绋嬭窇鎵€鏈夎处鍙?| [`src/hooks/models.mjs`](HOOKS.md) 鐨?`inScope` |
| 17 | 鎺ュ彛鎶栦竴涓嬶紝鍒楄〃鏁翠釜绌烘帀锛涙垨鏌愪釜妯″瀷缂轰环鏍硷紝鐢ㄦ埛閫変簡鎶ラ敊 | **閮ㄥ垎鎴愬姛鏈変笁鎬?*锛屾柟鍚戣鍚勮嚜閫夊锛氣憼 鏁翠釜鎺ュ彛澶辫触 鈫?閫€鍥炰笂娆″揩鐓э紙涓嶈杩斿洖绌鸿〃锛夆憽 鎺ュ彛鎴愬姛浣嗗崟鏉＄己瀛楁 鈫?**涓嶅垪**锛堜笉鐚滐級鈶?鐧诲綍澶辨晥 鈫?鎶?`signIn: "expired"` | [`src/models.mjs`](./src/models.mjs) 鐨?`buildModels` |
| 18 | 瓒婃敼瓒婁贡锛宍index.mjs` 娑ㄥ埌鍑犵櫨琛岋紝鏀逛竴涓挬瀛愯璇诲叏绡?| 鎴愮啛褰㈡€佹槸**`index.mjs` 鍙仛涔濋」閽╁瓙鐨勮閰嶏紝瀹炵幇鍏ㄥ湪 `src/`**銆傚疄娴嬪洓涓湡瀹炴彃浠剁殑 `index.mjs` 鏄?80~715 琛岋紝鑰?`src/` 鏄?1.4k~3.7k 琛?鈥斺€?鏈ā鏉跨幇鍦ㄦ槸 index 558 琛?/ `src/` 21 鏂囦欢 3,900+ 琛岋紙宸蹭笉鏄€屽崟鏂囦欢 78 琛屻€嶏級 | 鏈枃浠躲€屼簲銆侀暱澶т箣鍚庛€?|

杩樻湁涓ゆ潯鏄?**magpie 0.1.1763 閲嶆柊鎻愬彇濂戠害鍚庢墠鍙戠幇**鐨勶紙2026-10-28锛夛細

| # | 鐥囩姸 | 鍒ゆ嵁 | 鍑哄 |
|---|---|---|---|
| 19 | 鏌愪釜鑳藉姏銆屾槑鏄庡疄鐜颁簡鍗存病鐢熸晥銆嶏細妯″瀷涓嶄細鑱旂綉銆佷笉鑳芥敹鍥俱€佹病鏈夋€濊€冩。銆佹姌鎵ｅ墠鐨勫€嶇巼涓嶆樉绀?| 妯″瀷 / provider 鏉＄洰涓婃湁涓€鎵?*涓嶅啓灏辩瓑浜庡叧鎺?*鐨勫瓧娈碉細`searches`锛堟ā鍨嬬骇=杩欐潯鑷繁浼氭悳锛宲rovider 绾?涓婃父鏁翠綋浼氭悳锛夈€乣decides`锛坉ecision 妯″瀷锛屼粠 agent 鍒楄〃闅愯棌锛夈€乣rateWas`锛堟姌鎵ｅ墠鍊嶇巼锛夈€乣fast`銆乣serviceTiers`銆乣modalities`锛堝浘鐗?/ 闊抽鑳藉姏鍏ㄩ潬瀹冿紱鍏朵腑 `image` 鐪佺暐 **鈮?* 鍏虫帀锛岃鍧?25锛?| HOOKS 鍗佷竴涔嬩笁 |
| 20 | 鍘傚晢鏈夌敾鍥炬ā鍨嬶紝鎻掍欢閲屽綋鍨冨溇杩囨护鎺変簡锛涙垨鑰呭弽杩囨潵锛屽垪杩涘幓涔嬪悗鐢ㄦ埛鍦?chat 閲岄€変腑鎶?400 | magpie **0.1.1707 璧?*鏀寔鎻掍欢渚涘浘锛坄DrawsID` + `ImagesAPI` + npm 鏄?`@ai-sdk/openai-compatible`锛夈€備絾瀹?*鍚屾椂**鐣欏湪 chat 妯″瀷鍒楄〃閲?鈥斺€?鍒椾笉鍒楁槸鍙栬垗锛屽垽鎹 [`src/models.mjs`](./src/models.mjs) 鐨?`LIST_IMAGE_MODELS` | HOOKS 鍗佷竴涔嬩笁鐨勩€屾彃浠朵緵鍥俱€?|
| 21 | 鑺变竴鏅氫笂杩?magpie 鐨勩€屾瘡涓増鏈€嶏紝鏀逛簡涓€鍫嗘枃妗ｏ紝鐢ㄦ埛閭ｈ竟涓€鐐瑰彉鍖栭兘娌℃湁 | **鍒ゆ柇瑕佷笉瑕佸悓姝ワ紝鐪嬬ǔ瀹氭笭閬?*锛坢agpie 璁剧疆閲岄偅涓€屾洿鏂版笭閬擄細姣忎釜鐗堟湰 / 绋冲畾鐗堛€嶏級銆俙curl -s "https://usemagpie.ai/api/latest?channel=stable"` 鎷跨ǔ瀹氱増鐗堟湰鍙凤紱2026-10-28 瀹炴祴锛氭瘡鐗堟湰 0.1.1763 / **绋冲畾鐗?0.1.1327**锛岄€愬瓧娈垫瘮瀵瑰悗鎻掍欢鐩稿叧瀛楁**瀹屽叏涓€鑷?* 鈥斺€?杩芥瘡鐗堟湰鍑犱箮鍏ㄦ槸鐧借窇銆備竴鏉″懡浠ゅ垽鏂細`node scripts/check-magpie-stable.mjs` | HOOKS 椤堕儴 路 UPDATING 涓€ |
| 22 | 鍗＄墖涓婃瘡涓处鍙烽兘鏄剧ず銆屽墿浣欓搴︽湭鐭ャ€嶏紝鑰?`usage()` 鏄庢槑杩斿洖浜?plan / balance / windows銆佷篃娌℃湁 error | **绐楀彛鍙樻垚 text-only 浜?*锛?*鍒ゆ柇鍙湅 `used`锛屼笌 `aside` 鏃犲叧**锛?468 鏇存锛?026-10-29锛夈€備袱绉嶅啓娉曚細涓㈠崰姣旓細鈶?鏈?`amount`/`limit` 鍗存病鏈?`used`锛坢agpie < 0.1.1934 鐩存帴涓紱鈮?`1390aa458` 鎵嶇敤 amount/limit 鎺ㄧ畻锛夆憽 `resetsAt`/`runsOutAt` 濉炲巶鍟嗗師鏍锋椂闂?`"2026-10-28 23:59:59"`锛堣В鏋愬け璐?鈬?鏁存潯涓級銆傚垽鎹細`curl -s http://127.0.0.1:3425/v1/magpie/quotas`锛岀湅 `windows[0]` 鏈夋病鏈?`text: true` 鍜?ISO 褰㈠紡鐨?`runsOutAt` | HOOKS 涓?路 涓夋潯銆屽啓閿欎笉鎶ラ敊銆嶇殑绐楀彛瑙勭煩 |
| 23 | 鏈変竴鎵归搴﹀揩鍒版湡浜嗭紝鍗＄墖涓婂嵈瀹屽叏鐪嬩笉鍑烘潵 | 鐢ㄥ畼鏂瑰瓧娈?`runsOutAt` + `runsOut`锛堝墿浣欓搴︿綍鏃朵綔搴熴€佹崯澶卞灏戯級锛?*涓嶈鎷艰繘 `display`** 鈥斺€?鎷艰繘鍘诲彧鏄櫘閫氭枃瀛楋紝magpie 涓嶄細褰撳け鏁堟彁閱掋€傚巶鍟嗙粰鐨勬椂闂磋鍏堣浆 ISO | HOOKS 涓?路 瑙勭煩 鈶?|
| 24 | **鍗＄墖涓婇搴︽甯革紝璺敱椤甸噷杩欎釜鍙峰嵈鏄€屽墿浣欓搴︽湭鐭ャ€嶏紝杩樻€绘帓鍦ㄥ埆浜哄悗闈?* | 绐楀彛娌℃湁琚矾鐢辫鍏ワ細**`used` 缂虹渷鐨勭獥鍙ｅ垽鎴?`Text`锛宍aside: true` 鐨勭獥鍙ｈ矾鐢辩洿鎺ヨ烦杩?* 鈥斺€?`w.Aside || w.Text` 涓や釜鏉′欢閮戒細璺宠繃锛屼笌 amount/limit 鏃犲叧锛?468 鏇存锛夈€備竴鏉′笉鍓?鈬?`allowanceOf()` 杩斿洖绌?鈬?`routedAllowance` 涓?ok 鈬?`weighed()` 涓嶈 `Known`銆?*銆屼笉鍙備笌鎺掑簭銆嶇殑瀹為檯鍚庢灉鏄€岃繖涓彿鍦ㄨ矾鐢遍噷涓嶅瓨鍦ㄣ€?*銆傚垽鎹細`curl -s http://127.0.0.1:3425/v1/magpie/trace` 鐪嬭繖涓?provider 鐨?`known` 鏄?`true` 杩樻槸**瀛楁缂哄け**锛沗~/.config/magpie/quotas.json` 鐨?`spans` 鏄?`[{}]` 杩樻槸 `[{"aside":true}]` | HOOKS 涓?路 瑙勭煩 鈶?|
| 25 | **妯″瀷鏄庢槑鏀朵笉浜嗗浘锛屽嵈琚綋鎴愯兘鏀跺浘**锛氭埅鍥剧洿鍙戜笂娓告姤 `The request model is not multimodal` / 400锛屾垨鑰呮ā鍨嬪洖銆屽浘鐗囨棤娉曟煡鐪嬨€?| 妯″瀷鏉＄洰鐨?`capabilities.input.image` **蹇呴』鍐欐垚甯冨皵鍊?*锛氱渷鐣ヤ笉绛変簬 text锛岀瓑浜庛€屽巶鍟嗘湭琛ㄦ€併€嶏紝magpie 浼氭嬁 models.dev 鐨勮８妯″瀷 id 鎶曠エ琛?鈥斺€?鍚屽悕妯″瀷鍦ㄥ埆瀹舵爣杩?`image`锛岃繖涓ā鍨嬪氨浼氳甯︽垚鑳芥敹鍥俱€倀ext-only 妯℃澘瑙?HOOKS 鍗佷竴涔嬩笁锛涘弽鍚戠殑鎵嬪姩瑕嗙洊锛堝巶鍟嗚 `false` 鍗村嬀浜?`Accepts images`锛夊湪 magpie 渚ф殏鏃犺鍛?| HOOKS 鍗佷竴涔嬩笁 路 CHECKLIST A-14 |
| 26 | 閭€璇风爜濉簡銆佷富鐧诲綍涔熻繃浜嗭紝浣嗕笂绾ф病鎷垮埌濂栧姳锛涙垨銆岄個璇风爜銆嶉偅鏉＄櫥褰曟柟寮忕偣寮€鍙湁涓€涓銆佸悗闈粈涔堥兘娌℃帴 | 涓や釜鍘熷洜锛氣憼 涓庣爜鎴愬鐨勯澶栧弬鏁版病甯︼紙Accio 鐨?`sId`锛夆€斺€?鎹㈢爜鏃跺繀椤讳竴璧锋崲锛岃 `src/invite.mjs` 鐨?`write()`锛涒憽 鐢?`prompts` 鏁扮粍涓层€岄個璇风爜 鈫?涓荤櫥褰曘€嶆槸涓蹭笉璧锋潵鐨勶紝蹇呴』鐢?`ask()`锛圚OOKS 鍥浡烽櫡闃?5锛?| HOOKS 鍥浡烽櫡闃?5 路 鍥涗箣浜?路 `src/invite.mjs` |
| 27 | **鍗＄墖涓婄殑璐﹀彿鍚嶆槸涓€涓茬湅涓嶆噦鐨?ID**锛坄iam::01a1642a鈥?user:hw0615鈥銆乣urn:鈥銆乽uid锛夛紝鐢ㄦ埛浠ヤ负鏄€屾樉绀轰贡鐮併€?| `accountId` 鏄?*鍚嶅瓧**锛屼笉鏄韩浠斤細鎵嬫満鍙凤紙`maskPhone` 瀵瑰幓鎺夊浗瀹剁爜鍚?鈮?1 浣嶇殑鍙风爜鎵撶爜 `189****8051`锛涚煭鍙疯繑鍥炵┖涓蹭笉鏄剧ず锛夆啋 鏄电О/閭 鈫?**绌轰覆**锛堝涓诲洖閫€渚涘簲鍟嗗悕锛夈€傚唴閮?ID 鍙繘 `uid`銆?*URN 鍐欒繘 `accountId` 鏋侀毦鏀瑰洖** 鈥斺€?缁湡杩斿洖鍊兼槸鍚堝苟銆佹彃浠惰惤鐩樺張澶氫繚鐣欐棫鍊硷紝鎵€浠ョ画鏈熻矾寰勪篃瑕侀噸绠椾竴閬?| HOOKS 鍏殑銆宍accountId` 鏄悕瀛楋紝`uid` 鏄韩浠姐€嵚?`src/account-name.mjs` 鐨?`resolveAccount` |
| 28 | 鍗＄墖鏍囬鍐?`鍗庝负浜?HUAWEI` 涔嬪悗锛宍magpie plugin update` 鎶?`unrecognised dependency format: 鍗庝负浜?HUAWEI` | `package.json.name` 鍚屾椂鏄?bun 渚濊禆閿紝**蹇呴』鏄?slug銆佷笉鑳芥湁绌烘牸**锛涙樉绀哄悕鍐?`package.json.magpie.name`锛堝彲甯︾┖鏍硷級锛宲rovider/registry 鍚屾銆傛棫瀹夎鎸?UPDATING 鐨勩€屾棫鐗堝甫绌烘牸渚濊禆閿€嶆敼閿?+ 鐩綍 + lock锛屼笉鐢?rm+add | README銆屽寘鍚嶆槸 slug锛涙樉绀哄悕鍐?magpie.name銆嵚?UPDATING 杩佺Щ |
| 29 | 涓枃/鏈湴鍖栬韩浠藉彞鐓ф牱琚笂娓?403锛屼絾鎻掍欢鏃笉鏀瑰啓涔熶笉璇婃柇锛屽涓诲彧鏄剧ず銆孉PI 瀵嗛挜鏃犳晥銆?| 鍒ゆ嵁鏄€?*system 棣栬 + 璇嶅**銆嶏紝涓嶆槸鑻辨枃鏁村彞妯℃澘锛涙敼鍐欎笌璇婃柇蹇呴』瑕嗙洊鍚屼竴涓泦鍚?| CHANGELOG 0.2.34 路 `src/hooks/loader.mjs` 鐨?`IDENTITY_PHRASES` |

---

## 涓夈€佸懡浠?

```bash
# 鍚堣妫€鏌?鈥斺€?閫€鍑虹爜闈?0 灏辨槸涓嶅悎瑙勶紝鍒潬鐪肩潧鐪?
node scripts/check.mjs              # 妫€鏌ュ綋鍓嶇洰褰曪紙涓ユ牸锛氬崰浣嶇浼氬け璐ワ級
node scripts/check.mjs ../my-plugin # 妫€鏌ュ埆鐨勪粨搴?
npm run check:template              # 浠呰剼鎵嬫灦鑷韩锛氬厑璁搞€屾湭鍛藉悕銆嶅崰浣嶇

# 鎵撳寘闈㈤婕旓細README / CHANGELOG / docs 鍦ㄤ笉鍦ㄥ寘閲?
npm pack --dry-run

# 鍖呭悕鎾炶溅妫€鏌ワ紙鎾炰簡 = magpie 鐨勩€屾洿鏂般€嶄細瑁呮垚鍒汉鐨勫寘锛?
npm view <鍖呭悕> version

# 璇箟娴嬭瘯 鈥斺€?check 鏌ャ€屽舰鐘躲€嶏紝瀹冩煡銆岃涔夈€嶏紙free 涓夊垎鏀?/ 涓夋€侀檷绾?/ 404 vs 401 / 娴佸紡 usage锛?
node --test

# 缁存姢妫€鏌?鈥斺€?鏀逛簡浠ｇ爜鏈夋病鏈?bump銆乥ump 浜嗘湁娌℃湁鎵?tag銆丆HANGELOG 鏈夋病鏈夎繖涓€鑺?
#   鍏潯鍏ㄤ笉鎶ラ敊锛屼絾鍚庢灉鍚屼竴涓細鐢ㄦ埛姘歌繙鎷夸笉鍒版柊鐗堛€傚彂甯冨墠蹇呰窇銆?
node scripts/check-maintenance.mjs

# 鏄剧ず鍚嶏紙magpie.name锛屼腑鏂?+ English锛変笌 npm 鍖呭悕涓嶅悓鏃跺彂甯?
#   妯℃澘鑷甫 scripts/publish-npm.mjs锛圥UBLISH_AS = magpie-plugin-scaffold锛夛紱
#   娲剧敓浠撳簱鐢?create.mjs 鐢熸垚鑷繁鐨?PUBLISH_AS銆?
#   release.mjs 浼氳嚜鍔ㄦ娴嬶細鏈夊畠灏辩敤瀹冿紝娌℃湁灏遍€€鍥?npm publish銆?
#   CI 鐨?release.yml 蹇呴』閰?NPM_TOKEN锛涙病閰嶄細鏄惧紡澶辫触锛堜笉鏄?exit 0 鍋囩豢锛夈€?
npm run publish:npm

# 鍙楁帶鍙戝竷锛氬彧鍦?PR 鍚堝苟鍚庤繍琛岋紱鑴氭湰涓嶆帹 main锛屽彧鎺?tag
node scripts/release.mjs             # 棰勬紨锛氬凡鍚堝苟 HEAD + 妫€鏌?/ 娴嬭瘯 / pack锛屼粈涔堥兘涓嶆敼
node scripts/release.mjs --yes       # 鐪熷仛锛歵ag + Release锛堣 GITHUB_TOKEN 鎵嶅缓 Release锛?
node scripts/release.mjs --yes --npm # 鍐嶅姞 npm publish

# 鎵嬪伐鐗堬紙release.mjs 鐢ㄤ笉浜嗘椂锛?
git tag v0.1.8 && git push origin v0.1.8

# 閲嶆柊鎻愬彇 magpie 浜岃繘鍒堕噷鐨勯挬瀛愬绾︼紙鏍稿 HOOKS.md 鐢級
python extract-contract.py [magpie 鍙墽琛屾枃浠禲

# magpie 鍗囩骇鍚庡繀鍋氾細閲嶆柊鎻愬彇 + 鑷姩鎵惧嚭 HOOKS.md 婕忓啓鐨勫瓧娈?
python extract-contract.py && node scripts/contract-diff.mjs
#   閫€鍑虹爜 2 = 鏈夊樊闆嗭紙鍒楀嚭鍓?40 涓級銆傛寫銆屼笉鍐欎細鍏虫帀鏌愪釜鑳藉姏銆嶇殑琛ヨ繘 HOOKS 鍗佷竴涔嬩笁銆?

# 璇ヤ笉璇ヨ窡鐫€ magpie 鍗囩骇鍔ㄨ繖浠芥枃妗ｏ紵**鐪嬬ǔ瀹氭笭閬擄紝涓嶇湅姣忕増鏈笭閬?*
node scripts/check-magpie-stable.mjs
#   0 = 鍩虹嚎灏辨槸褰撳墠绋冲畾鐗堬紝涓嶇敤鍔紱2 = 绋冲畾鐗堝彉浜嗭紝鎸夊畠鎵撳嵃鐨勪笁姝ヨ蛋
#   瑁告煡锛歝url -s "https://usemagpie.ai/api/latest?channel=stable"

# 妯″瀷銆岃鑷繁鑳芥敹鍥俱€嶆槸涓嶆槸鐪熺殑锛熷彂涓€寮犲啓鐫€瀛楃殑鍐呭祵鍥鹃棶瀹冿紝鎸夊洖绛斿垎鍥涚被
#   鍋囧０鏄?= magpie 褰撳畠鑳芥敹鍥俱€佺洿鍙戜笂娓革紝鑰屼笂娓哥瓟銆岀湅涓嶈銆嶆垨鐩存帴鎷掔粷锛堝潙 25锛?
node scripts/probe-vision.mjs                 # 娴嬬綉鍏?/v1/models 閲岀殑姣忎釜妯″瀷
node scripts/probe-vision.mjs --vision-only   # 鍙祴璁剧疆閲岄偅涓瘑鍥炬ā鍨?
node scripts/probe-vision.mjs <provider/model> 鈥?
#   閫€鍑虹爜 2 = 鏈夊亣澹版槑锛涘彧璇绘湰鏈虹綉鍏充笌 settings.json锛屼笉鏀逛换浣曢厤缃?
```

---

## 鍥涖€佷袱涓氦浠橀棬

**闂?1 路 浠ｇ爜浜や粯**锛堢粰鐢ㄦ埛鑳借涔嬪墠锛?

```
鈻?node scripts/check.mjs 閫€鍑虹爜 = 0
鈻?CHECKLIST.md 鐨?A 琛ㄥ叏鍕撅紙check 鑴氭湰鏌ヤ笉鍒扮殑閭ｉ儴鍒嗭級
鈻?浜斾釜 TODO 鐨勮涔夋寜 HOOKS.md 瀵硅繃涓€閬嶏紝涓嶆槸銆岃兘璺戝氨绠椼€?
```

**闂?2 路 鍙戝竷**锛堣銆屽凡鍙戝竷銆嶄箣鍓嶏級

```
鈻?CHECKLIST.md 鐨?B 琛ㄥ叏鍕?
鈻?浜旀潯楠岃瘉閮借窇杩囷紙鍚?check-maintenance.mjs锛夛細npm 鐗堟湰 / tarball 鍐呭 / 鏈満 magpie 璁ゅ緱 / Release 鍦?
```

鈿?**娌¤繃闂?2 涓嶈璇淬€屽凡鍙戝竷銆嶃€?* 鍙?push 杩囧氨璇村凡鍙戝竷锛屾槸鍦ㄧ敤鍗拌薄浠ｆ浛楠岃瘉銆?

---

## 浜斻€侀暱澶т箣鍚庯細浠庡崟鏂囦欢鍒?`src/`

鏈ā鏉垮埢鎰忔槸**鍗曟枃浠跺叆闂?*锛堜節涓挬瀛愪竴灞忚瀹岋紝浜斾釜 TODO 鍦ㄥ簳閮級銆備絾鎻掍欢涓€鏃︽湁鐧诲綍銆?
缂撳瓨銆佸璐﹀彿銆佺鍒扳€﹀氨浼氶暱銆傚洓涓湡瀹炴彃浠剁殑瀹炴祴褰㈡€佹槸杩欐牱锛?

| 浠撳簱 | `index.mjs` | `src/` | `tests/` |
|---|---|---|---|
| 鏈ā鏉?| 558 琛?| 20 鏂囦欢 / 3,716 琛?| 16 |
| `magpie-magicrew-auth` | **86** | 27 鏂囦欢 / 7,773 琛?| 17 |
| `magpie-officeace` | 383 | 8 鏂囦欢 / 1,566 琛?| 2 |
| `magpie-loomy-auth` | 611 | 9 鏂囦欢 / 1,905 琛?| 4 |
| `magpie-today` | 715 | 18 鏂囦欢 / 2,812 琛?| 7 |

缁撹锛?*`index.mjs` 鍙仛瑁呴厤锛屽疄鐜板叏鍦?`src/`** 鈥斺€?鏈€鎴愮啛鐨勯偅涓紙magicrew锛塱ndex 鍙湁 86 琛屻€?

宸茬粡澶囧ソ 21 涓?`src/` 妯″潡锛堝墠鍥涘潡鍥涗釜鎻掍欢閲?4/4 閮芥湁锛沗store` 鍙湁 magicrew 鐙珛鎴愭枃浠讹紝
鍙︿袱涓悇鑷疄鐜颁簡绛変环閫昏緫锛涘叾浣欐槸 2026-10-29锝?0 浠?magicrew / 绀惧尯 MIT 鍖呮娊鍑虹殑閫氱敤鍗忚锛夛細

| 鏂囦欢 | 閲岄潰鍐欎粈涔?| 涓轰粈涔堝崟鐙嫀鍑烘潵 |
|---|---|---|
| [`src/refresh-lock.mjs`](./src/refresh-lock.mjs) | `createRefreshLock` / `run` / `clear` / `sweep` | 涓€娆℃€?refresh_token 鐨勫苟鍙戦椄锛氬悓 key 鍚堝苟銆佹垚鍔熷洖鏀?60 绉掋€佸け璐ュ彲閲嶈瘯锛涢敭蹇呴』鏄嚟鎹韩浠?|
| [`src/oauth-pkce.mjs`](./src/oauth-pkce.mjs) | `generatePkce` / `randomState` / `startLoopback` | OAuth PKCE S256 + 127.0.0.1 loopback锛歴tate/Host 鏍￠獙銆侀敊璇?path 404 涓嶇粨鏉熴€侀敊璇?state 400 鍙噸璇曘€佽秴鏃?abort/close |
| [`src/model-context.mjs`](./src/model-context.mjs) | `createModelContext` / `contextOf` / `clear` / `size` | 鏌?`~/.cache/magpie/models.json` 鐨勭湡瀹炰笂涓嬫枃锛涙煡涓嶅埌杩斿洖 fallback / undefined锛屼笉鐚?|
| [`src/openai-sse.mjs`](./src/openai-sse.mjs) | `parseSse` / `readSseEvents` / `openAIEvents` / `foldOpenAI` | SSE 甯цВ鏋?+ 闈炴祦鎶樺彔锛汣RLF / 澶氳 data / BOM / UTF-8 璺ㄥ潡 / 32 MiB / tool_calls 鍒嗙墖 / usage 甯?|
| [`src/usage-cache.mjs`](./src/usage-cache.mjs) | `createUsageCache` / `read` / `clear` / `publicUsage` / `exhausted` | 棰濆害鍗＄墖棰戠箒鍒锋柊锛氭垚鍔?60 绉?/ 澶辫触 5 绉掋€佸悓 key 骞跺彂鍚堝苟锛涙棤璇绘暟鏃?`exhausted` 蹇呴』鏀捐 |
| [`src/request-rewrite.mjs`](./src/request-rewrite.mjs) | `rewriteJsonBody` / `ensureStreamUsage` / `clampMaxTokens` / `stripModelPrefix` / `stripHopHeaders` | identity 蹇矾寰勶紱鏀?body 鍚庡繀椤诲幓鎺?`content-length` / `content-encoding`锛涘伐鍏?schema 涓嶅姩 |
| [`src/tool-schema.mjs`](./src/tool-schema.mjs) | `truncateToolName` / `truncateToolNames` / `loosenToolSchema` / `adaptToolList` / `rewriteToolSchema` / `createToolSchemaAdapter` | 宸ュ叿鍚嶈秴闀挎埅鏂紙淇濇寔鍞竴锛? 宸ュ叿 schema 鍏煎鏀瑰啓锛坄additionalProperties` 闈炲竷灏斺啋`true`銆佸垹 `items:{}`銆乣items` 瀛愭爲鎽婂钩涓斾笉鐣欑┖ `{}`锛夛紱**榛樿鍏抽棴銆佸彧浣滄樉寮?adapter** 鈥斺€?浼氭斁瀹界敤鎴?schema锛屼笌 `request-rewrite.mjs` 鐨勩€屽伐鍏?schema 缁濅笉鏀广€嶆槸涓ゅ鍙栬垗锛屽埆鍚屾椂鎸?|
| [`src/api.mjs`](./src/api.mjs) | `headersFor` / `read` / `get` / `asModelError` / `asSignInExpired` | 閿欒璇箟鍙湪涓€澶勫畾涔?鈥斺€?401 涓?404 娣风敤浼氭墦姝绘暣涓处鍙?|
| [`src/models.mjs`](./src/models.mjs) | `isUsable` / `priceOf` / `buildModels` / `defaultEntry` | 涓夋€侀檷绾?+ `free` 涓夊垎鏀紝閿欐硶閮介暱寰楀儚銆屾甯搞€?|
| [`src/chat.mjs`](./src/chat.mjs) | `passThrough` / `withUsage` / `singleShotToSSE` / `normalizeUsage` | 娴佸紡涓夊潙锛氳骞叉祦銆佹紡 `include_usage`銆乣stream:false` 涓嶈鎺ュ彈 |
| [`src/store.mjs`](./src/store.mjs) | `fileOf` / `readJson` / `writeJson` + 蹇収 / 鐧诲綍鎬?/ 涓€娆℃€ф爣璁颁笁浠跺 | 鍙啓 `~/.cache/magpie`銆佹枃浠跺悕甯﹁处鍙枫€佸師瀛愬啓銆佸彲鏁寸洰褰曞垹 |
| [`src/quota.mjs`](./src/quota.mjs) | `usageWindow` / `usage` / `toIso` / `QuotaShapeError` | **鎶娿€屽啓閿欎笉鎶ラ敊銆佷絾 GUI 鍜屾櫤鑳借矾鐢变細鍧忋€嶇殑浜旂被绐楀彛鍐欐硶鍙樻垚杩愯鏃堕敊璇?* 鈥斺€?瑙佷笅鏂圭殑琛?|
| [`src/invite.mjs`](./src/invite.mjs) | `createInviteStore` / `inviteHint` / `resolveInvite` / `makeInviteMethod` | 閭€璇风爜鍙兘鍦ㄧ櫥褰?URL 涓婂甫銆佷簨鍚庤ˉ涓嶄簡锛涜€?`prompts` 鏄潤鎬佹暟缁勶紝涓蹭笉璧枫€屽～鐮?鈫?涓荤櫥褰曘€嶁€斺€?鍙湁 `ask()` 鑳?|
| [`src/desktop-import.mjs`](./src/desktop-import.mjs) | `hasDesktopLogin` / `decryptChromiumV10` / `importDesktopLogin` | 鍘傚晢鏈夋闈㈠鎴风鏃讹紝杩欐槸**鍞竴涓嶅脊娴忚鍣?*鐨勭櫥褰曡矾锛汥PAPI + AES-GCM 鐨勮竟鐣岋紙v11/v20 瑙ｄ笉寮€锛夊繀椤诲啓鍦ㄤ唬鐮侀噷 |
| [`src/account-name.mjs`](./src/account-name.mjs) | `maskPhone` / `looksLikeIdentifier` / `accountLabelOf` / `resolveAccountLabel` / `resolveAccount` | 鎹㈢爜鍝嶅簲娌℃湁璐﹀彿鍚?鈬?鍗＄墖鍙兘鏄剧ず銆孲igned in銆嶏紱琛ヤ竴娆?userinfo 灏辫锛屼絾**澶辫触涓嶈兘闃诲鐧诲綍銆佷笉鑳界紪閫?*銆傛墜鏈哄彿锛堝幓鎺夊浗瀹剁爜鍚?鈮?1 浣嶏級涓€寰嬫墦鐮侊紝鐭彿杩斿洖绌轰覆锛涘唴閮?ID锛坄iam::鈥 / URN / uuid / `hw鈥锛?*涓嶈褰撳悕瀛?* 鈥斺€?瀹冧滑杩?`uid`锛屽悕瀛楀彇涓嶅埌灏辨槸绌轰覆 |
| [`src/rotation-captcha.mjs`](./src/rotation-captcha.mjs) | `encodeAngle` / `createRotationCaptcha` / `solveRotationCaptcha` / `createCookieJar` | 銆屾棆杞浘鐗囧姝ｃ€嶇殑楠岃瘉鐮侊細瑙掑害缂栫爜鏄粠鍓嶇鍙嶅嚭鏉ョ殑锛堝疄娴?4 缁勬彁浜ゆ鍚戠┓涓惧敮涓€鍛戒腑锛夛紱`acw_tc` WAF cookie 涓嶅甫鍥炲幓浼氬洖銆屽鎴风淇℃伅涓嶅尮閰嶃€嶏紱鍒よ涓嶅彲淇¤鎹㈠浘鑰屼笉鏄‖鎾?|
| [`src/vision-clock.mjs`](./src/vision-clock.mjs) | `readVisionModel` / `decideDegFromImage` / `clockToDeg` / `clockSpread` | 鐢ㄧ敤鎴疯嚜宸卞湪 magpie 閲岄€夌殑璇嗗浘妯″瀷鍒ゃ€屼富浣撴湞鍑犵偣銆嶏紱涓や釜鍒ゅ畼骞惰 + 鍒嗘闃堝€硷紱`max_tokens` 鏄粰鎺ㄧ悊鐣欑殑锛?00 浼氶タ姝荤瓟妗堬級 |
| [`src/local-browser.mjs`](./src/local-browser.mjs) | `readLocalCreds` / `credsNear` / `leveldbText` | 鐢ㄦ埛鍦ㄨ嚜宸辨祻瑙堝櫒閲岀櫥褰曡繃鏃讹紝鐩存帴璇?localStorage 鐨?leveldb 鈥斺€?涓嶅紑绐椼€佷笉寮规祻瑙堝櫒锛涜法 origin 蹇呴』鎴柇锛屽惁鍒?A 绔?jwt 浼氶厤鍒?B 绔?org |
| [`src/browser-login.mjs`](./src/browser-login.mjs) | `browserCandidates` / `findBrowser` / `chromiumLogin` / `selectCookies` | 闇€瑕佺敤鎴峰湪缃戦〉閲岀櫥褰曟椂锛屽紑涓€涓竴娆℃€?Chromium profile 浠?CDP 鍙?Cookie锛涘浗浜ф祻瑙堝櫒涔熻瑕嗙洊锛學indows 娉ㄥ唽琛?App Paths 浼樺厛 |
| [`src/tempmail-client.mjs`](./src/tempmail-client.mjs) | `createTempMailbox` / `waitTempCode` | 閭楠岃瘉鐮佽嚜鍔ㄧ櫥褰曠殑涓€娆℃€у湴鍧€锛涘煙鍚嶆湁榛戝悕鍗曪紙`maxxspace.com` 琚?magicrew 鎷掞級锛屾崲鍘傚晢鍏堢敤鐪熷疄璇锋眰纭 |
| [`tests/semantics.test.mjs`](./tests/semantics.test.mjs) | 璇箟閿侊紙鍚搴︾獥鍙?/ accountId 瑙勫垯锛?| `check.mjs` 鏌ヤ笉鍒扮殑閭ｉ儴鍒嗭紝鍙湁瀹冭兘鎷?|
| [`tests/mount.test.mjs`](./tests/mount.test.mjs) | 鍏ュ彛鍞竴鍑芥暟瀵煎嚭 / 涔濋挬瀛?/ config 妯″瀷 / loader / usage 褰㈢姸 | 妯″潡娴嬭瘯鍏ㄧ豢涔熸嫤涓嶄綇銆宨ndex 鏀瑰潖浜嗐€?|

**涓轰粈涔?`src/quota.mjs` 鍊煎緱鍗曠嫭涓€涓枃浠?*锛氶搴︾獥鍙ｆ槸 magpie **鐢诲崱鐗?*鍜?*鏅鸿兘璺敱鎺掑簭**鐨勫悓涓€涓緭鍏ャ€?
鍐欓敊涓嶄細宕╋紝鍙細璁╁崱鐗囨樉绀恒€屽墿浣欓搴︽湭鐭ャ€嶃€佽杩欎釜鍙峰湪璺敱閲岃褰撴垚涓嶅瓨鍦?鈥斺€?鐢ㄦ埛浠ヤ负鎻掍欢鍧忎簡锛?
鎻掍欢浣滆€呭湪鏃ュ織閲屼粈涔堥兘鐪嬩笉鍒般€傝繖涓瀯閫犲櫒鎶婁簲绫诲啓娉曠洿鎺ュ彉鎴?throw锛?

| 鍐欐硶 | 涓嶆嫤鐨勫悗鏋?| 鏋勯€犲櫒鐨勮涓?|
|---|---|---|
| 缂?`used`锛堜笖娌℃湁 amount/limit锛?| 绐楀彛鍒ゆ垚 `Text`锛?*璺敱涓嶈鍏?* 鈬?涓€鏉′笉鍓╂椂璇ュ彿鍦ㄨ矾鐢遍噷涓嶅瓨鍦紙鍧?24锛?| 鎶涳紝瑕?text-only 蹇呴』鏄惧紡 `textOnly: true` |
| `aside: true` 鍙堢粰 `amount`/`limit` | 鍒嗘瘝灏辨槸浣欓鏈韩锛岀畻鍑烘潵姘歌繙銆屽墿浣?100%銆嶁€斺€?鐪嬬潃婕備寒銆佸惈涔夋槸閿欑殑 | 鎶?|
| 閽卞寘鍨嬶紙`balance`锛夊張缁?`used` | 琚綋鍗犳瘮璇伙紝浣欓鏄剧ず閿?| 鎶?|
| `resetsAt` 濉炲巶鍟嗗師鏍锋椂闂?| 瑙ｆ瀽澶辫触锛屾暣鏉＄獥鍙ｈ涓㈡帀锛堝潙 22锛?| 鎶?|
| 鎵€鏈夌獥鍙ｉ兘鏄?`aside` / `textOnly` | 璺敱涓€鏉￠兘涓嶈 鈬?杩欎釜鍙峰湪璺敱椤点€屽墿浣欓搴︽湭鐭ャ€嶄笖鎺掑湪宸茬煡璐﹀彿涔嬪悗 | `usage()` 鎶?|
| `span` 涓嶆槸姝ｆ暣鏁?| 绐楀彛闀垮害绠楅敊锛岄噸缃椂闂存樉绀轰贡 | 鎶?|

**鎷嗗垎绀轰緥**锛歔`examples/split/`](./examples/split/) 鎶娿€宨ndex 鍙閰嶃€嶈繖浠朵簨鎽嗕簡涓€閬?
锛堜笁涓挬瀛愬悇鍗犱竴涓枃浠?+ 涓€涓?40 琛岀殑 index锛夈€傞挬瀛愬彧鏈変笁绉嶅舰鎬侊紝鍏朵綑浜斾釜鐓у悓涓€瑙勫垯鎼€?

**浠€涔堟椂鍊欒鎼?*锛堝嚭鐜颁换涓€鎯呭舰灏辨惉锛屽埆绛夛級锛?

- 鏌愪釜閽╁瓙鍑芥暟瓒呰繃 60 琛岋紝鎴栧悓涓€涓?`fetch` 鍦ㄤ笁涓挬瀛愰噷閲嶅鍑虹幇 鈫?鎶?`src/api.mjs`
- 闇€瑕佸湪涓ゆ璋冪敤涔嬮棿璁颁綇涓滆タ锛坱oken銆佸揩鐓с€佸綋澶╁仛杩囩殑鏍囪锛夆啋 鍔?`src/store.mjs`锛?
  **鏂囦欢鍚嶉噷蹇呴』甯﹁处鍙?*锛堝潙 16锛?
- 寮€濮嬫湁绗簩涓处鍙疯繘鏉?鈫?鍏堟煡鏈夋病鏈夋ā鍧楃骇鍙橀噺鍦ㄥ瓨 per-account 鐘舵€?

---

## 鍏€佹枃妗ｅ湴鍥?

| 鏂囦欢 | 绠′粈涔?| 浠€涔堟椂鍊欒 |
|---|---|---|
| [GUIDE](./GUIDE.md) | **璇存槑涔︿富绾?*锛?0 鍒嗛挓锛屾嬁妯℃澘 鈫?鏀硅韩浠?鈫?config 鈫?auth 鈫?models 鈫?usage/checkin 鈫?鑷 鈫?鎵撳垎 鈫?鍙戝竷 | **绗竴娆″仛鎻掍欢鏃讹紝浠庡ご璇?* |
| [OFFICIAL-SOURCES](./OFFICIAL-SOURCES.md) | **瀹樻柟 22 涓敋鐐?鈫?鏈粨搴撶殑鏄犲皠**锛涙瘡鏉＄粨璁虹殑瀹樻柟鍑哄 + 鐗堟湰鍩虹嚎 + 鎴戜滑琛ョ殑 8 鏉?| 鎯崇煡閬撱€岃繖鏉¤鐭╁畼鏂规湁娌℃湁鍐欍€嶆椂 |
| [SCORING](./SCORING.md) | 100 鍒嗘€庝箞绠椼€?0 鍒嗗崱鍦ㄥ摢銆乣node scripts/score.mjs` | 浜や粯鍓嶈嚜璇勬椂 |
| [README](./README.md) | 杩欎釜妯℃澘鐨勮璁″師鍒欙細鏈€灏忎氦浠橀潰銆佷節椤规竻鍗曘€佷笁鏉￠搧寰嬨€佸父瑙佸潙 | 寮€宸ュ墠 |
| [HOOKS.md](./HOOKS.md) | 21 绔犻挬瀛愬绾︼紙**瀛楁绾?*锛氬皯鍐?鍐欓敊浼氭€庢牱銆傚畼鏂规枃妗ｈ琛屼负锛屼袱鑰呭苟鐢紱`auth.checkin` 宸蹭簬 v0.1.1582 琛ヨ繘瀹樻柟鏂囨。锛?| 鍐欎唬鐮佹椂鎸夐挬瀛愭煡 |
| [MULTI-PROVIDER.md](./MULTI-PROVIDER.md) | 涓€涓寘涓や釜渚涘簲鍟嗭紙鍥藉唴/鍥介檯锛夛細鍒ゆ嵁銆侀鏋躲€佷簲鏉￠搧寰?| 鍙湁澶氱珯鐐规椂 |
| [UPDATING.md](./UPDATING.md) | 鍔熻兘鍒嗘敮 + PR + `rules` 闂ㄧ銆佽繘 main 鍚庣殑鍙楁帶鍙戝竷銆佺敤鎴锋€庝箞鎷垮埌 | **姣忔鍙戝竷鍓?* |
| [README-TEMPLATE.md](./README-TEMPLATE.md) | 鎻掍欢浠嬬粛椤垫ā鏉匡紙鐢ㄦ埛鍙湅瀹冨喅瀹氳涓嶈锛?| 鍐?README 鏃?|
| [CHECKLIST.md](./CHECKLIST.md) | 涓ゅ紶鍕鹃€夎〃锛氫氦浠樺墠 / 鍙戠増鍓?| 涓や釜浜や粯闂?|
| [CHANGELOG.md](./CHANGELOG.md) | 鏈ā鏉胯嚜宸辩殑鏇存柊璁板綍锛堟牸寮忓嵆鑼冧緥锛?| 鎵俱€屼负浠€涔堣繖鏍锋敼銆?|

---

## 涓冦€佽繖浠芥枃浠剁殑缁存姢瑙勭煩

1. **浠讳綍涓€浠戒笓妗ｆ柊澧?鏀瑰啓涓€鏉°€屼細闈欓粯鍑洪敊銆嶇殑缁撹锛屽氨鍦ㄧ浜岃妭鍔犱竴琛?*锛堢棁鐘?鈫?鍒ゆ嵁 鈫?鍑哄锛夈€?
   涓嶅姞鐨勫悗鏋滐細杩欎唤琛ㄤ細鎱㈡參杩囨湡锛岃€?AI 浼氱収鏍蜂俊瀹冦€?
2. 绗簩鑺傚彧鏀句竴鍙ヨ瘽鍒ゆ嵁锛?*璁鸿瘉鐣欏湪鍑哄閭ｄ竴浠?*銆傚埆鍦ㄨ繖閲屽鍒堕暱娈佃惤 鈥斺€?涓や唤浼氭墦鏋躲€?
3. 鏂板涓€浠芥枃妗ｏ紝灏辫鍦ㄧ浜旇妭鍔犱竴琛岋紝骞惰鏄庛€屼粈涔堟椂鍊欒銆嶃€?
4. 鍒ゆ嵁瑕佽兘**褰撳満楠岃瘉**锛堣兘璺戠殑鍛戒护銆佽兘鐪嬬殑瀛楁锛夈€傚啓涓嶆垚鍒ゆ嵁鐨勶紝鏄劅鎯筹紝涓嶆槸瑙勭煩銆?
