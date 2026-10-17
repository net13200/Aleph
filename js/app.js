/* Aleph — screens, exercises and the parent area. */
(() => {
  "use strict";

  const Aleph = window.Aleph;
  const D = Aleph.data;
  const S = Aleph.store;
  const A = Aleph.audio;

  const $app = document.getElementById("app");
  const SESSION_MAX_MS = 8 * 60 * 1000;

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------- Speech segments ----------
  function gender() {
    const p = S.profile();
    return p && p.gender === "f" ? "f" : "m";
  }
  const seg = {
    p(name) {
      const v = D.PHRASES[name];
      if (typeof v === "string") return { key: "p." + name, text: v };
      const g = gender();
      return { key: `p.${name}.${g}`, text: v[g] };
    },
    praise() {
      const i = Math.floor(Math.random() * D.PHRASES.praise.length);
      return { key: "p.praise." + i, text: D.PHRASES.praise[i] };
    },
    letter: (ch) => ({ key: "letter." + ch, text: D.LETTER[ch].name }),
    syl: (ch, sound) => ({ key: `syl.${ch}.${sound}`, text: D.syllableSpoken(ch, sound) }),
    nq: (id) => ({ key: "nq." + id, text: D.NQ[id].name }),
    sylSoft: (ch, nq) => ({ key: `sylsoft.${ch}.${D.NQ[nq].sound}`, text: D.dageshForms(ch, nq).soft.spoken }),
    sentence: (text) => ({ key: "sentence." + text, text }),
    // A letter as shown (maybe with dagesh or a sin dot) is named by its base letter.
    shown: (text) => seg.letter([...text][0]),
    // Any written syllable: a plain letter+vowel uses its syllable recording.
    part(text) {
      const p = D.parseWord(text);
      if (p.letters.length === 1 && p.niqqud.length === 1 && D.syllableText(p.letters[0], p.niqqud[0]) === text) {
        return seg.syl(p.letters[0], D.NQ[p.niqqud[0]].sound);
      }
      return { key: "part." + text, text };
    },
    word: (w) => ({ key: "word." + w.w, text: w.w }),
    text: (t) => ({ key: "word." + t, text: t }),
    name: () => ({ key: null, text: (S.profile() || {}).name || "" }),
  };
  function itemSeg(info) {
    return info.kind === "S" ? seg.syl(info.ch, info.sound) : seg.letter(info.ch);
  }

  // ---------- Guide character ----------
  const GUIDE = `
  <svg class="guide" viewBox="0 0 120 124" aria-hidden="true">
    <path d="M60 22 C 66 10, 78 7, 84 9 C 80 18, 70 24, 60 22 Z" fill="#2fae64"/>
    <path d="M60 24 L60 30" stroke="#7c4e30" stroke-width="3" stroke-linecap="round"/>
    <path d="M26 44 L28 20 L46 36 Z" fill="#8a5a44"/>
    <path d="M94 44 L92 20 L74 36 Z" fill="#8a5a44"/>
    <ellipse cx="60" cy="72" rx="40" ry="44" fill="#a06a4c"/>
    <path class="wing" d="M21 70 C 12 84, 16 98, 26 104 C 28 92, 28 80, 21 70 Z" fill="#8a5a44"/>
    <path class="wing" d="M99 70 C 108 84, 104 98, 94 104 C 92 92, 92 80, 99 70 Z" fill="#8a5a44"/>
    <ellipse cx="60" cy="86" rx="25" ry="27" fill="#f6e2c0"/>
    <path d="M50 84 q4 4 8 0 M62 84 q4 4 8 0 M56 94 q4 4 8 0" stroke="#e2c497" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="44" cy="56" r="15" fill="#fff"/>
    <circle cx="76" cy="56" r="15" fill="#fff"/>
    <circle class="pupil" cx="46" cy="57" r="6.5" fill="#3a2e5c"/>
    <circle class="pupil" cx="74" cy="57" r="6.5" fill="#3a2e5c"/>
    <circle cx="48" cy="54.5" r="2" fill="#fff"/>
    <circle cx="76" cy="54.5" r="2" fill="#fff"/>
    <path class="beak" d="M54 68 L66 68 L60 77 Z" fill="#ff9f43"/>
    <path d="M44 114 l-4 6 M48 115 l0 6 M52 114 l4 6 M68 114 l-4 6 M72 115 l0 6 M76 114 l4 6" stroke="#ff9f43" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

  async function talk(segments) {
    const g = document.querySelector(".guide");
    g && g.classList.add("talking");
    await A.say(segments);
    g && g.classList.remove("talking");
  }

  // ---------- Icons ----------
  const ICON = {
    speaker: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.8 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    next: `<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24"><path d="M3 11.5L12 4l9 7.5M5.5 9.8V20h13V9.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    lock: `<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
    book: `<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="currentColor"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" fill="currentColor" opacity=".55"/><path d="M12 7.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#fff"/></svg>`,
    pencil: `<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z" fill="currentColor"/></svg>`,
  };

  // ---------- Router ----------
  let view = null; // cleanup hook of the current screen
  function show(html, cls) {
    A.stop();
    if (view && view.cleanup) view.cleanup();
    view = {};
    $app.className = "screen " + (cls || "");
    $app.innerHTML = html;
    $app.scrollTop = 0;
    return view;
  }
  const $ = (sel) => $app.querySelector(sel);
  const $$ = (sel) => [...$app.querySelectorAll(sel)];
  function on(sel, evt, fn) {
    const e = typeof sel === "string" ? $(sel) : sel;
    if (e) e.addEventListener(evt, fn);
  }

  function start() {
    A.loadManifest();
    const p = S.profile();
    if (p) A.setRate(p.rate);
    if (!p) welcome();
    else home();
  }

  // ---------- First run (parent-facing) ----------
  function welcome() {
    show(
      `<div class="parent-page welcome">
        <div class="hero">${GUIDE}</div>
        <h1>ברוכים הבאים ל<span class="brand">אלף</span></h1>
        <p>אפליקציה שמשלימה את מה שהילד לומד בכיתה: אותיות, סימני ניקוד ומילים — בקצב שלו.</p>
        <p class="muted">כל המידע נשמר על המכשיר הזה בלבד. אין חשבון, אין שרת, אין פרסומות.</p>
        <button class="btn primary" id="go">יצירת פרופיל לילד</button>
      </div>`,
      "parent"
    );
    on("#go", "click", () => profileForm(S.newProfile(), true));
  }

  // ---------- Home ----------
  function home() {
    const p = S.profile();
    if (!p) return welcome();
    A.setRate(p.rate);
    const v = show(
      `<button class="corner lock" id="lock" aria-label="אזור הורים (לחיצה ארוכה)">
        <svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/></svg>${ICON.lock}
      </button>
      <div class="home-guide" id="guide">${GUIDE}<div class="bubble">שָׁלוֹם ${esc(p.name)}!</div></div>
      <button class="play-btn" id="play" aria-label="מתחילים">${ICON.play}</button>
      <button class="round-btn stickers-btn" id="stickers" aria-label="המדבקות שלי">${ICON.book}<span>${p.stickers.length}</span></button>`,
      "home"
    );
    const greet = () => talk([seg.p("hello"), seg.name(), seg.p("letsPlay")]);
    on("#guide", "click", () => {
      A.unlock();
      greet();
    });
    on("#play", "click", () => {
      A.unlock();
      A.sfx.tap();
      startSession();
    });
    on("#stickers", "click", () => {
      A.unlock();
      A.sfx.tap();
      stickerBook();
    });
    longPress($("#lock"), () => parentGate());
    // Browsers that allow it (e.g. after the splash tap) greet right away.
    v.timer = setTimeout(greet, 400);
    v.cleanup = () => clearTimeout(v.timer);
  }

  function longPress(btn, fn) {
    let t = null;
    const cancel = () => {
      clearTimeout(t);
      btn.classList.remove("holding");
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("holding");
      t = setTimeout(() => {
        btn.classList.remove("holding");
        fn();
      }, 1200);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, cancel));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ---------- Sticker book ----------
  function stickerBook() {
    const p = S.profile();
    const letters = D.LETTERS.filter((l) => p.letters.includes(l.ch));
    const cells = letters
      .map((l) => {
        const got = p.stickers.includes(l.ch);
        return `<button class="sticker ${got ? "got" : ""}" data-ch="${l.ch}">
          <span class="emoji">${got ? D.stickerFor(l.ch) : ""}</span><span class="ltr">${l.ch}</span></button>`;
      })
      .join("");
    show(
      `<div class="topbar"><button class="icon-btn" id="back" aria-label="חזרה">${ICON.home}</button></div>
       <div class="sticker-grid">${cells || ""}</div>`,
      "stickers"
    );
    on("#back", "click", home);
    $$(".sticker").forEach((b) =>
      b.addEventListener("click", () => {
        const ch = b.dataset.ch;
        const w = D.exampleWord(ch);
        const segs = [seg.p("thisIsLetter"), seg.letter(ch)];
        if (p.stickers.includes(ch) && w) segs.push(seg.p("like"), seg.word(w));
        talk(segs);
      })
    );
    if (!letters.length || !p.stickers.length) talk([seg.p("noStickersYet")]);
  }

  // ---------- Session ----------
  let session = null;

  function startSession() {
    const p = S.profile();
    const tasks = S.planSession(p);
    if (!tasks.length) {
      noLettersYet();
      return;
    }
    p.sessions += 1;
    S.saveProfile(p);
    session = {
      p,
      no: p.sessions,
      tasks,
      i: 0,
      started: Date.now(),
      requeued: new Set(),
      newStickers: [],
      total: tasks.filter((t) => !t.type.startsWith("intro")).length,
      doneCount: 0,
    };
    runTask();
  }

  function noLettersYet() {
    show(
      `<div class="parent-page">
        <div class="hero small">${GUIDE}</div>
        <h2>עוד לא סומנו אותיות</h2>
        <p>כדי להתחיל, ההורה מסמן באזור ההורים אילו אותיות כבר נלמדו בכיתה.</p>
        <button class="btn primary" id="gate">לאזור ההורים</button>
        <button class="btn" id="back">חזרה</button>
      </div>`,
      "parent"
    );
    on("#gate", "click", parentGate);
    on("#back", "click", home);
  }

  function endSessionEarly() {
    if (!session) return home();
    S.addSeconds(session.p, Math.min((Date.now() - session.started) / 1000, 20 * 60));
    session = null;
    home();
  }

  function sessionShell(stageHtml, cls) {
    const dots = Array.from({ length: session.total }, (_, k) => `<i class="${k < session.doneCount ? "on" : ""}"></i>`).join("");
    const v = show(
      `<div class="topbar">
         <button class="icon-btn" id="exit" aria-label="יציאה">${ICON.close}</button>
         <div class="dots" aria-hidden="true">${dots}</div>
         <button class="icon-btn speaker" id="again" aria-label="שמע שוב">${ICON.speaker}</button>
       </div>
       <div class="stage ${cls || ""}">${stageHtml}</div>`,
      "session"
    );
    on("#exit", "click", endSessionEarly);
    on("#again", "click", () => v.replay && v.replay());
    return v;
  }

  function runTask() {
    if (!session) return;
    const overTime = Date.now() - session.started > SESSION_MAX_MS;
    if (session.i >= session.tasks.length || (overTime && !session.tasks[session.i].type.startsWith("intro"))) {
      endSession();
      return;
    }
    const task = session.tasks[session.i];
    const info = S.itemInfo(task.id);
    const run = {
      intro: introTask,
      introNq: introNqTask,
      hear: hearTask,
      hearSyl: hearTask,
      opening: soundTask,
      closing: soundTask,
      trace: traceTask,
      wheel: wheelTask,
      similar: similarTask,
      wordpic: wordPicTask,
      missing: missingTask,
      build: buildTask,
      twin: twinTask,
      dagesh: dageshTask,
      ehevi: eheviTask,
      finalForm: finalFormTask,
      sentence: sentenceTask,
      tune: tuneTask,
      plural: pluralTask,
      family: familyTask,
      prefix: prefixTask,
      punct: punctTask,
      bare: bareTask,
      story: storyTask,
    }[task.type];
    run(task, info);
  }

  function finishTask(task, firstTry) {
    if (!session) return;
    const p = session.p;
    if (task.type === "intro") {
      S.markIntroduced(p, task.id);
    } else if (task.type === "introNq") {
      S.markIntroduced(p, "N:" + S.itemInfo(task.id).niqqud);
    } else {
      session.doneCount++;
      const mastered = S.record(p, task.id, task.type, firstTry, session.no);
      const info = S.itemInfo(task.id);
      if (mastered && info.kind === "L" && !p.stickers.includes(info.ch)) {
        p.stickers.push(info.ch);
        session.newStickers.push(info.ch);
        S.saveProfile(p);
      }
      // A miss comes back later in the same session (once).
      if (!firstTry && !session.requeued.has(task.id)) {
        session.requeued.add(task.id);
        const at = Math.min(session.tasks.length, session.i + 4);
        session.tasks.splice(at, 0, { id: task.id, type: task.type });
        session.total++;
      }
    }
    session.i++;
    runTask();
  }

  async function endSession() {
    const s = session;
    session = null;
    S.addSeconds(s.p, Math.min((Date.now() - s.started) / 1000, 20 * 60));
    const stickers = s.newStickers
      .map((ch, i) => `<div class="sticker got pop" style="animation-delay:${0.4 + i * 0.25}s"><span class="emoji">${D.stickerFor(ch)}</span><span class="ltr">${ch}</span></div>`)
      .join("");
    show(
      `<div class="end">
        <div class="confetti" aria-hidden="true">${"<i></i>".repeat(14)}</div>
        <div class="home-guide">${GUIDE}</div>
        <h1>כׇּל הַכָּבוֹד ${esc(s.p.name)}!</h1>
        ${stickers ? `<div class="new-stickers">${stickers}</div>` : ""}
        <button class="play-btn small" id="home" aria-label="הביתה">${ICON.home}</button>
      </div>`,
      "end"
    );
    on("#home", "click", home);
    A.sfx.sticker();
    await wait(500);
    const segs = [seg.p("wellDone"), seg.name(), seg.p("done")];
    if (s.newStickers.length) segs.push(seg.p("newSticker"));
    talk(segs);
  }

  // ---------- Exercise: meet a new letter ----------
  function introTask(task, info) {
    const w = D.exampleWord(info.ch);
    const v = sessionShell(
      `<div class="intro">
        <button class="big-letter" id="letter">${info.display}</button>
        ${w ? `<div class="pic">${w.e}</div>` : ""}
      </div>
      <button class="next-btn" id="next" aria-label="הלאה">${ICON.next}</button>`,
      "intro-stage"
    );
    const say = () => {
      const segs = [seg.p("thisIsLetter"), seg.letter(info.ch)];
      if (w) segs.push(seg.p("like"), seg.word(w));
      return talk(segs);
    };
    v.replay = say;
    on("#letter", "click", say);
    on("#next", "click", () => {
      A.sfx.tap();
      finishTask(task, true);
    });
    talk([seg.p("newLetter")]).then(() => document.body.contains($("#letter")) && say());
  }

  // ---------- Exercise: meet a new niqqud mark ----------
  function introNqTask(task, info) {
    const v = sessionShell(
      `<div class="intro">
        <button class="big-letter syl" id="letter">${info.display}</button>
      </div>
      <button class="next-btn" id="next" aria-label="הלאה">${ICON.next}</button>`,
      "intro-stage"
    );
    const say = () => talk([seg.p("thisIs"), seg.nq(info.niqqud), seg.p("like"), itemSeg(info)]);
    v.replay = say;
    on("#letter", "click", say);
    on("#next", "click", () => {
      A.sfx.tap();
      finishTask(task, true);
    });
    talk([seg.p("newMark")]).then(() => document.body.contains($("#letter")) && say());
  }

  // ---------- Exercise: choose one of three ----------
  // opts: { prompt: [segments], answer, choices (strings or {v, label}), onWrong1(chosen),
  //         onReveal(), visual, intro() — runs before the prompt, afterRight() }
  function choiceTask(task, opts) {
    const cards = opts.choices
      .map((c) => (typeof c === "string" ? { v: c, label: c } : c))
      .map((c) => `<button class="card" data-v="${esc(c.v)}"><span>${c.label}</span></button>`)
      .join("");
    const v = sessionShell(`${opts.visual || ""}<div class="choices ${opts.choicesClass || ""}">${cards}</div>`, opts.stageClass);
    let attempts = 0;
    let locked = false;
    const ask = async () => {
      if (opts.intro) {
        locked = true;
        await opts.intro();
        locked = false;
      }
      return talk(opts.prompt);
    };
    v.replay = ask;
    $$(".card").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (locked || btn.disabled) return;
        const val = btn.dataset.v;
        if (val === opts.answer) {
          locked = true;
          btn.classList.add("right");
          A.sfx.correct();
          if (opts.afterRight) await opts.afterRight();
          else if (attempts === 0 && Math.random() < 0.4) await talk([seg.praise()]);
          else await wait(750);
          finishTask(task, attempts === 0);
          return;
        }
        attempts++;
        opts.onConfuse && opts.onConfuse(val);
        A.sfx.soft();
        btn.classList.add("wrong");
        btn.disabled = true;
        if (attempts === 1) {
          // First miss: name what was chosen, say what we're looking for, ask again.
          locked = true;
          await talk(opts.onWrong1(val));
          locked = false;
        } else {
          // Second miss: show the answer; the item comes back later this session.
          locked = true;
          $$(".card").forEach((b) => b.dataset.v === opts.answer && b.classList.add("reveal"));
          await talk(opts.onReveal());
          await wait(700);
          finishTask(task, false);
        }
      })
    );
    ask();
  }

  function hearTask(task, info) {
    const p = session.p;
    const isSyl = info.kind === "S";
    const answer = info.display;
    const choices = S.choicesFor(p, task);
    const target = itemSeg(info);
    const chosenSeg = (val) => (isSyl ? seg.part(val) : seg.letter(val));
    choiceTask(task, {
      stageClass: "hear-stage" + (isSyl ? " syl" : ""),
      visual: `<div class="ear-guide">${GUIDE}</div>`,
      prompt: isSyl ? [seg.p("where"), target] : [seg.p("whereLetter"), target],
      answer,
      choices,
      onConfuse: (val) => !isSyl && S.recordConfusion(p, info.ch, val),
      onWrong1: (val) =>
        isSyl
          ? [seg.p("thisIs"), chosenSeg(val), seg.p("weLookForSyl"), target]
          : [seg.p("thisIsLetter"), chosenSeg(val), seg.p("weLookFor"), target],
      onReveal: () => (isSyl ? [seg.p("thisIs"), target] : [seg.p("thisIsLetter"), target, seg.p("laterAgain")]),
    });
  }

  function soundTask(task, info) {
    const p = session.p;
    const opening = task.type === "opening";
    const words = D.WORDS.filter((w) => (opening ? w.first : w.last) === info.base);
    const w = pickOne(words);
    const t = Object.assign({}, task, { answer: info.base });
    const choices = S.choicesFor(p, t);
    const marks = opening ? `<i class="on"></i><i></i><i></i>` : `<i></i><i></i><i class="on"></i>`;
    const prompt = [seg.p(opening ? "opening" : "closing"), seg.word(w)];
    choiceTask(task, {
      stageClass: "sound-stage",
      visual: `<div class="picture"><div class="pic">${w.e}</div><div class="where-mark" aria-hidden="true">${marks}</div></div>`,
      prompt,
      answer: info.base,
      choices,
      onConfuse: (val) => S.recordConfusion(p, info.base, val),
      onWrong1: (val) => [seg.p("thisIsLetter"), seg.letter(val), seg.p("listenAgain"), seg.word(w)],
      onReveal: () => [seg.word(w), seg.p(opening ? "startsWith" : "endsWith"), seg.letter(info.base)],
    });
  }

  // ---------- Exercise: syllable wheel ----------
  // A row where only the letter or only the vowel changes. The guide reads the
  // row, lighting each syllable, then asks for one of them.
  function wheelTask(task, info) {
    const rows = S.wheelRows(session.p, info);
    const row = pickOne(rows);
    const target = itemSeg(info);
    choiceTask(task, {
      stageClass: "hear-stage syl",
      choicesClass: "four",
      visual: `<div class="ear-guide">${GUIDE}</div>`,
      choices: row.slice().sort(() => Math.random() - 0.5),
      answer: info.display,
      async intro() {
        await talk([seg.p("listen")]);
        // Read in reading order: right to left.
        for (const card of $$(".card")) {
          if (!card.isConnected) return;
          card.classList.add("lit");
          await talk([seg.part(card.dataset.v)]);
          card.classList.remove("lit");
        }
        await wait(250);
      },
      prompt: [seg.p("where"), target],
      onWrong1: (val) => [seg.p("thisIs"), seg.part(val), seg.p("weLookForSyl"), target],
      onReveal: () => [seg.p("thisIs"), target],
    });
  }

  // ---------- Exercise: telling similar letters apart ----------
  // Only for letters this child has mixed up repeatedly.
  function similarTask(task, info) {
    const p = session.p;
    const partner = S.similarPartner(p, info.ch) || D.lookAlikes(info.ch)[0];
    const target = seg.letter(info.ch);
    choiceTask(task, {
      stageClass: "hear-stage similar",
      visual: `<div class="ear-guide">${GUIDE}</div>`,
      choices: S.choicesFor(p, { id: task.id, type: "similar", partner }),
      answer: info.ch,
      prompt: [seg.p("whereLetter"), target],
      onConfuse: (val) => S.recordConfusion(p, info.ch, val),
      onWrong1: (val) => [seg.p("thisIsLetter"), seg.letter(val), seg.p("weLookFor"), target],
      onReveal: () => [seg.p("thisIsLetter"), target, seg.p("laterAgain")],
      // Name both, side by side, so the contrast sticks.
      async afterRight() {
        const other = $$(".card").find((c) => c.dataset.v !== info.ch);
        await talk([seg.p("thisIsLetter"), target]);
        other && other.classList.add("lit");
        await talk([seg.p("andThisLetter"), seg.letter(partner)]);
      },
    });
  }

  // ---------- Exercise: word and picture ----------
  // Reading with understanding: the word is not read aloud until the child answers.
  function wordPicTask(task, info) {
    const w = info.word;
    const pics = S.pictureChoices(w);
    choiceTask(task, {
      stageClass: "word-stage",
      choicesClass: "pics",
      visual: `<div class="big-word">${w.w}</div>`,
      choices: pics.map((x) => ({ v: x.w, label: x.e })),
      answer: w.w,
      prompt: [seg.p("wordPic")],
      onWrong1: (val) => [seg.p("thisIs"), seg.word(D.WORDS.find((x) => x.w === val)), seg.p("wordPic")],
      onReveal: () => [seg.p("written"), seg.word(w)],
      afterRight: () => talk([seg.word(w)]),
    });
  }

  // ---------- Exercise: what's missing? ----------
  function missingTask(task, info) {
    const w = info.word;
    const parts = w.parsed.syllables;
    const idx = Math.floor(Math.random() * parts.length);
    const shown = parts.map((x, i) => (i === idx ? `<span class="blank">?</span>` : `<span>${x}</span>`)).join("");
    choiceTask(task, {
      stageClass: "word-stage",
      visual: `<div class="picture small"><div class="pic">${w.e}</div></div><div class="big-word parts" id="word">${shown}</div>`,
      choices: S.missingChoices(session.p, w, idx),
      answer: parts[idx],
      prompt: [seg.p("missing"), seg.word(w)],
      onWrong1: (val) => [seg.p("thisIs"), seg.part(val), seg.p("listenAgain"), seg.word(w)],
      onReveal: () => [seg.word(w)],
      async afterRight() {
        const blank = $(".blank");
        if (blank) {
          blank.textContent = parts[idx];
          blank.classList.add("filled");
        }
        await talk([seg.word(w)]);
      },
    });
  }

  // ---------- Exercise: build a word ----------
  // Tap the syllables in reading order to put the word together.
  function buildTask(task, info) {
    const w = info.word;
    const parts = w.parsed.syllables;
    let order = parts.map((_, i) => i);
    while (order.every((x, i) => x === i)) order = order.sort(() => Math.random() - 0.5);
    const slots = parts.map((_, i) => `<span class="slot" data-i="${i}"></span>`).join("");
    const tiles = order.map((i) => `<button class="tile" data-i="${i}">${parts[i]}</button>`).join("");
    const v = sessionShell(
      `<div class="picture small"><div class="pic">${w.e}</div></div>
       <div class="slots">${slots}</div>
       <div class="tiles">${tiles}</div>`,
      "word-stage build-stage"
    );
    const prompt = [seg.p("build"), seg.word(w)];
    let next = 0;
    let mistakes = 0;
    let locked = false;
    v.replay = () => talk(prompt);
    $$(".tile").forEach((tile) =>
      tile.addEventListener("click", async () => {
        if (locked || tile.disabled) return;
        const i = +tile.dataset.i;
        // Same-looking syllables are interchangeable.
        if (parts[i] === parts[next]) {
          tile.disabled = true;
          tile.classList.add("used");
          $$(".tile").forEach((t) => t.classList.remove("reveal"));
          const slot = $(`.slot[data-i="${next}"]`);
          slot.textContent = parts[i];
          slot.classList.add("filled");
          next++;
          A.sfx.tap();
          if (next === parts.length) {
            locked = true;
            A.sfx.correct();
            $(".slots").classList.add("done");
            await talk([seg.word(w)]);
            await wait(500);
            finishTask(task, mistakes === 0);
          } else {
            talk([seg.part(parts[i])]);
          }
          return;
        }
        mistakes++;
        A.sfx.soft();
        tile.classList.remove("wiggle");
        void tile.offsetWidth;
        tile.classList.add("wiggle");
        locked = true;
        if (mistakes === 1) {
          await talk([seg.p("thisIs"), seg.part(parts[i]), seg.p("listenAgain"), seg.word(w)]);
        } else {
          const right = $$(".tile").find((t) => !t.disabled && parts[+t.dataset.i] === parts[next]);
          right && right.classList.add("reveal");
          await talk([seg.part(parts[next])]);
        }
        locked = false;
      })
    );
    talk(prompt);
  }

  // ---------- Stage 8: letters that sound the same ----------
  function twinTask(task, info) {
    const p = session.p;
    const t = info.twin;
    const others = p.letters.filter((c) => !D.LETTER[c].finalOf && !D.soundsAlike(c, t.a) && !t.needs.includes(c));
    const pool = others.length >= 2 ? others : others.concat(D.RECOMMENDED_ORDER.filter((c) => !D.soundsAlike(c, t.a) && !t.needs.includes(c)));
    const choices = [t.b].concat(pool.sort(() => Math.random() - 0.5).slice(0, 2)).sort(() => Math.random() - 0.5);
    const target = seg.letter(t.a);
    choiceTask(task, {
      stageClass: "hear-stage twin-stage",
      visual: `<div class="big-letter small-big">${t.a}</div>`,
      choices,
      answer: t.b,
      prompt: [seg.p("soundsLike"), target],
      onWrong1: (val) => [seg.p("thisIsLetter"), seg.shown(val), seg.p("soundsLike"), target],
      onReveal: () => [seg.letter(t.a), seg.p("andAlso"), seg.shown(t.b), seg.p("soundSame")],
      afterRight: () => talk([seg.letter(t.a), seg.p("andAlso"), seg.shown(t.b), seg.p("soundSame")]),
    });
  }

  // ---------- Stage 9: dagesh and the shin/sin dot change the sound ----------
  function dageshTask(task, info) {
    const p = session.p;
    const nq = pickOne(p.niqqud.filter((n) => D.syllableAllowed(info.ch, n)));
    const f = D.dageshForms(info.ch, nq);
    const soft = Math.random() < 0.5;
    const segHard = seg.syl(info.ch, D.NQ[nq].sound);
    const segSoft = seg.sylSoft(info.ch, nq);
    const target = soft ? segSoft : segHard;
    const segOf = (v) => (v === f.hard.text ? segHard : segSoft);
    choiceTask(task, {
      stageClass: "hear-stage similar",
      visual: `<div class="ear-guide">${GUIDE}</div>`,
      choices: [f.hard.text, f.soft.text].sort(() => Math.random() - 0.5),
      answer: soft ? f.soft.text : f.hard.text,
      prompt: [seg.p("where"), target],
      onWrong1: (val) => [seg.p("thisIs"), segOf(val), seg.p("weLookForSyl"), target],
      onReveal: () => [seg.p("thisIs"), target],
      // Hear both, so the difference the dot makes is clear.
      async afterRight() {
        for (const card of $$(".card")) {
          card.classList.add("lit");
          await talk([segOf(card.dataset.v)]);
          card.classList.remove("lit");
        }
      },
    });
  }

  // ---------- Stage 7: ה at the end of a word is read as a vowel ----------
  function eheviTask(task, info) {
    const [a, b] = info.pair;
    const target = pickOne([a, b]);
    const ws = (w) => ({ key: "word." + w, text: w });
    choiceTask(task, {
      stageClass: "hear-stage similar words",
      visual: `<div class="ear-guide">${GUIDE}</div>`,
      choices: [a, b].sort(() => Math.random() - 0.5),
      answer: target,
      prompt: [seg.p("whereWritten"), ws(target)],
      onWrong1: (val) => [seg.p("hereItSays"), ws(val), seg.p("whereWritten"), ws(target)],
      onReveal: () => [seg.p("hereItSays"), ws(target)],
    });
  }

  // ---------- Stage 9: final letters ----------
  function finalFormTask(task, info) {
    const p = session.p;
    const w = pickOne(S.wordsEndingWith(info.ch));
    const stem = w.w.slice(0, w.w.lastIndexOf(info.ch));
    const others = D.LETTERS.filter((l) => l.finalOf && l.ch !== info.ch).map((l) => l.ch);
    const choices = [info.ch, info.base, pickOne(others)].sort(() => Math.random() - 0.5);
    choiceTask(task, {
      stageClass: "word-stage",
      visual: `<div class="picture small"><div class="pic">${w.e}</div></div><div class="big-word parts"><span>${stem}</span><span class="blank">?</span></div>`,
      choices,
      answer: info.ch,
      prompt: [seg.p("whichEnd"), seg.word(w)],
      onWrong1: (val) => [seg.p("thisIsLetter"), seg.letter(val), seg.p("listenAgain"), seg.word(w)],
      onReveal: () => [seg.p("atEndWeWrite"), seg.letter(info.ch)],
      async afterRight() {
        const blank = $(".blank");
        if (blank) {
          blank.textContent = info.ch;
          blank.classList.add("filled");
        }
        await talk([seg.word(w)]);
      },
    });
  }

  // ---------- Stage 10: read a sentence, pick its picture ----------
  function sentenceTask(task) {
    const { answer, choices } = S.sentenceTask(session.p);
    const scene = (c) => `<span class="scene"><span class="place">${c.place.e}</span><span class="who">${c.subject.e}</span></span>`;
    choiceTask(task, {
      stageClass: "word-stage sentence-stage",
      choicesClass: "pics scenes",
      visual: `<div class="big-word sentence">${answer.text}</div>`,
      choices: choices.map((c) => ({ v: c.text, label: scene(c) })),
      answer: answer.text,
      prompt: [seg.p("readSentence")],
      onWrong1: (val) => [seg.p("inThisPicture"), seg.sentence(val), seg.p("readSentence")],
      onReveal: () => [seg.p("written"), seg.sentence(answer.text)],
      afterRight: () => talk([seg.sentence(answer.text)]),
    });
  }

  // ---------- Grade 2, stage 11: words in the same tune ----------
  // Four words with one pattern. The guide asks for three of them in a row;
  // finding them quickly is the fluency practice.
  function tuneTask(task, info) {
    const words = S.tuneWords(session.p, info.idx);
    const targets = words.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    const v = sessionShell(
      `<div class="ear-guide">${GUIDE}</div>
       <div class="choices words4">${words.map((w) => `<button class="card" data-v="${esc(w)}"><span>${w}</span></button>`).join("")}</div>`,
      "hear-stage tune-stage"
    );
    let round = 0;
    let missesThisRound = 0;
    let mistakes = 0;
    let locked = false;
    const ask = () => talk([seg.p("whereWritten"), seg.text(targets[round])]);
    v.replay = ask;
    $$(".card").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (locked || btn.disabled) return;
        const target = targets[round];
        locked = true;
        if (btn.dataset.v === target) {
          A.sfx.correct();
          btn.classList.add("right");
          await wait(600);
          $$(".card").forEach((b) => (b.classList.remove("right", "wrong", "reveal"), (b.disabled = false)));
          round++;
          missesThisRound = 0;
          if (round === targets.length) {
            if (!mistakes) await talk([seg.praise()]);
            finishTask(task, mistakes === 0);
            return;
          }
          locked = false;
          ask();
          return;
        }
        mistakes++;
        missesThisRound++;
        A.sfx.soft();
        btn.classList.add("wrong");
        btn.disabled = true;
        if (missesThisRound === 1) {
          await talk([seg.p("hereItSays"), seg.text(btn.dataset.v), seg.p("whereWritten"), seg.text(target)]);
        } else {
          $$(".card").forEach((b) => b.dataset.v === target && b.classList.add("reveal"));
          await talk([seg.p("hereItSays"), seg.text(target)]);
        }
        locked = false;
      })
    );
    talk([seg.p("sameTune")]).then(() => $(".tune-stage") && ask());
  }

  // ---------- Grade 2, stage 11: one or many (endings) ----------
  function pluralTask(task, info) {
    const x = D.PLURALS[info.idx];
    const many = Math.random() < 0.5;
    const pics = many ? `<span>${x.e}</span><span>${x.e}</span><span>${x.e}</span>` : `<span>${x.e}</span>`;
    choiceTask(task, {
      stageClass: "word-stage",
      choicesClass: "words2",
      visual: `<div class="picture"><div class="pic count ${many ? "many" : ""}">${pics}</div></div>`,
      choices: [x.one, x.many].sort(() => Math.random() - 0.5),
      answer: many ? x.many : x.one,
      prompt: [seg.p("whichFits")],
      onWrong1: (val) => [seg.p("hereItSays"), seg.text(val), seg.p("lookAgain")],
      onReveal: () => [seg.p("written"), seg.text(many ? x.many : x.one)],
      afterRight: () => talk([seg.text(many ? x.many : x.one)]),
    });
  }

  // ---------- Grade 2, stage 11: word families (roots) ----------
  function familyTask(task, info) {
    const t = S.familyTask(session.p, info.idx);
    choiceTask(task, {
      stageClass: "word-stage",
      choicesClass: "words3",
      visual: `<div class="big-word">${t.word}</div>`,
      choices: t.choices,
      answer: t.answer,
      prompt: [seg.p("familyOf"), seg.text(t.word)],
      onWrong1: (val) => [seg.p("hereItSays"), seg.text(val), seg.p("familyOf"), seg.text(t.word)],
      onReveal: () => [seg.text(t.word), seg.p("andAlso"), seg.text(t.answer), seg.p("sameFamily")],
      afterRight: () => talk([seg.text(t.word), seg.p("andAlso"), seg.text(t.answer), seg.p("sameFamily")]),
    });
  }

  // ---------- Grade 2, stage 11: prefix letters ----------
  function prefixTask(task, info) {
    const t = S.prefixTask(session.p, info.idx);
    choiceTask(task, {
      stageClass: "hear-stage similar words",
      choicesClass: "words3",
      visual: `<div class="ear-guide">${GUIDE}</div>`,
      choices: t.choices,
      answer: t.target,
      prompt: [seg.p("whereWritten"), seg.text(t.target)],
      onWrong1: (val) => [seg.p("hereItSays"), seg.text(val), seg.p("whereWritten"), seg.text(t.target)],
      onReveal: () => [seg.p("hereItSays"), seg.text(t.target)],
    });
  }

  // ---------- Grade 2, stage 12: period or question mark ----------
  function punctTask(task) {
    const t = S.punctTask(session.p);
    const mark = t.question ? "?" : ".";
    choiceTask(task, {
      stageClass: "word-stage",
      choicesClass: "marks",
      visual: `<div class="big-word sentence parts"><span>${t.text}</span><span class="blank">&nbsp;</span></div>`,
      choices: [".", "?"].map((m) => ({ v: m, label: m })),
      answer: mark,
      prompt: [seg.p("dotOrQuestion")],
      onWrong1: () => [seg.p(t.question ? "isQuestion" : "notQuestion")],
      onReveal: () => [seg.p(t.question ? "isQuestion" : "notQuestion")],
      async afterRight() {
        const blank = $(".blank");
        if (blank) {
          blank.textContent = mark;
          blank.classList.add("filled");
        }
        await talk([seg.sentence(t.text + mark)]);
      },
    });
  }

  // ---------- Grade 2, stage 12: a short word without niqqud ----------
  function bareTask(task) {
    const w = pickOne(S.bareWords(session.p));
    const pics = S.pictureChoices(w);
    choiceTask(task, {
      stageClass: "word-stage",
      choicesClass: "pics",
      visual: `<div class="big-word">${D.stripNiqqud(w.w)}</div>`,
      choices: pics.map((x) => ({ v: x.w, label: x.e })),
      answer: w.w,
      prompt: [seg.p("wordPic")],
      onWrong1: (val) => [seg.p("thisIs"), seg.word(D.WORDS.find((x) => x.w === val)), seg.p("wordPic")],
      onReveal: () => [seg.p("written"), seg.word(w)],
      afterRight: () => talk([seg.word(w)]),
    });
  }

  // ---------- Grade 2, stage 12: read a short story, answer a question ----------
  function storyTask(task) {
    const t = S.storyTask(session.p);
    choiceTask(task, {
      stageClass: "word-stage story-stage",
      choicesClass: "pics",
      visual: `<div class="story"><p>${t.story}</p><p class="question">${t.question}</p></div>`,
      choices: t.choices.map((pl) => ({ v: pl.w, label: pl.e })),
      answer: t.answer.w,
      prompt: [seg.p("readStory")],
      onWrong1: () => [seg.p("readStoryAgain")],
      onReveal: () => [seg.sentence(t.story)],
      afterRight: () => talk([seg.sentence(t.story)]),
    });
  }

  // ---------- Exercise: tracing ----------
  function traceTask(task, info) {
    const v = sessionShell(`<div class="trace-wrap" id="trace"></div>`, "trace-stage");
    let fails = 0;
    let failsThisStroke = 0;
    const intro = () => [seg.p("letsWrite"), seg.letter(info.ch)];
    const tracer = Aleph.createTracer($("#trace"), info.ch, {
      onStroke() {
        failsThisStroke = 0;
        A.sfx.tap();
      },
      async onFail() {
        fails++;
        failsThisStroke++;
        A.sfx.soft();
        if (failsThisStroke >= 3) {
          failsThisStroke = 0;
          talk([seg.p("watch")]);
          await tracer.demo();
        } else {
          talk([seg.p("traceRetry")]);
        }
      },
      async onDone() {
        A.sfx.correct();
        await wait(300);
        await talk([seg.praise()]);
        await wait(300);
        // One slip is forgiven; tracing is about direction and order, not neatness.
        finishTask(task, fails <= 1);
      },
    });
    v.replay = async () => {
      await talk(intro());
      await tracer.demo();
    };
    v.cleanup = () => tracer.destroy();
    (async () => {
      await talk(intro().concat(seg.p("watch")));
      await tracer.demo();
      talk([seg.p("yourTurn")]);
    })();
  }

  // ---------- Parent gate ----------
  function parentGate() {
    const a = 3 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    let entry = "";
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((k) => `<button class="key" data-k="${k}">${k}</button>`).join("");
    show(
      `<div class="topbar"><button class="icon-btn" id="back" aria-label="חזרה">${ICON.close}</button></div>
       <div class="gate">
         <p>להורים: כמה זה</p>
         <div class="q" dir="ltr">${a} × ${b} = <span id="entry">?</span></div>
         <div class="keypad" dir="ltr">${keys}</div>
       </div>`,
      "parent gate-screen"
    );
    on("#back", "click", home);
    $$(".key").forEach((btn) =>
      btn.addEventListener("click", () => {
        const k = btn.dataset.k;
        if (k === "⌫") entry = entry.slice(0, -1);
        else if (k === "✓") {
          if (Number(entry) === a * b) return parentHome();
          entry = "";
          $(".q").classList.add("shake");
          setTimeout(() => $(".q") && $(".q").classList.remove("shake"), 400);
        } else if (entry.length < 3) entry += k;
        $("#entry").textContent = entry || "?";
      })
    );
  }

  // ---------- Parent area ----------
  function parentHome() {
    const p = S.profile();
    const statusLabel = { mastered: "נלמד", practice: "בתרגול", learned: "עוד לא תורגל", off: "לא נלמד עדיין בכיתה" };
    const map = D.LETTERS.map((l) => {
      const st = S.letterStatus(p, l.ch);
      return `<div class="map-cell ${st}" title="${l.name} — ${statusLabel[st]}">${l.ch}</div>`;
    }).join("");
    const nq = D.NIQQUD.map((n) => {
        const s = S.niqqudStatus(p, n.id);
        const sample = D.syllableText("ב", n.id);
        const detail = s.status === "off" ? statusLabel.off : n.sound ? `${s.mastered} מתוך ${s.total} צירופים נלמדו` : "משמש בקריאת מילים";
        return `<div class="nq-row"><div class="map-cell ${s.status}">${sample}</div><div><b>${n.name}</b><br><span class="muted">${detail}</span></div></div>`;
      })
      .join("");
    const conf = S.topConfusions(p);
    const confHtml = conf.length
      ? `<ul class="conf">${conf
          .map((c) => `<li><span class="pair">${c.target} / ${c.chosen}</span> <span class="muted">${c.count} פעמים — חיפשנו ${c.target} ונבחרה ${c.chosen}</span></li>`)
          .join("")}</ul>`
      : `<p class="muted">עוד אין בלבולים חוזרים.</p>`;
    const voiceOk = A.hasHebrewVoice();
    const rec = A.recordedCount();
    const voiceHtml = rec
      ? `<p>${rec} הקלטות בדוקות זמינות. השאר מושמע בקול של המכשיר.</p>`
      : voiceOk
      ? `<p>מושמע בקול העברי של המכשיר (${esc(A.voiceName())}).</p>`
      : `<p class="warn">לא נמצא קול עברי במכשיר. באייפון: הגדרות ← נגישות ← תוכן מדובר ← קולות ← עברית. באנדרואיד: הגדרות ← המרת טקסט לדיבור ← התקנת עברית.</p>`;

    show(
      `<div class="parent-page dash">
        <div class="dash-head">
          <h1>אזור הורים</h1>
          <button class="btn small" id="back">חזרה לילד</button>
        </div>
        <section class="card-box summary">
          <div><b>${esc(p.name)}</b> · כיתה ${p.grade}′</div>
          <div class="stats">
            <div><b>${S.minutesThisWeek(p)}</b><span>דקות תרגול השבוע</span></div>
            <div><b>${p.stickers.length}</b><span>אותיות שנלמדו</span></div>
            <div><b>${S.readableWords(p).filter((w) => S.isMastered(p, "W:" + w.w)).length}</b><span>מילים שנקראו</span></div>
            <div><b>${p.sessions}</b><span>מפגשים</span></div>
          </div>
        </section>
        <section class="card-box">
          <h2>מפת אותיות</h2>
          <div class="letter-map">${map}</div>
          <div class="legend">
            <span><i class="mastered"></i>נלמד</span><span><i class="practice"></i>בתרגול</span>
            <span><i class="learned"></i>עוד לא תורגל</span><span><i class="off"></i>לא נלמד בכיתה</span>
          </div>
          <h2>ניקוד</h2>
          ${nq}
          <h2>כללי קריאה</h2>
          ${D.RULES.map((r) => {
            const st = S.ruleStatus(p, r.id);
            const detail = st.status === "off" ? statusLabel.off : `${st.mastered} מתוך ${st.total} תרגילים נלמדו`;
            return `<div class="nq-row"><div class="map-cell ${st.status} rule-cell">${r.sample}</div><div><b>${r.name}</b><br><span class="muted">${detail}</span></div></div>`;
          }).join("")}
          ${
            p.grade === "ב"
              ? `<h2>כיתה ב׳</h2>${D.GRADE2.map((g) => {
                  const st = S.grade2Status(p, g.id);
                  const detail = st.total ? `${st.mastered} מתוך ${st.total} תרגילים נלמדו` : "עוד אין מספיק מילים שנלמדו";
                  return `<div class="nq-row"><div class="map-cell ${st.status} dot-cell"></div><div><b>${g.name}</b><br><span class="muted">${detail}</span></div></div>`;
                }).join("")}`
              : ""
          }
        </section>
        <section class="card-box">
          <h2>בלבולים נפוצים</h2>
          ${confHtml}
        </section>
        <section class="card-box">
          <h2>קול</h2>
          ${voiceHtml}
          <button class="btn small" id="voices">בדיקת קול: האזנה לכל הפריטים</button>
        </section>
        <section class="card-box actions">
          <button class="btn primary" id="edit">עדכון מה נלמד בכיתה ופרטי הילד</button>
          <button class="btn" id="export">גיבוי ההתקדמות לקובץ</button>
          <label class="btn file-btn">שחזור מגיבוי<input type="file" id="import" accept="application/json,.json" hidden></label>
          <button class="btn danger" id="reset">מחיקת כל המידע</button>
          <p class="muted">המידע נשמר רק במכשיר הזה. כדאי לגבות לפני החלפת טלפון.</p>
        </section>
      </div>`,
      "parent"
    );
    on("#back", "click", home);
    on("#edit", "click", () => profileForm(JSON.parse(JSON.stringify(p)), false));
    on("#voices", "click", voiceCheck);
    on("#export", "click", () => {
      const blob = new Blob([S.exportData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `aleph-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    });
    on("#import", "change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        S.importData(await f.text());
        alert("הגיבוי שוחזר.");
        start();
      } catch (_) {
        alert("הקובץ הזה אינו גיבוי של אלף.");
      }
    });
    on("#reset", "click", () => {
      if (confirm("למחוק את הפרופיל ואת כל ההתקדמות מהמכשיר?")) {
        S.resetAll();
        welcome();
      }
    });
  }

  function voiceCheck() {
    const rows = [];
    D.LETTERS.forEach((l) => rows.push({ label: `${l.ch} — ${l.name}`, segs: [seg.letter(l.ch)] }));
    D.NIQQUD.forEach((n) => rows.push({ label: `${D.syllableText("ב", n.id)} — ${n.name}`, segs: [seg.nq(n.id)] }));
    // One row per sound; marks that sound the same share a recording.
    const sounds = [];
    D.NIQQUD.forEach((n) => !sounds.some((x) => x.sound === n.sound) && sounds.push(n));
    sounds.forEach((n) =>
      D.LETTERS.filter((l) => D.syllableAllowed(l.ch, n.id)).forEach((l) => {
        const same = D.NIQQUD.filter((m) => m.sound === n.sound && D.syllableAllowed(l.ch, m.id)).map((m) => D.syllableText(l.ch, m.id));
        rows.push({ label: same.join(" / "), segs: [seg.syl(l.ch, n.sound)] });
      })
    );
    D.WORDS.forEach((w) => rows.push({ label: `${w.e} ${w.w}`, segs: [seg.word(w)] }));
    Object.keys(D.DAGESH_PAIRS).forEach((ch) =>
      D.NIQQUD.forEach((n) => {
        if (!D.syllableAllowed(ch, n.id) || D.NIQQUD.find((m) => m.sound === n.sound) !== n) return;
        rows.push({ label: D.dageshForms(ch, n.id).soft.text, segs: [seg.sylSoft(ch, n.id)] });
      })
    );
    D.EHEVI_PAIRS.flat().forEach((w) => rows.push({ label: w, segs: [{ key: "word." + w, text: w }] }));
    D.SUBJECTS.forEach((s) => D.PLACES.forEach((pl) => rows.push({ label: `${s.e}${pl.e} ${s.w} ${pl.w}`, segs: [seg.sentence(s.w + " " + pl.w)] })));
    const parts = new Set();
    D.WORDS.forEach((w) => w.parsed.ok && w.parsed.syllables.forEach((x) => parts.add(x)));
    [...parts].map((x) => seg.part(x)).filter((g) => g.key.startsWith("part.")).forEach((g) => rows.push({ label: g.text, segs: [g] }));
    Object.keys(D.PHRASES).forEach((k) => {
      const v = D.PHRASES[k];
      if (Array.isArray(v)) v.forEach((t, i) => rows.push({ label: t, segs: [{ key: `p.${k}.${i}`, text: t }] }));
      else if (typeof v === "string") rows.push({ label: v, segs: [{ key: "p." + k, text: v }] });
      else ["m", "f"].forEach((g) => rows.push({ label: v[g], segs: [{ key: `p.${k}.${g}`, text: v[g] }] }));
    });
    show(
      `<div class="parent-page">
        <div class="dash-head"><h1>בדיקת קול</h1><button class="btn small" id="back">חזרה</button></div>
        <p class="muted">לחצו על שורה כדי לשמוע. מערכות קול בעברית לא תמיד קוראות ניקוד נכון — אם משהו נשמע שגוי, זה המקום לגלות זאת.</p>
        <div class="voice-list">${rows.map((r, i) => `<button class="voice-row" data-i="${i}">${ICON.speaker}<span>${r.label}</span></button>`).join("")}</div>
      </div>`,
      "parent"
    );
    on("#back", "click", parentHome);
    $$(".voice-row").forEach((b) => b.addEventListener("click", () => A.say(rows[+b.dataset.i].segs)));
  }

  // ---------- Profile form ----------
  function profileForm(p, isNew) {
    const letterBtns = (list) =>
      list.map((l) => `<button type="button" class="toggle ${p.letters.includes(l.ch) ? "on" : ""}" data-ch="${l.ch}" aria-pressed="${p.letters.includes(l.ch)}">${l.ch}</button>`).join("");
    const base = D.LETTERS.filter((l) => !l.finalOf);
    const finals = D.LETTERS.filter((l) => l.finalOf);
    const nq = D.NIQQUD.map(
      (n) =>
        `<button type="button" class="toggle nq ${p.niqqud.includes(n.id) ? "on" : ""}" data-nq="${n.id}" aria-pressed="${p.niqqud.includes(n.id)}">
          <span class="nq-sample">${D.syllableText("ב", n.id)}</span><span>${n.name}</span></button>`
    ).join("");
    show(
      `<div class="parent-page form">
        <div class="dash-head"><h1>${isNew ? "פרופיל חדש" : "עדכון פרופיל"}</h1>${isNew ? "" : `<button class="btn small" id="cancel">ביטול</button>`}</div>
        <label class="field"><span>שם הילד</span><input id="name" type="text" maxlength="20" value="${esc(p.name)}" autocomplete="off" placeholder="למשל: נועה"></label>
        <div class="field"><span>פונים אל הילד בלשון</span>
          <div class="seg-ctl" id="gender">
            <button type="button" data-v="m" class="${p.gender === "m" ? "on" : ""}">זכר (בּוֹא)</button>
            <button type="button" data-v="f" class="${p.gender === "f" ? "on" : ""}">נקבה (בּוֹאִי)</button>
          </div></div>
        <div class="field"><span>כיתה</span>
          <div class="seg-ctl" id="grade">
            <button type="button" data-v="א" class="${p.grade === "א" ? "on" : ""}">א′</button>
            <button type="button" data-v="ב" class="${p.grade === "ב" ? "on" : ""}">ב′</button>
          </div></div>
        <div class="field"><span>אילו אותיות כבר נלמדו בכיתה?</span>
          <div class="toggles" id="letters">${letterBtns(base)}</div>
          <div class="row-btns"><button type="button" class="btn small" id="all">סמן הכול</button><button type="button" class="btn small" id="none">נקה</button></div>
          <span class="sub">אותיות סופיות</span>
          <div class="toggles" id="finals">${letterBtns(finals)}</div>
          <p class="muted">אפשר לעדכן כל שבוע. האפליקציה מתרגלת רק מה שסומן, ופותחת חומר חדש בהדרגה.</p>
        </div>
        <div class="field"><span>אילו סימני ניקוד נלמדו?</span>
          <div class="toggles nq-toggles">${nq}</div>
          <p class="muted">מילים לקריאה מופיעות רק כשכל האותיות וסימני הניקוד שלהן סומנו כאן.</p>
        </div>
        <div class="field"><span>מה עוד נלמד?</span>
          <div class="rule-toggles">${D.RULES.map(
            (r) => `<button type="button" class="toggle rule ${(p.rules || []).includes(r.id) ? "on" : ""}" data-rule="${r.id}" aria-pressed="${(p.rules || []).includes(r.id)}">
              <span class="rule-sample">${r.sample}</span><span>${r.name}</span></button>`
          ).join("")}</div>
          <p class="muted">מילים עם ה׳ בסוף, או עם ב/כ/פ בלי דגש, מופיעות רק אחרי שהכלל המתאים סומן.</p>
        </div>
        <label class="field"><span>מהירות הקול</span>
          <div class="rate-row"><input id="rate" type="range" min="0.6" max="1.1" step="0.05" value="${p.rate}"><button type="button" class="icon-btn" id="try" aria-label="דוגמה">${ICON.speaker}</button></div>
        </label>
        <p class="error" id="err" hidden></p>
        <button class="btn primary" id="save">שמירה</button>
      </div>`,
      "parent"
    );
    $$(".toggle[data-ch]").forEach((b) =>
      b.addEventListener("click", () => {
        const on = b.classList.toggle("on");
        b.setAttribute("aria-pressed", on);
      })
    );
    $$(".toggle[data-rule]").forEach((b) =>
      b.addEventListener("click", () => {
        const on = b.classList.toggle("on");
        b.setAttribute("aria-pressed", on);
      })
    );
    $$(".toggle[data-nq]").forEach((b) =>
      b.addEventListener("click", () => {
        const on = b.classList.toggle("on");
        b.setAttribute("aria-pressed", on);
      })
    );
    ["#gender", "#grade"].forEach((id) =>
      $$(id + " button").forEach((b) =>
        b.addEventListener("click", () => {
          $$(id + " button").forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
          // A second-grader already learned everything in grade 1: mark it all, if nothing is marked yet.
          if (id === "#grade" && b.dataset.v === "ב" && !$$(".toggle.on").length) {
            $$(".toggle[data-ch], .toggle[data-nq], .toggle[data-rule]").forEach((t) => (t.classList.add("on"), t.setAttribute("aria-pressed", true)));
          }
        })
      )
    );
    on("#all", "click", () => $$("#letters .toggle").forEach((b) => (b.classList.add("on"), b.setAttribute("aria-pressed", true))));
    on("#none", "click", () => $$("#letters .toggle, #finals .toggle").forEach((b) => (b.classList.remove("on"), b.setAttribute("aria-pressed", false))));
    on("#try", "click", () => {
      A.unlock();
      A.setRate(Number($("#rate").value));
      A.say([seg.p("thisIsLetter"), seg.letter("ד"), seg.p("like"), seg.word(D.WORDS.find((w) => w.first === "ד"))]);
    });
    on("#cancel", "click", parentHome);
    on("#save", "click", () => {
      const name = $("#name").value.trim();
      const err = $("#err");
      if (!name) {
        err.textContent = "צריך שם — הדמות פונה אל הילד בשמו.";
        err.hidden = false;
        $("#name").focus();
        return;
      }
      p.name = name;
      p.gender = $("#gender .on").dataset.v;
      p.grade = $("#grade .on").dataset.v;
      p.letters = $$(".toggle[data-ch].on").map((b) => b.dataset.ch);
      p.niqqud = $$(".toggle[data-nq].on").map((b) => b.dataset.nq);
      p.rules = $$(".toggle[data-rule].on").map((b) => b.dataset.rule);
      p.rate = Number($("#rate").value);
      A.setRate(p.rate);
      S.saveProfile(p);
      isNew ? home() : parentHome();
    });
  }

  // Start once the splash is gone (or right away if there is none).
  if (document.getElementById("splash")) document.addEventListener("sugi-splash-done", start, { once: true });
  else start();
})();
