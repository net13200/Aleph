"""Generate the app's recordings, following the spec's process:

1. Every item is written with full niqqud (js/data.js); Phonikud adds stress
   and vocal-shva marks and converts it to a phonetic transcript.
2. A Hebrew TTS voice (Phonikud's Piper checkpoints) reads the transcript.
3. Check A: a Hebrew speech-recognition model (ivrit-ai Whisper) transcribes
   the file and it must match the expected text.
4. Check C: length, silence at the start/end and inside, and loudness.
5. A file that fails is regenerated with other settings; if it fails again it
   goes on the list for a human recording.
6. Short items (letters, syllables) can't be checked reliably by speech
   recognition, so they always go on the human-listening list, as the spec asks.

Usage:
  node tools/voice/export_items.js > items.json
  python tools/voice/make_voice.py --models MODELS --phonikud PHONIKUD_SRC \
      --items items.json --out audio [--voice model] [--only word,p]
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, time

import numpy as np
import soundfile as sf

HATAMA = "֫"   # Phonikud stress mark
METEG = "ֽ"    # Phonikud vocal-shva mark
SHVA = "ְ"
NIQQUD_RE = re.compile(r"[֑-ׇ]")
FINALS = str.maketrans("ךםןףץ", "כמנפצ")
SHORT_KINDS = {"syl", "sylsoft", "part"}  # too short for speech recognition: a person listens
SEGOL, PATACH, HIRIQ = "\u05b6", "\u05b7", "\u05b4"
VOWEL_MARKS = set("\u05b0\u05b1\u05b2\u05b3\u05b4\u05b5\u05b6\u05b7\u05b8\u05b9\u05ba\u05bb\u05c7")

# Stress Phonikud gets wrong, checked by hand: syllable counted from the end
# (1 = last, 2 = second to last).
STRESS = {
    "אֵיפֹה": 2, "אֵיזוֹ": 2, "בְּאֵיזוֹ": 2, "צָדִי": 2, "פַּתָּח": 2, "צֵירֵה": 2, "חוֹלָם": 2, "קָמַץ": 2,
    "שׁוּרוּק": 1, "גַּנָּה": 1, "גִּיטָרָה": 2, "פִּיצָה": 2, "בָּנָנָה": 2, "אַבָּא": 2, "סַבָּא": 2,
    "רוֹבּוֹט": 2, "קַקְטוּס": 2, "הִיפּוֹפּוֹטָם": 2, "זֶבְּרָה": 2, "בּוּבָּה": 2, "טֶלֶפוֹן": 3,
    "אֲנַחְנוּ": 2, "יָפֶה": 1, "שׁוֹקוֹלָד": 1, "בּוֹאִי": 2, "קִבַּלְתָּ": 2, "יֹפִי": 2, "סִיַּמְנוּ": 2, "עָלֶיהָ": 2,
}


def is_letter(c):
    return "א" <= c <= "ת"


def clusters(text):
    out = []
    for c in text:
        if "֑" <= c <= "ׇ" and out and is_letter(out[-1][0]):
            out[-1][1] += c
        else:
            out.append([c, ""])
    return out


def vowels(marks):
    return "".join(c for c in marks if c in VOWEL_MARKS)


def enhance(ours, model_out):
    """Our niqqud, plus the stress and vocal-shva marks Phonikud predicts.

    Phonikud sometimes reads a different word (דֶּלֶת for דָּלֶת); its stress is
    only taken for words where its vowels agree with ours."""
    o = clusters(ours)
    m = [c for c in clusters(model_out.replace("|", "")) if is_letter(c[0])]
    ol = [c for c in o if is_letter(c[0])]
    matched = [a[0] for a in ol] == [b[0] for b in m]
    if matched:
        # Group letters into words to compare vowels word by word.
        words, cur = [], []
        k = 0
        for c in o:
            if is_letter(c[0]):
                cur.append((c, m[k]))
                k += 1
            elif cur:
                words.append(cur)
                cur = []
        if cur:
            words.append(cur)
        for w in words:
            same = all(vowels(a[1]).replace(SHVA, "") == vowels(b[1]).replace(SHVA, "") for a, b in w)
            for a, b in w:
                if same and HATAMA in b[1] and HATAMA not in a[1]:
                    a[1] += HATAMA
                if METEG in b[1] and SHVA in a[1] and METEG not in a[1]:
                    a[1] += METEG
    # Vocal shva: on the first letter of a word, after another shva, or on a
    # doubled letter (הַנְּקֻדָּה).
    prev = [" ", ""]
    for i, c in enumerate(o):
        nxt = o[i + 1] if i + 1 < len(o) else [" ", ""]
        last_in_word = not is_letter(nxt[0])
        if is_letter(c[0]) and SHVA in c[1] and METEG not in c[1] and not last_in_word:
            # Dagesh in בגדכפת can be the light kind, which doesn't make the shva vocal.
            doubled = "\u05bc" in c[1] and c[0] not in "בגדכפת"
            if not is_letter(prev[0]) or SHVA in prev[1] or doubled:
                c[1] += METEG
        prev = c
    return "".join(a + b for a, b in o), matched


def stress_rule(word):
    """Syllable to stress, counted from the end, when a rule or the list says so."""
    bare = word.replace(HATAMA, "").replace(METEG, "")
    bare = re.sub(r"[^\u05d0-\u05ea\u0591-\u05c7]", "", bare)
    if bare in STRESS:
        return STRESS[bare]
    cl = [c for c in clusters(bare) if is_letter(c[0])]
    if len(cl) < 3:
        return None
    marks = [vowels(c[1]).replace(SHVA, "") if i == len(cl) - 1 else vowels(c[1]) for i, c in enumerate(cl)]
    last_vowel = next((m for m in reversed(marks[:-1]) if m), "")
    # Segolates: כֶּלֶב, דָּלֶת, נִגְמֶרֶת — last vowel segol, then a final consonant.
    if not marks[-1] and last_vowel == SEGOL and marks[-2] == SEGOL:
        return 2
    # בַּיִת, מַיִם, זַיִן: patach, yod with hiriq, final consonant.
    if not marks[-1] and cl[-2][0] == "י" and marks[-2] == HIRIQ and marks[-3] == PATACH:
        return 2
    # Patach genuva (תַּפּוּחַ, יָרֵחַ) is said before the consonant; stress stays on the syllable before it.
    if cl[-1][0] in "חע" and marks[-1] == PATACH and marks[-2] in ("", "\u05b5", "\u05b4", "\u05b9"):
        return 2
    # טַבַּעַת, נִשְׁמַעַת: patach on a guttural before the final ת.
    if cl[-1][0] == "ת" and not marks[-1] and cl[-2][0] in "עח" and marks[-2] == PATACH and marks[-3] == PATACH:
        return 2
    return None


def place_stress(ipa_word, k):
    """Move the stress mark to the k-th syllable from the end of one IPA word."""
    w = ipa_word.replace("ˈ", "")
    vs = [i for i, c in enumerate(w) if c in "aeiou"]
    if len(vs) < k:
        return ipa_word
    j = vs[-k]
    if j > 0 and w[j - 1] not in "aeiou":
        j -= 1
        if j > 0 and w[j - 1 : j + 1] == "ts":
            j -= 1
    return w[:j] + "ˈ" + w[j:]


def to_ipa(enhanced, phonemize):
    out = []
    for word in enhanced.split(" "):
        ipa = phonemize(word)
        k = stress_rule(word)
        if not k and ipa.count("ˈ") > 1:  # one stress per word: keep the last
            last = ipa.rfind("ˈ")
            ipa = ipa[:last].replace("ˈ", "") + ipa[last:]
        out.append(place_stress(ipa, k) if k else ipa)
    return " ".join(out)


def plain(text, loose=False):
    t = NIQQUD_RE.sub("", text).translate(FINALS)
    t = re.sub(r"[^א-ת]", "", t)
    if loose and len(t) > 1:  # ignore spelling with/without vowel letters
        t = t[0] + re.sub(r"[אהוי]", "", t[1:])
    return t


def edit_ratio(a, b):
    if not a and not b:
        return 1.0
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ca != cb))
    return 1 - d[len(b)] / max(len(a), len(b))


def trim_and_level(audio, sr):
    """Trim silence at the ends, keep a short pad, normalise loudness."""
    frame = int(sr * 0.01)
    n = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: n * frame].reshape(n, frame) ** 2, axis=1) + 1e-12)
    thr = max(rms.max() * 0.03, 1e-4)
    voiced = np.where(rms > thr)[0]
    if not len(voiced):
        return audio, {"empty": True}
    a, b = voiced[0], voiced[-1] + 1
    gaps = np.diff(voiced) * 0.01
    longest_gap = float(gaps.max()) if len(gaps) else 0.0
    pad = int(sr * 0.06)
    out = audio[max(0, a * frame - pad): min(len(audio), b * frame + pad)]
    level = np.sqrt(np.mean(out ** 2)) + 1e-9
    out = out * (0.1 / level)  # about -20 dBFS RMS
    peak = np.abs(out).max()
    if peak > 0.95:
        out = out * (0.95 / peak)
    return out.astype(np.float32), {
        "lead": round(a * 0.01, 3),
        "tail": round((n - b) * 0.01, 3),
        "longest_gap": round(longest_gap, 3),
        "duration": round(len(out) / sr, 3),
    }


def check_c(stats, ipa):
    """Length must fit the transcript; no long pauses inside."""
    problems = []
    if stats.get("empty"):
        return ["silent file"]
    phones = len(re.sub(r"[ˈ\s?!.,]", "", ipa))
    lo, hi = 0.035 * phones + 0.1, 0.18 * phones + 0.8
    if not lo <= stats["duration"] <= hi:
        problems.append(f"length {stats['duration']}s outside {lo:.2f}–{hi:.2f}s")
    if stats["longest_gap"] > 0.45:
        problems.append(f"pause of {stats['longest_gap']}s inside")
    return problems


def check_a(asr_text, item):
    kind = item["key"].split(".")[0]
    want, got = plain(item["text"]), plain(asr_text)
    if kind in SHORT_KINDS:
        # Speech recognition is unreliable on a lone syllable; only flag clear misses.
        ok = bool(got) and (plain(item["text"], True)[:1] == plain(asr_text, True)[:1] or edit_ratio(want, got) >= 0.5)
        return ok, round(edit_ratio(want, got), 2)
    r = max(edit_ratio(want, got), edit_ratio(plain(item["text"], True), plain(asr_text, True)))
    need = 1.0 if kind == "word" else 0.85
    return r >= need, round(r, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--phonikud", required=True, help="path to a checkout of github.com/thewh1teagle/phonikud")
    ap.add_argument("--items", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="model")
    ap.add_argument("--only", default="", help="comma-separated key prefixes")
    ap.add_argument("--keys", default="", help="file with one key per line to (re)generate")
    ap.add_argument("--length-scale", type=float, default=1.12, help=">1 is slower, for young listeners")
    args = ap.parse_args()

    sys.path.insert(0, args.phonikud)
    from phonikud import phonemize
    from phonikud_onnx import Phonikud
    from piper_onnx import Piper
    from faster_whisper import WhisperModel

    nakdan = Phonikud(os.path.join(args.models, "phonikud-1.0.int8.onnx"))
    cfg = os.path.join(args.models, "model.config.json")
    voices = {v: Piper(os.path.join(args.models, v + ".onnx"), cfg) for v in ["model", "shaul", "michael"]}
    order = [args.voice] + [v for v in voices if v != args.voice]
    asr = WhisperModel(os.path.join(args.models, "whisper"), device="cpu", compute_type="int8", cpu_threads=os.cpu_count())

    items = json.load(open(args.items))
    if args.only:
        prefixes = tuple(p + "." for p in args.only.split(","))
        items = [i for i in items if i["key"].startswith(prefixes)]
    if args.keys:
        wanted = set(open(args.keys).read().split("\n"))
        items = [i for i in items if i["key"] in wanted]
    os.makedirs(args.out, exist_ok=True)
    manifest_path = os.path.join(args.out, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    t0 = time.time()

    # 1. Text → our niqqud + Phonikud stress → phonetic transcript.
    jobs = []
    for item in items:
        text = item["text"]
        enhanced, matched = enhance(text, nakdan.add_diacritics(NIQQUD_RE.sub("", text)))
        jobs.append(dict(item=item, kind=item["key"].split(".")[0], enhanced=enhanced, matched=matched, ipa=to_ipa(enhanced, phonemize), attempt=0, heard="", score=None))
    print(f"phonemized {len(jobs)} items in {time.time() - t0:.0f}s", flush=True)

    # Attempts: chosen voice, then slower/calmer, then the other voices.
    attempts = [(order[0], args.length_scale, 0.5), (order[0], args.length_scale * 1.1, 0.33)] + [(v, args.length_scale, 0.5) for v in order[1:]]

    def synth(job):
        voice, ls, noise = attempts[job["attempt"]]
        audio, sr = voices[voice].create(job["ipa"], is_phonemes=True, length_scale=ls, noise_scale=noise)
        audio, stats = trim_and_level(np.asarray(audio, dtype=np.float32), sr)
        job.update(voice=voice, audio=audio, sr=sr, stats=stats, problems=check_c(stats, job["ipa"]))

    def to16k(audio, sr):
        t16 = np.arange(0, len(audio) / sr, 1 / 16000)
        return np.interp(t16, np.arange(len(audio)) / sr, audio).astype(np.float32)

    def recognise(job):
        segs, _ = asr.transcribe(to16k(job["audio"], job["sr"]), language="he", beam_size=5, without_timestamps=True, condition_on_previous_text=False)
        job["heard"] = " ".join(x.text for x in segs).strip()

    pending = jobs
    for round_no in range(len(attempts)):
        for job in pending:
            synth(job)
        for job in pending:
            if job["kind"] not in SHORT_KINDS:
                recognise(job)
        retry = []
        for job in pending:
            if job["kind"] not in SHORT_KINDS:
                ok_a, job["score"] = check_a(job["heard"], job["item"])
                if not ok_a:
                    job["problems"].append(f"heard “{job['heard']}” ({job['score']})")
            if job["problems"] and job["attempt"] + 1 < len(attempts):
                job["attempt"] += 1
                retry.append(job)
        print(f"round {round_no + 1}: {len(pending)} checked, {len(retry)} to retry ({time.time() - t0:.0f}s)", flush=True)
        if not retry:
            break
        pending = retry

    # 2. Write files, manifest and report. Only recordings that passed the
    # automatic checks go in the manifest; the rest are candidates a parent
    # listens to and approves in the app (voice check).
    cand_path = os.path.join(args.out, "candidates.json")
    candidates = json.load(open(cand_path)) if os.path.exists(cand_path) else {}
    report = []
    for job in jobs:
        item, kind = job["item"], job["kind"]
        status = "fail" if job["problems"] else ("listen" if kind in SHORT_KINDS or not job["matched"] else "pass")
        fname = hashlib.sha1(item["key"].encode()).hexdigest()[:12] + ".mp3"
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            sf.write(tmp.name, job["audio"], job["sr"])
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-ar", "22050", "-b:a", "48k", os.path.join(args.out, fname)], check=True)
        if status == "pass":
            manifest[item["key"]] = fname
            candidates.pop(item["key"], None)
        else:
            manifest.pop(item["key"], None)
            candidates[item["key"]] = fname
        report.append(dict(key=item["key"], text=item["text"], label=item.get("label"), enhanced=job["enhanced"], ipa=job["ipa"],
                           stress_from_model=job["matched"], status=status, voice=job["voice"], heard=job["heard"], score=job["score"],
                           problems=job["problems"], duration=job["stats"].get("duration"), file=fname))
        print(f"{status:6} {item['key']}  /{job['ipa']}/  heard: {job['heard']}  {'; '.join(job['problems'])}")

    json.dump(dict(sorted(manifest.items())), open(manifest_path, "w"), ensure_ascii=False, indent=1)
    json.dump(dict(sorted(candidates.items())), open(cand_path, "w"), ensure_ascii=False, indent=1)
    rep_path = os.path.join(args.out, "voice-report.json")
    old = {r["key"]: r for r in json.load(open(rep_path))} if os.path.exists(rep_path) else {}
    old.update({r["key"]: r for r in report})
    json.dump(sorted(old.values(), key=lambda r: r["key"]), open(rep_path, "w"), ensure_ascii=False, indent=1)
    # What the app's voice check shows: items a person should listen to, or record.
    status = {k: r["status"] for k, r in sorted(old.items()) if r["status"] != "pass"}
    json.dump(status, open(os.path.join(args.out, "voice-status.json"), "w"), ensure_ascii=False, indent=0)
    counts = {s: sum(r["status"] == s for r in report) for s in ("pass", "listen", "fail")}
    print(f"done in {time.time() - t0:.0f}s: {counts}")


if __name__ == "__main__":
    main()
