/* ============================================================
 * Today · DailyReplay Schema v0.3
 * 变化（相对 v0.2）：
 *  - scene.time: 'HH:MM' | null（用户确认制；删除 time_type / period）
 *  - scene.photo_id: string | null（图片 Blob 存 IndexedDB，这里只存 id）
 *  - scene 不再存 emotion / emotion_emoji（情绪只输出一套 emotion_curve）
 *  - emotion_curve: [{emoji, label}]（对象数组）
 *  - user_selected_mood → user_mood_hint（输入信号，非展示模块）
 * ============================================================ */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});

  var SCENE_KEYS = ['commute', 'work', 'food', 'walk', 'home', 'night', 'study', 'city', 'generic'];

  var EMOJI = {
    '如常': '🗓', '平静': '😌', '轻松': '😌', '放松': '😌', '满足': '😊', '开心': '😄',
    '愉快': '😄', '温暖': '🥰', '踏实': '☺️', '安心': '🙂', '还不错': '🙂', '不错': '🙂',
    '期待': '🤩', '惊喜': '✨', '缓和': '🍂', '饿': '🤤', '困': '😴', '疲惫': '😮‍💨', '累': '😮‍💨',
    '慌乱': '😰', '紧张': '😟', '烦闷': '😒', '烦躁': '😣', '挫败': '😔', '失落': '🥀',
    '委屈': '🥺', '难过': '😢', '低落': '🌧', '无奈': '🙃'
  };

  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function emojiFor(label) { return EMOJI[label] || '🌤'; }
  function imageUrl(key) { return 'assets/scenes/' + key + '.webp'; }
  function svgUrl(key) { return 'assets/scenes/' + key + '.svg'; }
  function isTime(t) { return t == null || t === '' || /^\d{1,2}:\d{2}$/.test(t); }
  function normTime(t) {
    if (t == null) return null;
    t = String(t).trim();
    if (!t) return null;
    if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
    var p = t.split(':');
    return String(p[0]).padStart(2, '0') + ':' + p[1];
  }

  function normMood(m) {
    if (!m || !m.label) return null;
    return { emoji: String(m.emoji || emojiFor(m.label)), label: String(m.label) };
  }
  function normCurve(c) {
    if (!Array.isArray(c)) return [];
    return c.map(function (e) {
      if (typeof e === 'string') return { emoji: emojiFor(e), label: e };
      return { emoji: String((e && e.emoji) || emojiFor(e && e.label)), label: String((e && e.label) || '') };
    }).filter(function (e) { return e.label; });
  }
  function normScene(s, i) {
    s = s || {};
    var key = SCENE_KEYS.indexOf(s.image_key) !== -1 ? s.image_key : 'generic';
    return {
      id: String(s.id || ('scene_' + (i + 1))),
      event: String(s.event || s.title || ''),
      time: normTime(s.time),
      title: String(s.title || s.event || ''),
      caption: String(s.caption || ''),
      photo_id: s.photo_id ? String(s.photo_id) : null,
      image_key: key
    };
  }

  function createDailyReplay(o) {
    o = o || {};
    var date = o.date || todayISO();
    var p = date.split('-');
    return {
      id: 'daily_' + p[0] + '_' + p[1] + '_' + p[2],
      date: date,
      title: String(o.title || ''),
      raw_text: String(o.raw_text || ''),
      user_mood_hint: normMood(o.user_mood_hint),
      emotion_curve: normCurve(o.emotion_curve),
      summary: String(o.summary || ''),
      created_at: o.created_at || new Date().toISOString(),
      scenes: (o.scenes || []).map(normScene)
    };
  }

  function validateDailyReplay(r) {
    if (!r || typeof r !== 'object') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return false;
    if (typeof r.raw_text !== 'string') return false;
    if (!Array.isArray(r.scenes) || r.scenes.length < 1 || r.scenes.length > 5) return false;
    if (!Array.isArray(r.emotion_curve) || r.emotion_curve.length < 2 || r.emotion_curve.length > 4) return false;
    for (var i = 0; i < r.scenes.length; i++) {
      var s = r.scenes[i];
      if (typeof s.event !== 'string' || !s.event) return false;
      if (typeof s.title !== 'string' || !s.title) return false;
      if (typeof s.caption !== 'string') return false;
      if (!isTime(s.time)) return false;
      if (s.photo_id != null && typeof s.photo_id !== 'string') return false;
      if (SCENE_KEYS.indexOf(s.image_key) === -1) return false;
    }
    for (var j = 0; j < r.emotion_curve.length; j++) {
      var e = r.emotion_curve[j];
      if (!e || typeof e.label !== 'string' || !e.label || typeof e.emoji !== 'string') return false;
    }
    if (r.user_mood_hint && (typeof r.user_mood_hint.label !== 'string' || typeof r.user_mood_hint.emoji !== 'string')) return false;
    return typeof r.summary === 'string';
  }

  /* ---------- 历史版本迁移：v0.1 / v0.2 → v0.3 ---------- */
  function normalizeReplay(old) {
    if (!old || !old.scenes || !old.scenes.length) return null;
    var scenes = old.scenes.map(function (s, i) {
      var key = s.image_key;
      if (!key && s.image_url) {
        var m = String(s.image_url).match(/([a-z_]+)\.(webp|svg)$/i);
        key = m ? m[1] : null;
      }
      return normScene({
        id: s.id, event: s.event || s.title, title: s.title, caption: s.caption,
        time: s.time, photo_id: s.photo_id || null,
        image_key: key
      }, i);
    }).filter(function (s) { return s.event; });
    if (scenes.length < 2) return null;
    var hint = old.user_mood_hint || old.user_selected_mood || null;
    var curve = normCurve(old.emotion_curve && old.emotion_curve.length
      ? old.emotion_curve
      : scenes.map(function () { return '平静'; }));
    if (curve.length < 2) curve = [{ emoji: emojiFor('如常'), label: '如常' }, { emoji: emojiFor('平静'), label: '平静' }];
    var r = createDailyReplay({
      date: old.date, title: old.title || '', raw_text: old.raw_text || '', user_mood_hint: hint,
      emotion_curve: curve, summary: old.summary || '',
      created_at: old.created_at, scenes: scenes
    });
    return validateDailyReplay(r) ? r : null;
  }

  Today.schema = {
    SCENE_KEYS: SCENE_KEYS, todayISO: todayISO, emojiFor: emojiFor,
    imageUrl: imageUrl, svgUrl: svgUrl, isTime: isTime, normTime: normTime,
    createDailyReplay: createDailyReplay, validateDailyReplay: validateDailyReplay,
    normalizeReplay: normalizeReplay
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Today.schema;
})(typeof window !== 'undefined' ? window : globalThis);
