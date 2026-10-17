/* Audio for Aleph.
 *
 * Every spoken segment is { key, text }. What plays, in order of preference:
 *   1. the parent's own recording of that item (kept in IndexedDB on the device),
 *   2. the recording listed in audio/manifest.json, which passed the automatic
 *      checks in tools/voice/,
 *   3. a candidate recording (audio/candidates.json) the parent listened to and
 *      approved in the voice check — short items machines can't check,
 *   4. the device's Hebrew voice reading `text` (it often ignores niqqud).
 * Sound effects are synthesized with WebAudio so nothing needs downloading. */
(() => {
  "use strict";

  const Aleph = (window.Aleph = window.Aleph || {});

  let manifest = {};
  let status = {}; // key → "listen" | "fail", from the recording checks
  let own = new Set(); // keys the parent recorded
  let candidates = {}; // key → file awaiting the parent's approval
  const APPROVED_KEY = "aleph.approvedVoice";
  let approved = new Set();
  try {
    approved = new Set(JSON.parse(localStorage.getItem(APPROVED_KEY) || "[]"));
  } catch (_) {}
  function saveApproved() {
    try {
      localStorage.setItem(APPROVED_KEY, JSON.stringify([...approved]));
    } catch (_) {}
  }
  let rate = 0.85;
  let voice = null;
  let ctx = null;
  let currentAudio = null;
  let token = 0; // bumps on every new say() / stop(), cancelling older chains

  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;

  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    const he = voices.filter((v) => /^he|^iw/i.test(v.lang));
    // Prefer a local (offline) voice.
    voice = he.find((v) => v.localService) || he[0] || null;
  }
  if (synth) {
    pickVoice();
    synth.addEventListener && synth.addEventListener("voiceschanged", pickVoice);
  }

  async function loadManifest() {
    try {
      const res = await fetch("audio/manifest.json", { cache: "no-cache" });
      if (res.ok) manifest = await res.json();
    } catch (_) {
      manifest = {};
    }
    try {
      const res = await fetch("audio/candidates.json", { cache: "no-cache" });
      if (res.ok) candidates = await res.json();
    } catch (_) {
      candidates = {};
    }
    try {
      const res = await fetch("audio/voice-status.json", { cache: "no-cache" });
      if (res.ok) status = await res.json();
    } catch (_) {
      status = {};
    }
    try {
      own = new Set(await ownKeys());
    } catch (_) {
      own = new Set();
    }
  }

  // ---------- The parent's own recordings (IndexedDB, this device only) ----------
  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("aleph-voice", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("rec");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction("rec", mode);
      const req = fn(t.objectStore("rec"));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
    });
  }
  const ownKeys = () => tx("readonly", (st) => st.getAllKeys());
  const ownGet = (key) => tx("readonly", (st) => st.get(key));
  async function ownSave(key, blob) {
    await tx("readwrite", (st) => st.put(blob, key));
    own.add(key);
  }
  async function ownDelete(key) {
    await tx("readwrite", (st) => st.delete(key));
    own.delete(key);
  }

  // Records from the microphone until stop() is called on the result.
  async function record() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: rec.mimeType || "audio/mp4" }));
      };
    });
    rec.start();
    return { stop: () => (rec.stop(), done) };
  }

  function playFile(src) {
    return new Promise((resolve) => {
      const a = new Audio(src);
      currentAudio = a;
      a.playbackRate = Math.max(0.6, Math.min(1.2, rate / 0.85));
      const finish = () => {
        if (currentAudio === a) currentAudio = null;
        resolve();
      };
      a.onended = finish;
      a.onerror = finish;
      a.play().catch(finish);
    });
  }

  function speakText(text) {
    return new Promise((resolve) => {
      if (!synth) {
        setTimeout(resolve, 300 + text.length * 60);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "he-IL";
      if (voice) u.voice = voice;
      u.rate = rate;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        resolve();
      };
      // Some engines never fire onend; never let the lesson hang on it.
      const guard = setTimeout(finish, 1500 + (text.length * 160) / rate);
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    });
  }

  function stop() {
    token++;
    if (synth) synth.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }

  // say([{key, text}, ...]) — plays segments in order. Resolves when done or
  // when interrupted by another say()/stop().
  async function say(segments) {
    stop();
    const myToken = token;
    for (const seg of segments) {
      if (myToken !== token) return;
      if (!seg || !seg.text) continue;
      if (seg.key && own.has(seg.key)) {
        const blob = await ownGet(seg.key).catch(() => null);
        if (blob) {
          const url = URL.createObjectURL(blob);
          await playFile(url);
          URL.revokeObjectURL(url);
          continue;
        }
      }
      const file = seg.key && (manifest[seg.key] || (approved.has(seg.key) && candidates[seg.key]));
      if (file) {
        await playFile("audio/" + file);
        // Recordings are trimmed tight; leave a breath between segments.
        if (myToken === token) await new Promise((r) => setTimeout(r, 110));
      } else await speakText(seg.text);
    }
  }

  // ---------- Sound effects ----------
  function audioCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = "sine", gain = 0.18) {
    const c = audioCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const sfx = {
    correct() {
      tone(784, 0, 0.18, "triangle");
      tone(1175, 0.1, 0.28, "triangle");
    },
    soft() {
      // A gentle, non-punishing "hmm" for a wrong answer.
      tone(330, 0, 0.22, "sine", 0.12);
      tone(294, 0.14, 0.26, "sine", 0.1);
    },
    tap() {
      tone(660, 0, 0.06, "sine", 0.08);
    },
    sticker() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, "triangle", 0.15));
    },
  };

  // iOS only lets audio start from a user gesture; call this from one.
  function unlock() {
    audioCtx();
    if (synth && !unlock.done) {
      unlock.done = true;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    }
  }

  Aleph.audio = {
    loadManifest,
    say,
    stop,
    sfx,
    unlock,
    setRate(r) {
      rate = r;
    },
    hasHebrewVoice() {
      pickVoice();
      return !!voice;
    },
    voiceName() {
      return voice ? voice.name : null;
    },
    recordedCount() {
      return Object.keys(manifest).length;
    },
    // For the parent's voice check.
    source(key) {
      if (own.has(key)) return "own";
      if (manifest[key]) return "file";
      if (candidates[key]) return approved.has(key) ? "approved" : "candidate";
      return "device";
    },
    // Plays the candidate recording so the parent can judge it.
    async preview(seg) {
      if (candidates[seg.key] && !own.has(seg.key)) {
        stop();
        await playFile("audio/" + candidates[seg.key]);
      } else await say([seg]);
    },
    approve(key, yes) {
      if (yes) approved.add(key);
      else approved.delete(key);
      saveApproved();
    },
    checkStatus: (key) => status[key] || null,
    record,
    saveOwn: ownSave,
    deleteOwn: ownDelete,
    canRecord: () => !!(navigator.mediaDevices && window.MediaRecorder),
  };
})();
