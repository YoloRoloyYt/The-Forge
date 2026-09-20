'use strict';
// ---------------------------------------------------------------------------
// save.js — one localStorage slot, versioned, defensive about bad data.
// ---------------------------------------------------------------------------
(function (F) {

  const KEY = 'forge2.save.v1';
  const SETTINGS = 'forge2.settings.v1';

  F.Save = {
    write(state) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
      catch (e) { return false; }
    },
    read() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return (v && typeof v === 'object') ? v : null;
      } catch (e) { return null; }
    },
    wipe() { try { localStorage.removeItem(KEY); } catch (e) {} },
    has() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },

    settings(v) {
      if (v === undefined) {
        try { return JSON.parse(localStorage.getItem(SETTINGS) || '{}') || {}; }
        catch (e) { return {}; }
      }
      try { localStorage.setItem(SETTINGS, JSON.stringify(v)); } catch (e) {}
    },
  };

})(window.F2 = window.F2 || {});
