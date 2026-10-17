/* Everything the child can hear, as { key, text } segments.
 * The app builds its prompts from these, and tools/voice/ reads all() to
 * produce the checked recordings in audio/. */
(() => {
  "use strict";

  const Aleph = (window.Aleph = window.Aleph || {});
  const D = Aleph.data;

  const speech = {
    phrase(name, gender) {
      const v = D.PHRASES[name];
      if (typeof v === "string") return { key: "p." + name, text: v };
      return { key: `p.${name}.${gender}`, text: v[gender] };
    },
    praise: (i) => ({ key: "p.praise." + i, text: D.PHRASES.praise[i] }),
    letter: (ch) => ({ key: "letter." + ch, text: D.LETTER[ch].name }),
    syl: (ch, sound) => ({ key: `syl.${ch}.${sound}`, text: D.syllableSpoken(ch, sound) }),
    nq: (id) => ({ key: "nq." + id, text: D.NQ[id].name }),
    sylSoft: (ch, nq) => ({ key: `sylsoft.${ch}.${D.NQ[nq].sound}`, text: D.dageshForms(ch, nq).soft.spoken }),
    sentence: (text) => ({ key: "sentence." + text, text }),
    word: (w) => {
      const text = typeof w === "string" ? w : w.w;
      return { key: "word." + text, text };
    },
    // Any written syllable: a plain letter+vowel uses its syllable recording.
    part(text) {
      const p = D.parseWord(text);
      if (p.letters.length === 1 && p.niqqud.length === 1 && D.syllableText(p.letters[0], p.niqqud[0]) === text) {
        return speech.syl(p.letters[0], D.NQ[p.niqqud[0]].sound);
      }
      return { key: "part." + text, text };
    },

    // Every segment, once, with a label for the parent's voice check.
    all() {
      const out = [];
      const seen = new Set();
      const add = (seg, label) => {
        if (seen.has(seg.key)) return;
        seen.add(seg.key);
        out.push(Object.assign({ label: label || seg.text }, seg));
      };
      D.LETTERS.forEach((l) => add(speech.letter(l.ch), `${l.ch} — ${l.name}`));
      D.NIQQUD.forEach((n) => add(speech.nq(n.id), `${D.syllableText("ב", n.id)} — ${n.name}`));
      // One recording per sound; marks that sound the same share it.
      D.NIQQUD.forEach((n) =>
        D.LETTERS.filter((l) => D.syllableAllowed(l.ch, n.id)).forEach((l) => {
          const same = D.NIQQUD.filter((m) => m.sound === n.sound && D.syllableAllowed(l.ch, m.id)).map((m) => D.syllableText(l.ch, m.id));
          add(speech.syl(l.ch, n.sound), same.join(" / "));
        })
      );
      Object.keys(D.DAGESH_PAIRS).forEach((ch) =>
        D.NIQQUD.forEach((n) => D.syllableAllowed(ch, n.id) && add(speech.sylSoft(ch, n.id), D.dageshForms(ch, n.id).soft.text))
      );
      D.WORDS.forEach((w) => add(speech.word(w), `${w.e} ${w.w}`));
      D.EHEVI_PAIRS.flat().forEach((w) => add(speech.word(w)));
      D.WORDS.forEach((w) => w.parsed.ok && w.parsed.syllables.forEach((x) => add(speech.part(x))));
      D.SUBJECTS.forEach((s) => D.PLACES.forEach((pl) => add(speech.sentence(s.w + " " + pl.w), `${s.e}${pl.e} ${s.w} ${pl.w}`)));
      Object.keys(D.PHRASES).forEach((k) => {
        const v = D.PHRASES[k];
        if (Array.isArray(v)) v.forEach((_, i) => add(speech.praise(i)));
        else if (typeof v === "string") add(speech.phrase(k));
        else ["m", "f"].forEach((g) => add(speech.phrase(k, g)));
      });
      return out;
    },
  };

  Aleph.speech = speech;
})();
