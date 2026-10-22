/* Today v0.5 content contract. Independent of the v0.3 storage schema.
 * Evidence offsets are UTF-16 string indexes: raw_text.slice(start, end) === quote.
 * RawMemory: {id,date,raw_text,user_feeling}; user_feeling is null or an explicit
 * user-selected/user-written feeling. It is never an AI inference.
 * Event: one source-backed information unit, classified by kind.
 * Fragment: a user-confirmable life stage referencing occurred Event IDs.
 * Scene: one picture-book page referencing a Fragment, its Events and evidence.
 * Replay: the complete versioned result; AI observation remains separate from
 * user feeling. visual_prompt is a prompt only, not a generated image.
 */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var content = Today.content || (Today.content = {});

  content.contracts = {
    VERSION: '0.5',
    EVENT_KINDS: ['occurred', 'planned', 'thought', 'emotion_only', 'uncertain'],
    FRAGMENT_STATUS: ['draft', 'confirmed'],
    FEELING_SOURCES: ['user_selected', 'user_text'],
    OBSERVATION_SOURCES: ['mock_observation', 'llm_inference'],
    GENERATION_MODES: ['mock', 'llm'],
    IMAGE_KEYS: ['commute', 'work', 'food', 'walk', 'home', 'night', 'study', 'city', 'generic'],
    SCENE_PROVENANCE: ['mock_draft', 'user_edited'],
    REQUIRED_FIELDS: {
      raw_memory: ['id', 'date', 'raw_text', 'user_feeling'],
      event: ['id', 'kind', 'time', 'location', 'action', 'object', 'goal', 'emotion', 'evidence'],
      fragment: ['id', 'title', 'event_ids', 'status'],
      scene: ['id', 'fragment_id', 'event_ids', 'title', 'caption', 'visual_prompt', 'evidence', 'provenance', 'time', 'photo_id', 'image_key'],
      replay: ['id', 'version', 'raw_memory', 'events', 'fragments', 'scenes', 'title', 'reflection', 'user_feeling', 'ai_observation', 'generation_meta']
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = content.contracts;
})(typeof window !== 'undefined' ? window : globalThis);
