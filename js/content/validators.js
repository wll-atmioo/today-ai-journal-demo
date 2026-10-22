/* Structural and provenance checks. This is NOT a semantic truth detector:
 * unsupported prose in a caption still needs later model/human evaluation.
 */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var content = Today.content || (Today.content = {});
  var contracts = content.contracts || (typeof require === 'function' ? require('./contracts') : null);

  function record(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function nonempty(x) { return typeof x === 'string' && x.trim().length > 0; }
  function nullableText(x) { return x === null || nonempty(x); }
  function err(out, code, path, message) { out.push({ code: code, path: path, message: message }); }
  function result(errors) { return { ok: errors.length === 0, errors: errors }; }
  function requiredFields(value, fields, path, out) {
    if (!record(value)) { err(out, 'TYPE', path, 'Expected object'); return false; }
    fields.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) err(out, 'REQUIRED', path + '.' + key, 'Missing field');
    });
    return true;
  }
  function uniqueIds(items, path, out) {
    var seen = Object.create(null);
    items.forEach(function (item, i) {
      var id = item && item.id;
      if (!nonempty(id)) return;
      if (seen[id]) err(out, 'DUPLICATE_ID', path + '[' + i + '].id', 'Duplicate ID: ' + id);
      seen[id] = true;
    });
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function evidence(span, raw, path, out) {
    if (!record(span) || !nonempty(span.quote) || !Number.isInteger(span.start) || !Number.isInteger(span.end)) {
      err(out, 'EVIDENCE_SHAPE', path, 'Evidence needs quote and integer start/end'); return;
    }
    if (span.start < 0 || span.end <= span.start || span.end > raw.length || raw.slice(span.start, span.end) !== span.quote) {
      err(out, 'EVIDENCE_MISMATCH', path, 'Evidence must be an exact span in raw_text');
    }
  }
  function checkFeeling(value, raw, path, out) {
    if (value === null) return;
    if (!record(value) || contracts.FEELING_SOURCES.indexOf(value.source) === -1 || !nonempty(value.label)) {
      err(out, 'FEELING_SHAPE', path, 'Feeling needs user source and label'); return;
    }
    if (value.emoji != null && typeof value.emoji !== 'string') err(out, 'TYPE', path + '.emoji', 'Emoji must be text or null');
    if (value.source === 'user_text') evidence(value.evidence, raw, path + '.evidence', out);
    else if (value.evidence != null) evidence(value.evidence, raw, path + '.evidence', out);
  }
  function checkRawMemory(raw, path, out) {
    if (!requiredFields(raw, contracts.REQUIRED_FIELDS.raw_memory, path, out)) return;
    if (!nonempty(raw.id)) err(out, 'TYPE', path + '.id', 'ID must be nonempty text');
    if (!validDate(raw.date)) err(out, 'DATE', path + '.date', 'Date must be a valid ISO day');
    if (!nonempty(raw.raw_text)) err(out, 'TYPE', path + '.raw_text', 'Original memory must be nonempty text');
    checkFeeling(raw.user_feeling, typeof raw.raw_text === 'string' ? raw.raw_text : '', path + '.user_feeling', out);
  }
  function checkEvent(event, raw, path, out) {
    if (!requiredFields(event, contracts.REQUIRED_FIELDS.event, path, out)) return;
    if (!nonempty(event.id)) err(out, 'TYPE', path + '.id', 'ID must be nonempty text');
    if (contracts.EVENT_KINDS.indexOf(event.kind) === -1) err(out, 'EVENT_KIND', path + '.kind', 'Unknown event kind');
    ['time', 'location', 'action', 'object', 'goal', 'emotion'].forEach(function (key) {
      if (!nullableText(event[key])) err(out, 'TYPE', path + '.' + key, 'Expected nonempty text or null');
    });
    if (!Array.isArray(event.evidence) || event.evidence.length === 0) {
      err(out, 'EVIDENCE_REQUIRED', path + '.evidence', 'Every classified unit needs source evidence'); return;
    }
    event.evidence.forEach(function (span, i) { evidence(span, raw, path + '.evidence[' + i + ']', out); });
  }
  function checkFragment(fragment, events, path, out) {
    if (!requiredFields(fragment, contracts.REQUIRED_FIELDS.fragment, path, out)) return;
    if (!nonempty(fragment.id)) err(out, 'TYPE', path + '.id', 'ID must be nonempty text');
    if (!nonempty(fragment.title)) err(out, 'TYPE', path + '.title', 'Title must be nonempty text');
    if (contracts.FRAGMENT_STATUS.indexOf(fragment.status) === -1) err(out, 'FRAGMENT_STATUS', path + '.status', 'Unknown status');
    if (!Array.isArray(fragment.event_ids) || fragment.event_ids.length === 0) {
      err(out, 'EVENT_REF_REQUIRED', path + '.event_ids', 'Fragment needs at least one Event'); return;
    }
    var seen = Object.create(null);
    fragment.event_ids.forEach(function (id, i) {
      var refPath = path + '.event_ids[' + i + ']';
      if (seen[id]) err(out, 'DUPLICATE_REF', refPath, 'Repeated Event reference');
      seen[id] = true;
      var event = events[id];
      if (!event) err(out, 'UNKNOWN_EVENT', refPath, 'Event does not exist');
      else if (event.kind !== 'occurred') err(out, 'NON_OCCURRED_EVENT', refPath, 'Only occurred Events may enter a life-stage Fragment');
    });
  }
  function checkAnalysis(analysis, path, out) {
    if (!record(analysis)) { err(out, 'TYPE', path, 'Expected analysis object'); return; }
    checkRawMemory(analysis.raw_memory, path + '.raw_memory', out);
    if (!Array.isArray(analysis.events) || analysis.events.length === 0) {
      err(out, 'EVENTS_REQUIRED', path + '.events', 'At least one classified unit is required'); return;
    }
    if (!Array.isArray(analysis.fragments) || analysis.fragments.length < 1 || analysis.fragments.length > 5) {
      err(out, 'FRAGMENT_COUNT', path + '.fragments', 'Expected 1–5 Fragments'); return;
    }
    uniqueIds(analysis.events, path + '.events', out);
    uniqueIds(analysis.fragments, path + '.fragments', out);
    var raw = analysis.raw_memory && typeof analysis.raw_memory.raw_text === 'string' ? analysis.raw_memory.raw_text : '';
    var eventMap = Object.create(null);
    analysis.events.forEach(function (event, i) {
      checkEvent(event, raw, path + '.events[' + i + ']', out);
      if (event && nonempty(event.id)) eventMap[event.id] = event;
    });
    analysis.fragments.forEach(function (fragment, i) {
      checkFragment(fragment, eventMap, path + '.fragments[' + i + ']', out);
    });
  }
  function sameSpan(a, b) { return a && b && a.start === b.start && a.end === b.end && a.quote === b.quote; }
  function checkPlannedLeak(text, events, path, out) {
    if (typeof text !== 'string') return;
    Object.keys(events).forEach(function (id) {
      var planned = events[id];
      if (planned.kind !== 'planned') return;
      var quotes = Array.isArray(planned.evidence) ? planned.evidence.map(function (span) { return span && span.quote; }) : [];
      var copiedPlan = quotes.some(function (quote) { return nonempty(quote) && text.indexOf(quote) !== -1; });
      var actionAsDone = nonempty(planned.action) && text.indexOf(planned.action) !== -1 &&
        /(今天|已经|刚才|终于).{0,12}(完成|做完|办完|交完|投递)/.test(text) &&
        !Object.keys(events).some(function (otherId) {
          return events[otherId].kind === 'occurred' && events[otherId].action === planned.action;
        });
      if (copiedPlan || actionAsDone) err(out, 'PLANNED_TEXT_LEAK', path, 'Planned content leaked into an occurred-life narrative');
    });
  }
  function checkScene(scene, fragments, events, raw, path, out) {
    if (!requiredFields(scene, contracts.REQUIRED_FIELDS.scene, path, out)) return;
    if (!nonempty(scene.id)) err(out, 'TYPE', path + '.id', 'ID must be nonempty text');
    if (!nonempty(scene.title)) err(out, 'TYPE', path + '.title', 'Title must be nonempty text');
    if (!nonempty(scene.caption)) err(out, 'TYPE', path + '.caption', 'Caption must be nonempty text');
    checkPlannedLeak(scene.title, events, path + '.title', out);
    checkPlannedLeak(scene.caption, events, path + '.caption', out);
    if (!nonempty(scene.visual_prompt)) err(out, 'TYPE', path + '.visual_prompt', 'Visual prompt must be nonempty text');
    if (scene.image_asset != null && (typeof scene.image_asset !== 'string' || !/^assets\/scenes\/[a-z0-9-]+\.webp$/.test(scene.image_asset))) {
      err(out, 'IMAGE_ASSET', path + '.image_asset', 'Static image must be a local scene WebP');
    }
    if (contracts.SCENE_PROVENANCE.indexOf(scene.provenance) === -1) err(out, 'PROVENANCE', path + '.provenance', 'Scene source must be identified');
    if (scene.time !== null && (typeof scene.time !== 'string' || !/^\d{1,2}:\d{2}$/.test(scene.time))) err(out, 'TIME', path + '.time', 'Render time must be HH:MM or null');
    if (scene.photo_id !== null && typeof scene.photo_id !== 'string') err(out, 'TYPE', path + '.photo_id', 'Photo ID must be text or null');
    if (contracts.IMAGE_KEYS.indexOf(scene.image_key) === -1) err(out, 'IMAGE_KEY', path + '.image_key', 'Unknown legacy image key');
    var fragment = fragments[scene.fragment_id];
    if (!fragment) err(out, 'UNKNOWN_FRAGMENT', path + '.fragment_id', 'Fragment does not exist');
    else if (fragment.status !== 'confirmed') err(out, 'UNCONFIRMED_FRAGMENT', path + '.fragment_id', 'Scene requires a confirmed Fragment');
    if (!Array.isArray(scene.event_ids) || scene.event_ids.length === 0) {
      err(out, 'EVENT_REF_REQUIRED', path + '.event_ids', 'Scene needs Event IDs');
    } else {
      var seen = Object.create(null);
      scene.event_ids.forEach(function (id, i) {
        var refPath = path + '.event_ids[' + i + ']';
        if (seen[id]) err(out, 'DUPLICATE_REF', refPath, 'Repeated Event reference');
        seen[id] = true;
        if (!events[id]) err(out, 'UNKNOWN_EVENT', refPath, 'Event does not exist');
        else if (events[id].kind !== 'occurred') err(out, 'PLANNED_AS_FACT', refPath, 'A non-occurred unit cannot become a Scene fact');
        if (fragment && fragment.event_ids.indexOf(id) === -1) err(out, 'EVENT_NOT_IN_FRAGMENT', refPath, 'Event is not in linked Fragment');
      });
    }
    if (!Array.isArray(scene.evidence) || scene.evidence.length === 0) {
      err(out, 'EVIDENCE_REQUIRED', path + '.evidence', 'Scene needs traceable evidence'); return;
    }
    scene.evidence.forEach(function (span, i) {
      var spanPath = path + '.evidence[' + i + ']';
      evidence(span, raw, spanPath, out);
      var matched = Array.isArray(scene.event_ids) && scene.event_ids.some(function (id) {
        var event = events[id];
        return event && Array.isArray(event.evidence) && event.evidence.some(function (source) { return sameSpan(source, span); });
      });
      if (!matched) err(out, 'EVIDENCE_UNLINKED', spanPath, 'Evidence is not linked to a referenced Event');
    });
    if (Array.isArray(scene.event_ids)) scene.event_ids.forEach(function (id) {
      var event = events[id];
      if (event && Array.isArray(event.evidence) && !event.evidence.some(function (source) {
        return scene.evidence.some(function (span) { return sameSpan(source, span); });
      })) err(out, 'EVENT_EVIDENCE_MISSING', path + '.evidence', 'No evidence for Scene Event ' + id);
    });
  }
  function checkClaim(claim, events, path, out, source, allowEmotionOnly) {
    if (claim === null) return;
    if (!record(claim) || !nonempty(claim.text) || !Array.isArray(claim.event_ids) || claim.event_ids.length === 0) {
      err(out, 'CLAIM_SHAPE', path, 'Claim needs text and Event references'); return;
    }
    if (source && claim.source !== source) err(out, 'CLAIM_SOURCE', path + '.source', 'Unexpected claim source');
    claim.event_ids.forEach(function (id, i) {
      if (!events[id]) err(out, 'UNKNOWN_EVENT', path + '.event_ids[' + i + ']', 'Event does not exist');
      else if (events[id].kind !== 'occurred' && !(allowEmotionOnly && events[id].kind === 'emotion_only')) err(out, 'PLANNED_AS_FACT', path + '.event_ids[' + i + ']', 'Only occurred Events or explicit feelings may support generated claims');
    });
  }
  function validateRawMemory(raw) { var errors = []; checkRawMemory(raw, 'raw_memory', errors); return result(errors); }
  function validateAnalysis(analysis) { var errors = []; checkAnalysis(analysis, 'analysis', errors); return result(errors); }
  function validateReplay(replay) {
    var errors = [];
    if (!requiredFields(replay, contracts.REQUIRED_FIELDS.replay, 'replay', errors)) return result(errors);
    if (!nonempty(replay.id)) err(errors, 'TYPE', 'replay.id', 'ID must be nonempty text');
    if (replay.version !== contracts.VERSION) err(errors, 'VERSION', 'replay.version', 'Expected v0.5');
    if (!nonempty(replay.title)) err(errors, 'TYPE', 'replay.title', 'Title must be nonempty text');
    checkAnalysis(replay, 'replay', errors);
    var raw = replay.raw_memory && typeof replay.raw_memory.raw_text === 'string' ? replay.raw_memory.raw_text : '';
    var fragments = Object.create(null), events = Object.create(null);
    if (Array.isArray(replay.fragments)) replay.fragments.forEach(function (f, i) {
      if (f && f.id) fragments[f.id] = f;
      if (f && f.status !== 'confirmed') err(errors, 'UNCONFIRMED_FRAGMENT', 'replay.fragments[' + i + '].status', 'Replay may contain only confirmed Fragments');
    });
    if (Array.isArray(replay.events)) replay.events.forEach(function (e) { if (e && e.id) events[e.id] = e; });
    if (!Array.isArray(replay.scenes) || replay.scenes.length < 1 || replay.scenes.length > 5) {
      err(errors, 'SCENE_COUNT', 'replay.scenes', 'Expected 1–5 Scenes');
    } else {
      uniqueIds(replay.scenes, 'replay.scenes', errors);
      var used = Object.create(null);
      replay.scenes.forEach(function (scene, i) {
        checkScene(scene, fragments, events, raw, 'replay.scenes[' + i + ']', errors);
        if (scene && scene.fragment_id) {
          if (used[scene.fragment_id]) err(errors, 'DUPLICATE_FRAGMENT_SCENE', 'replay.scenes[' + i + '].fragment_id', 'One Scene per Fragment in A0');
          used[scene.fragment_id] = true;
        }
      });
      if (Array.isArray(replay.fragments)) replay.fragments.forEach(function (fragment) {
        if (fragment && fragment.status === 'confirmed' && !used[fragment.id]) err(errors, 'FRAGMENT_WITHOUT_SCENE', 'replay.scenes', 'Confirmed Fragment lacks Scene');
      });
    }
    checkFeeling(replay.user_feeling, raw, 'replay.user_feeling', errors);
    if (replay.raw_memory && JSON.stringify(replay.raw_memory.user_feeling) !== JSON.stringify(replay.user_feeling)) {
      err(errors, 'FEELING_SOURCE_MISMATCH', 'replay.user_feeling', 'Replay feeling must copy RawMemory user feeling');
    }
    checkClaim(replay.reflection, events, 'replay.reflection', errors, null, true);
    if (replay.reflection) checkPlannedLeak(replay.reflection.text, events, 'replay.reflection.text', errors);
    if (replay.ai_observation !== null) {
      if (!record(replay.ai_observation) || contracts.OBSERVATION_SOURCES.indexOf(replay.ai_observation.source) === -1) {
        err(errors, 'OBSERVATION_SOURCE', 'replay.ai_observation', 'Observation must identify mock or model source');
      } else checkClaim(replay.ai_observation, events, 'replay.ai_observation', errors, replay.ai_observation.source, true);
    }
    if (!record(replay.generation_meta) || contracts.GENERATION_MODES.indexOf(replay.generation_meta.mode) === -1 || !nonempty(replay.generation_meta.provider)) {
      err(errors, 'GENERATION_META', 'replay.generation_meta', 'Generation mode/provider required');
    }
    return result(errors);
  }

  content.validators = {
    validateRawMemory: validateRawMemory,
    validateAnalysis: validateAnalysis,
    validateReplay: validateReplay
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = content.validators;
})(typeof window !== 'undefined' ? window : globalThis);
