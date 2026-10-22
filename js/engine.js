/* ============================================================
 * Today · 规则型 Demo Engine v0.3
 * v0.3 原则：用户负责确认事实，系统负责整理和表达。
 *  - proposeFragments(rawText)：拆句 → 挑 2~4 个片段（只预填原文明确写出的钟点）
 *  - buildReplay(rawText, fragments, opts)：从「用户确认过的片段」组装回放
 *  - 时间：只有用户确认了才显示；原文只写时段词（早上等）→ 不预填
 *  - 情绪：多来源输入（片段情绪 + user_mood_hint），只输出一套 emotion_curve
 *  - 关键词路由仅决定视觉素材（9 类），不生成文字内容
 * 注意：这是规则型 Demo，不是真实模型调用。
 * ============================================================ */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var _schema = null;
  function S() { if (!_schema) _schema = Today.schema; return _schema; }

  /* ---------------- 中文数字 ---------------- */
  var CN_DIGITS = { '零': 0, '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  var NUM_RE = '[0-9一两二三四五六七八九十]{1,3}';
  function cnNum(str) {
    str = String(str).trim();
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    if (str === '十') return 10;
    if (str.length === 1) return CN_DIGITS[str];
    if (str.length === 2 && str[0] === '十') return 10 + (CN_DIGITS[str[1]] || 0);
    if (str.length === 2 && str[1] === '十') return (CN_DIGITS[str[0]] || 0) * 10;
    if (str.length === 3 && str[1] === '十') return (CN_DIGITS[str[0]] || 0) * 10 + (CN_DIGITS[str[2]] || 0);
    return null;
  }

  /* ---------------- 分句 ---------------- */
  var PERIODS = '凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|深夜|夜里|夜里头';
  function splitClauses(text) {
    var raw = String(text || '').split(/[,，。;；!！?？\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (raw.length === 0 && String(text || '').trim()) raw = [String(text).trim()];
    /* 超长单句（无标点）按 ~24 字回退切一刀 */
    var out = [];
    raw.forEach(function (c) {
      if (c.length > 46) {
        out.push(c.slice(0, Math.ceil(c.length / 2)), c.slice(Math.ceil(c.length / 2)));
      } else out.push(c);
    });
    /* 单长句（≥20 字、无标点）从中间切一刀，保证可拆出 2 个片段 */
    if (out.length === 1 && out[0].length >= 20) {
      var cut = Math.ceil(out[0].length / 2);
      out = [out[0].slice(0, cut), out[0].slice(cut)];
    }
    return out;
  }

  /* ---------------- 钟点解析（仅明确钟点，用于预填） ---------------- */
  function parseExplicitClock(text) {
    text = String(text || '');
    var m = text.match(new RegExp('(' + PERIODS + ')\\s*(' + NUM_RE + ')\\s*(点半钟|点半|半钟|半|点\\s*[:：]\\d{2}|点|[:：]\\d{2})'))
      || text.match(new RegExp('(' + PERIODS + ')\\s*(\\d{1,2})[:：](\\d{2})'))
      || text.match(/(\d{1,2})[:：](\d{2})/);
    if (!m) return null;
    var seg = null, h = null, min = 0;
    if (new RegExp('^(' + PERIODS + ')$').test(m[1])) {
      seg = m[1]; h = cnNum(m[2]);
      var tail = m[3] || '';
      if (/半/.test(tail)) min = 30;
      else if (/^[:：]/.test(tail)) min = parseInt(tail.slice(1), 10) || 0;
    } else if (/^\d/.test(m[1])) {
      h = parseInt(m[1], 10); min = parseInt(m[2], 10) || 0;
      if (h > 23 || min > 59) return null;
      return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    } else return null;
    if (h == null || h < 0 || h > 12) return null;
    if (/下午|傍晚|晚上|深夜|夜里/.test(seg) && h < 12) h += 12;
    if (seg === '中午' && h >= 1 && h <= 2) h += 12;
    if (h > 23 || min > 59) return null;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }
  function stripTimePhrases(text) {
    return String(text || '')
      .replace(new RegExp('(' + PERIODS + ')\\s*(' + NUM_RE + ')\\s*(点半钟|点半|半钟|半|点\\s*[:：]\\d{2}|点|[:：]\\d{2})', 'g'), '')
      .replace(/(\d{1,2})[:：](\d{2})/g, '')
      .replace(new RegExp('^\\s*(' + PERIODS + ')\\s*'), '')
      .replace(/^(现在才|现在是?|现在已经|都已经?|才|就)[，,]?\s*/, '')
      .replace(/^[\s,，然后接着后来而且并并且但也]+/, '')
      .trim();
  }

  /* ---------------- 情绪词表 ---------------- */
  var EMOTION_WORDS = [
    [/不太好吃|没有想象中|不太合口|有点油|有点腻/, '失落'],
    [/慌|赶不上|差点迟到|手忙脚乱/, '慌乱'],
    [/紧张|忐忑|心慌/, '紧张'],
    [/烦|躁|郁闷|堵得慌/, '烦躁'],
    [/挫败|没回答好|没做好|搞砸|失误|又被|批评/, '挫败'],
    [/失落|难过|伤心|哭/, '难过'],
    [/委屈|不甘/, '委屈'],
    [/累|疲惫|困|撑不住|熬/, '疲惫'],
    [/饿/, '饿'],
    [/开心|高兴|喜欢|好喝|好吃|惊喜|幸运/, '开心'],
    [/满足|值得|圆满|舒服|顺/, '满足'],
    [/轻松|放松|透气|舒服的风|治愈/, '轻松'],
    [/踏实|安心|放心|完成了|弄完|搞定了|做完了/, '踏实'],
    [/平静|安静|平静下来/, '平静']
  ];
  function detectEmotion(text) {
    for (var i = 0; i < EMOTION_WORDS.length; i++) {
      if (EMOTION_WORDS[i][0].test(text)) return EMOTION_WORDS[i][1];
    }
    return null;
  }
  function valence(label) {
    if (/慌乱|紧张|烦躁|挫败|难过|委屈|烦闷|失落|低落|无奈|饿|困|累|疲惫/.test(label)) return -1;
    if (/开心|满足|轻松|踏实|安心|愉快|温暖|期待|惊喜|还不错|不错/.test(label)) return 1;
    return 0;
  }
  function shiftAfter(label) { return valence(label) >= 0 ? '平静' : '缓和'; }

  /* ---------------- 关键词路由（仅视觉素材） ---------------- */
  var ROUTES = [
    ['commute', /地铁|通勤|赶车|公交|班车|打车|骑车|开车|堵车|高铁|火车|飞机|赶路|迟到/],
    ['work', /上班|工作|开会|汇报|方案|加班|同事|老板|项目|需求|代码|debug|改bug|工位|面试|笔试/],
    ['food', /吃|饭|早午餐|午餐|晚餐|早饭|晚饭|外卖|奶茶|咖啡|拿铁|麻辣拌|面|火锅|烧烤|烘焙|做饭|下厨|菜/],
    ['walk', /散步|走走|遛弯|透气|晃悠|步行|溜达/],
    ['home', /回家|到家|屋里|宿舍|公寓|躺着|躺平|窝在/],
    ['night', /睡前|洗漱|晚安|夜宵|深夜|凌晨|熬夜|入睡|睡/],
    ['study', /自习|学习|看书|读书|书|课|上课|复习|简历|刷题|笔记|考试|作业|写完|图书馆/],
    ['city', /街|商场|超市|市中心|城市|出门|外出|逛街|晚霞|日落|天空|路上/]
  ];
  function routeImage(text) {
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i][1].test(text)) return ROUTES[i][0];
    return 'generic';
  }

  /* ---------------- 片段标题 / 旁白模板 ---------------- */
  var TITLE_BANK = [
    [/差点迟到|赶不上|匆忙/, '匆忙开始'],
    [/饿/, '饿意来得有点早'],
    [/困/, '困意突然来了'],
    [/汇报|面试|笔试/, '有一个没准备好的瞬间'],
    [/改简历|简历/, '改简历的时间'],
    [/看书|读书|自习/, '留给自己的一点时间'],
    [/吃了|吃了顿|下馆子/, '一顿饭的时间'],
    [/散步|走走|遛弯/, '出门走走'],
    [/晚霞|日落/, '今天的晚霞'],
    [/咖啡|拿铁|奶茶/, '一杯小小的奖励'],
    [/任务|作业|方案/, '把它做完了'],
    [/上课|一整天课/, '满满的一天课']
  ];
  function fragmentTitle(event, emotion) {
    for (var i = 0; i < TITLE_BANK.length; i++) if (TITLE_BANK[i][0].test(event)) return TITLE_BANK[i][1];
    var clean = event.replace(/^(然后|接着|还|也|又|后来|最后|但是|但|而且)[，,]?\s*/, '');
    if (clean.length <= 8) return clean;
    return clean.slice(0, 7);
  }
  function captionFor(event, emotion) {
    var v = valence(emotion);
    if (v < 0) {
      if (/饿/.test(event)) return '还没到饭点，肚子已经先发出了提醒。';
      if (/困|累|疲惫/.test(event)) return '身体的电量，在这里降到了最低。';
      if (/迟到|赶不上/.test(event)) return '一天从一点慌乱开始。';
      return '这个瞬间，让今天的节奏乱了半拍。';
    }
    if (v > 0) {
      if (/晚霞|日落|天空/.test(event)) return '停下来看了很久，很值得。';
      if (/吃|喝|咖啡|奶茶/.test(event)) return '小小的心愿，今天实现了。';
      if (/完成|弄完|做完|改完/.test(event)) return '事情落定的那一刻，心情也落了地。';
      return '想起来还是觉得不错的一个瞬间。';
    }
    return '安安静静发生的一小段。';
  }

  /* ---------------- 子句合并（时间引导句→下句，评语句→上句） ---------------- */
  var QUALIFIER_RE = /^(有点|不太|挺|很|太|好|特别|超|蛮|但是|但|感觉)/;
  var TIMELEAD_RE = /^(现在才|现在是?|现在已经|都已经?|都)/;
  function mergeClauses(clauses) {
    var out = [];
    clauses.forEach(function (c) {
      var stripped = stripTimePhrases(c);
      var isQual = QUALIFIER_RE.test(c) && stripped.length < 8 && stripped.length > 0;
      var isTimeLead = TIMELEAD_RE.test(c) && stripped.replace(/[，,]/g, '').length < 5;
      if (isTimeLead) {
        out.push({ text: c, pend: true });
      } else if (isQual && out.length) {
        var last = out[out.length - 1];
        last.text = last.text + '，' + c;
      } else if (isQual && !out.length && clauses.length > 1) {
        out.push({ text: c, pend: true });
      } else {
        if (out.length && out[out.length - 1].pend) {
          var pd = out.pop();
          out.push({ text: pd.text + '，' + c });
        } else out.push({ text: c });
      }
    });
    var res = [];
    out.forEach(function (o) {
      if (o.pend && res.length) res[res.length - 1] = res[res.length - 1] + '，' + o.text;
      else res.push(o.text);
    });
    return res.filter(Boolean);
  }

  /* ---------------- 片段提案 ---------------- */
  function infoScore(clause) {
    var s = 0;
    if (clause.length >= 6) s += 2;
    if (clause.length >= 14) s += 1;
    ROUTES.forEach(function (r) { if (r[1].test(clause)) s += 2; });
    if (detectEmotion(clause)) s += 2;
    if (/^(然后|接着|还|也|又|后来|最后|但是|但)/.test(clause)) s += 1;
    return s;
  }
  function proposeFragments(rawText) {
    var clauses = mergeClauses(splitClauses(rawText));
    if (!clauses.length) return [];
    var scored = clauses.map(function (c, i) { return { c: c, i: i, s: infoScore(c) }; });
    var want = Math.min(scored.length, Math.max(2, Math.min(3, scored.length)));
    var picked = scored.slice().sort(function (a, b) { return b.s - a.s || a.i - b.i; }).slice(0, want)
      .sort(function (a, b) { return a.i - b.i; });

    /* §12 冻结规则：收敛 Scene 数量可以合并事实，但不得删除原始细节。
       未入选的子句并入「最近的已选片段」（距离相等时优先并入后一个），细节和时间随文本一起带过去。 */
    var pickedIdx = {};
    picked.forEach(function (p) { pickedIdx[p.i] = true; });
    scored.filter(function (s) { return !pickedIdx[s.i]; })
      .sort(function (a, b) { return a.i - b.i; })
      .forEach(function (u) {
        var ev = stripTimePhrases(u.c) || u.c;
        if (!ev || ev.replace(/[，,]/g, '').length < 2) return;
        var after = null, before = null;
        picked.forEach(function (p) {
          if (p.i > u.i && (!after || p.i < after.i)) after = p;
          if (p.i < u.i && (!before || p.i > before.i)) before = p;
        });
        var target = (after && (!before || after.i - u.i <= u.i - before.i)) ? after : before;
        if (!target) return;
        target.c = (target === after) ? ev + '，' + target.c : target.c + '，' + ev;
      });

    var frags = picked.map(function (p) {
      var ev = stripTimePhrases(p.c) || p.c;
      return { event: ev, time: parseExplicitClock(p.c) };
    });
    /* 剥离时间后的残句（<3 字）并入相邻片段——只合并，绝不丢弃（§12） */
    var out = [];
    frags.forEach(function (f) {
      var isStub = f.event.replace(/[，,、\s]/g, '').length < 3;
      if (!isStub) {
        if (out.length && out[out.length - 1]._stub) {
          var st = out.pop();
          out.push({ event: st.event + '，' + f.event, time: st.time || f.time });
        } else out.push({ event: f.event, time: f.time });
      } else if (out.length && !out[out.length - 1]._stub) {
        var prev = out[out.length - 1];
        prev.event = prev.event + '，' + f.event;
        if (f.time && !prev.time) prev.time = f.time;
      } else {
        out.push({ event: f.event, time: f.time, _stub: true });
      }
    });
    if (out.length > 1 && out[out.length - 1]._stub) {
      var lastS = out.pop();
      out[out.length - 1].event += '，' + lastS.event;
      if (lastS.time && !out[out.length - 1].time) out[out.length - 1].time = lastS.time;
    }
    return out;
  }

  /* ---------------- 情绪统一输出 ---------------- */
  function unifyCurve(emotions, hint) {
    var arr = emotions.filter(Boolean).slice();
    if (!arr.length) arr = ['如常'];
    if (hint && hint.label) {
      var lab = hint.label;
      if (arr.indexOf(lab) === -1) {
        var hv = valence(lab), replaced = false;
        for (var k = arr.length - 2; k >= 1; k--) {       /* 同极性的中间节点 → 被用户信号替换 */
          if (valence(arr[k]) === hv) { arr[k] = lab; replaced = true; break; }
        }
        if (!replaced && valence(arr[0]) === hv && arr.length >= 2) { arr[0] = lab; replaced = true; }
        if (!replaced) {
          if (hv <= valence(arr[arr.length - 1])) arr.push(lab);
          else arr.splice(arr.length - 1, 0, lab);
        }
      }
    }
    /* 去重（保留首次出现）+ 截断 4 */
    var uniq = [];
    arr.forEach(function (e) { if (uniq.indexOf(e) === -1) uniq.push(e); });
    if (uniq.length > 4) uniq = uniq.slice(0, 4);
    if (uniq.length === 1) uniq.push(shiftAfter(uniq[0]));
    return uniq.map(function (e) { return { emoji: S().emojiFor(e), label: e }; });
  }

  /* ---------------- 封面标题 ---------------- */
  var RE_COMPLETION = /(总算|终于|最后|还是|顺利)[^，。]{0,10}(完成|弄完|搞定|做完|写完|改完|交上|提交)/;
  var GENERIC_VERBS = /^(吃了|吃|回家|到家|回来|出去|睡|走)/;
  var NOUN_BANK = /赶地铁|地铁|通勤|汇报|面试|笔试|自习|图书馆|简历|上课|课程|课|方案|任务|作业|散了会儿步|散步|晚霞|日落|咖啡|拿铁|奶茶|看书|读书|吃饭|做饭|健身房|跑步|加班|开会/;
  function eventWord(frag) {
    var ev = String(frag.event || '');
    var m = ev.match(NOUN_BANK);
    if (m) return m[0];
    m = ev.match(/([\u4e00-\u9fa5]{2,4})(?:的时候|的瞬间|时|中)/);
    if (m && !GENERIC_VERBS.test(m[1])) return m[1];
    m = ev.replace(/^(然后|接着|还|也|又|后来|最后|但是|但|而且)[，,]?\s*/, '').match(/^([\u4e00-\u9fa5]{2,4})/);
    if (m && !GENERIC_VERBS.test(m[1])) return m[1];
    return null;
  }
  function coverTitle(scenes, curve, rawText) {
    var text = String(rawText || '').trim();
    var hasFeeling = /(压力|焦虑|难过|难受|伤心|失落|烦躁|疲惫|有点累|很累|紧张|忐忑|孤单|委屈|想家|想念|开心|高兴|平静|安心|不安|心情|感觉|觉得)/.test(text);
    var hasAction = /(上课|学习|工作|开会|汇报|面试|投递|修改|写|做|完成|去|回家|出门|散步|走|跑|吃|喝|洗|看|读|听|聊|见|遇见|买|拍照|旅行|休息|睡|玩|逛|锻炼|健身)/.test(text);
    if (hasFeeling && !hasAction) {
      var statedFeeling = text.match(/低落|难过|失落|烦躁|疲惫|有点累|很累|紧张|忐忑|孤单|委屈|想家|开心|高兴|平静|安心|不安/);
      return '写下此刻的' + (statedFeeling ? statedFeeling[0] : '感受');
    }
    var facts = (scenes || []).filter(function (scene) { return scene && scene.event; });
    function phrase(scene) {
      if (/^([\u4e00-\u9fa5])\1+$/.test(String(scene.event).trim())) return '';
      var sceneTitle = sceneTitleFor(scene.event, scene.time);
      if (sceneTitle && sceneTitle !== '这一段记忆') return sceneTitle;
      var word = eventWord(scene);
      if (word && word.length >= 2) return word;
      return String(scene.event).replace(/^(今天|早上|上午|中午|下午|傍晚|晚上|后来|最后)[，,\s]*/, '')
        .replace(/[。！？!?].*$/, '').slice(0, 12);
    }
    if (!facts.length) return '记下此刻的一页';
    var first = phrase(facts[0]);
    var last = phrase(facts[facts.length - 1]);
    if (facts.length === 1 || first === last) return first.length >= 2 ? first + '的那一页' : '记下此刻的一页';
    return (first + '与' + last).slice(0, 20);
  }
  function isOldCoverTemplate(title) {
    return /^从.+开始的一天$/.test(title) || /^从.+到.+的一天$/.test(title) ||
      /^(今天，留下了一件事|今天留下来的几段时光|今天，也值得被记下来)$/.test(title);
  }
  function chooseCoverTitle(title, scenes, curve, rawText) {
    var candidate = String(title || '').trim();
    return candidate && !isOldCoverTemplate(candidate) ? candidate : coverTitle(scenes, curve, rawText);
  }
  function coverTitleForReplay(replay) {
    replay = replay || {};
    return chooseCoverTitle(replay.title, replay.scenes, replay.emotion_curve,
      replay.raw_text || (replay.raw_memory && replay.raw_memory.raw_text));
  }
  function curveSummary(curve) {
    var f = curve[0].label, l = curve[curve.length - 1].label;
    if (valence(f) < 0 && valence(l) > 0) return '从一点' + f + '，到最后慢慢' + l + '下来。';
    if (valence(f) > 0 && valence(l) > 0) return '一整天都挺不错的，值得留下。';
    if (valence(f) < 0 && valence(l) < 0) return '有点辛苦的一天，也被记下来了。';
    return '平平静静，也有值得记住的瞬间。';
  }
  function factSummary(scenes) {
    var facts = (scenes || []).map(function (scene) { return String(scene.event || '').replace(/[。！？!?]+$/, '').trim(); }).filter(Boolean);
    if (!facts.length) return '';
    if (facts.length === 1) return '这一页留住了「' + facts[0] + '」。它是回看这一天时最具体的坐标。';
    var middle = facts.length > 2 ? '，中间还有「' + facts[Math.floor(facts.length / 2)] + '」' : '';
    return '从「' + facts[0] + '」到「' + facts[facts.length - 1] + '」' + middle + '。一天的路径，就留在这些具体经历里。';
  }

  /* ---------------- 组装回放 ---------------- */

  /* ---------------- v0.4 标题/文案质量规则 ---------------- */
  var PERIOD_BANDS = [[0, '深夜'], [5, '清晨'], [7, '早上'], [9, '上午'], [12, '中午'], [14, '下午'], [17, '傍晚'], [19, '晚上']];
  var CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三'];
  function periodWordOf(hh) {
    var w = '白天';
    for (var i = 0; i < PERIOD_BANDS.length; i++) if (hh >= PERIOD_BANDS[i][0]) w = PERIOD_BANDS[i][1];
    return w;
  }
  function timeWordCn(t) {
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return '';
    var ci = t.indexOf(':');
    var hh = parseInt(t.slice(0, ci), 10), mm = parseInt(t.slice(ci + 1), 10);
    var h12 = hh % 12 === 0 ? 12 : hh % 12;
    var num = CN_NUM[h12] || String(h12);
    var w = periodWordOf(hh) + num;
    if (mm === 0) return w + '点';
    if (mm === 30) return w + '点半';
    return w + '点过';
  }
  function validateReplayTitle(t) {
    if (!t || typeof t !== 'string') return false;
    var v = t.trim();
    if (v.length < 4 || v.length > 20) return false;
    if (/今天.*(早上|上午|下午|晚上|中午|今晚|清晨|凌晨|深夜).*的一天/.test(v)) return false;
    if (/^(今天|早上|上午|下午|晚上|中午|今晚|清晨|凌晨|深夜)的一天$/.test(v)) return false;
    if (/^(普通|平凡|忙碌|充实|一般|安静|平常)的一天$/.test(v)) return false;
    var stripped = v.replace(/[，、\s]/g, '');
    if (/^(今天|早上|上午|下午|晚上|中午|凌晨|清晨|今晚|深夜)+$/.test(stripped)) return false;
    return true;
  }
  var DRINK_NOUN = /^(咖啡|拿铁|奶茶|茶|豆浆|柠檬水|热可可)$/;
  function sceneTitleFor(ev, timeStr) {
    ev = String(ev || '');
    if (/上了一整天课/.test(ev)) return '一整天的课';
    if (/(睡前|夜里).*(楼下|散步|走了一段|走了一小段)/.test(ev)) return /楼下/.test(ev) ? '睡前楼下那段路' : '睡前走的那段路';
    if (/泡.{0,4}茶.*任务.*(写完|完成|做完)/.test(ev)) return '茶与写完的任务';
    if (/任务.*(写完|完成|做完)/.test(ev)) return '写完的任务';
    var classTime = ev.match(/(上午|下午|晚上|早上).*上课/);
    if (classTime) return classTime[1] + '的课';
    var walkTime = ev.match(/(上午|下午|晚上|早上).*散步/);
    if (walkTime) return walkTime[1] + '的散步';
    var noun = eventWord({ event: ev });
    if (noun && /^([\u4e00-\u9fa5])\1+$/.test(noun)) noun = null;
    if (noun === '课') noun = '那堂课';
    var per = '';
    if (timeStr && /^\d{1,2}:\d{2}$/.test(String(timeStr))) per = periodWordOf(parseInt(String(timeStr).slice(0, 2), 10));
    if (noun && DRINK_NOUN.test(noun)) return '那杯' + noun;
    if (noun && per) return per + ' · ' + noun;
    if (noun) return noun;
    var action = ev.replace(/^(今天|早上|上午|中午|下午|傍晚|晚上|后来|最后)[，,\s]*/, '').replace(/[。！？!?]+$/, '').trim();
    return action.length >= 2 && action.length <= 13 ? action : '这一段记忆';
  }
  function captionFor(ev, timeStr, isDone) {
    var body = String(ev || '').replace(/[。！？!?…\s]+$/, '');
    var head = timeWordCn(timeStr);
    if (/^(今天|早上|上午|中午|下午|傍晚|晚上|夜里|凌晨)/.test(body)) head = '';
    return (head ? head + '，' : '') + body + '。';
  }

  function buildReplay(rawText, fragments, opts) {
    opts = opts || {};
    rawText = String(rawText == null ? '' : rawText);
    fragments = (fragments || []).filter(function (f) { return f && f.event && String(f.event).trim(); });
    if (fragments.length < 1) return fallbackReplay(rawText, opts);

    var emotions = [];
    var scenes = fragments.map(function (f, i) {
      var event = String(f.event).trim();
      var usePreset = f.preset && f.preset._for === event;
      var emotion = usePreset && f.preset.emotion ? f.preset.emotion
        : (detectEmotion(event) || detectEmotion(rawText) || (opts.userMoodHint && valence(opts.userMoodHint.label) < 0 ? opts.userMoodHint.label : null) || '平静');
      emotions.push(emotion);
      return {
        id: 'scene_' + (i + 1),
        event: event,
        time: S().normTime(f.time),
        title: usePreset && f.preset.title ? f.preset.title : null,
        caption: usePreset && f.preset.caption ? f.preset.caption : null,
        photo_id: f.photo_id ? String(f.photo_id) : null,
        image_key: usePreset && f.preset.image_key ? f.preset.image_key : routeImage(event)
      };
    });

    /* v0.4：事实锚定文案——preset 优先，其余规则生成（事件原文必须进入 Caption） */
    var doneAll = RE_COMPLETION.test(rawText);
    scenes.forEach(function (sc, si) {
      if (!sc.title) sc.title = sceneTitleFor(sc.event, sc.time);
      if (!sc.caption) sc.caption = captionFor(sc.event, sc.time, doneAll && si === scenes.length - 1);
    });

    /* 完成态：全文出现「总算…完成」→ 末幕情绪落踏实 */
    if (RE_COMPLETION.test(rawText)) {
      var li = emotions.length - 1;
      if (valence(emotions[li]) <= 0) emotions[li] = '踏实';
    }

    var curve = unifyCurve(emotions, opts.userMoodHint);
    var replay = S().createDailyReplay({
      date: opts.date,
      title: chooseCoverTitle(opts.title, scenes, curve, rawText),
      raw_text: rawText,
      user_mood_hint: opts.userMoodHint,
      emotion_curve: curve,
      summary: opts.summary || factSummary(scenes),
      scenes: scenes
    });
    if (!S().validateDailyReplay(replay)) return fallbackReplay(rawText, opts);
    return replay;
  }

  /* ---------------- 兜底 ---------------- */
  function fallbackReplay(rawText, opts) {
    opts = opts || {};
    rawText = String(rawText || '');
    var clauses = splitClauses(rawText);
    var picks = clauses.slice(0, 3);
    if (!picks.length) picks = [rawText.trim() || '今天留下的文字'];
    var emotions = picks.map(function (c) { return detectEmotion(c) || '平静'; });
    var curve = unifyCurve(emotions, opts.userMoodHint);
    return S().createDailyReplay({
      date: opts.date,
      title: coverTitle(picks.map(function (c) { return { event: c }; }), curve, rawText),
      raw_text: rawText,
      user_mood_hint: opts.userMoodHint,
      emotion_curve: curve,
      summary: factSummary(picks.map(function (event) { return { event: event }; })),
      scenes: picks.map(function (c, i) {
        var ev = stripTimePhrases(c) || c;
        var emotion = emotions[i];
        return {
          id: 'scene_' + (i + 1), event: ev, time: null,
          title: fragmentTitle(ev, emotion) || '今天的一段',
          caption: captionFor(ev, null, false),
          photo_id: null, image_key: routeImage(ev)
        };
      })
    });
  }

  /* ---------------- 关键词（Generating chips） ---------------- */
  function extractKeywords(clauses) {
    var found = [];
    (clauses || []).forEach(function (c) {
      ROUTES.forEach(function (r) {
        var m = String(c).match(new RegExp(r[1].source));
        if (m && found.indexOf(m[0]) === -1) found.push(m[0]);
      });
      var em = detectEmotion(c);
      if (em && found.indexOf(em) === -1) found.push(em);
    });
    return found;
  }

  Today.engine = {
    proposeFragments: proposeFragments,
    buildReplay: buildReplay,
    fallbackReplay: fallbackReplay,
    coverTitleForReplay: coverTitleForReplay,
    factSummary: factSummary,
    extractKeywords: extractKeywords,
    _internal: { validateReplayTitle: validateReplayTitle, sceneTitleFor: sceneTitleFor, captionFor: captionFor, timeWordCn: timeWordCn,
      splitClauses: splitClauses, parseExplicitClock: parseExplicitClock,
      stripTimePhrases: stripTimePhrases, detectEmotion: detectEmotion,
      routeImage: routeImage, unifyCurve: unifyCurve, coverTitle: coverTitle,
      eventWord: eventWord, valence: valence
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Today.engine;
})(typeof window !== 'undefined' ? window : globalThis);
