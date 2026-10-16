/* Letter tracing: the child follows each stroke with a finger, in order and in
 * the right direction. A stroke counts once the finger has passed its
 * checkpoints from start to end without wandering off the letter. */
(() => {
  "use strict";

  const Aleph = (window.Aleph = window.Aleph || {});
  const NS = "http://www.w3.org/2000/svg";

  const STEP = 3; // checkpoint spacing, in letter-box units
  const HIT = 13; // how close the finger must pass a checkpoint
  const START_HIT = 16; // how close to the green dot a stroke must begin
  const OFF_TRACK = 22; // further than this from the stroke means "off the letter"
  const LOOKAHEAD = 7; // checkpoints the finger may skip in one move (fast fingers)

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function sample(points) {
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / STEP));
      for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
    return out;
  }

  const ptsAttr = (pts) => pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // createTracer(container, ch, { onStroke, onFail, onDone }) → { demo(), destroy() }
  function createTracer(container, ch, handlers) {
    const strokes = Aleph.data.STROKES[ch].map(sample);
    const svg = el("svg", { viewBox: "0 0 100 104", class: "trace-svg", "aria-hidden": "true" });
    container.appendChild(svg);

    const guide = el("g", { class: "trace-guide" }, svg);
    strokes.forEach((s) => el("polyline", { points: ptsAttr(s) }, guide));
    const doneLayer = el("g", { class: "trace-done" }, svg);
    const live = el("polyline", { class: "trace-live", points: "" }, svg);
    const ghost = el("polyline", { class: "trace-ghost", points: "" }, svg);
    const markers = el("g", { class: "trace-markers" }, svg);
    const pen = el("circle", { class: "trace-pen", r: 4.5, cx: -20, cy: -20 }, svg);

    let current = 0;
    let reached = 0;
    let tracking = false;
    let busy = false;
    let finished = false;

    function drawMarkers() {
      markers.innerHTML = "";
      if (finished) return;
      const s = strokes[current];
      const a = s[0];
      const b = s[Math.min(s.length - 1, 5)];
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      // Arrow a little way along the stroke, pointing the way to go.
      const m = s[Math.min(s.length - 1, 4)];
      el("path", { class: "trace-arrow", d: "M -4 -4 L 4 0 L -4 4 Z", transform: `translate(${m[0]} ${m[1]}) rotate(${ang})` }, markers);
      el("circle", { class: "trace-start", cx: a[0], cy: a[1], r: 6.5 }, markers);
      const t = el("text", { class: "trace-num", x: a[0], y: a[1] + 2.6 }, markers);
      t.textContent = String(current + 1);
    }

    function toLocal(evt) {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const m = svg.getScreenCTM();
      if (!m) return [0, 0];
      const p = pt.matrixTransform(m.inverse());
      return [p.x, p.y];
    }

    function resetStroke() {
      tracking = false;
      reached = 0;
      live.setAttribute("points", "");
    }

    function completeStroke() {
      el("polyline", { points: ptsAttr(strokes[current]) }, doneLayer);
      resetStroke();
      current++;
      if (current >= strokes.length) {
        finished = true;
        drawMarkers();
        svg.classList.add("is-complete");
        handlers.onDone && handlers.onDone();
      } else {
        drawMarkers();
        handlers.onStroke && handlers.onStroke(current);
      }
    }

    function fail() {
      resetStroke();
      handlers.onFail && handlers.onFail(current);
    }

    function onDown(evt) {
      if (busy || finished) return;
      evt.preventDefault();
      const p = toLocal(evt);
      if (dist(p, strokes[current][0]) > START_HIT) {
        markers.classList.remove("pulse");
        void markers.getBBox(); // restart the pulse animation
        markers.classList.add("pulse");
        return;
      }
      svg.setPointerCapture && svg.setPointerCapture(evt.pointerId);
      tracking = true;
      reached = 0;
    }

    function onMove(evt) {
      if (!tracking) return;
      evt.preventDefault();
      const p = toLocal(evt);
      const s = strokes[current];
      let best = -1;
      for (let i = reached; i < Math.min(s.length, reached + LOOKAHEAD + 1); i++) {
        if (dist(p, s[i]) <= HIT) best = i;
      }
      if (best > reached) {
        reached = best;
        live.setAttribute("points", ptsAttr(s.slice(0, reached + 1)));
      }
      if (reached >= s.length - 1) {
        completeStroke();
        return;
      }
      const nearest = Math.min(...s.map((q) => dist(p, q)));
      if (nearest > OFF_TRACK) fail();
    }

    function onUp() {
      if (!tracking) return;
      const s = strokes[current];
      if (reached >= s.length - 2) completeStroke();
      else fail();
    }

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    drawMarkers();

    // Animate a pen drawing the strokes still to be written.
    async function demo() {
      if (finished) return;
      busy = true;
      resetStroke();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (let k = current; k < strokes.length; k++) {
        const s = strokes[k];
        const dur = reduce ? 0 : 450 + s.length * 14;
        await new Promise((resolve) => {
          const t0 = performance.now();
          function frame(now) {
            if (!svg.isConnected) return resolve();
            const t = dur ? Math.min(1, (now - t0) / dur) : 1;
            const n = Math.max(1, Math.round(t * (s.length - 1)));
            ghost.setAttribute("points", ptsAttr(s.slice(0, n + 1)));
            pen.setAttribute("cx", s[n][0]);
            pen.setAttribute("cy", s[n][1]);
            if (t < 1) requestAnimationFrame(frame);
            else setTimeout(resolve, 180);
          }
          requestAnimationFrame(frame);
        });
      }
      ghost.setAttribute("points", "");
      pen.setAttribute("cx", -20);
      busy = false;
    }

    return {
      demo,
      destroy() {
        svg.remove();
      },
    };
  }

  Aleph.createTracer = createTracer;
})();
