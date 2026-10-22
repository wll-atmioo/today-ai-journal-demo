/* ============================================================
 * Today · 照片存储 v0.3
 * 原则：localStorage 只存 DailyReplay 文本/metadata（含 photo_id），
 *       图片 Blob 存 IndexedDB；无 IndexedDB 的环境（旧浏览器/jsdom）
 *       自动降级为内存 Map（页面刷新后图片丢失，但 metadata 完好）。
 * 上传链路：原图 → Canvas 最长边 1600px → JPEG q0.85 → 存储put(id)。
 * ============================================================ */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var DB_NAME = 'today_photos';
  var STORE = 'photos';
  var memory = Object.create(null);   /* 降级存储 */
  var dbPromise = null;
  var urlCache = Object.create(null); /* id → objectURL */

  function hasIDB() { return typeof global.indexedDB !== 'undefined' && global.indexedDB; }
  function canURL() { return typeof global.URL !== 'undefined' && global.URL && typeof global.URL.createObjectURL === 'function'; }

  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = global.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          try { req.result.createObjectStore(STORE); } catch (e) {}
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        setTimeout(function () { reject(new Error('idb timeout')); }, 4000);
      });
    }
    return dbPromise;
  }

  function put(id, blob) {
    if (!id || !blob) return Promise.resolve();
    if (!hasIDB()) { memory[id] = blob; return Promise.resolve(); }
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () { memory[id] = blob; });
  }

  function get(id) {
    if (!id) return Promise.resolve(null);
    if (!hasIDB()) return Promise.resolve(memory[id] || null);
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var rq = tx.objectStore(STORE).get(id);
        rq.onsuccess = function () { resolve(rq.result || null); };
        rq.onerror = function () { reject(rq.error); };
      });
    }).catch(function () { return memory[id] || null; });
  }

  function del(id) {
    if (!id) return Promise.resolve();
    if (urlCache[id] && canURL()) { try { global.URL.revokeObjectURL(urlCache[id]); } catch (e) {} }
    delete urlCache[id];
    delete memory[id];
    if (!hasIDB()) return Promise.resolve();
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE)['delete'](id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    }).catch(function () {});
  }

  /* 压缩：最长边 ≤1600px，JPEG 0.85；无 Canvas/解码失败时原样返回 */
  function compress(file, maxEdge) {
    maxEdge = maxEdge || 1600;
    return new Promise(function (resolve) {
      var done = false;
      function finish(b) { if (!done) { done = true; resolve(b || file); } }
      try {
        if (!canURL() || typeof global.Image === 'undefined' || typeof document === 'undefined') return finish(file);
        if (file.size && file.size < 350 * 1024) return finish(file); /* 小图直存 */
        var url = global.URL.createObjectURL(file);
        var img = new global.Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth || 0, h = img.naturalHeight || 0;
            if (!w || !h) return finish(file);
            var scale = Math.min(1, maxEdge / Math.max(w, h));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * scale));
            c.height = Math.max(1, Math.round(h * scale));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            var toBlobDone = false;
            c.toBlob(function (b) { toBlobDone = true; finish(b); }, 'image/jpeg', 0.85);
            setTimeout(function () { if (!toBlobDone) finish(file); }, 2500);
          } catch (e) { finish(file); }
          try { global.URL.revokeObjectURL(url); } catch (e2) {}
        };
        img.onerror = function () { finish(file); };
        img.src = url;
        setTimeout(function () { finish(file); }, 5000);
      } catch (e) { finish(file); }
    });
  }

  /* id → objectURL（带缓存）；不可用环境返回 null（UI 回退插画链） */
  function url(id) {
    if (!id) return Promise.resolve(null);
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    return get(id).then(function (blob) {
      if (!blob) return null;
      if (!canURL()) return null;
      try { urlCache[id] = global.URL.createObjectURL(blob); } catch (e) { return null; }
      return urlCache[id];
    });
  }

  Today.photos = { put: put, get: get, del: del, compress: compress, url: url };
  if (typeof module !== 'undefined' && module.exports) module.exports = Today.photos;
})(typeof window !== 'undefined' ? window : globalThis);
