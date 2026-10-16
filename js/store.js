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
  // How many not-yet-mastered items of each kind practise at once.
  // Reading rules (R) count per rule, so one rule doesn't crowd out the others.
  const ACTIVE_NEW_LIMIT = { L: 4, S: 6, W: 4, R: 2, T: 1 };
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
      rules: [],
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
    if (kind === "W") {
      const word = D.WORDS.find((w) => w.w === ch);
      return { id, kind, word, display: word.w };
    }
    if (kind === "R") {
      // "R:twin:0", "R:dagesh:ב", "R:ehevi:0"
      const rule = ch;
      if (rule === "twin") return { id, kind, rule, twin: D.TWINS[+nq] };
      if (rule === "dagesh") return { id, kind, rule, ch: nq };
      return { id, kind, rule, pair: D.EHEVI_PAIRS[+nq] };
    }
    if (kind === "T") return { id, kind };
    return {
      id,
      kind,
      ch,
      base: ch,
      niqqud: nq,
      sound: D.NQ[nq].sound,
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
    D.NIQQUD.filter((n) => p.niqqud.includes(n.id)).forEach((n) => {
      letters.forEach((ch) => {
        if (D.syllableAllowed(ch, n.id)) items.push(`S:${ch}:${n.id}`);
      });
    });
    readableWords(p).forEach((w) => items.push("W:" + w.w));
    const rules = p.rules || [];
    if (rules.includes("ehevi")) {
      D.EHEVI_PAIRS.forEach((pair, i) => pair.every((w) => readable(p, D.parseWord(w))) && items.push("R:ehevi:" + i));
    }
    if (rules.includes("sameSound")) {
      D.TWINS.forEach((t, i) => t.needs.every((c) => p.letters.includes(c)) && (!t.soft || rules.includes("dagesh")) && items.push("R:twin:" + i));
    }
    if (rules.includes("dagesh") && p.niqqud.length) {
      Object.keys(D.DAGESH_PAIRS).forEach((ch) => p.letters.includes(ch) && items.push("R:dagesh:" + ch));
    }
    if (rules.includes("sentences") && readableSentenceParts(p).ok) items.push("T:s");
    return items;
  }

  // Can this child read it? Every letter and niqqud mark learned in class,
  // plus the reading rules it depends on.
  function readable(p, parsed) {
    const rules = p.rules || [];
    return (
      parsed.ok &&
      parsed.letters.every((c) => p.letters.includes(c)) &&
      parsed.niqqud.every((n) => p.niqqud.includes(n)) &&
      (!parsed.silentEnd || rules.includes("ehevi")) &&
      (!parsed.soft || rules.includes("dagesh"))
    );
  }

  function readableWords(p) {
    return D.WORDS.filter((w) => readable(p, w.parsed));
  }

  function readableSentenceParts(p) {
    const subjects = D.SUBJECTS.filter((x) => readable(p, x.parsed));
    const places = D.PLACES.filter((x) => readable(p, x.parsed));
    return { subjects, places, ok: subjects.length >= 2 && places.length >= 2 };
  }

  // A sentence and three pictures: the right one, one with another subject, one with another place.
  function sentenceTask(p) {
    const { subjects, places } = readableSentenceParts(p);
    const [s, s2] = shuffle(subjects.slice());
    const [pl, pl2] = shuffle(places.slice());
    const mk = (a, b) => ({ text: a.w + " " + b.w, subject: a, place: b });
    const answer = mk(s, pl);
    return { answer, choices: shuffle([answer, mk(s2, pl), mk(s, pl2)]) };
  }

  // Mastered items plus a few new ones. A syllable opens only after its
  // letter is mastered; new material opens as older material is mastered.
  function activeItems(p) {
    const out = [];
    const fresh = {};
    for (const id of candidateItems(p)) {
      if (isMastered(p, id)) {
        out.push(id);
        continue;
      }
      const info = itemInfo(id);
      if (info.kind === "S" && !isMastered(p, "L:" + info.ch)) continue;
      // Words open once every letter in them is mastered.
      if (info.kind === "W" && !info.word.parsed.letters.every((c) => isMastered(p, "L:" + c))) continue;
      if (info.kind === "R" && !ruleItemLetters(info).every((c) => isMastered(p, "L:" + c))) continue;
      // Sentences once a few words are read well.
      if (info.kind === "T" && candidateItems(p).filter((x) => x.startsWith("W:") && isMastered(p, x)).length < 2) continue;
      const bucket = info.kind === "R" ? "R:" + info.rule : info.kind;
      if ((fresh[bucket] || 0) < ACTIVE_NEW_LIMIT[info.kind]) {
        out.push(id);
        fresh[bucket] = (fresh[bucket] || 0) + 1;
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
    if (info.kind === "S") return wheelRows(p, info).length ? ["hearSyl", "wheel"] : ["hearSyl"];
    if (info.kind === "W") {
      const n = info.word.parsed.syllables.length;
      const types = ["wordpic"];
      if (n >= 2 && n <= 3) types.push("build");
      if (n >= 2) types.push("missing");
      return types;
    }
    if (info.kind === "R") return [info.rule];
    if (info.kind === "T") return ["sentence"];
    const types = ["hear", "trace"];
    if (similarPartner(p, info.ch)) types.push("similar");
    if (info.isFinal) {
      if (wordsEndingWith(info.ch).length) types.push("finalForm");
      return types;
    }
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
      // Likewise the first time a niqqud mark shows up.
      const nqKey = info.kind === "S" && "N:" + info.niqqud;
      if (nqKey && !(p.progress[nqKey] && p.progress[nqKey].introduced) && !introduced.has(nqKey)) {
        introduced.add(nqKey);
        out.push({ id: t.id, type: "introNq" });
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
      // One option with the same letter and another vowel, one with another letter.
      const vowelAlts = shuffle(otherVowels(p, info).map((n) => D.syllableText(info.ch, n)));
      const letterAlts = shuffle(otherLetters(p, info));
      if (letterAlts.length < 2) letterAlts.push(...shuffle(otherLetters({ letters: D.RECOMMENDED_ORDER }, info)));
      pool = vowelAlts.slice(0, 1).concat(letterAlts.map((c) => D.syllableText(c, info.niqqud)));
    } else if (task.type === "similar") {
      return shuffle([info.ch, task.partner]);
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

  function ruleItemLetters(info) {
    if (info.rule === "twin") return info.twin.needs;
    if (info.rule === "dagesh") return [info.ch];
    return [...new Set(info.pair.flatMap((w) => D.parseWord(w).letters))];
  }

  // Words ending in a given final letter, for "which form goes at the end?".
  function wordsEndingWith(ch) {
    return D.WORDS.filter((w) => w.w.endsWith(ch));
  }

  // Learned niqqud marks with a different sound, one per sound.
  function otherVowels(p, info) {
    const seen = new Set([info.sound]);
    const out = [];
    D.NIQQUD.forEach((n) => {
      if (p.niqqud.includes(n.id) && !seen.has(n.sound) && D.syllableAllowed(info.ch, n.id)) {
        seen.add(n.sound);
        out.push(n.id);
      }
    });
    return out;
  }

  // Learned letters that sound different from this syllable's letter (and from each other).
  function otherLetters(p, info) {
    const out = [];
    p.letters.forEach((c) => {
      if (c === info.ch || !D.syllableAllowed(c, info.niqqud) || D.soundsAlike(c, info.ch)) return;
      if (out.some((o) => D.soundsAlike(o, c))) return;
      out.push(c);
    });
    return out;
  }

  // Syllable-wheel rows: only the letter changes, or only the vowel changes.
  function wheelRows(p, info) {
    const rows = [];
    const letters = otherLetters(p, info);
    if (letters.length >= 2) rows.push([info.ch].concat(shuffle(letters).slice(0, 3)).map((c) => D.syllableText(c, info.niqqud)));
    const vowels = otherVowels(p, info);
    if (vowels.length >= 2) rows.push([info.niqqud].concat(vowels.slice(0, 3)).map((n) => D.syllableText(info.ch, n)));
    return rows;
  }

  // A letter this child keeps mixing up with a look-alike or sound-alike one.
  function similarPartner(p, ch) {
    let best = null;
    Object.entries(p.confusions).forEach(([k, n]) => {
      const [a, b] = k.split(">");
      const other = a === ch ? b : b === ch ? a : null;
      if (!other || n < 2 || !p.letters.includes(other) || !D.LETTER[other]) return;
      if (!D.lookAlikes(ch).includes(other) && !D.soundsAlike(ch, other)) return;
      if (!best || n > best.n) best = { ch: other, n };
    });
    return best && best.ch;
  }

  // Three pictures: the word's and two others.
  function pictureChoices(word) {
    const others = shuffle(D.WORDS.filter((w) => w.e !== word.e && w.first !== word.first)).slice(0, 2);
    return shuffle([word].concat(others));
  }

  // What a syllable sounds like, so two options that sound the same never appear together.
  const SOUND_CLASS = { ט: "ת", ע: "א", ה: "א", ק: "כּ", ח: "כ", ס: "שׂ", ו: "ב", ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
  function soundKey(syl) {
    const p = D.parseWord(syl);
    let key = "";
    for (const c of syl) {
      if (/[\u05D0-\u05EA]/.test(c)) key += SOUND_CLASS[c] || c;
    }
    return key.replace(/[יהא]$/, "") + "|" + p.niqqud.map((n) => D.NQ[n].sound).join("");
  }

  // Options for "what's missing?": the missing syllable and two that differ by one sound.
  function missingChoices(p, word, idx) {
    const answer = word.parsed.syllables[idx];
    const parsed = D.parseWord(answer);
    const ch = parsed.letters[0];
    const nq = parsed.niqqud[0];
    const cands = [];
    if (ch && nq) {
      otherVowels(p, { ch, sound: D.NQ[nq].sound }).forEach((n) => cands.push(D.syllableText(ch, n)));
      otherLetters(p, { ch, niqqud: nq }).forEach((c) => cands.push(D.syllableText(c, nq)));
    }
    readableWords(p).forEach((w) => cands.push(...w.parsed.syllables));
    const keys = new Set([soundKey(answer)]);
    const picked = [];
    for (const c of shuffle(cands.slice(0, 6)).concat(shuffle(cands.slice(6)))) {
      const k = soundKey(c);
      if (keys.has(k)) continue;
      keys.add(k);
      picked.push(c);
      if (picked.length === 2) break;
    }
    return shuffle([answer].concat(picked));
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

  function ruleStatus(p, ruleId) {
    const prefix = { ehevi: "R:ehevi:", sameSound: "R:twin:", dagesh: "R:dagesh:", sentences: "T:" }[ruleId];
    if (!(p.rules || []).includes(ruleId)) return { status: "off", mastered: 0, total: 0 };
    const ids = candidateItems(p).filter((id) => id.startsWith(prefix));
    const mastered = ids.filter((id) => isMastered(p, id)).length;
    const seen = ids.some((id) => p.progress[id] && p.progress[id].seen);
    return { status: ids.length && mastered === ids.length ? "mastered" : seen ? "practice" : "learned", mastered, total: ids.length };
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
    wheelRows,
    similarPartner,
    pictureChoices,
    missingChoices,
    readableWords,
    readable,
    sentenceTask,
    wordsEndingWith,
    record,
    markIntroduced,
    recordConfusion,
    addSeconds,
    minutesThisWeek,
    letterStatus,
    niqqudStatus,
    topConfusions,
    ruleStatus,
    exportData,
    importData,
    resetAll,
    isMastered,
  };
})();
