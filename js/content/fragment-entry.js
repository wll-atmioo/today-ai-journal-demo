/* Phase A1 entry: RawMemory -> validated Events -> life-stage Fragments ->
 * existing Confirm view. A1 intentionally leaves Replay generation on v0.4.
 * Unknown text is not guessed by Mock; it goes to the explicit legacy route.
 */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var content = Today.content || (Today.content = {});

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function rawMemory(input) {
    var feeling = input.userFeeling;
    return {
      id: 'memory_' + String(input.date).replace(/-/g, '_'),
      date: input.date,
      raw_text: String(input.text || '').trim(),
      user_feeling: feeling && feeling.label ? {
        source: 'user_selected', emoji: String(feeling.emoji || '💭'), label: String(feeling.label)
      } : null
    };
  }
  function writtenFeeling(events) {
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (!event.emotion || !event.evidence || !event.evidence[0]) continue;
      var span = event.evidence[0];
      var offset = span.quote.indexOf(event.emotion);
      if (offset < 0) continue;
      var start = span.start + offset;
      return {
        source: 'user_text', emoji: null, label: event.emotion,
        evidence: { quote: event.emotion, start: start, end: start + event.emotion.length }
      };
    }
    return null;
  }
  function toConfirmFragments(analysis) {
    var events = Object.create(null);
    analysis.events.forEach(function (event) { events[event.id] = event; });
    return analysis.fragments.map(function (fragment) {
      var seen = Object.create(null);
      var quotes = [];
      fragment.event_ids.forEach(function (id) {
        events[id].evidence.forEach(function (span) {
          var key = span.start + ':' + span.end;
          if (!seen[key]) { quotes.push(span.quote); seen[key] = true; }
        });
      });
      return {
        event: quotes.join('，'), // Only source text enters the legacy Replay path.
        stage_title: fragment.title, // Confirm-only label; never treated as a fact.
        time: null, photo_id: null, preset: null,
        source_fragment_id: fragment.id,
        source_event_ids: fragment.event_ids.slice(),
        provenance: 'mock_proposal'
      };
    });
  }
  function reasonFor(error) {
    var message = String(error && error.message || error);
    if (message.indexOf('MOCK_SAMPLE_NOT_FOUND') === 0) return 'MOCK_SAMPLE_NOT_FOUND';
    if (message.indexOf('Invalid ') === 0) return 'INVALID_ANALYSIS';
    return 'MOCK_ERROR';
  }
  function create(pipeline, legacyEngine) {
    if (!pipeline || typeof pipeline.analyzeMemory !== 'function' || !legacyEngine || typeof legacyEngine.proposeFragments !== 'function') {
      throw new Error('A1 entry requires a Pipeline and the v0.4 fallback engine');
    }
    return {
      analyze: function (input) {
        var raw = rawMemory(input);
        try {
          var analysis = pipeline.analyzeMemory(raw);
          if (!raw.user_feeling) {
            analysis.raw_memory.user_feeling = writtenFeeling(analysis.events);
            raw.user_feeling = analysis.raw_memory.user_feeling;
          }
          var fragments = toConfirmFragments(analysis);
          return {
            mode: 'mock_v05', analysis: analysis, fragments: fragments,
            debug: {
              route: 'mock_v05', raw_memory: copy(raw), events: copy(analysis.events),
              fragments: copy(analysis.fragments), fallback_reason: null
            }
          };
        } catch (error) {
          var fallback = legacyEngine.proposeFragments(raw.raw_text).map(function (fragment) {
            return {
              event: fragment.event, time: fragment.time, photo_id: null, preset: null,
              stage_title: null, source_fragment_id: null, source_event_ids: [], provenance: 'legacy_v04'
            };
          });
          return {
            mode: 'legacy_v04', analysis: null, fragments: fallback,
            debug: {
              route: 'legacy_v04', raw_memory: copy(raw), events: [],
              fragments: copy(fallback), fallback_reason: reasonFor(error)
            }
          };
        }
      }
    };
  }

  content.fragmentEntry = { create: create, toConfirmFragments: toConfirmFragments };
  if (typeof module !== 'undefined' && module.exports) module.exports = content.fragmentEntry;
})(typeof window !== 'undefined' ? window : globalThis);
