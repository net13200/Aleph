/* Content for Aleph: letters, niqqud, words, tracing paths and spoken phrases.
 * Everything the child hears has a stable `key`, so a pre-recorded file
 * (audio/<key>.mp3, listed in audio/manifest.json) can replace the
 * on-device voice item by item. */
(() => {
  "use strict";

  const Aleph = (window.Aleph = window.Aleph || {});

  // ---------- Letters ----------
  // name: vocalized letter name (what the child hears and the parent sees).
  // finalOf: final forms point at their base letter.
  const LETTERS = [
    { ch: "א", name: "אָלֶף" },
    { ch: "ב", name: "בֵּית" },
    { ch: "ג", name: "גִּימֶל" },
    { ch: "ד", name: "דָּלֶת" },
    { ch: "ה", name: "הֵא" },
    { ch: "ו", name: "וָו" },
    { ch: "ז", name: "זַיִן" },
    { ch: "ח", name: "חֵית" },
    { ch: "ט", name: "טֵית" },
    { ch: "י", name: "יוּד" },
    { ch: "כ", name: "כָּף" },
    { ch: "ל", name: "לָמֶד" },
    { ch: "מ", name: "מֵם" },
    { ch: "נ", name: "נוּן" },
    { ch: "ס", name: "סָמֶךְ" },
    { ch: "ע", name: "עַיִן" },
    { ch: "פ", name: "פֵּא" },
    { ch: "צ", name: "צָדִי" },
    { ch: "ק", name: "קוֹף" },
    { ch: "ר", name: "רֵישׁ" },
    { ch: "ש", name: "שִׁין" },
    { ch: "ת", name: "תָּו" },
    { ch: "ך", name: "כָּף סוֹפִית", finalOf: "כ" },
    { ch: "ם", name: "מֵם סוֹפִית", finalOf: "מ" },
    { ch: "ן", name: "נוּן סוֹפִית", finalOf: "נ" },
    { ch: "ף", name: "פֵּא סוֹפִית", finalOf: "פ" },
    { ch: "ץ", name: "צָדִי סוֹפִית", finalOf: "צ" },
  ];
  const LETTER = Object.fromEntries(LETTERS.map((l) => [l.ch, l]));

  // Letters that sound the same (or nearly) at the start/end of a word.
  // A "which letter do you hear" question never offers two of these together.
  const SAME_SOUND = [
    ["א", "ה", "ע"],
    ["ט", "ת"],
    ["כ", "ק"],
    ["כ", "ח"],
    ["ב", "ו"],
    ["ס", "ש"],
  ];
  function soundsAlike(a, b) {
    if (a === b) return true;
    return SAME_SOUND.some((g) => g.includes(a) && g.includes(b));
  }

  // Letters children tend to mix up by shape — used as preferred distractors
  // so practice targets the hard contrasts, and shown in the parent area.
  const LOOK_ALIKE = [
    ["ב", "כ"],
    ["ד", "ר"],
    ["ו", "ז"],
    ["ה", "ח", "ת"],
    ["ג", "נ"],
    ["ס", "ם"],
    ["ע", "צ"],
  ];
  function lookAlikes(ch) {
    const out = new Set();
    LOOK_ALIKE.forEach((g) => {
      if (g.includes(ch)) g.forEach((x) => x !== ch && out.add(x));
    });
    return [...out];
  }

  // ---------- Niqqud ----------
  // In the order the Ministry programme teaches them. `sound` groups marks
  // that sound the same (kamatz/patach, segol/tsere, shuruk/kubutz).
  const NIQQUD = [
    { id: "kamatz", mark: "\u05B8", name: "קָמַץ", sound: "a" },
    { id: "patach", mark: "\u05B7", name: "פַּתָּח", sound: "a" },
    { id: "hiriq", mark: "\u05B4", name: "חִירִיק", sound: "i" },
    { id: "holam", mark: "\u05B9", name: "חוֹלָם", sound: "o" },
    { id: "segol", mark: "\u05B6", name: "סֶגּוֹל", sound: "e" },
    { id: "tsere", mark: "\u05B5", name: "צֵירֵה", sound: "e" },
    { id: "shuruk", mark: "\u05BC", name: "שׁוּרוּק", sound: "u" },
    { id: "kubutz", mark: "\u05BB", name: "קֻבּוּץ", sound: "u" },
  ];
  const NQ = Object.fromEntries(NIQQUD.map((n) => [n.id, n]));
  const DAGESH = "\u05BC";
  const SHIN_DOT = "\u05C1";

  // The consonant as written at the start of a syllable.
  function onset(ch) {
    let c = ch;
    if ("בכפ".includes(ch)) c += DAGESH; // bet/kaf/pe with dagesh
    if (ch === "ש") c += SHIN_DOT;
    return c;
  }

  // Letter + niqqud as the child sees it. Holam and shuruk are written with vav.
  function syllableText(ch, niqqudId) {
    const c = onset(ch);
    if (niqqudId === "holam") return c + "ו\u05B9";
    if (niqqudId === "shuruk") return c + "ו" + DAGESH;
    return c + NQ[niqqudId].mark;
  }

  // Letters that don't form a sensible open syllable with a vowel.
  function syllableAllowed(ch, niqqudId) {
    if (LETTER[ch].finalOf) return false;
    if (ch === "ו" && (niqqudId === "holam" || niqqudId === "shuruk")) return false;
    return true;
  }

  // What the device voice reads for consonant + vowel sound. Spelled so an
  // engine that ignores niqqud still has a fair chance (recordings replace it).
  const VOWEL_SPELL = { a: "\u05B8ה", i: "\u05B4י", o: "וֹ", e: "\u05B6ה", u: "וּ" };
  function syllableSpoken(ch, sound) {
    return onset(ch) + VOWEL_SPELL[sound];
  }

  // ---------- Words ----------
  // first: opening letter. last: closing *sound* letter as a base form, or
  // null when the word ends in a vowel or in a sound that would be ambiguous
  // for a first-grader (soft ב/כ/פ, patach genuva).
  const WORDS = [
    { w: "אַרְיֵה", e: "🦁", first: "א", last: null },
    { w: "אֹזֶן", e: "👂", first: "א", last: "נ" },
    { w: "אַנָּנָס", e: "🍍", first: "א", last: "ס" },
    { w: "אֲוִירוֹן", e: "✈️", first: "א", last: "נ" },
    { w: "בַּיִת", e: "🏠", first: "ב", last: "ת" },
    { w: "בַּלּוֹן", e: "🎈", first: "ב", last: "נ" },
    { w: "בָּנָנָה", e: "🍌", first: "ב", last: null },
    { w: "גָּמָל", e: "🐫", first: "ג", last: "ל" },
    { w: "גֶּזֶר", e: "🥕", first: "ג", last: "ר" },
    { w: "גְּלִידָה", e: "🍦", first: "ג", last: null },
    { w: "דָּג", e: "🐟", first: "ד", last: "ג" },
    { w: "דֹּב", e: "🐻", first: "ד", last: null },
    { w: "דְּבוֹרָה", e: "🐝", first: "ד", last: null },
    { w: "הַר", e: "⛰️", first: "ה", last: "ר" },
    { w: "הִיפּוֹפּוֹטָם", e: "🦛", first: "ה", last: "מ" },
    { w: "וֶרֶד", e: "🌹", first: "ו", last: "ד" },
    { w: "וָפֶל", e: "🧇", first: "ו", last: "ל" },
    { w: "זֶבְּרָה", e: "🦓", first: "ז", last: null },
    { w: "זְאֵב", e: "🐺", first: "ז", last: null },
    { w: "זַיִת", e: "🫒", first: "ז", last: "ת" },
    { w: "חָתוּל", e: "🐱", first: "ח", last: "ל" },
    { w: "חָלָב", e: "🥛", first: "ח", last: null },
    { w: "חִלָּזוֹן", e: "🐌", first: "ח", last: "נ" },
    { w: "טִיל", e: "🚀", first: "ט", last: "ל" },
    { w: "טַבַּעַת", e: "💍", first: "ט", last: "ת" },
    { w: "טֶלֶפוֹן", e: "☎️", first: "ט", last: "נ" },
    { w: "יָד", e: "✋", first: "י", last: "ד" },
    { w: "יֶלֶד", e: "👦", first: "י", last: "ד" },
    { w: "יָרֵחַ", e: "🌙", first: "י", last: null },
    { w: "כַּדּוּר", e: "⚽", first: "כ", last: "ר" },
    { w: "כֶּלֶב", e: "🐶", first: "כ", last: null },
    { w: "כּוֹבַע", e: "🎩", first: "כ", last: null },
    { w: "לִימוֹן", e: "🍋", first: "ל", last: "נ" },
    { w: "לֶחֶם", e: "🍞", first: "ל", last: "מ" },
    { w: "לֵב", e: "❤️", first: "ל", last: null },
    { w: "מַיִם", e: "💧", first: "מ", last: "מ" },
    { w: "מְכוֹנִית", e: "🚗", first: "מ", last: "ת" },
    { w: "מַפְתֵּחַ", e: "🔑", first: "מ", last: null },
    { w: "נָחָשׁ", e: "🐍", first: "נ", last: "ש" },
    { w: "נֵר", e: "🕯️", first: "נ", last: "ר" },
    { w: "נְמָלָה", e: "🐜", first: "נ", last: null },
    { w: "סוּס", e: "🐴", first: "ס", last: "ס" },
    { w: "סֵפֶר", e: "📖", first: "ס", last: "ר" },
    { w: "סַבָּא", e: "👴", first: "ס", last: null },
    { w: "עֵץ", e: "🌳", first: "ע", last: "צ" },
    { w: "עַכְבָּר", e: "🐭", first: "ע", last: "ר" },
    { w: "עוּגָה", e: "🎂", first: "ע", last: null },
    { w: "פִּיל", e: "🐘", first: "פ", last: "ל" },
    { w: "פֶּרַח", e: "🌸", first: "פ", last: "ח" },
    { w: "פִּיצָה", e: "🍕", first: "פ", last: null },
    { w: "צָב", e: "🐢", first: "צ", last: null },
    { w: "צִפּוֹר", e: "🐦", first: "צ", last: "ר" },
    { w: "צְפַרְדֵּעַ", e: "🐸", first: "צ", last: null },
    { w: "קוֹף", e: "🐒", first: "ק", last: null },
    { w: "קֶשֶׁת", e: "🌈", first: "ק", last: "ת" },
    { w: "קַקְטוּס", e: "🌵", first: "ק", last: "ס" },
    { w: "רֶגֶל", e: "🦵", first: "ר", last: "ל" },
    { w: "רַכֶּבֶת", e: "🚂", first: "ר", last: "ת" },
    { w: "רוֹבּוֹט", e: "🤖", first: "ר", last: "ט" },
    { w: "שֶׁמֶשׁ", e: "☀️", first: "ש", last: "ש" },
    { w: "שָׁעוֹן", e: "⌚", first: "ש", last: "נ" },
    { w: "שׁוֹקוֹלָד", e: "🍫", first: "ש", last: "ד" },
    { w: "תּוּת", e: "🍓", first: "ת", last: "ת" },
    { w: "תַּפּוּחַ", e: "🍎", first: "ת", last: null },
    { w: "תַּרְנְגוֹל", e: "🐓", first: "ת", last: "ל" },
    // Short words with simple niqqud, so word practice can start early.
    { w: "עָנָן", e: "☁️", first: "ע", last: "נ" },
    { w: "פָּרָה", e: "🐄", first: "פ", last: null },
    { w: "סַל", e: "🧺", first: "ס", last: "ל" },
    { w: "כַּף", e: "🥄", first: "כ", last: null },
    { w: "מַגָּף", e: "👢", first: "מ", last: null },
    { w: "אַבָּא", e: "👨", first: "א", last: null },
    { w: "שָׁפָן", e: "🐇", first: "ש", last: "נ" },
    { w: "סִירָה", e: "⛵", first: "ס", last: null },
    { w: "גֶּשֶׁם", e: "🌧️", first: "ג", last: "מ" },
    { w: "מִטָּה", e: "🛏️", first: "מ", last: null },
    { w: "בּוּבָּה", e: "🪆", first: "ב", last: null },
    { w: "גִּיטָרָה", e: "🎸", first: "ג", last: null },
  ];
  WORDS.forEach((w, i) => (w.id = "w" + i));

  // ---------- Reading a vocalized word ----------
  // Splits a word into syllables and lists the letters and niqqud a child
  // must know to read it. Words with marks the programme hasn't reached
  // (shva, hataf, kamatz katan) or with a patach genuva are not used for
  // syllable work.
  const MARK_NQ = { "\u05B8": "kamatz", "\u05B7": "patach", "\u05B4": "hiriq", "\u05B9": "holam", "\u05B6": "segol", "\u05B5": "tsere", "\u05BB": "kubutz" };
  const UNSUPPORTED = /[\u05B0-\u05B3\u05C7]/;
  const isMark = (c) => c >= "\u0591" && c <= "\u05C7" && c !== "\u05BE" && c !== "\u05C0" && c !== "\u05C3" && c !== "\u05C6";

  function parseWord(word) {
    const clusters = [];
    for (const c of word) {
      if (isMark(c) && clusters.length) clusters[clusters.length - 1].text += c;
      else clusters.push({ text: c, base: c });
    }
    const out = { syllables: [], niqqud: new Set(), letters: new Set(), ok: !UNSUPPORTED.test(word), genuva: false, silentEnd: false, soft: false };
    let cur = null;
    clusters.forEach((cl, i) => {
      const marks = cl.text.slice(1);
      const prev = clusters[i - 1];
      const prevHasVowel = prev && prev.vowel;
      let vowel = null;
      for (const m of marks) if (MARK_NQ[m]) vowel = MARK_NQ[m];
      // Vav carrying a holam dot or a shuruk dagesh after a vowel-less letter is the vowel itself.
      if (cl.base === "ו" && prev && !prevHasVowel && (marks === "\u05B9" || marks === "\u05BC")) {
        prev.vowel = marks === "\u05B9" ? "holam" : "shuruk";
        out.niqqud.add(prev.vowel);
        cur.text += cl.text;
        cl.mater = true;
        return;
      }
      // Silent letters closing an open vowel: yod after i/e, he or alef at the end.
      const silent = !marks && prevHasVowel && ((cl.base === "י" && /hiriq|tsere|segol/.test(prev.vowel)) || ((cl.base === "ה" || cl.base === "א") && i === clusters.length - 1));
      if (silent) {
        if (cl.base !== "י") {
          out.letters.add(cl.base);
          out.silentEnd = true; // ה/א read as a vowel: stage 7
        }
        cur.text += cl.text;
        cl.mater = true;
        return;
      }
      out.letters.add(cl.base);
      // Bet/kaf/pe without dagesh (and final kaf/pe) sound v/kh/f: stage 9.
      if ("בכפךף".includes(cl.base) && !marks.includes(DAGESH)) out.soft = true;
      if (vowel || (clusters[i + 1] && clusters[i + 1].base === "ו" && /^(\u05B9|\u05BC)$/.test(clusters[i + 1].text.slice(1)) && !vowel)) {
        // Patach under a final ח/ע after an open vowel is read before the consonant.
        if (i === clusters.length - 1 && vowel === "patach" && "חע".includes(cl.base) && cur && !cur.closed) out.genuva = true;
        cl.vowel = vowel;
        if (vowel) out.niqqud.add(vowel);
        cur = { text: cl.text };
        out.syllables.push(cur);
      } else if (cur) {
        cur.text += cl.text;
        cur.closed = true;
      } else {
        out.ok = false; // starts with a vowel-less letter
      }
    });
    out.syllables = out.syllables.map((x) => x.text);
    if (out.genuva) out.ok = false;
    out.niqqud = [...out.niqqud];
    out.letters = [...out.letters];
    return out;
  }
  WORDS.forEach((w) => Object.assign(w, { parsed: parseWord(w.w) }));

  // ---------- Reading rules (programme stages 7–10) ----------
  // The parent marks these once they were taught in class.
  const RULES = [
    { id: "ehevi", name: "אותיות אהו״י כתנועה, ה׳ בסוף מילה", sample: "חוֹלָה" },
    { id: "sameSound", name: "אותיות שנשמעות אותו דבר", sample: "ט–ת" },
    { id: "dagesh", name: "אותיות שהניקוד משנה: בּ/ב, כּ/כ, פּ/פ, שׁ/שׂ", sample: "בּ/ב" },
    { id: "sentences", name: "קריאת משפטים קצרים", sample: "הַדָּג בַּמַּיִם" },
  ];

  // Letters that sound the same. `a`/`b` are what the child sees; `needs`
  // lists the base letters that must be learned; soft forms also need the
  // dagesh rule.
  const SIN_DOT = "\u05C2";
  const TWINS = [
    { a: "ת", b: "ט", needs: ["ת", "ט"] },
    { a: "ק", b: "כּ", needs: ["ק", "כ"] },
    { a: "ח", b: "כ", needs: ["ח", "כ"], soft: true },
    { a: "ס", b: "שׂ", needs: ["ס", "ש"], soft: true },
    { a: "ו", b: "ב", needs: ["ו", "ב"], soft: true },
    { a: "א", b: "ע", needs: ["א", "ע"] },
  ];

  // Letters whose sound the niqqud changes: with/without dagesh, shin/sin dot.
  const DAGESH_PAIRS = {
    ב: { hard: "בּ", soft: "ב", softSound: "ו" },
    כ: { hard: "כּ", soft: "כ", softSound: "ח" },
    פ: { hard: "פּ", soft: "פ", softSound: "פ" },
    ש: { hard: "שׁ", soft: "שׂ", softSound: "ס" },
  };
  function dageshForms(ch, niqqudId) {
    const d = DAGESH_PAIRS[ch];
    const sound = NQ[niqqudId].sound;
    // Holam and shuruk are written on a vav after the letter.
    const vowel = niqqudId === "holam" ? "ו\u05B9" : niqqudId === "shuruk" ? "ו" + DAGESH : NQ[niqqudId].mark;
    return {
      hard: { text: d.hard + vowel, spoken: onset(ch) + VOWEL_SPELL[sound] },
      soft: { text: d.soft + vowel, spoken: d.softSound + VOWEL_SPELL[sound] },
    };
  }

  // Word pairs that differ only by a final ה read as a vowel.
  const EHEVI_PAIRS = [
    ["חוֹל", "חוֹלָה"],
    ["שִׁיר", "שִׁירָה"],
    ["דָּג", "דָּגָה"],
    ["סוּס", "סוּסָה"],
    ["גַּן", "גַּנָּה"],
    ["תּוֹר", "תּוֹרָה"],
  ];

  // Short sentences: a subject in a place. The picture is the subject's
  // emoji placed on the place's emoji.
  const SUBJECTS = [
    { w: "הַדָּג", e: "🐟" },
    { w: "הַכֶּלֶב", e: "🐶" },
    { w: "הַסּוּס", e: "🐴" },
    { w: "הַפִּיל", e: "🐘" },
    { w: "הַקּוֹף", e: "🐒" },
    { w: "הַצָּב", e: "🐢" },
    { w: "הַיֶּלֶד", e: "👦" },
    { w: "הַגָּמָל", e: "🐫" },
    { w: "הַנָּחָשׁ", e: "🐍" },
    { w: "הַצִּפּוֹר", e: "🐦" },
    { w: "הַשָּׁפָן", e: "🐇" },
  ];
  const PLACES = [
    { w: "בַּבַּיִת", e: "🏠" },
    { w: "בַּמַּיִם", e: "💧" },
    { w: "עַל הָעֵץ", e: "🌳" },
    { w: "עַל הָהָר", e: "⛰️" },
    { w: "בַּסַּל", e: "🧺" },
    { w: "בַּמִּטָּה", e: "🛏️" },
    { w: "בַּסִּירָה", e: "⛵" },
    { w: "עַל הַכִּסֵּא", e: "🪑" },
  ];
  [SUBJECTS, PLACES].forEach((list) =>
    list.forEach((x) => {
      const parts = x.w.split(" ").map(parseWord);
      x.parsed = {
        ok: parts.every((q) => q.ok),
        letters: [...new Set(parts.flatMap((q) => q.letters))],
        niqqud: [...new Set(parts.flatMap((q) => q.niqqud))],
        silentEnd: parts.some((q) => q.silentEnd),
        soft: parts.some((q) => q.soft),
      };
    })
  );

  // The sticker for each letter is the picture of its first word.
  function stickerFor(ch) {
    const base = LETTER[ch] && LETTER[ch].finalOf ? LETTER[ch].finalOf : ch;
    const w = WORDS.find((x) => x.first === base);
    return w ? w.e : "⭐";
  }
  function exampleWord(ch) {
    const base = LETTER[ch] && LETTER[ch].finalOf ? LETTER[ch].finalOf : ch;
    return WORDS.find((x) => x.first === base) || null;
  }

  // ---------- Tracing paths ----------
  // Print letters in a 100x104 box (top line y=20, baseline y=80, descenders
  // to ~98). Each letter is an ordered list of strokes; each stroke is a
  // polyline drawn in writing order, so the order of points is the direction
  // the finger must move.
  const STROKES = {
    א: [
      [[30, 22], [70, 80]],
      [[72, 22], [71, 38], [58, 54]],
      [[42, 41], [32, 56], [30, 80]],
    ],
    ב: [
      [[28, 22], [64, 22], [70, 28], [70, 78]],
      [[80, 79], [24, 79]],
    ],
    ג: [
      [[42, 22], [58, 22], [63, 28], [63, 62], [68, 80]],
      [[63, 56], [42, 80]],
    ],
    ד: [
      [[24, 22], [78, 22]],
      [[66, 22], [66, 80]],
    ],
    ה: [
      [[26, 22], [66, 22], [72, 28], [72, 80]],
      [[33, 44], [33, 80]],
    ],
    ו: [[[44, 22], [54, 22], [57, 28], [57, 80]]],
    ז: [
      [[36, 22], [66, 22]],
      [[52, 22], [50, 40], [50, 80]],
    ],
    ח: [
      [[26, 22], [66, 22], [72, 28], [72, 80]],
      [[30, 24], [30, 80]],
    ],
    ט: [[[32, 22], [30, 70], [38, 79], [64, 79], [72, 70], [72, 32], [64, 24], [54, 26], [48, 36]]],
    י: [[[44, 22], [56, 22], [58, 30], [52, 46]]],
    כ: [[[28, 22], [64, 22], [72, 30], [72, 70], [64, 79], [28, 79]]],
    ל: [[[32, 4], [32, 30], [66, 30], [72, 38], [70, 52], [54, 80]]],
    מ: [
      [[24, 13], [37, 25], [28, 80]],
      [[42, 22], [64, 22], [72, 30], [72, 79], [44, 79]],
    ],
    נ: [[[44, 22], [56, 22], [60, 28], [60, 79], [36, 79]]],
    ס: [[[22, 22], [60, 22], [68, 27], [73, 36], [74, 50], [72, 62], [66, 72], [57, 78], [48, 79], [39, 77], [32, 71], [27, 61], [26, 48], [28, 36], [31, 27], [34, 22]]],
    ע: [
      [[30, 22], [48, 62]],
      [[72, 22], [62, 68], [50, 78], [28, 80]],
    ],
    פ: [
      [[28, 22], [64, 22], [72, 30], [72, 70], [64, 79], [28, 79]],
      [[33, 24], [33, 44], [48, 44]],
    ],
    צ: [
      [[30, 22], [66, 70], [66, 79], [26, 79]],
      [[72, 22], [70, 40], [56, 48]],
    ],
    ק: [
      [[28, 22], [64, 22], [72, 30], [72, 80]],
      [[33, 42], [33, 98]],
    ],
    ר: [[[26, 22], [64, 22], [72, 30], [72, 80]]],
    ש: [
      [[30, 22], [30, 70], [38, 79], [66, 79], [74, 70], [74, 22]],
      [[50, 24], [54, 62]],
    ],
    ת: [
      [[26, 22], [66, 22], [72, 28], [72, 80]],
      [[34, 22], [34, 74], [24, 80]],
    ],
    ך: [[[28, 22], [64, 22], [72, 30], [72, 98]]],
    ם: [[[30, 22], [72, 22], [72, 79], [30, 79], [30, 24]]],
    ן: [[[46, 22], [56, 22], [59, 28], [59, 98]]],
    ף: [
      [[28, 22], [64, 22], [72, 30], [72, 98]],
      [[33, 24], [33, 44], [48, 44]],
    ],
    ץ: [
      [[30, 22], [58, 54]],
      [[72, 22], [66, 48], [64, 98]],
    ],
  };

  // ---------- Spoken phrases ----------
  // m/f variants address a boy or a girl; the rest are shared.
  const PHRASES = {
    hello: "שָׁלוֹם",
    letsPlay: { m: "בּוֹא נְשַׂחֵק!", f: "בּוֹאִי נְשַׂחֵק!" },
    whereLetter: "אֵיפֹה הָאוֹת",
    where: "אֵיפֹה",
    opening: "בְּאֵיזוֹ אוֹת מַתְחִילָה הַמִּלָּה",
    closing: "בְּאֵיזוֹ אוֹת נִגְמֶרֶת הַמִּלָּה",
    thisIsLetter: "זוֹ הָאוֹת",
    weLookFor: "אֲנַחְנוּ מְחַפְּשִׂים אֶת",
    thisIs: "זֶה",
    weLookForSyl: "אֲנַחְנוּ מְחַפְּשִׂים",
    listenAgain: { m: "תַּקְשִׁיב שׁוּב", f: "תַּקְשִׁיבִי שׁוּב" },
    startsWith: "מַתְחִילָה בָּאוֹת",
    endsWith: "נִגְמֶרֶת בָּאוֹת",
    laterAgain: "נַחֲזֹר עָלֶיהָ עוֹד מְעַט",
    like: "כְּמוֹ",
    newLetter: { m: "יֵשׁ לְךָ אוֹת חֲדָשָׁה!", f: "יֵשׁ לָךְ אוֹת חֲדָשָׁה!" },
    letsWrite: { m: "בּוֹא נִכְתֹּב אֶת הָאוֹת", f: "בּוֹאִי נִכְתֹּב אֶת הָאוֹת" },
    watch: { m: "תִּסְתַּכֵּל אֵיךְ כּוֹתְבִים", f: "תִּסְתַּכְּלִי אֵיךְ כּוֹתְבִים" },
    yourTurn: { m: "עַכְשָׁו אַתָּה, מֵהַנְּקֻדָּה הַיְּרֻקָּה", f: "עַכְשָׁו אַתְּ, מֵהַנְּקֻדָּה הַיְּרֻקָּה" },
    traceRetry: { m: "נַסֵּה שׁוּב מֵהַנְּקֻדָּה הַיְּרֻקָּה", f: "נַסִּי שׁוּב מֵהַנְּקֻדָּה הַיְּרֻקָּה" },
    praise: ["כׇּל הַכָּבוֹד!", "מְצֻיָּן!", "יָפֶה מְאוֹד!", "נָכוֹן!", "יֹפִי!"],
    done: "סִיַּמְנוּ לְהַיּוֹם!",
    wellDone: "כׇּל הַכָּבוֹד",
    newSticker: { m: "קִבַּלְתָּ מַדְבֵּקָה חֲדָשָׁה!", f: "קִבַּלְתְּ מַדְבֵּקָה חֲדָשָׁה!" },
    listen: { m: "תַּקְשִׁיב", f: "תַּקְשִׁיבִי" },
    build: { m: "בְּנֵה אֶת הַמִּלָּה", f: "בְּנִי אֶת הַמִּלָּה" },
    missing: "מָה חָסֵר בַּמִּלָּה",
    wordPic: { m: "קְרָא אֶת הַמִּלָּה, וּבְחַר אֶת הַתְּמוּנָה", f: "קִרְאִי אֶת הַמִּלָּה, וּבַחֲרִי אֶת הַתְּמוּנָה" },
    written: "כָּתוּב",
    andThisLetter: "וְזוֹ הָאוֹת",
    newMark: { m: "יֵשׁ לְךָ סִימָן נִקּוּד חָדָשׁ!", f: "יֵשׁ לָךְ סִימָן נִקּוּד חָדָשׁ!" },
    soundsLike: "אֵיזוֹ אוֹת נִשְׁמַעַת כְּמוֹ",
    andAlso: "וְגַם",
    soundSame: "נִשְׁמָעוֹת אוֹתוֹ דָּבָר",
    whereWritten: "אֵיפֹה כָּתוּב",
    hereItSays: "כָּאן כָּתוּב",
    whichEnd: "אֵיזוֹ אוֹת חֲסֵרָה בְּסוֹף הַמִּלָּה",
    atEndWeWrite: "בְּסוֹף מִלָּה כּוֹתְבִים",
    readSentence: { m: "קְרָא אֶת הַמִּשְׁפָּט, וּבְחַר אֶת הַתְּמוּנָה", f: "קִרְאִי אֶת הַמִּשְׁפָּט, וּבַחֲרִי אֶת הַתְּמוּנָה" },
    inThisPicture: "בַּתְּמוּנָה הַזֹּאת",
    noStickersYet: "הַמַּדְבֵּקוֹת יַגִּיעוּ כְּשֶׁתִּלְמְדוּ אוֹתִיּוֹת",
  };

  // Default teaching order: letters whose sound can be stretched first, as
  // the Ministry of Education programme recommends, then the rest.
  const RECOMMENDED_ORDER = "שזסלרחמנאבגדהוטיכעפצקת".split("");

  Aleph.data = {
    LETTERS,
    LETTER,
    NIQQUD,
    NQ,
    RULES,
    TWINS,
    DAGESH_PAIRS,
    dageshForms,
    EHEVI_PAIRS,
    SUBJECTS,
    PLACES,
    syllableSpoken,
    syllableAllowed,
    parseWord,
    WORDS,
    STROKES,
    PHRASES,
    RECOMMENDED_ORDER,
    soundsAlike,
    lookAlikes,
    syllableText,
    stickerFor,
    exampleWord,
  };
})();
