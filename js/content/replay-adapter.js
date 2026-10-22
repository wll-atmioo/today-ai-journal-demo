/* Lossless v0.5 record with legacy render fields for the existing pages.
 * Do not invent emotion nodes just to satisfy the v0.3 schema.
 */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var content = Today.content || (Today.content = {});
  var validators = content.validators || (typeof require === 'function' ? require('./validators') : null);

  function toRenderableReplay(replay) {
    var check = validators.validateReplay(replay);
    if (!check.ok) throw new Error('Cannot render invalid v0.5 Replay: ' + check.errors[0].code);
    var byId = {};
    replay.events.forEach(function (event) { byId[event.id] = event; });
    var view = JSON.parse(JSON.stringify(replay));
    view.id = replay.id;
    view.version = '0.5';
    view.engine_mode = replay.generation_meta.mode;
    view.date = replay.raw_memory.date;
    view.raw_text = replay.raw_memory.raw_text;
    view.user_mood_hint = replay.user_feeling ? {
      emoji: replay.user_feeling.emoji || '✎', label: replay.user_feeling.label
    } : null;
    view.emotion_curve = []; // Kept only for old render consumers; never shown as a trajectory.
    view.summary = replay.reflection ? replay.reflection.text : '';
    view.scenes = replay.scenes.map(function (scene) {
      var page = JSON.parse(JSON.stringify(scene));
      page.event = scene.event_ids.map(function (id) { return byId[id].evidence.map(function (span) { return span.quote; }).join('；'); }).join('；');
      return page;
    });
    return view;
  }

  content.replayAdapter = { toRenderableReplay: toRenderableReplay };
  if (typeof module !== 'undefined' && module.exports) module.exports = content.replayAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
