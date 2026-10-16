/* Local-only storage, progress tracking and session planning.
 * Everything lives in localStorage on the device; the parent area can export
 * and import a backup file. */
(() => {
  "use strict";

  const Aleph = (window.Aleph = window.Aleph || {});
  const D = Aleph.data;

  const KEY = "aleph.v1";
  const MASTERY_STREAK = 3; // correct in a row...
  const MASTERY_SESSIONS = 2; // ...spread over at least this many sessions
  const ACTIVE_NEW_LIMIT = 5; // how many not-yet-mastered items practise at once
  const SESSION_TASKS = 10;

  let state = load();

  function blank() {
    return { version: 1, activeId: null, profiles: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.profiles)) return blank();
      return s;
    } catch (_) {
      return blank();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  function newProfile() {
    return {
      id: "p" + Date.now().toString(36),
      name: "",
      gender: "m",
      grade: "א",
      letters: [],
      niqqud: [],
      rate: 0.85,
      progress: {},
      confusions: {},
      seconds: {},
      stickers: [],
      sessions: 0,
      created: Date.now(),
    };
  }

  function profile() {
    return state.profiles.find((p) => p.id === state.activeId) || null;
  }

  function saveProfile(p) {
    const i = state.profiles.findIndex((x) => x.id === p.id);
    if (i >= 0) state.profiles[i] = p;
    else state.profiles.push(p);
    state.activeId = p.id;
    save();
  }

  // ---------- Items ----------
  // "L:ד" — a letter. "S:ב:kamatz" — a syllable (letter + niqqud).
  function itemInfo(id) {
    const [kind, ch, nq] = id.split(":");
    if (kind === "L") {
      const l = D.LETTER[ch];
      return { id, kind, ch, base: l.finalOf || ch, isFinal: !!l.finalOf, name: l.name, display: ch };
    }
    return {
      id,
      kind,
      ch,
      base: ch,
      niqqud: nq,
      name: D.SYL_A[ch],
      display: D.syllableText(ch, nq),
    };
  }

  function prog(p, id) {
    if (!p.progress[id]) {
      p.progress[id] = { seen: 0, correct: 0, wrong: 0, streak: 0, sessions: [], types: {}, mastered: false, lastWrong: 0 };
    }
    return p.progress[id];
  }

  function isMastered(p, id) {
    return !!(p.progress[id] && p.progress[id].mastered);
  }

  // All items the parent has opened, in teaching order.
  function candidateItems(p) {
    const order = D.RECOMMENDED_ORDER.concat(["ך", "ם", "ן", "ף", "ץ"]);
    const letters = order.filter((ch) => p.letters.includes(ch));
    const items = letters.map((ch) => "L:" + ch);
    D.NIQQUD.filter((n) => n.v1 && p.niqqud.includes(n.id)).forEach((n) => {
      letters.forEach((ch) => {
        if (!D.LETTER[ch].finalOf) items.push(`S:${ch}:${n.id}`);
      });
    });
    return items;
  }

  // Mastered items plus a few new ones. A syllable opens only after its
  // letter is mastered; new material opens as older material is mastered.
  function activeItems(p) {
    const out = [];
    let fresh = 0;
    for (const id of candidateItems(p)) {
      if (isMastered(p, id)) {
        out.push(id);
        continue;
      }
      const info = itemInfo(id);
      if (info.kind === "S" && !isMastered(p, "L:" + info.ch)) continue;
      if (fresh < ACTIVE_NEW_LIMIT) {
        out.push(id);
        fresh++;
      }
    }
    return out;
  }

  // ---------- Recording answers ----------
  function record(p, id, type, firstTry, sessionNo) {
    const r = prog(p, id);
    r.seen++;
    r.types[type] = (r.types[type] || 0) + 1;
    if (firstTry) {
      r.correct++;
      r.streak++;
      if (!r.sessions.includes(sessionNo)) r.sessions = r.sessions.concat(sessionNo).slice(-5);
    } else {
      r.wrong++;
      r.streak = 0;
      r.lastWrong = sessionNo;
    }
    let newlyMastered = false;
    if (!r.mastered && r.streak >= MASTERY_STREAK && r.sessions.length >= MASTERY_SESSIONS) {
      r.mastered = true;
      newlyMastered = true;
    }
    save();
    return newlyMastered;
  }

  function markIntroduced(p, id) {
    prog(p, id).introduced = true;
    save();
  }

  function recordConfusion(p, target, chosen) {
    const k = target + ">" + chosen;
    p.confusions[k] = (p.confusions[k] || 0) + 1;
    save();
  }

  function dayKey(d = new Date()) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function addSeconds(p, secs) {
    const k = dayKey();
    p.seconds[k] = (p.seconds[k] || 0) + Math.round(secs);
    save();
  }

  function minutesThisWeek(p) {
    let total = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      total += p.seconds[dayKey(d)] || 0;
    }
    return Math.round(total / 60);
  }

  // ---------- Session planning ----------
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Exercise types an item can use with the letters this child knows.
  function typesFor(p, id) {
    const info = itemInfo(id);
    if (info.kind === "S") return ["hearSyl"];
    if (info.isFinal) return ["hear", "trace"];
    const types = ["hear", "trace"];
    const known = p.letters.filter((c) => !D.LETTER[c].finalOf);
    const canDistract = (target) => known.filter((c) => !D.soundsAlike(c, target)).length >= 2;
    if (D.WORDS.some((w) => w.first === info.base) && canDistract(info.base)) types.push("opening");
    if (D.WORDS.some((w) => w.last === info.base) && canDistract(info.base)) types.push("closing");
    return types;
  }

  function weight(p, id, sessionNo) {
    const r = p.progress[id];
    if (!r || !r.seen) return 4;
    let w = r.mastered ? 0.6 : 3;
    if (r.lastWrong && sessionNo - r.lastWrong <= 2) w += 2; // recent mistakes come back sooner
    return w;
  }

  function pickWeighted(list) {
    const total = list.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of list) {
      r -= x.w;
      if (r <= 0) return x;
    }
    return list[list.length - 1];
  }

  function planSession(p) {
    const sessionNo = p.sessions + 1;
    const active = activeItems(p);
    if (!active.length) return [];

    const pool = active.map((id) => ({ id, w: weight(p, id, sessionNo), uses: 0 }));
    const tasks = [];
    const usedTypes = {};
    let guard = 0;
    while (tasks.length < SESSION_TASKS && guard++ < 200) {
      const avail = pool.filter((x) => x.uses < (isMastered(p, x.id) ? 1 : 2));
      if (!avail.length) {
        pool.forEach((x) => (x.uses = 0)); // small pool: allow another round
        continue;
      }
      const pick = pickWeighted(avail);
      pick.uses++;
      const types = typesFor(p, pick.id);
      const r = p.progress[pick.id] || { types: {} };
      const used = usedTypes[pick.id] || [];
      const count = (t) => used.filter((u) => u === t).length;
      // Rotate types within the session, then prefer what was practised least overall.
      const type = types.slice().sort((a, b) => count(a) - count(b) || (r.types[a] || 0) - (r.types[b] || 0) || Math.random() - 0.5)[0];
      usedTypes[pick.id] = used.concat(type);
      tasks.push({ id: pick.id, type });
    }

    // Spread repeats of the same item apart.
    shuffle(tasks);
    for (let i = 1; i < tasks.length; i++) {
      if (tasks[i].id === tasks[i - 1].id) {
        const j = tasks.findIndex((t, k) => k > i && t.id !== tasks[i].id);
        if (j > 0) [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
      }
    }

    // A letter the child hasn't met in the app gets a short introduction first.
    const out = [];
    const introduced = new Set();
    tasks.forEach((t) => {
      const info = itemInfo(t.id);
      const r = p.progress[t.id];
      if (info.kind === "L" && !(r && r.introduced) && !introduced.has(t.id)) {
        introduced.add(t.id);
        out.push({ id: t.id, type: "intro" });
      }
      out.push(t);
    });
    return out;
  }

  // Choices for a "which one" question: the answer plus two distractors.
  function choicesFor(p, task) {
    const info = itemInfo(task.id);
    const answer = task.answer || info.display;
    let pool;
    if (info.kind === "S") {
      pool = p.letters
        .filter((c) => !D.LETTER[c].finalOf && c !== info.ch && !D.soundsAlike(c, info.ch))
        .map((c) => D.syllableText(c, info.niqqud));
      if (pool.length < 2) {
        pool = pool.concat(
          D.RECOMMENDED_ORDER.filter((c) => c !== info.ch && !D.soundsAlike(c, info.ch)).map((c) => D.syllableText(c, info.niqqud))
        );
      }
    } else {
      const target = task.answer || info.ch;
      const hear = task.type === "hear";
      // Sound questions never offer a letter that sounds like the answer.
      const ok = hear ? (c) => c !== target : (c) => c !== target && !D.LETTER[c].finalOf && !D.soundsAlike(c, target);
      pool = shuffle(p.letters.filter(ok));
      // In "hear" practice, often include a look-alike letter the child knows.
      if (hear && Math.random() < 0.6) {
        const alike = D.lookAlikes(target).filter((c) => pool.includes(c));
        if (alike.length) pool = [alike[0]].concat(pool.filter((c) => c !== alike[0]));
      }
      if (pool.length < 2) pool = pool.concat(shuffle(D.RECOMMENDED_ORDER.filter((c) => ok(c) && !pool.includes(c))));
    }
    const distractors = [...new Set(pool)].slice(0, 2);
    return shuffle([answer, ...distractors]);
  }

  // Letter status for the parent's map.
  function letterStatus(p, ch) {
    if (!p.letters.includes(ch)) return "off";
    const r = p.progress["L:" + ch];
    if (r && r.mastered) return "mastered";
    if (r && r.seen) return "practice";
    return "learned";
  }

  function niqqudStatus(p, nq) {
    if (!p.niqqud.includes(nq)) return { status: "off", mastered: 0, total: 0 };
    const ids = candidateItems(p).filter((id) => id.endsWith(":" + nq));
    const mastered = ids.filter((id) => isMastered(p, id)).length;
    const seen = ids.some((id) => p.progress[id] && p.progress[id].seen);
    return { status: mastered && mastered === ids.length ? "mastered" : seen ? "practice" : "learned", mastered, total: ids.length };
  }

  function topConfusions(p, n = 5) {
    return Object.entries(p.confusions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, count]) => {
        const [target, chosen] = k.split(">");
        return { target, chosen, count };
      });
  }

  function exportData() {
    return JSON.stringify(state, null, 1);
  }

  function importData(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.profiles)) throw new Error("bad backup");
    state = s;
    if (!state.profiles.some((p) => p.id === state.activeId)) state.activeId = state.profiles[0] ? state.profiles[0].id : null;
    save();
  }

  function resetAll() {
    state = blank();
    save();
  }

  Aleph.store = {
    profile,
    newProfile,
    saveProfile,
    save,
    itemInfo,
    activeItems,
    candidateItems,
    planSession,
    choicesFor,
    record,
    markIntroduced,
    recordConfusion,
    addSeconds,
    minutesThisWeek,
    letterStatus,
    niqqudStatus,
    topConfusions,
    exportData,
    importData,
    resetAll,
    isMastered,
  };
})();
