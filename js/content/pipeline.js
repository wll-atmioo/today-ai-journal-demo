/* v0.5 orchestration only; no UI, persistence, LLM or image service. */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var content = Today.content || (Today.content = {});
  var validators = content.validators || (typeof require === 'function' ? require('./validators') : null);
  var contracts = content.contracts || (typeof require === 'function' ? require('./contracts') : null);

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function assertValid(check, label) {
    if (!check.ok) throw new Error(label + ': ' + check.errors.map(function (e) { return e.code + ' at ' + e.path; }).join('; '));
  }
  function create(provider) {
    if (!provider || typeof provider.analyzeMemory !== 'function' || typeof provider.composeReplay !== 'function') {
      throw new Error('Content Provider needs analyzeMemory and composeReplay');
    }
    return {
      analyzeMemory: function (rawMemory) {
        assertValid(validators.validateRawMemory(rawMemory), 'Invalid RawMemory');
        var raw = copy(rawMemory);
        var proposal = provider.analyzeMemory(raw);
        var analysis = {
          raw_memory: raw,
          events: copy(proposal.events),
          fragments: copy(proposal.fragments)
        };
        assertValid(validators.validateAnalysis(analysis), 'Invalid analysis');
        return analysis;
      },
      // A0 confirms the proposed set only. Editing, dropping and regrouping are A1 work.
      confirmFragments: function (analysis, confirmedIds) {
        assertValid(validators.validateAnalysis(analysis), 'Invalid analysis');
        if (!Array.isArray(confirmedIds) || confirmedIds.length !== analysis.fragments.length) {
          throw new Error('A0 confirmation requires every proposed Fragment ID');
        }
        var ids = {};
        confirmedIds.forEach(function (id) { ids[id] = (ids[id] || 0) + 1; });
        if (analysis.fragments.some(function (fragment) { return ids[fragment.id] !== 1; })) {
          throw new Error('A0 confirmation IDs must exactly match the proposed Fragments');
        }
        var confirmed = copy(analysis);
        confirmed.fragments.forEach(function (fragment) { fragment.status = 'confirmed'; });
        assertValid(validators.validateAnalysis(confirmed), 'Invalid confirmation');
        return confirmed;
      },
      composeReplay: function (confirmedAnalysis) {
        assertValid(validators.validateAnalysis(confirmedAnalysis), 'Invalid analysis');
        if (confirmedAnalysis.fragments.some(function (fragment) { return fragment.status !== 'confirmed'; })) {
          throw new Error('A0 Replay requires confirmed Fragments');
        }
        var analysis = copy(confirmedAnalysis);
        var story = provider.composeReplay(analysis);
        var replay = {
          id: 'replay_' + analysis.raw_memory.id,
          version: contracts.VERSION,
          raw_memory: analysis.raw_memory,
          events: analysis.events,
          fragments: analysis.fragments,
          scenes: copy(story.scenes),
          title: story.title,
          reflection: copy(story.reflection),
          user_feeling: copy(analysis.raw_memory.user_feeling),
          ai_observation: copy(story.ai_observation),
          generation_meta: copy(story.generation_meta)
        };
        assertValid(validators.validateReplay(replay), 'Invalid Replay');
        return replay;
      }
    };
  }

  content.pipeline = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = content.pipeline;
})(typeof window !== 'undefined' ? window : globalThis);
