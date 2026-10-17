# יצירת ההקלטות

מייצר את כל מה שהילד שומע כקבצי קול, לפי התהליך שב־spec: ניקוד מלא → תעתיק פונטי → קול סינתטי → בדיקה אוטומטית → האזנה אנושית.

## מה קורה לכל פריט

1. **הטקסט המנוקד** מגיע מהאפליקציה (`js/data.js` דרך `js/speech.js`) — הניקוד שלנו הוא המקור.
2. **הטעמה ושווא נע.** [Phonikud](https://github.com/thewh1teagle/phonikud) מנבא איפה ההטעמה. לוקחים ממנו רק את ההטעמה, ורק כשהניקוד שלו זהה לשלנו (לפעמים הוא קורא מילה אחרת: דֶּלֶת במקום דָּלֶת). מעליו יש כללים: מלעיל בסגוליים (כֶּלֶב, דָּלֶת, מַיִם), פתח גנובה (תַּפּוּחַ), שווא נע בתחילת מילה, אחרי שווא ובאות מודגשת (הַנְּקֻדָּה), ורשימה קצרה של מילים שנבדקו ידנית (`STRESS` ב־`make_voice.py`).
3. **קול.** אחד מקולות ה־TTS של Phonikud (Piper) קורא את התעתיק, קצת לאט מהרגיל.
4. **בדיקה ג׳** — אורך שמתאים לתעתיק, בלי הפסקות ארוכות באמצע, עוצמה אחידה (הקובץ נחתך ומנורמל).
5. **בדיקה א׳** — מודל זיהוי דיבור עברי (ivrit-ai Whisper) מתמלל את הקובץ, וזה חייב להתאים לטקסט: מילה — התאמה מלאה; משפט — כמעט מלאה.
6. **ניסיון חוזר.** קובץ שנכשל נוצר מחדש: לאט יותר ורגוע יותר, ואז בקולות האחרים. אם הכול נכשל — הוא לא נכנס, ומסומן "צריך הקלטה".
7. **האזנה אנושית.** צירופים והברות קצרים מדי לזיהוי דיבור, ולכן תמיד מסומנים "להאזנה". באפליקציה: אזור הורים ← בדיקת קול ← "לבדיקה". שם אפשר גם להקליט פריט בקול שלכם (נשמר רק במכשיר).

## הרצה

```sh
# כלים (Python 3.11+)
python -m venv venv && . venv/bin/activate
pip install phonikud-onnx piper-onnx faster-whisper soundfile numpy colorlog num2words regex
git clone https://github.com/thewh1teagle/phonikud   # ה־phonemizer, משמש מהמקור

# מודלים (≈ 2.2GB), לתיקייה MODELS:
#   huggingface.co/Phonikud/phonikud-onnx            → phonikud-1.0.int8.onnx
#   huggingface.co/Phonikud/phonikud-tts-checkpoints → model.onnx, shaul.onnx, michael.onnx, model.config.json
#   huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2 → לתיקייה MODELS/whisper

node tools/voice/export_items.js > items.json
python tools/voice/make_voice.py --models MODELS --phonikud phonikud --items items.json --out audio
```

`--only word,p` מייצר רק חלק מהפריטים (לפי תחילת המפתח). התוצאות:

- `audio/*.mp3` ו־`audio/manifest.json` — מה שהאפליקציה מנגנת.
- `audio/voice-status.json` — פריטים "להאזנה" / "צריך הקלטה", לתצוגה באזור ההורים.
- `audio/voice-report.json` — לכל פריט: התעתיק, מה זיהוי הדיבור שמע, ולמה נכשל.

אחרי עדכון הקלטות צריך להעלות את `CACHE` ב־`sw.js`.

**רישיון:** מודלי ה־TTS של Phonikud מפורסמים ברישיון שאינו מסחרי (CC-NC).
