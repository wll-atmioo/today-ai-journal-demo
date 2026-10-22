/* ============================================================
 * Today · localStorage 持久化（PRD §12）
 * key: today_daily_replays
 * 结构: { "2026-09-21": DailyReplay, ... }（一天一条，重复保存即覆盖）
 * ============================================================ */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var KEY = 'today_daily_replays';

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }

  function validV05(replay) {
    return replay && replay.version === '0.5' && Today.content && Today.content.validators &&
      Today.content.validators.validateReplay(replay).ok && replay.date === replay.raw_memory.date;
  }

  /** v0.5 原样读取；旧记录仍走既有 v0.3 规范化，不写回。 */
  function all() {
    var data = load();
    var out = {};
    Object.keys(data).forEach(function (k) {
      var n = data[k] && data[k].version === '0.5' ? (validV05(data[k]) ? data[k] : null) :
        (Today.schema.normalizeReplay(data[k]) || (Today.schema.validateDailyReplay(data[k]) ? data[k] : null));
      if (n) out[k] = n;
    });
    return out;
  }

  function getByDate(iso) { return all()[iso] || null; }
  function count() { return Object.keys(all()).length; }
  function dates() { return Object.keys(all()).sort(); }

  /** 保存（覆盖当天已有内容）→ { ok, overwritten } */
  function save(replay) {
    try {
      if (replay && replay.version === '0.5' ? !validV05(replay) : Today.schema && !Today.schema.validateDailyReplay(replay)) {
        return { ok: false, overwritten: false, error: 'invalid replay' };
      }
      var data = load();
      var overwritten = !!data[replay.date];
      data[replay.date] = replay;
      global.localStorage.setItem(KEY, JSON.stringify(data));
      return { ok: true, overwritten: overwritten };
    } catch (e) {
      return { ok: false, overwritten: false, error: String(e && e.message || e) };
    }
  }

  Today.store = { KEY: KEY, load: load, all: all, getByDate: getByDate, count: count, dates: dates, save: save };
  if (typeof module !== 'undefined' && module.exports) module.exports = Today.store;
})(typeof window !== 'undefined' ? window : globalThis);
