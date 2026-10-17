// Prints every segment the app can say, as JSON, for make_voice.py.
global.window = {};
require("../../js/data.js");
require("../../js/speech.js");
process.stdout.write(JSON.stringify(window.Aleph.speech.all(), null, 1));
