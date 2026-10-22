/* ============================================================
 * Today · UI 状态机 v0.3
 * 流程：Start → Record → Fragment Confirm → Generating
 *       → Replay → Calendar → Day Detail →（编辑这一天）→ Fragment Confirm
 * 原则：用户负责确认事实（时间/照片/文本），系统负责整理和表达。
 * ============================================================ */
(function () {
  'use strict';
  var schema = Today.schema;
  var store = Today.store;
  var engine = Today.engine;
  var demo = Today.demo;
  var photos = Today.photos;
  var preferences = Today.preferences;
  var contentPipeline = Today.content && Today.content.pipeline && Today.content.mockProvider
    ? Today.content.pipeline.create(Today.content.mockProvider) : null;
  var fragmentEntry = Today.content && Today.content.fragmentEntry && Today.content.pipeline && Today.content.mockProvider
    ? Today.content.fragmentEntry.create(contentPipeline, engine) : null;

  var GEN_STAGES = [
    '写下的小事，先落在纸上…',
    '画面慢慢浮出来了…',
    '再给这一页添一点颜色…',
    '翻开看看这一天吧。'
  ];
  var GEN_TOTAL_MS = 3200;
  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  var HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
  var MINUTES = [0,10,20,30,40,50];
  var MOODS = [
    { emoji: '😌', label: '平静' }, { emoji: '😣', label: '烦躁' },
    { emoji: '😫', label: '有点累' }, { emoji: '😄', label: '开心' },
    { emoji: '😟', label: '紧张' }, { emoji: '🙂', label: '还不错' }
  ];
  function moodIcon(label) {
    var colors = { '平静': '#c7d8cf', '烦躁': '#e2c5bc', '有点累': '#c9c9d8', '开心': '#edd6a6', '紧张': '#d7cad8', '还不错': '#d3dfb9' };
    var fill = colors[label] || '#d9d9ce';
    var mouth = label === '开心' || label === '还不错' ? '<path d="M24 37q8 8 16 0"/>' :
      label === '烦躁' || label === '有点累' ? '<path d="M25 40q7-5 14 0"/>' :
      label === '紧张' ? '<ellipse cx="32" cy="39" rx="3" ry="4"/>' : '<path d="M25 39q7 2 14 0"/>';
    var eyes = label === '有点累' ? '<path d="M22 29q4 2 8 0m5 0q4 2 8 0"/>' : '<path d="M25 27v3m14-3v3"/>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 5C47 6 58 18 57 32c-1 16-10 25-25 26C18 57 7 47 6 33 5 17 17 7 32 5Z" fill="' + fill + '" opacity=".75"/><path d="M15 18q19-16 35 1" fill="none" stroke="#fff" stroke-width="4" opacity=".35"/><g fill="none" stroke="#625a54" stroke-width="2.4" stroke-linecap="round">' + eyes + mouth + '</g></svg>';
  }

  var state = {
    page: 'start',
    rawText: '',
    moodHint: null,          /* 用户输入信号，非展示模块（预设或自定义 {emoji,label}） */
    moodCustomOpen: false,   /* 自定义心情输入区展开 */
    menuIdx: null,           /* 片段卡 ··· 菜单当前展开的下标 */
    addingFrag: null,        /* 新增片段草稿 */
    fragments: [],           /* [{event, time, photo_id, preset}] */
    analysis: null,           /* Validated Mock Event/Fragment proposal */
    contentMode: 'legacy_v04',
    editingDate: null,       /* 编辑历史日期时的 ISO */
    editingOriginalReplay: null,
    recordPhotoId: null,
    recordPhotoRemoved: false,
    examplePickerOpen: false,
    generationNote: '',
    exampleMeta: null,       /* 示例携带的 title/summary 覆盖 */
    examplePhotos: [],
    ddClose: null,           /* Day Detail 打开时的关闭函数 */
    replay: null,
    historyMode: false,
    savedToday: false,
    calY: 0, calM: 0,
    genTimer: null
  };

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function photoUrl(id) {
    var match = /^showcase_([a-z]+)_([0-2])$/.exec(String(id || ''));
    if (match) {
      var example = demo.EXAMPLES.find(function (item) { return item.id === match[1]; });
      if (example && example.photos[Number(match[2])]) return Promise.resolve(example.photos[Number(match[2])].path);
    }
    return photos.url(id);
  }
  function fmtDot(iso) { return String(iso).replace(/-/g, '.'); }
  function isoOf(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

  var PREF_CHOICES = {
    paper: [['cream', '米白纸'], ['gray', '暖灰纸'], ['apricot', '淡杏纸'], ['sage', '鼠尾草纸'], ['rose', '雾粉纸']],
    character: [['female', '女生'], ['male', '男生'], ['neutral', '不出现人物']],
    artStyle: [['watercolor', '水彩'], ['minimal', '简笔'], ['postcard', '明信片']],
    calendarView: [['picture', '画面'], ['note', '小字'], ['feeling', '感受']]
  };
  function renderPrefPreview(pref) {
    var labels = {
      female: '一个女生陪着这一页', male: '一个男生陪着这一页', neutral: '只留下场景和物件',
      watercolor: '轻柔的水彩', minimal: '清爽的简笔', postcard: '像一张明信片'
    };
    var img = $('#prefs-preview-img');
    img.src = pref.artStyle === 'watercolor' && pref.character === 'female'
      ? 'assets/scenes/journal-character-female-reference.webp'
      : pref.artStyle === 'watercolor' && pref.character === 'male'
        ? 'assets/scenes/journal-character-male-watercolor.webp'
        : illustrationSource('home', pref);
    img.alt = labels[pref.character] + '，' + labels[pref.artStyle] + '的日记本预览';
    $('#prefs-preview-role').textContent = labels[pref.character];
    $('#prefs-preview-style').textContent = labels[pref.artStyle];
  }
  function renderPrefs() {
    var current = preferences.read();
    [['paper', '#prefs-paper'], ['character', '#prefs-character'], ['artStyle', '#prefs-art-style'], ['calendarView', '#prefs-calendar-view']].forEach(function (group) {
      var box = $(group[1]); box.innerHTML = '';
      PREF_CHOICES[group[0]].forEach(function (option) {
        var button = document.createElement('button');
        button.type = 'button'; button.className = 'pref-choice' + (current[group[0]] === option[0] ? ' on' : '');
        button.textContent = option[1]; button.setAttribute('aria-pressed', current[group[0]] === option[0] ? 'true' : 'false');
        button.onclick = function () {
          if (!preferences.setChoice(group[0], option[0])) { toast('偏好没能保存'); return; }
          applyPreferences(); renderPrefs(); if (state.page === 'calendar') renderMonth();
          if (state.page === 'replay') mountReplay(state.replay, state.historyMode);
          if (state.page === 'start' && state.examplePickerOpen) renderExamples();
        };
        box.appendChild(button);
      });
    });
    renderPrefPreview(current);
  }
  function applyPreferences() {
    var pref = preferences.read();
    document.body.dataset.paper = pref.paper;
    document.body.dataset.artStyle = pref.artStyle;
    document.body.dataset.character = pref.character;
    var picture = $('.start-story-art');
    var source = $('source', picture), img = $('img', picture);
    if (pref.character === 'female' && pref.artStyle === 'watercolor') {
      source.srcset = schema.imageUrl('generic'); img.src = schema.svgUrl('generic');
    } else if (pref.character === 'male' && pref.artStyle === 'watercolor') {
      source.srcset = ''; img.src = 'assets/scenes/journal-character-male-watercolor.webp';
    } else {
      source.srcset = '';
      img.src = illustrationSource('generic', pref);
    }
  }
  function openPrefs() { renderPrefs(); $('#prefs-overlay').hidden = false; document.body.classList.add('modal-open'); }
  function closePrefs() { $('#prefs-overlay').hidden = true; document.body.classList.remove('modal-open'); }

  function illustrationSource(key, pref) {
    pref = pref || preferences.read();
    var motifs = {
      commute: '<rect x="161" y="171" width="198" height="113" rx="25"/><path d="M182 202h156M194 284l-17 30m166-30 17 30"/><circle cx="210" cy="260" r="7"/><circle cx="311" cy="260" r="7"/>',
      work: '<rect x="164" y="150" width="192" height="151" rx="7"/><path d="M192 185h118M192 211h104M192 237h86M324 258l44-92"/>',
      food: '<ellipse cx="260" cy="252" rx="112" ry="39"/><path d="M204 181h104v68H204zM308 188q45-8 37 25-5 18-37 18M198 263h129"/>',
      walk: '<path d="M107 291q99-106 203-35 49 34 100 0M174 235V132m-39 74 39-81 39 81m124 40V145m-32 65 32-73 32 73"/>',
      home: '<path d="M149 224 260 131l111 93M174 210v106h172V210M235 315v-67h50v67M299 227h26v26h-26z"/>',
      night: '<path d="M273 112a93 93 0 1 0 105 131 104 104 0 1 1-105-131Z"/><path d="M132 161h25m-12-12v25m220-21h25m-12-12v25"/>',
      study: '<path d="M260 170q-53-34-111-14v124q62-17 111 17 49-34 111-17V156q-58-20-111 14Zm0 0v127M173 190h59m-59 23h59m115-23h-59m59 23h-59"/>',
      city: '<path d="M127 302V194h65v108m15 0V153h86v149m15 0V206h79v96M151 223h18m-18 27h18m61-63h40m-40 30h40m-40 30h40m61-10h32"/>',
      generic: '<path d="M145 164q56-19 115 13 59-32 115-13v143q-56-19-115 13-59-32-115-13V164Zm115 13v143M168 200h66m-66 28h66m118-28h-66m66 28h-66"/>'
    };
    var bg = pref.artStyle === 'postcard' ? '#efe6d6' : pref.artStyle === 'minimal' ? '#f8f6ef' : '#f4ece3';
    var ink = pref.artStyle === 'postcard' ? '#675c55' : '#766b60';
    var figure = '';
    if (pref.character === 'female') figure = '<g stroke="' + ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M390 185q-3-40 30-44 36 2 31 48l8 42-18-8-43 2-17 7z" fill="#554e49"/><ellipse cx="420" cy="184" rx="23" ry="29" fill="#ead5c7"/><path d="M392 169q23-33 55 1m-51 26-7 33m59-33 8 33" fill="none"/><path d="M398 229q22-16 44 0l6 46-56 0z" fill="#c99894"/><path d="M393 273h54l14 43h-82z" fill="#c99894"/><path d="M396 314v19m47-19v19M395 245l-19 42m70-42 18 42" fill="none"/></g>';
    if (pref.character === 'male') figure = '<g stroke="' + ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="420" cy="184" rx="23" ry="28" fill="#ead5c7"/><path d="M398 180q-4-38 23-39 28 0 28 34l-11-7-9-14-10 14z" fill="#514b47"/><path d="M397 225q22-14 46 0l7 70h-60z" fill="#8da49c"/><path d="M406 226l14 16 14-16" fill="none"/><path d="M394 245l-17 44m70-44 17 44M399 294v39m42-39v39" fill="none"/></g>';
    var border = pref.artStyle === 'postcard' ? '<rect x="24" y="24" width="472" height="342" rx="5" fill="none" stroke="#b6a997" stroke-width="2"/><circle cx="436" cy="74" r="25" fill="none" stroke="#b6a997" stroke-width="2"/>' : '';
    var washes = pref.artStyle === 'minimal' ? '' : pref.artStyle === 'postcard'
      ? '<rect x="39" y="39" width="442" height="312" fill="#e7d9c5" opacity=".36"/>'
      : '<ellipse cx="250" cy="234" rx="205" ry="135" fill="#d8e5db" opacity=".66"/><ellipse cx="334" cy="159" rx="113" ry="91" fill="#e8cfc5" opacity=".28"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 390"><rect width="520" height="390" fill="' + bg + '"/>' + washes + border + '<g fill="none" stroke="' + ink + '" stroke-width="' + (pref.artStyle === 'minimal' ? '3' : '4') + '" stroke-linecap="round" stroke-linejoin="round">' + (motifs[key] || motifs.generic) + '</g>' + figure + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function maleWatercolorPath(key) {
    return key === 'generic' ? 'assets/scenes/journal-character-male-watercolor.webp' :
      'assets/scenes/' + key + '-male-watercolor.webp';
  }

  var toastTimer = null;
  function toast(msg, opts) {
    var t = $('#toast');
    t.innerHTML = esc(msg) + (opts && opts.actionLabel ? '<button type="button" class="toast-action">' + esc(opts.actionLabel) + '</button>' : '');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, opts && opts.actionLabel ? 5200 : 2300);
    var act = opts && opts.actionLabel ? t.querySelector('.toast-action') : null;
    if (act) act.onclick = function () {
      clearTimeout(toastTimer);
      t.classList.remove('show');
      if (opts.onAction) opts.onAction();
    };
  }

  /* ---------------- 页面切换 ---------------- */
  function go(page) {
    state.page = page;
    $$('.page').forEach(function (p) { p.classList.toggle('active', p.dataset.page === page); });
    document.body.dataset.page = page;
    window.scrollTo(0, 0);
    if (page === 'start') { initStart(); }
    if (page === 'record') mountRecord();
    if (page === 'confirm') mountConfirm();
    if (page === 'calendar') mountCalendar();
    if (page === 'replay') mountReplay(state.replay, state.historyMode);
  }

  /* ---------------- 00 Start ---------------- */
  function initStart() {
    var now = new Date();
    var startDate = $('#start-date');
    if (startDate) startDate.textContent = (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · 星期' + WEEKDAYS[now.getDay()];
    $('#btn-cal-entry').hidden = store.count() === 0;
    $('#btn-start').onclick = function () {
      state.editingDate = null;
      state.editingOriginalReplay = null;
      state.rawText = '';
      state.moodHint = null;
      state.recordPhotoId = null;
      state.recordPhotoRemoved = false;
      state.exampleMeta = null;
      state.examplePhotos = [];
      var cover = $('#journal-cover');
      if (!cover || cover.classList.contains('is-opening')) return;
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { go('record'); return; }
      cover.classList.add('is-opening');
      setTimeout(function () { cover.classList.remove('is-opening'); go('record'); }, 390);
    };
    $('#guess-text').textContent = '还没想好怎么写？';
    $('#guess-cta').textContent = '选一页示例看看 →';
    $('#btn-guess').onclick = function () {
      state.examplePickerOpen = !state.examplePickerOpen;
      renderExamples();
    };
    renderExamples();
    $('#btn-cal-entry').onclick = function () {
      var now = new Date();
      state.calY = now.getFullYear();
      state.calM = now.getMonth();
      go('calendar');
    };
  }

  function renderExamples() {
    var list = $('#example-list');
    list.hidden = !state.examplePickerOpen;
    list.innerHTML = '';
    if (!state.examplePickerOpen) return;
    demo.EXAMPLES.forEach(function (ex) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'example-choice';
      var pref = preferences.read();
      var source = ex.photos[0].path;
      button.innerHTML = '<img alt="预置示例照片"><span><strong>' + esc(ex.title) + '</strong><small>' + esc(ex.preview || ex.raw_text.slice(0, 30)) + '</small></span>';
      $('img', button).src = source;
      button.onclick = function () { loadExample(ex); };
      list.appendChild(button);
    });
  }

  function loadExample(ex) {
    /* 预置示例先回到输入页；照片作为已有 Photo ID 进入确认与回放。 */
    state.rawText = ex.raw_text;
    state.moodHint = ex.mood_hint ? { emoji: ex.mood_hint.emoji, label: ex.mood_hint.label } : null;
    state.fragments = [];
    state.analysis = null;
    state.contentMode = 'legacy_v04';
    state.editingDate = null;
    state.editingOriginalReplay = null;
    state.recordPhotoId = null;
    state.recordPhotoRemoved = false;
    state.exampleMeta = { id: ex.id, title: ex.title, raw_text: ex.raw_text };
    state.examplePhotos = ex.photos.map(function (item, index) {
      return { path: item.path, label: item.label, scene: item.scene, id: 'showcase_' + ex.id + '_' + index };
    });
    go('record');
  }

  /* ---------------- 01 Record ---------------- */
  function mountRecord() {
    var d = state.editingDate ? new Date(state.editingDate + 'T12:00:00') : new Date();
    $('#record-date').textContent = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WEEKDAYS[d.getDay()];
    $('.record-title').innerHTML = state.editingDate ? '那一天，<br>还想补上什么？' : '今天，<br>有什么想留下来？';
    $('#btn-record').textContent = state.editingDate ? '整理这一页' : '留下今天';
    /* v0.4：日记纸头 + 固定示例库随机 placeholder + 软引导面板复位 */
    var dEl = $('#diary-date');
    if (dEl) dEl.textContent = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WEEKDAYS[d.getDay()];
    var ta = $('#input-today');
    if (!(ta.getAttribute('placeholder') || '').trim()) {
      ta.setAttribute('placeholder', RECORD_EXAMPLES[Math.floor(Math.random() * RECORD_EXAMPLES.length)]);
    }
    if (ta.value !== state.rawText) ta.value = state.rawText;
    var panel = $('#short-panel');
    if (panel) panel.hidden = true;
    renderMoodSel();
    renderRecordPhoto();
    renderExamplePhotos();
    renderRecordReminder();
    refreshRecordState();
  }

  function renderExamplePhotos() {
    var panel = $('#example-record-panel');
    panel.hidden = !state.exampleMeta;
    $('#record-photo-card').hidden = !!state.exampleMeta;
    if (!state.exampleMeta) return;
    $('#example-record-title').textContent = state.exampleMeta.title;
    var gallery = $('#example-photo-gallery');
    gallery.innerHTML = '';
    state.examplePhotos.forEach(function (item) {
      var figure = document.createElement('figure');
      figure.innerHTML = '<img src="' + esc(item.path) + '" alt="' + esc(item.label) + '"><figcaption>' + esc(item.label) + '</figcaption>';
      gallery.appendChild(figure);
    });
  }

  function renderRecordPhoto() {
    var preview = $('#record-photo-preview');
    var button = $('#btn-record-photo');
    preview.innerHTML = '';
    preview.hidden = !state.recordPhotoId;
    button.textContent = state.recordPhotoId ? '换一张照片' : '添加照片';
    button.onclick = function () { $('#input-record-photo').click(); };
    if (!state.recordPhotoId) return;
    var currentId = state.recordPhotoId;
    var image = document.createElement('img');
    image.alt = '这一天的真实照片';
    photoUrl(currentId).then(function (url) { if (url && state.recordPhotoId === currentId) image.src = url; });
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-text';
    remove.textContent = '先不放照片';
    remove.onclick = function () { state.recordPhotoId = null; state.recordPhotoRemoved = true; renderRecordPhoto(); };
    preview.appendChild(image);
    preview.appendChild(remove);
  }

  function renderRecordReminder() {
    var saved = $('#reminder-saved');
    var reminders = preferences.read().reminders;
    var dates = Object.keys(reminders).sort().filter(function (date) { return date >= schema.todayISO(); });
    saved.hidden = dates.length === 0;
    saved.innerHTML = dates.length ? '已收好：' + esc(dates[0]) + ' · ' + esc(reminders[dates[0]]) +
      ' <button type="button" class="btn-text" id="btn-reminder-remove">取消这条</button>' : '';
    if (dates.length) $('#btn-reminder-remove').onclick = function () {
      if (preferences.removeReminder(dates[0])) { toast('这条提醒已取下'); renderRecordReminder(); }
      else toast('暂时没能更改提醒');
    };
    var dateInput = $('#reminder-date');
    if (!dateInput.value) {
      var next = new Date(); next.setDate(next.getDate() + 1);
      dateInput.value = isoOf(next.getFullYear(), next.getMonth(), next.getDate());
    }
  }

  function isPresetMood(mh, m) {
    return mh && mh.label === m.label && mh.emoji === m.emoji;
  }
  function isCustomMood(mh) {
    return !!mh && !MOODS.some(function (m) { return isPresetMood(mh, m); });
  }

  function renderMoodSel() {
    var box = $('#mood-row');
    box.innerHTML = '';
    MOODS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      var on = isPresetMood(state.moodHint, m);
      b.className = 'mood-chip' + (on ? ' on' : '');
      b.innerHTML = '<i class="mood-icon">' + moodIcon(m.label) + '</i><span>' + esc(m.label) + '</span>';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.onclick = function () {
        state.moodHint = on ? null : { emoji: m.emoji, label: m.label };
        state.moodCustomOpen = false;
        renderMoodSel();
      };
      box.appendChild(b);
    });

    /* 自定义 chip（选中态展示） */
    if (isCustomMood(state.moodHint)) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'mood-chip mood-chip-custom on';
      c.innerHTML = '<i class="mood-icon">' + moodIcon(state.moodHint.label) + '</i><span>' + esc(state.moodHint.label) + '</span>';
      c.setAttribute('aria-pressed', 'true');
      c.setAttribute('aria-label', '自定义心情 ' + state.moodHint.label + '，点击取消');
      c.onclick = function () {
        state.moodHint = null;
        renderMoodSel();
      };
      box.appendChild(c);
    }

    /* ＋ 自定义 入口 */
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'mood-chip mood-add' + (state.moodCustomOpen ? ' open' : '');
    add.innerHTML = '<i class="mood-icon">' + moodIcon('custom') + '</i><span>自定义</span>';
    add.setAttribute('aria-expanded', state.moodCustomOpen ? 'true' : 'false');
    add.setAttribute('aria-label', '自定义心情');
    add.onclick = function () {
      state.moodCustomOpen = !state.moodCustomOpen;
      renderMoodSel();
    };
    box.appendChild(add);

    /* 轻量自定义输入区（Mood Card 内展开） */
    if (state.moodCustomOpen) {
      var area = document.createElement('div');
      area.className = 'mood-custom-area';
      area.innerHTML =
        '<input type="text" class="mood-emoji-input" maxlength="8" placeholder="💭" aria-label="自定义心情的 Emoji（可留空）">' +
        '<input type="text" class="mood-label-input" maxlength="8" placeholder="2～8 个字的描述" aria-label="自定义心情描述（2～8 个字）">' +
        '<div class="mood-custom-actions">' +
        '<button type="button" class="btn-mini btn-mini-primary">确认</button>' +
        '<button type="button" class="btn-mini btn-mini-ghost">取消</button>' +
        '</div>' +
        '<p class="mood-custom-hint">Emoji 可留空（默认 💭）；描述 2～8 个字。</p>';
      var ei = $('.mood-emoji-input', area), li = $('.mood-label-input', area);
      /* 编辑已有自定义时预填 */
      if (isCustomMood(state.moodHint)) {
        ei.value = state.moodHint.emoji;
        li.value = state.moodHint.label;
      }
      $('.btn-mini-primary', area).onclick = function () {
        var label = li.value.trim();
        var cpLen = Array.from(label).length;
        if (cpLen < 2 || cpLen > 8) { toast('描述需要 2～8 个字'); li.focus(); return; }
        var emoji = Array.from(ei.value.trim()).slice(0, 4).join('') || '💭';
        state.moodHint = { emoji: emoji, label: label };
        state.moodCustomOpen = false;
        renderMoodSel();
      };
      $('.btn-mini-ghost', area).onclick = function () {
        state.moodCustomOpen = false;
        renderMoodSel();
      };
      box.appendChild(area);
      setTimeout(function () { try { li.focus(); } catch (e) {} }, 30);
    }
  }

  function refreshRecordState() {
    var ta = $('#input-today');
    $('#btn-record').disabled = ta.value.trim().length === 0;
    var p = $('#short-panel');
    if (p && !p.hidden) p.hidden = true;
  }

  /* v0.4：固定输入示例库（正式设计；历史测试内容一律不进 placeholder） */
  var RECORD_EXAMPLES = [
    '早上出门有点赶，下午一直在改一个拖了很久的东西，晚上终于弄完，整个人突然松了下来。',
    '中午吃到一家很好吃的小店，下午路上看到天特别蓝，其实没发生什么大事，但心情不错。',
    '今天知道了一件不太开心的事，本来有点不想继续做事，后来还是去自习室把今天的任务完成了。',
    '上午上课，中午和朋友一起吃饭，晚上回宿舍前慢慢走了一段路。'
  ];

  function goConfirmFromRecord(text) {
    if (state.exampleMeta && text.replace(/\s+/g, '') !== state.exampleMeta.raw_text.replace(/\s+/g, '')) {
      state.exampleMeta = null;
      state.examplePhotos = [];
    }
    state.rawText = text;
    state.moodHint = state.moodHint || null;
    var targetDate = state.editingDate || schema.todayISO();
    var proposal = fragmentEntry ? fragmentEntry.analyze({
      text: text, date: targetDate, userFeeling: state.moodHint
    }) : {
      mode: 'legacy_v04', analysis: null,
      fragments: engine.proposeFragments(text).map(function (f) { return { event: f.event, time: f.time, photo_id: null, preset: null }; }),
      debug: null
    };
    state.fragments = proposal.fragments;
    if (state.editingOriginalReplay) {
      state.fragments.forEach(function (fragment, index) {
        var match = state.editingOriginalReplay.scenes.find(function (scene) { return scene.event === fragment.event; });
        if (match && match.photo_id && !(index === 0 && state.recordPhotoRemoved)) fragment.photo_id = match.photo_id;
      });
    }
    if (state.recordPhotoId && state.fragments.length) state.fragments[0].photo_id = state.recordPhotoId;
    if (state.exampleMeta && proposal.mode === 'mock_v05') state.examplePhotos.forEach(function (item) {
      if (state.fragments[item.scene]) state.fragments[item.scene].photo_id = item.id;
    });
    state.analysis = proposal.analysis;
    state.contentMode = proposal.mode;
    if (Today.content) {
      Today.content.debug = Today.content.debug || {};
      Today.content.debug.last = proposal.debug; // local, in-memory diagnostic only
    }
    go('confirm');
    if (fragmentEntry && proposal.mode === 'legacy_v04') toast('这一页先照着你写下的话排一排，哪里不贴切都可以改。');
  }

  function submitToday() {
    var ta = $('#input-today');
    var text = ta.value.trim();
    if (!text) return;
    /* v0.4：短输入软引导——不硬阻断、不编造；事实够几幕就生成几幕 */
    var effective = text.replace(/[，。、,.!！?？;；:：\s\n]/g, '');
    if (effective.length < 14) {
      var panel = $('#short-panel');
      if (panel) panel.hidden = false;
      ta.focus();
      return;
    }
    goConfirmFromRecord(text);
  }

  /* ---------------- 02 Fragment Confirm ---------------- */
  function mountConfirm() {
    if (state.editingDate) {
      var p = state.editingDate.split('-');
      $('#confirm-editing').hidden = false;
      $('#confirm-editing').textContent = '正在修改 ' + parseInt(p[1], 10) + ' 月 ' + parseInt(p[2], 10) + ' 日的这一页';
    } else {
      $('#confirm-editing').hidden = true;
    }
    updateConfirmTitle();
    /* 原始记录：默认折叠，仅作核对参考 */
    $('#confirm-raw').hidden = true;
    $('#confirm-raw-text').textContent = state.rawText || '';
    var tg = $('#btn-raw-toggle');
    tg.setAttribute('aria-expanded', 'false');
    tg.textContent = '看看最初写下的话 ▾';
    state.fragments.forEach(function (f) { f._editing = false; f._timeOpen = false; f._tpH = undefined; f._tpM = undefined; f._draft = undefined; });
    state.menuIdx = null;
    state.addingFrag = null;
    renderConfirmArea();
  }

  /* Confirm 区域整体刷新：卡片 + 新增区 + 标题数量 */
  function renderConfirmArea() {
    renderFrags();
    renderAddZone();
    updateConfirmTitle();
    updateConfirmModeNote();
  }
  function mockFragmentsUnchanged(frags) {
    if (!state.analysis || state.contentMode !== 'mock_v05' || frags.length !== state.analysis.fragments.length) return false;
    var proposed = Today.content.fragmentEntry.toConfirmFragments(state.analysis);
    return frags.every(function (frag, i) {
      return frag.source_fragment_id === proposed[i].source_fragment_id && frag.event === proposed[i].event;
    });
  }
  function updateConfirmModeNote() {
    var note = $('#confirm-mode-note');
    var changedMock = state.contentMode === 'mock_v05' && !mockFragmentsUnchanged(state.fragments);
    note.hidden = !changedMock && state.contentMode === 'mock_v05';
    note.textContent = state.exampleMeta ? '这是一页预写示例，用来体验整理、回放和日历；不代表任意记录都能得到同样的文字。' :
      changedMock ? '片段已经按你的意思改过。新画面会按这些片段做基础整理，先预览，满意后再保存。' :
      '这次先按你写下的话做基础整理。请检查每个片段，生成后也能先预览再保存。';
  }
  function updateConfirmTitle() {
    var el = $('#confirm-title');
    if (el) el.textContent = '看看今天记下了什么';
    var sub = $('#confirm-sub');
    if (sub) sub.textContent = state.fragments.length === 1
      ? '先留下这一段。哪里不准确，都可以改成你的说法。'
      : '这一天留下了 ' + state.fragments.length + ' 段时光。哪里不准确，都可以改成你的说法。';
  }

  /* 删除片段（含撤销 Toast，不弹二次确认） */
  function deleteFrag(i) {
    var removed = state.fragments.splice(i, 1)[0];
    state.menuIdx = null;
    renderConfirmArea();
    toast('已删除片段 ' + (i + 1), {
      actionLabel: '撤销',
      onAction: function () {
        state.fragments.splice(Math.min(i, state.fragments.length), 0, removed);
        renderConfirmArea();
      }
    });
  }

  function photoIdFor(i) {
    var d = (state.editingDate || schema.todayISO()).replace(/-/g, '');
    return 'photo_daily_' + d + '_scene_' + (i + 1) + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function renderFrags() {
    var list = $('#frag-list');
    list.innerHTML = '';
    state.fragments.forEach(function (f, i) { list.appendChild(renderFragCard(f, i)); });
  }

  /* 只重渲染第 i 张卡，避免整页刷新打断输入 */
  function rerenderCard(i) {
    var list = $('#frag-list');
    var old = list.children[i];
    if (old) list.replaceChild(renderFragCard(state.fragments[i], i), old);
    else renderFrags();
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function renderFragCard(f, i) {
    var card = document.createElement('article');
    card.className = 'frag-card card-paper n' + (i % 4);

    /* ---- 编辑态 ---- */
    if (f._editing) {
      card.classList.add('editing');
      card.innerHTML =
        '<div class="frag-head"><span class="frag-num" aria-hidden="true">' + pad2(i + 1) + '</span></div>' +
        '<textarea class="frag-event-input" rows="3" aria-label="片段 ' + (i + 1) + ' 的内容"></textarea>' +
        '<div class="frag-edit-actions">' +
        '<button type="button" class="btn-mini btn-mini-primary">保存修改</button>' +
        '<button type="button" class="btn-mini btn-mini-ghost">取消</button>' +
        '</div>';
      var ta = $('.frag-event-input', card);
      ta.value = f._draft !== undefined ? f._draft : f.event;
      ta.addEventListener('input', function () { f._draft = ta.value; });
      setTimeout(function () { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }, 30);
      var btns = $$('.btn-mini', card);
      btns[0].onclick = function () {
        var v = ta.value.trim();
        if (v && v !== f.event) {
          f.event = v;
          f.stage_title = null; // The old Mock label may no longer fit the user's edit.
          f.source_fragment_id = null;
          f.source_event_ids = [];
          f.provenance = 'user_edited';
        }
        f._editing = false;
        f._draft = undefined;
        rerenderCard(i);
        updateConfirmModeNote();
      };
      btns[1].onclick = function () {
        f._editing = false;
        f._draft = undefined;
        rerenderCard(i);
      };
      return card;
    }

    /* ---- 阅读态 ---- */
    var last = state.fragments.length - 1;
    card.innerHTML =
      '<div class="frag-head">' +
      '<span class="frag-num" aria-hidden="true">' + pad2(i + 1) + '</span>' +
      '<div class="frag-tools">' +
      '<button type="button" class="frag-move frag-move-up"' + (i === 0 ? ' disabled' : '') + ' aria-label="上移片段 ' + (i + 1) + '">↑</button>' +
      '<button type="button" class="frag-move frag-move-down"' + (i === last ? ' disabled' : '') + ' aria-label="下移片段 ' + (i + 1) + '">↓</button>' +
      '<div class="frag-menu-wrap">' +
      '<button type="button" class="frag-menu-btn" aria-haspopup="true" aria-expanded="' + (state.menuIdx === i) + '" aria-label="片段 ' + (i + 1) + ' 的操作">···</button>' +
      (state.menuIdx === i ? '<div class="frag-menu" role="menu"><button type="button" class="frag-menu-item" role="menuitem">删除这个片段</button></div>' : '') +
      '</div>' +
      '<button type="button" class="frag-edit-btn">✎ 编辑</button>' +
      '</div>' +
      '</div>' +
      '<p class="frag-event-text">' + (f.stage_title ? '<strong>' + esc(f.stage_title) + '</strong><br>' : '') + esc(f.event) + '</p>' +
      '<div class="frag-time-slot"></div>' +
      '<div class="frag-photo-slot"></div>';

    var up = $('.frag-move-up', card), down = $('.frag-move-down', card);
    if (up && !up.disabled) up.onclick = function () {
      var t = state.fragments[i - 1]; state.fragments[i - 1] = state.fragments[i]; state.fragments[i] = t;
      state.menuIdx = null; renderConfirmArea();
    };
    if (down && !down.disabled) down.onclick = function () {
      var t = state.fragments[i + 1]; state.fragments[i + 1] = state.fragments[i]; state.fragments[i] = t;
      state.menuIdx = null; renderConfirmArea();
    };
    $('.frag-menu-btn', card).onclick = function (e) {
      e.stopPropagation();
      state.menuIdx = state.menuIdx === i ? null : i;
      renderFrags();
    };
    var delBtn = $('.frag-menu-item', card);
    if (delBtn) delBtn.onclick = function (e) { e.stopPropagation(); deleteFrag(i); };
    $('.frag-edit-btn', card).onclick = function () { f._editing = true; f._draft = undefined; rerenderCard(i); };
    renderTimeSlot($('.frag-time-slot', card), f, i);
    renderPhotoSlot($('.frag-photo-slot', card), f, i);
    return card;
  }

  /* 时间：无 → 胶囊「🕒 添加时间」；有 → 胶囊「🕒 HH:MM ✓」；点开 → Today 自绘时间选择浮层 */
  function renderTimeSlot(slot, f, i, rr) {
    var R = rr || function () { rerenderCard(i); };
    slot.innerHTML = '';
    if (f._timeOpen) {
      /* 初始化临时选择状态 */
      if (f._tpH === undefined) {
        f._tpH = f.time ? parseInt(f.time.slice(0, 2), 10) : null;
        f._tpM = f.time ? parseInt(f.time.slice(3, 5), 10) : null;
      }
      var box = document.createElement('div');
      box.className = 'frag-time-editor';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', '片段 ' + (i + 1) + ' 的时间选择');
      box.innerHTML =
        '<p class="frag-time-q">这个片段大概发生在？</p>' +
        '<p class="tp-big" aria-live="polite"><b class="tp-h">' + (f._tpH === null ? '‒‒' : pad2(f._tpH)) + '</b><i>:</i><b class="tp-m">' + (f._tpM === null ? '‒‒' : pad2(f._tpM)) + '</b></p>' +
        '<p class="tp-cap">小时</p>' +
        '<div class="tp-chips tp-hours" role="radiogroup" aria-label="小时"></div>' +
        '<p class="tp-cap">分钟</p>' +
        '<div class="tp-chips tp-mins" role="radiogroup" aria-label="分钟"></div>' +
        '<div class="frag-time-editor-row">' +
        '<button type="button" class="btn-mini btn-mini-primary">确认</button>' +
        '<button type="button" class="btn-mini btn-mini-ghost">不记录时间</button>' +
        '</div>';

      function chipRow(container, list, cur, onPick) {
        list.forEach(function (v) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'tp-chip' + (cur === v ? ' on' : '');
          c.textContent = pad2(v);
          c.setAttribute('role', 'radio');
          c.setAttribute('aria-checked', cur === v ? 'true' : 'false');
          c.onclick = function () { onPick(v); R(); };
          container.appendChild(c);
        });
      }
      chipRow($('.tp-hours', box), HOURS, f._tpH, function (v) { f._tpH = v; });
      chipRow($('.tp-mins', box), MINUTES, f._tpM, function (v) { f._tpM = v; });

      $('.btn-mini-primary', box).onclick = function () {
        if (f._tpH === null) { toast('先选一个小时'); return; }
        var mm = f._tpM === null ? 0 : f._tpM;
        f.time = pad2(f._tpH) + ':' + pad2(mm);
        f._timeOpen = false;
        R();
      };
      $('.btn-mini-ghost', box).onclick = function () {
        f.time = null;
        f._timeOpen = false;
        f._tpH = f._tpM = null;
        R();
      };
      slot.appendChild(box);
      return;
    }
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'frag-pill frag-pill-time' + (f.time ? ' has-time' : '');
    pill.textContent = f.time ? '🕒 ' + f.time + ' ✓' : '🕒 添加时间';
    pill.setAttribute('aria-label', '片段 ' + (i + 1) + (f.time ? ' 的时间 ' + f.time + '，点击修改' : '，添加时间（可选）'));
    pill.onclick = function () { f._tpH = f._tpM = undefined; f._timeOpen = true; R(); };
    slot.appendChild(pill);
  }

  /* 新增片段：＋ 添加一个片段（上限 5）；新增卡：正文/时间/照片/保存/取消 */
  var MAX_FRAGS = 5;
  function renderAddZone() {
    var zone = $('#frag-add-zone');
    if (!zone) return;
    zone.innerHTML = '';
    if (state.addingFrag) {
      var card = document.createElement('article');
      card.className = 'frag-card card-paper adding';
      card.innerHTML =
        '<div class="frag-head"><span class="frag-add-tag">＋ 新片段</span></div>' +
        '<textarea class="frag-event-input" rows="3" placeholder="这个片段发生了什么？"></textarea>' +
        '<div class="frag-time-slot"></div>' +
        '<div class="frag-photo-slot"></div>' +
        '<div class="frag-edit-actions">' +
        '<button type="button" class="btn-mini btn-mini-primary">保存片段</button>' +
        '<button type="button" class="btn-mini btn-mini-ghost">取消新增</button>' +
        '</div>';
      var ta = $('.frag-event-input', card);
      ta.value = state.addingFrag.event || '';
      ta.addEventListener('input', function () { state.addingFrag.event = ta.value; });
      var R = function () { renderConfirmArea(); };
      renderTimeSlot($('.frag-time-slot', card), state.addingFrag, state.fragments.length, R);
      renderPhotoSlot($('.frag-photo-slot', card), state.addingFrag, state.fragments.length, R);
      /* 只取操作区的两个按钮，避免把时间编辑器里的 mini 按钮误绑成保存/取消 */
      var acts = $$('.frag-edit-actions .btn-mini', card);
      acts[0].onclick = function () {
        var v = ta.value.trim();
        if (!v) { toast('先写一点这个片段的内容吧'); ta.focus(); return; }
        state.fragments.push({ event: v, time: state.addingFrag.time || null, photo_id: state.addingFrag.photo_id || null, provenance: 'user_added' });
        state.addingFrag = null;
        renderConfirmArea();
      };
      acts[1].onclick = function () {
        var pid = state.addingFrag.photo_id;
        state.addingFrag = null;
        if (pid) photos.del(pid);
        renderConfirmArea();
      };
      zone.appendChild(card);
      setTimeout(function () { try { ta.focus(); } catch (e) {} }, 30);
      return;
    }
    if (state.fragments.length >= MAX_FRAGS) return;
    var add = document.createElement('button');
    add.type = 'button';
    add.id = 'btn-frag-add';
    add.className = 'frag-add-btn';
    add.textContent = '＋ 添加一个片段';
    add.onclick = function () {
      state.addingFrag = { event: '', time: null, photo_id: null, _timeOpen: false };
      renderConfirmArea();
    };
    zone.appendChild(add);
  }

  /* 照片：无 → 胶囊「📷 添加照片」；有 → 缩略图 + 更换/删除 */
  function renderPhotoSlot(slot, f, i, rr) {
    var R = rr || function () { rerenderCard(i); };
    slot.innerHTML = '';
    if (f.photo_id) {
      var box = document.createElement('div');
      box.className = 'frag-photo-box';
      var thumb = document.createElement('div');
      thumb.className = 'frag-photo-thumb';
      thumb.setAttribute('role', 'img');
      thumb.setAttribute('aria-label', '片段 ' + (i + 1) + ' 的照片');
      var fb = document.createElement('span');
      fb.className = 'thumb-fallback';
      fb.textContent = '📷';
      thumb.appendChild(fb);
      photoUrl(f.photo_id).then(function (u) {
        if (u) { fb.remove(); thumb.style.backgroundImage = 'url(' + u + ')'; }
      });
      box.appendChild(thumb);
      var links = document.createElement('div');
      links.className = 'frag-photo-links';
      var bSwap = document.createElement('button');
      bSwap.type = 'button'; bSwap.textContent = '更换照片';
      var bDel = document.createElement('button');
      bDel.type = 'button'; bDel.className = 'is-del'; bDel.textContent = '删除';
      links.appendChild(bSwap); links.appendChild(bDel);
      box.appendChild(links);

      var file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.setAttribute('capture', 'environment');
      file.hidden = true;
      bSwap.onclick = function () { file.click(); };
      file.addEventListener('change', function () {
        var fl = file.files && file.files[0];
        if (!fl) return;
        var newId = photoIdFor(i);
        photos.compress(fl)
          .then(function (b) { return photos.put(newId, b); })
          .then(function () { f.photo_id = newId; R(); })
          .catch(function () { toast('照片没能加上，再试一次？'); });
      });
      bDel.onclick = function () {
        f.photo_id = null;
        R();
      };
      box.appendChild(file);
      slot.appendChild(box);
      return;
    }
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'frag-pill frag-pill-photo';
    pill.textContent = '📷 添加照片';
    pill.setAttribute('aria-label', '片段 ' + (i + 1) + '，添加照片（可选，每幕最多一张）');
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.setAttribute('capture', 'environment');
    file.hidden = true;
    pill.onclick = function () { file.click(); };
    file.addEventListener('change', function () {
      var fl = file.files && file.files[0];
      if (!fl) return;
      var id = photoIdFor(i);
      photos.compress(fl)
        .then(function (b) { return photos.put(id, b); })
        .then(function () { f.photo_id = id; R(); })
        .catch(function () { toast('照片没能加上，再试一次？'); });
    });
    slot.appendChild(pill);
    slot.appendChild(file);
  }

  /* ---------------- 03 Generating ---------------- */
  function mountGenerating(chips) {
    var status = $('#gen-status');
    status.textContent = GEN_STAGES[0];
    status.style.opacity = '1';
    var kwBox = $('#gen-keywords');
    kwBox.innerHTML = '';
    (chips || []).forEach(function (c, i) {
      var el = document.createElement('span');
      el.className = 'kw-chip k' + (i % 4);
      el.textContent = c.text + (c.photo ? ' 📷' : '');
      el.style.animationDelay = (350 + i * 420) + 'ms';
      kwBox.appendChild(el);
    });
    var pages = $('#gen-skeletons');
    pages.innerHTML = '';
    (chips || []).forEach(function (_, i) {
      var page = document.createElement('div');
      page.className = 'sk sk' + ((i % 3) + 1);
      page.innerHTML = '<span>第 ' + (i + 1) + ' 页</span>';
      pages.appendChild(page);
    });
    clearInterval(state.genTimer);
    var idx = 0;
    state.genTimer = setInterval(function () {
      idx = Math.min(idx + 1, GEN_STAGES.length - 1);
      status.style.opacity = '0';
      setTimeout(function () { status.textContent = GEN_STAGES[idx]; status.style.opacity = '1'; }, 240);
    }, 800);
  }

  function confirmedMockReplay(frags) {
    if (!contentPipeline || !Today.content.replayAdapter || !mockFragmentsUnchanged(frags)) return null;
    var ids = state.analysis.fragments.map(function (f) { return f.id; });
    var confirmed = contentPipeline.confirmFragments(state.analysis, ids);
    var contentReplay = contentPipeline.composeReplay(confirmed);
    contentReplay.scenes.forEach(function (scene, i) {
      scene.time = frags[i].time || null; // User-confirmed clock only.
      scene.photo_id = frags[i].photo_id || null;
    });
    var check = Today.content.validators.validateReplay(contentReplay);
    if (!check.ok) throw new Error('Invalid confirmed Replay: ' + check.errors[0].code);
    return Today.content.replayAdapter.toRenderableReplay(contentReplay);
  }

  async function runGenerate() {
    var frags = state.fragments.filter(function (f) { return f.event && String(f.event).trim(); });
    if (frags.length < 1) { toast('至少保留一个片段'); return; }
    state.fragments = frags;
    go('generating');
    var chips = frags.map(function (f) {
      var kw = engine.extractKeywords([f.event])[0] || String(f.event || '').slice(0, 6);
      return { text: kw, photo: !!f.photo_id };
    });
    mountGenerating(chips);
    var t0 = Date.now();
    var opts = {
      userMoodHint: state.moodHint,
      date: state.editingDate || schema.todayISO(),
      title: state.exampleMeta && state.exampleMeta.title,
      summary: state.exampleMeta && state.exampleMeta.summary
    };
    var replay = null;
    state.generationNote = '';
    try { replay = confirmedMockReplay(frags); } catch (e) {
      if (Today.content && Today.content.debug) Today.content.debug.story_error = String(e && e.message || e);
      replay = null;
    }
    if (!replay) {
      if (state.contentMode === 'mock_v05') state.generationNote = '片段已按你的改动重新做基础整理。旧的示例文案不会直接沿用。';
      try { replay = await engine.buildReplay(state.rawText, frags, opts); } catch (e) { replay = null; }
      if (!replay || !schema.validateDailyReplay(replay)) replay = engine.fallbackReplay(state.rawText, opts);
    }
    await sleep(Math.max(400, GEN_TOTAL_MS - (Date.now() - t0)));
    clearInterval(state.genTimer);
    state.replay = replay;
    state.historyMode = false;
    state.savedToday = false;
    go('replay');
  }

  /* ---------------- 04 Replay ---------------- */
  function artImg(scene, illustrationOnly) {
    /* 用户照片优先；主题插画随当前角色和画法选择。 */
    var wrap = document.createElement('div');
    wrap.className = 'art';
    var img = document.createElement('img');
    img.alt = scene.photo_id && !illustrationOnly ? '这一天添加的照片' : '与这一幕主题相关的固定绘本插画';
    img.loading = 'lazy';
    img.decoding = 'async';
    var chain = [];
    if (scene.photo_id && !illustrationOnly) chain.push({ type: 'photo', id: scene.photo_id });
    var pref = preferences.read();
    var useFemaleArt = pref.character === 'female' && pref.artStyle === 'watercolor';
    var useMaleArt = pref.character === 'male' && pref.artStyle === 'watercolor';
    var keys = Today.content && Today.content.contracts ? Today.content.contracts.IMAGE_KEYS :
      ['commute', 'work', 'food', 'walk', 'home', 'night', 'study', 'city', 'generic'];
    var key = keys.indexOf(scene.image_key) !== -1 ? scene.image_key : 'generic';
    if (useMaleArt) chain.push({ type: 'asset', path: maleWatercolorPath(key) });
    if (useFemaleArt && scene.image_asset && /^assets\/scenes\/[a-z0-9-]+\.webp$/.test(scene.image_asset)) {
      chain.push({ type: 'asset', path: scene.image_asset });
    }
    if (useFemaleArt) {
      chain.push({ type: 'webp', key: key });
      chain.push({ type: 'svg', key: key });
      if (key !== 'generic') {
        chain.push({ type: 'webp', key: 'generic' });
        chain.push({ type: 'svg', key: 'generic' });
      }
    } else {
      chain.push({ type: 'illustration', key: key });
    }
    var idx = 0;
    function tryNext() {
      if (idx >= chain.length) {
        wrap.classList.add('art-fallback');
        img.onerror = null;
        img.alt = '水彩纸上的手绘日记本';
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 390"><rect width="520" height="390" fill="#f7f0e3"/>' +
          '<ellipse cx="252" cy="196" rx="151" ry="106" fill="#d6ded1" opacity=".42"/>' +
          '<ellipse cx="322" cy="183" rx="99" ry="91" fill="#e8cebc" opacity=".32"/>' +
          '<path d="M154 275 Q258 247 367 275 M191 265 V140 Q246 126 260 152 Q302 126 333 140 V265 Q288 247 260 269 Q221 247 191 265Z" fill="#fcf8ee" stroke="#786b5e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M260 152 V269 M205 170 Q231 163 246 171 M205 188 Q230 181 245 188 M275 171 Q301 163 319 171 M276 190 Q301 183 319 190" fill="none" stroke="#9d8f7f" stroke-width="2" stroke-linecap="round"/></svg>');
        return;
      }
      var item = chain[idx++];
      if (item.type === 'photo') {
        photoUrl(item.id).then(function (u) {
          if (u) { wrap.classList.add('has-photo'); img.src = u; }
          else tryNext();
        }).catch(tryNext);
      } else {
        img.src = item.type === 'asset' ? item.path : item.type === 'illustration' ? illustrationSource(item.key, pref) : item.type === 'webp' ? schema.imageUrl(item.key) : schema.svgUrl(item.key);
      }
    }
    img.addEventListener('error', tryNext);
    tryNext();
    wrap.appendChild(img);
    return wrap;
  }

  function sceneSection(s, i, replay) {
    var sec = document.createElement('section');
    sec.className = 'reel-sec reel-scene s' + (i % 3);
    sec.innerHTML =
      (s.time ? '<p class="scene-time">' + esc(s.time) + '</p>' : '') +
      '<figure class="scene-figure g' + (i % 3) + '" role="img" aria-label="' + esc(s.title) + '">' +
      (s.photo_id ? '<span class="scene-photo-date">' + (/^showcase_/.test(s.photo_id) ? '预置照片素材' : '照片记录') + '</span>' : '') +
      '</figure>' +
      '<h3 class="scene-title">' + esc(s.title) + '</h3>' +
      (s.photo_id ? '<div class="scene-art-companion"><span>主题插画</span></div>' : '<p class="scene-art-note">这一幕用主题插画留住画面；你也可以在编辑时换成当天照片。</p>') +
      '<p class="scene-caption">' + esc(s.caption) + '</p>';
    sec.querySelector('.scene-figure').appendChild(artImg(s));
    if (s.photo_id) sec.querySelector('.scene-art-companion').appendChild(artImg(s, true));
    return sec;
  }

  function curveHTML(curve) {
    return curve.map(function (e) {
      return '<span class="curve-node"><i class="curve-emoji">' + esc(e.emoji) + '</i><b class="curve-label">' + esc(e.label) + '</b></span>';
    }).join('<i class="curve-link" aria-hidden="true"></i>');
  }

  function feelingObservationHTML(replay) {
    if (replay.version === '0.5') {
      var feeling = replay.user_feeling ?
        '<div class="memory-note"><span class="memory-note-label">你记录的感受</span><p>' + esc(replay.user_feeling.label) + '</p></div>' : '';
      var observation = replay.ai_observation ?
        '<div class="memory-note observation"><span class="memory-note-label">Today 的观察 · 并非你的原话</span><p>' + esc(replay.ai_observation.text) + '</p></div>' : '';
      return feeling + observation;
    }
    return replay.user_mood_hint ?
      '<div class="memory-note"><span class="memory-note-label">你选择的感受</span><p>' + esc(replay.user_mood_hint.label) + '</p></div>' : '';
  }

  function reflectionHTML(replay) {
    if (replay.version === '0.5' && replay.reflection) return '<div class="reflection"><p class="reflection-label"><span class="journal-script" lang="en">for later</span>Today 写给这一天 <small>示例文案</small></p>' +
      '<p class="reflection-text">' + esc(replay.reflection.text) + '</p></div>';
    return '<div class="reflection legacy-reflection"><p class="reflection-label"><span class="journal-script" lang="en">looking back</span>回望这一天</p>' +
      '<p class="reflection-text">' + esc(memoryReflection(replay)) + '</p></div>';
  }

  function memoryReflection(replay) {
    if (replay.version === '0.5' && replay.reflection && replay.reflection.text) return replay.reflection.text;
    var summary = String(replay.summary || '');
    if (summary && !/(值得留下|值得记住|普通的一天|平平静静|有点辛苦的一天|从一点.+到最后)/.test(summary)) return summary;
    return engine.factSummary(replay.scenes);
  }

  function endSection(replay, historyMode) {
    var m = parseInt(replay.date.slice(5, 7), 10);
    var d = parseInt(replay.date.slice(8, 10), 10);
    var isToday = replay.date === schema.todayISO();
    var end = document.createElement('section');
    end.className = 'reel-sec reel-end';
    var cta = '';

    if (historyMode || state.savedToday) {
      cta =
        '<button type="button" class="btn-primary" id="btn-end-cal">回到日记目录</button>' +
        '<button type="button" class="btn-secondary" id="btn-end-replay2">再读一遍</button>' +
        '<button type="button" class="btn-ghost end-ghost" id="btn-end-edit">' + (isToday ? '重新编辑今天' : '重新编辑这一天') + '</button>';
    } else {
      cta =
        '<button type="button" class="btn-primary" id="btn-save">' + (state.editingDate ? '收好修改后的这一页' : '收进日记') + '</button>' +
        '<button type="button" class="btn-secondary" id="btn-end-replay2">再读一遍</button>' +
        '<button type="button" class="btn-ghost end-ghost" id="btn-end-finish">结束回看</button>';
    }

    end.innerHTML = '<p class="end-kicker">这一页的末尾</p>' +
      feelingObservationHTML(replay) + reflectionHTML(replay) +
      (state.generationNote && !historyMode ? '<p class="save-mode-note">' + esc(state.generationNote) + '</p>' : '') +
      '<div class="reel-cta">' + cta + '</div>';

    var bCal = $('#btn-end-cal', end), bSave = $('#btn-save', end);
    var bReplay2 = $('#btn-end-replay2', end);
    var bEdit = $('#btn-end-edit', end), bFinish = $('#btn-end-finish', end);

    if (bCal) bCal.onclick = function () { go('calendar'); };
    if (bReplay2) bReplay2.onclick = function () { mountReplay(state.replay, state.historyMode); $('#reel').scrollTop = 0; };
    if (bEdit) bEdit.onclick = function () { loadForEdit(state.replay); };
    if (bFinish) bFinish.onclick = function () {
      if (store.count() > 0) go('calendar'); else go('start');
    };
    if (bSave) bSave.onclick = function () {
      var previous = store.getByDate(replay.date);
      if (previous && state.editingOriginalReplay && JSON.stringify(previous) !== JSON.stringify(state.editingOriginalReplay)) {
        toast('这一天在别处更新过了，请回日历重新打开');
        return;
      }
      if (previous) {
        var changedMode = previous.version === '0.5' && replay.version !== '0.5';
        var message = changedMode
          ? '这次会用基础方式重新整理，并替换旧页的回望文字。原来那页不会保留在日历里。确认收好新的一页吗？'
          : '这次修改会替换日历里原来那一页。确认收好吗？';
        if (!window.confirm(message)) return;
      }
      var res = store.save(replay);
      if (res.ok) {
        state.savedToday = true;
        if (res.overwritten) toast(isToday ? '今天的回放已更新' : m + ' 月 ' + d + ' 日的回放已更新');
        else toast('已记入 ' + m + ' 月 ' + d + ' 日');
        bSave.disabled = true;
        setTimeout(function () { go('calendar'); }, 950);
      } else {
        toast('今天的回放暂时没有保存成功。');
      }
    };
    return end;
  }

  function loadForEdit(replay) {
    state.rawText = replay.raw_text || (replay.raw_memory && replay.raw_memory.raw_text) || '';
    state.moodHint = replay.user_mood_hint ? { emoji: replay.user_mood_hint.emoji, label: replay.user_mood_hint.label } : null;
    state.fragments = [];
    state.analysis = null;
    state.contentMode = 'legacy_v04';
    state.editingDate = replay.date;
    state.editingOriginalReplay = JSON.parse(JSON.stringify(replay));
    state.recordPhotoId = (replay.scenes[0] && replay.scenes[0].photo_id) || null;
    state.recordPhotoRemoved = false;
    state.exampleMeta = null;
    go('record');
  }

  function beginPastEntry(iso) {
    state.rawText = '';
    state.moodHint = null;
    state.fragments = [];
    state.analysis = null;
    state.contentMode = 'legacy_v04';
    state.editingDate = iso;
    state.editingOriginalReplay = null;
    state.recordPhotoId = null;
    state.recordPhotoRemoved = false;
    state.exampleMeta = null;
    go('record');
  }


  /* ---------------- v0.4：Scene Title / Caption 用户可改（改成我的说法） ---------------- */
  function attachSceneEditors() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('#reel .reel-scene'));
    cards.forEach(function (card, idx) {
      if (card.querySelector('.scene-edit-btn')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scene-edit-btn';
      btn.textContent = '✎ 改成我的说法';
      btn.onclick = function () { openSceneEditor(card, idx); };
      card.appendChild(btn);
    });
  }
  function openSceneEditor(card, idx) {
    var sc = state.replay && state.replay.scenes[idx];
    if (!sc) return;
    var tEl = card.querySelector('.scene-title');
    var cEl = card.querySelector('.scene-caption');
    if (!tEl || !cEl || card.querySelector('.scene-title-input')) return;
    var ti = document.createElement('input');
    ti.type = 'text';
    ti.className = 'scene-title-input';
    ti.value = sc.title;
    ti.setAttribute('aria-label', '这一幕的标题');
    var ca = document.createElement('textarea');
    ca.className = 'scene-caption-input';
    ca.rows = 3;
    ca.value = sc.caption;
    ca.setAttribute('aria-label', '这一幕的描述');
    var row = document.createElement('div');
    row.className = 'scene-edit-actions';
    var okB = document.createElement('button');
    okB.type = 'button'; okB.className = 'btn-mini btn-mini-primary'; okB.textContent = '保存';
    var noB = document.createElement('button');
    noB.type = 'button'; noB.className = 'btn-mini btn-mini-ghost'; noB.textContent = '取消';
    row.appendChild(okB); row.appendChild(noB);
    tEl.replaceWith(ti);
    cEl.replaceWith(ca);
    var btn = card.querySelector('.scene-edit-btn');
    if (btn) btn.hidden = true;
    card.appendChild(row);
    okB.onclick = function () {
      var nt = ti.value.trim(), nc = ca.value.trim();
      if (nt) sc.title = nt;
      if (nc) sc.caption = nc;
      if (state.replay.version === '0.5') sc.provenance = 'user_edited';
      /* 已入库（历史重播 / 今日已存）：即时写回，日历与 Day Detail 同步 */
      if (state.historyMode || state.savedToday) {
        var saved = store.save(state.replay);
        toast(saved.ok ? '已按你的说法更新' : '修改还没有保存成功');
      }
      closeSceneEditor(card, idx);
    };
    noB.onclick = function () { closeSceneEditor(card, idx); };
  }
  function closeSceneEditor(card, idx) {
    var sc = state.replay.scenes[idx];
    var ti = card.querySelector('.scene-title-input');
    var ca = card.querySelector('.scene-caption-input');
    var row = card.querySelector('.scene-edit-actions');
    var btn = card.querySelector('.scene-edit-btn');
    if (ti) {
      var t = document.createElement('h3');
      t.className = 'scene-title';
      t.textContent = sc.title;
      ti.replaceWith(t);
    }
    if (ca) {
      var c = document.createElement('p');
      c.className = 'scene-caption';
      c.textContent = sc.caption;
      ca.replaceWith(c);
    }
    if (row && row.parentNode) row.parentNode.removeChild(row);
    if (btn) btn.hidden = false;
  }

  function mountReplay(replay, historyMode) {
    var reel = $('#reel');
    reel.innerHTML = '';
    reel.scrollTop = 0;
    if (!replay) { go('start'); return; }
    state.historyMode = !!historyMode;

    var head = document.createElement('section');
    head.className = 'reel-sec reel-head h' + (replay.scenes.length % 3);
    head.innerHTML =
      '<p class="reel-date">' + fmtDot(replay.date) + '</p>' +
      '<h2 class="reel-title">' + esc(engine.coverTitleForReplay(replay)) + '</h2>' +
      '<span class="swash" aria-hidden="true"></span>' +
      '<p class="reel-sub">' + (state.exampleMeta && !historyMode ? '这是一页预写示例。<br>可以试着改动片段，再看看回放如何变化。' : replay.version === '0.5'
        ? (replay.scenes.length === 1 ? '这一段记忆，<br>从这里慢慢翻开。' : '这一天留下的几页，<br>从这里慢慢翻开。')
        : '这是照着你写下的话翻开的一页。<br>哪里不贴切，还可以再改。') + '</p>' +
      '<div class="scroll-cue" aria-hidden="true"><i></i><i></i><i></i></div>';
    reel.appendChild(head);

    var sceneEls = replay.scenes.map(function (s, i) { return sceneSection(s, i, replay); });
    sceneEls.forEach(function (el) { reel.appendChild(el); });
    reel.appendChild(endSection(replay, historyMode));
    attachSceneEditors();

    var secs = [head].concat(sceneEls, [reel.lastElementChild]);
    var dots = $('#reel-dots');
    dots.innerHTML = '';
    secs.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rdot';
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 屏');
      b.onclick = function () { s.scrollIntoView({ behavior: 'smooth' }); };
      dots.appendChild(b);
    });
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var idx = secs.indexOf(en.target);
            $$('.rdot', dots).forEach(function (d, i) { d.classList.toggle('on', i === idx); });
            en.target.classList.add('in');
          }
        });
      }, { root: reel, threshold: 0.55 });
      secs.forEach(function (s) { obs.observe(s); });
    } else {
      secs.forEach(function (s) { s.classList.add('in'); });
    }

    $('#btn-replay-back').onclick = function () {
      if (historyMode) go('calendar');
      else if (state.fragments.length) go('confirm');
      else if (store.count() > 0) go('calendar');
      else go('record');
    };
  }

  /* ---------------- 05 Calendar ---------------- */
  function mountCalendar() {
    if (!state.calY) {
      var now = new Date();
      state.calY = now.getFullYear();
      state.calM = now.getMonth();
    }
    renderMonth();
  }

  function collageCells(container, scenes) {
    /* 拼贴：1 大 2 小；有照片的格子异步换成照片 */
    var s = scenes.slice(0, 3);
    var collage = document.createElement('span');
    collage.className = 'collage ' + (s.length >= 3 ? 'c3' : 'c1');
    var cells = s.map(function (sc) {
      var cell = document.createElement('i');
      var pic = document.createElement('img');
      pic.alt = '';
      var pref = preferences.read();
      if (pref.character === 'female' && pref.artStyle === 'watercolor') {
        pic.src = schema.imageUrl(sc.image_key);
        pic.onerror = function () { pic.onerror = null; pic.src = schema.svgUrl(sc.image_key); };
      } else if (pref.character === 'male' && pref.artStyle === 'watercolor') {
        var key = /^(commute|work|food|walk|home|night|study|city|generic)$/.test(sc.image_key) ? sc.image_key : 'generic';
        pic.src = maleWatercolorPath(key);
        pic.onerror = function () { pic.onerror = null; pic.src = illustrationSource(key, pref); };
      } else pic.src = illustrationSource(sc.image_key, pref);
      cell.appendChild(pic);
      if (sc.photo_id) {
        photoUrl(sc.photo_id).then(function (u) {
          if (u) { pic.src = u; cell.classList.add('is-photo'); }
        });
      }
      collage.appendChild(cell);
      return cell;
    });
    container.appendChild(collage);
    return cells;
  }

  function renderMonth() {
    var y = state.calY, m = state.calM;
    $('#cal-title').textContent = y + ' 年 ' + (m + 1) + ' 月';
    var grid = $('#cal-grid');
    grid.innerHTML = '';
    var replays = store.all();
    var todayIso = schema.todayISO();
    var prefs = preferences.read();
    var viewNames = { picture: '画面', note: '小字', feeling: '感受' };
    $('#cal-view-label').textContent = '当前：' + viewNames[prefs.calendarView];

    WEEKDAYS.forEach(function (w) {
      var h = document.createElement('div');
      h.className = 'cal-weekday';
      h.textContent = w;
      grid.appendChild(h);
    });

    var firstDow = new Date(y, m, 1).getDay();
    var daysIn = new Date(y, m + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < firstDow; i++) cells.push(null);
    for (var d = 1; d <= daysIn; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    cells.forEach(function (d) {
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (d === null) { cell.classList.add('empty'); grid.appendChild(cell); return; }
      var iso = isoOf(y, m, d);
      var r = replays[iso];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day' + (iso === todayIso ? ' today' : '');
      if (r) {
        btn.classList.add('has-replay');
        btn.classList.add('view-' + prefs.calendarView);
        if (prefs.calendarView === 'picture') collageCells(btn, r.scenes);
        if (prefs.calendarView === 'note') {
          var note = document.createElement('span'); note.className = 'cal-mini-note';
          note.textContent = (r.scenes[0] && r.scenes[0].title || '').replace(/[，,。]/g, '').slice(0, 2);
          btn.appendChild(note);
        }
        if (prefs.calendarView === 'feeling') {
          var feeling = document.createElement('span'); feeling.className = 'cal-mini-feeling';
          feeling.textContent = (r.user_feeling && r.user_feeling.label) || (r.user_mood_hint && r.user_mood_hint.label) || '记下了';
          btn.appendChild(feeling);
        }
        var num = document.createElement('span');
        num.className = 'cal-num';
        num.textContent = d;
        btn.appendChild(num);
        btn.setAttribute('aria-label', (m + 1) + ' 月 ' + d + ' 日，已有回放：' + engine.coverTitleForReplay(r));
        btn.onclick = function () { openDayDetail(iso); };
      } else {
        btn.innerHTML = '<span class="cal-num">' + d + '</span>';
        if (iso <= todayIso) {
          btn.classList.add('can-add');
          btn.setAttribute('aria-label', (m + 1) + ' 月 ' + d + ' 日，补记这一天');
          btn.onclick = function () { beginPastEntry(iso); };
        } else btn.disabled = true;
      }
      if (prefs.reminders[iso]) {
        var marker = document.createElement('span'); marker.className = 'cal-reminder-mark'; marker.title = '有一条提醒';
        marker.textContent = '·'; btn.appendChild(marker);
      }
      cell.appendChild(btn);
      grid.appendChild(cell);
    });
    var reminderBox = $('#cal-reminders');
    var monthPrefix = y + '-' + pad2(m + 1) + '-';
    var reminderDates = Object.keys(prefs.reminders).filter(function (date) { return date.indexOf(monthPrefix) === 0; }).sort();
    reminderBox.hidden = reminderDates.length === 0;
    reminderBox.innerHTML = reminderDates.length ? '<p class="record-extra-title">这月留给自己的提醒</p>' + reminderDates.map(function (date) {
      return '<p><strong>' + parseInt(date.slice(8), 10) + ' 日</strong> · ' + esc(prefs.reminders[date]) + '</p>';
    }).join('') : '';
  }

  /* ---------------- Day Detail 弹窗 ---------------- */
  function openDayDetail(iso) {
    var r = store.getByDate(iso);
    if (!r) return;
    var y = parseInt(iso.slice(0, 4), 10), m = parseInt(iso.slice(5, 7), 10), d = parseInt(iso.slice(8, 10), 10);
    var wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    var modal = $('#day-detail');
    modal.innerHTML =
      '<div class="dd-card" role="dialog" aria-modal="true" aria-label="' + m + ' 月 ' + d + ' 日详情">' +
      '<header class="dd-head"><p class="dd-date">' + m + ' 月 ' + d + ' 日 · 星期' + wd + '</p>' +
      '<button type="button" class="icon-btn" id="btn-dd-close" aria-label="关闭弹窗">×</button></header>' +
      '<div class="dd-body">' +
      '<h3 class="dd-title">' + esc(engine.coverTitleForReplay(r)) + '</h3>' +
      '<p class="dd-reflection">' + esc(memoryReflection(r)) + '</p>' +
      '<div class="dd-feelings">' + feelingObservationHTML(r) + '</div>' +
      '<details class="dd-original"><summary>看看最初写下的话</summary><p>' + esc(r.raw_text || (r.raw_memory && r.raw_memory.raw_text) || '') + '</p></details>' +
      '<div class="dd-scenes"></div>' +
      '<div class="dd-cta">' +
      '<button type="button" class="btn-primary" id="btn-dd-replay">再读一遍这一天</button>' +
      '<button type="button" class="btn-secondary" id="btn-dd-edit">编辑这一天</button>' +
      '<button type="button" class="btn-text" id="btn-dd-photo">' + (r.scenes[0].photo_id ? '更换第一页照片' : '给第一页加照片') + '</button>' +
      (r.scenes[0].photo_id ? '<button type="button" class="btn-text" id="btn-dd-photo-remove">移除第一页照片</button>' : '') +
      '<input type="file" id="input-dd-photo" accept="image/*" hidden>' +
      '</div></div></div>';

    /* Scene 纵向排列：编号 + 16:9 图 + 时间（如有）+ 事件 */
    var list = $('.dd-scenes', modal);
    r.scenes.forEach(function (sc, idx) {
      var art = document.createElement('article');
      art.className = 'dd-scene n' + (idx % 4);
      var head = document.createElement('div');
      head.className = 'dd-scene-head';
      head.innerHTML = '<span class="frag-num" aria-hidden="true">' + pad2(idx + 1) + '</span>' +
        (sc.time ? '<span class="dd-scene-time">' + esc(sc.time) + '</span>' : '');
      var fig = document.createElement('figure');
      fig.className = 'dd-scene-fig';
      fig.setAttribute('role', 'img');
      fig.setAttribute('aria-label', sc.title);
      fig.appendChild(artImg(sc));
      var tt = document.createElement('p');
      tt.className = 'dd-scene-title';
      tt.textContent = sc.title;
      var ev = document.createElement('p');
      ev.className = 'dd-scene-event';
      ev.textContent = sc.event;
      art.appendChild(head); art.appendChild(fig); art.appendChild(tt); art.appendChild(ev);
      list.appendChild(art);
    });

    modal.hidden = false;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    function close() {
      modal.hidden = true;
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      state.ddClose = null;
    }
    state.ddClose = close;
    $('#btn-dd-close', modal).onclick = close;
    /* 蒙层点击关闭；弹窗内部点击不冒泡关闭 */
    modal.onclick = function (e) { if (e.target === modal) close(); };
    $('#btn-dd-replay', modal).onclick = function () {
      close();
      state.replay = r;
      state.historyMode = true;
      go('replay');
    };
    $('#btn-dd-edit', modal).onclick = function () { close(); loadForEdit(r); };
    $('#btn-dd-photo', modal).onclick = function () { $('#input-dd-photo', modal).click(); };
    $('#input-dd-photo', modal).onchange = function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var id = 'photo_daily_' + iso.replace(/-/g, '') + '_detail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      photos.compress(file).then(function (blob) { return photos.put(id, blob); }).then(function () {
        var updated = JSON.parse(JSON.stringify(r));
        updated.scenes[0].photo_id = id;
        var saved = store.save(updated);
        if (saved.ok) { toast('照片已收进这一天，文字没有改动'); openDayDetail(iso); }
        else toast('照片暂时没能保存');
      }).catch(function () { toast('照片暂时没能加上'); });
    };
    var removePhoto = $('#btn-dd-photo-remove', modal);
    if (removePhoto) removePhoto.onclick = function () {
      var updated = JSON.parse(JSON.stringify(r));
      updated.scenes[0].photo_id = null;
      var saved = store.save(updated);
      if (saved.ok) { toast('照片已从这一页取下'); openDayDetail(iso); }
      else toast('照片暂时没能移除');
    };
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    applyPreferences();
    initStart();
    /* 点击菜单外区域收起片段 ··· 菜单 */
    document.addEventListener('click', function (e) {
      if (state.menuIdx === null) return;
      var t = e.target;
      if (t && t.closest && t.closest('.frag-menu-wrap')) return;
      state.menuIdx = null;
      if (state.page === 'confirm') renderFrags();
    });
    /* 桌面端 Esc 关闭 Day Detail */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#prefs-overlay').hidden) { closePrefs(); return; }
      if (e.key !== 'Escape' || !state.ddClose) return;
      state.ddClose();
    });

    var ta = $('#input-today');
    ta.addEventListener('input', refreshRecordState);
    $('#btn-record-back').addEventListener('click', function () { go(state.editingDate ? 'calendar' : 'start'); });
    $('#btn-record').addEventListener('click', submitToday);
    $('#input-record-photo').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var input = this;
      var date = (state.editingDate || schema.todayISO()).replace(/-/g, '');
      var id = 'photo_daily_' + date + '_record_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      photos.compress(file).then(function (blob) { return photos.put(id, blob); }).then(function () {
        state.recordPhotoId = id; state.recordPhotoRemoved = false; renderRecordPhoto(); toast('照片已放进这一页'); input.value = '';
      }).catch(function () { toast('照片暂时没能加上'); });
    });
    $('#reminder-enabled').addEventListener('change', function () { $('#reminder-fields').hidden = !this.checked; });
    $('#btn-reminder-save').addEventListener('click', function () {
      var date = $('#reminder-date').value, message = $('#reminder-text').value.trim();
      if (!preferences.dateOK(date) || !message) { toast('选一天，再写下提醒内容'); return; }
      if (preferences.saveReminder(date, message)) { toast('提醒已收好，下次打开日历还能看到'); renderRecordReminder(); }
      else toast('提醒没能保存');
    });
    $('#btn-start-prefs').addEventListener('click', openPrefs);
    $('#btn-cal-prefs').addEventListener('click', openPrefs);
    $('#btn-prefs-close').addEventListener('click', closePrefs);
    $('#prefs-overlay').addEventListener('click', function (e) { if (e.target === this) closePrefs(); });
    /* v0.4：短输入软引导 */
    $('#btn-short-continue').addEventListener('click', function () {
      var p = $('#short-panel');
      if (p) p.hidden = true;
      $('#input-today').focus();
    });
    $('#btn-short-go').addEventListener('click', function () {
      var p = $('#short-panel');
      if (p) p.hidden = true;
      var t = $('#input-today').value.trim();
      if (t) goConfirmFromRecord(t);
    });
    /* 顶部返回：编辑历史时回日历，正常流程回记录页（保留输入和心情） */
    $('#btn-confirm-back').addEventListener('click', function () {
      go(state.editingDate ? 'calendar' : 'record');
    });
    /* 返回修改原文：回 Record，textarea / mood 由 state 保留 */
    $('#btn-confirm-back2').addEventListener('click', function () { go('record'); });
    /* 原始记录折叠开关 */
    $('#btn-raw-toggle').addEventListener('click', function () {
      var raw = $('#confirm-raw');
      raw.hidden = !raw.hidden;
      this.setAttribute('aria-expanded', raw.hidden ? 'false' : 'true');
      this.textContent = raw.hidden ? '看看最初写下的话 ▾' : '合上最初写下的话 ▴';
    });
    $('#btn-confirm-generate').addEventListener('click', function () { runGenerate(); });
    $('#btn-cal-back').addEventListener('click', function () { go('start'); });
    $('#btn-cal-prev').addEventListener('click', function () {
      state.calM -= 1;
      if (state.calM < 0) { state.calM = 11; state.calY -= 1; }
      renderMonth();
    });
    $('#btn-cal-next').addEventListener('click', function () {
      state.calM += 1;
      if (state.calM > 11) { state.calM = 0; state.calY += 1; }
      renderMonth();
    });

    go('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
