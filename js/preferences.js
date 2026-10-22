/* Local presentation choices and in-app reminders. No push or network calls. */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var KEY = 'today_journal_preferences_v1';
  var defaults = { paper: 'cream', character: 'neutral', artStyle: 'minimal', calendarView: 'picture', reminders: {} };
  var choices = {
    paper: ['cream', 'gray', 'apricot', 'sage', 'rose'],
    character: ['female', 'male', 'neutral'],
    artStyle: ['watercolor', 'minimal', 'postcard'],
    calendarView: ['picture', 'note', 'feeling']
  };
  function dateOK(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value + 'T12:00:00').getTime()); }
  function read() {
    var data = {};
    try { data = JSON.parse(global.localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
    var result = {};
    Object.keys(choices).forEach(function (key) { result[key] = choices[key].indexOf(data[key]) >= 0 ? data[key] : defaults[key]; });
    result.reminders = {};
    if (data.reminders && typeof data.reminders === 'object' && !Array.isArray(data.reminders)) {
      Object.keys(data.reminders).forEach(function (date) {
        var value = data.reminders[date];
        if (dateOK(date) && typeof value === 'string' && value.trim()) result.reminders[date] = value.trim().slice(0, 80);
      });
    }
    return result;
  }
  function write(data) {
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }
  function setChoice(key, value) {
    if (!choices[key] || choices[key].indexOf(value) < 0) return false;
    var data = read(); data[key] = value; return write(data);
  }
  function saveReminder(date, text) {
    if (!dateOK(date) || !String(text || '').trim()) return false;
    var data = read(); data.reminders[date] = String(text).trim().slice(0, 80); return write(data);
  }
  function removeReminder(date) { var data = read(); delete data.reminders[date]; return write(data); }
  Today.preferences = { KEY: KEY, read: read, setChoice: setChoice, saveReminder: saveReminder, removeReminder: removeReminder, dateOK: dateOK };
  if (typeof module !== 'undefined' && module.exports) module.exports = Today.preferences;
})(typeof window !== 'undefined' ? window : globalThis);
