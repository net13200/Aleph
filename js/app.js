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
    syl: (ch) => ({ key: "syl." + ch, text: D.SYL_A[ch] }),
    word: (w) => ({ key: "word." + w.w, text: w.w }),
    name: () => ({ key: null, text: (S.profile() || {}).name || "" }),
  };
  function itemSeg(info) {
    return info.kind === "S" ? seg.syl(info.ch) : seg.letter(info.ch);
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
      total: tasks.filter((t) => t.type !== "intro").length,
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
    if (session.i >= session.tasks.length || (overTime && session.tasks[session.i].type !== "intro")) {
      endSession();
      return;
    }
    const task = session.tasks[session.i];
    const info = S.itemInfo(task.id);
    const run = { intro: introTask, hear: hearTask, hearSyl: hearTask, opening: soundTask, closing: soundTask, trace: traceTask }[task.type];
    run(task, info);
  }

  function finishTask(task, firstTry) {
    if (!session) return;
    const p = session.p;
    if (task.type === "intro") {
      S.markIntroduced(p, task.id);
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

  // ---------- Exercise: choose one of three ----------
  // opts: { prompt: [segments], answer, choices, onWrong1(chosen), onReveal(), visual }
  function choiceTask(task, opts) {
    const cards = opts.choices
      .map((c) => `<button class="card" data-v="${esc(c)}"><span>${c}</span></button>`)
      .join("");
    const v = sessionShell(`${opts.visual || ""}<div class="choices">${cards}</div>`, opts.stageClass);
    let attempts = 0;
    let locked = false;
    v.replay = () => talk(opts.prompt);
    $$(".card").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (locked || btn.disabled) return;
        const val = btn.dataset.v;
        if (val === opts.answer) {
          locked = true;
          btn.classList.add("right");
          A.sfx.correct();
          if (attempts === 0 && Math.random() < 0.4) await talk([seg.praise()]);
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
    talk(opts.prompt);
  }

  function hearTask(task, info) {
    const p = session.p;
    const isSyl = info.kind === "S";
    const answer = info.display;
    const choices = S.choicesFor(p, task);
    const target = itemSeg(info);
    const chosenSeg = (val) => {
      if (!isSyl) return seg.letter(val);
      return seg.syl([...val][0]);
    };
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
    const nq = D.NIQQUD.filter((n) => n.v1)
      .map((n) => {
        const s = S.niqqudStatus(p, n.id);
        const sample = "בּ" + n.mark;
        const detail = s.status === "off" ? statusLabel.off : `${s.mastered} מתוך ${s.total} צירופים נלמדו`;
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
    Object.keys(D.SYL_A).forEach((ch) => rows.push({ label: `${D.syllableText(ch, "kamatz")} / ${D.syllableText(ch, "patach")}`, segs: [seg.syl(ch)] }));
    D.WORDS.forEach((w) => rows.push({ label: `${w.e} ${w.w}`, segs: [seg.word(w)] }));
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
        `<button type="button" class="toggle nq ${p.niqqud.includes(n.id) ? "on" : ""}" data-nq="${n.id}" ${n.v1 ? "" : "disabled"} aria-pressed="${p.niqqud.includes(n.id)}">
          <span class="nq-sample">בּ${n.mark}</span><span>${n.name}</span></button>`
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
          <p class="muted">בגרסה הזו: קמץ ופתח. שאר הסימנים יגיעו בגרסה הבאה.</p>
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
