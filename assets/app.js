/* Experimental Research Project: self-paced, gamified activity.
   Plain JavaScript, no build step, no external libraries.
   Pure scoring / simulator / badge logic lives in assets/logic.js (window.ERP). */
(function () {
  "use strict";

  var W = window.WORKSHOP;
  var ERP = window.ERP;
  var root = document.getElementById("app");
  if (!W || !ERP || !root) {
    if (root) root.textContent = "The activity failed to load. Check that assets/data.js and assets/logic.js are in the repository.";
    return;
  }

  var STORAGE_KEY = "erp-activity-v2";
  var STEPS = [
    { id: "learn", label: "Learn" },
    { id: "watch", label: "Watch Juma" },
    { id: "turn", label: "Your turn" },
    { id: "reveal", label: "Reveal" }
  ];
  var MAX_WRONG_BEFORE_HELP = 2;
  var ALL_QUESTIONS = [];
  W.stages.forEach(function (s) { s.questions.forEach(function (q) { ALL_QUESTIONS.push(q); }); });
  function qType(q) { return q.type || "mcq"; }

  /* ---------- state ---------- */

  function freshState() {
    return {
      v: 2, started: false, screen: "home", stage: 0, step: 0,
      q: {}, match: {}, matchSel: null, matchChecked: false,
      seenBadges: {}, settings: { sound: false, challenge: false, reduceViz: false },
      records: { bestScore: 0, bestStreak: 0, bestTimeMs: 0 },
      startedAt: 0, finishedAt: 0, labUsed: false, challengeCompleted: false,
      finishCelebrated: false, playerName: ""
    };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      var s = JSON.parse(raw);
      if (!s || s.v !== 2 || typeof s !== "object") return freshState();
      var base = freshState();
      Object.keys(base).forEach(function (k) { if (s[k] === undefined || s[k] === null) s[k] = base[k]; });
      Object.keys(base.settings).forEach(function (k) { if (s.settings[k] === undefined) s.settings[k] = base.settings[k]; });
      Object.keys(base.records).forEach(function (k) { if (s.records[k] === undefined) s.records[k] = base.records[k]; });
      if (["home", "setting", "stage", "finish", "lab"].indexOf(s.screen) < 0) s.screen = "home";
      s.stage = clamp(parseInt(s.stage, 10) || 0, 0, W.stages.length - 1);
      s.step = clamp(parseInt(s.step, 10) || 0, 0, STEPS.length - 1);
      if (typeof s.q !== "object") s.q = {};
      if (typeof s.match !== "object") s.match = {};
      return s;
    } catch (e) {
      return freshState();
    }
  }

  function saveState() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode or full: progress simply is not kept */ }
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  var state = loadState();
  var pendingFocus = null;

  function qState(id) {
    var s = state.q[id];
    if (!s || typeof s !== "object") return { wrong: [], solved: false, shown: false, sel: null, wager: null, val: null, order: null };
    if (!Array.isArray(s.wrong)) s.wrong = [];
    return s;
  }
  function qStateW(id) {
    if (!state.q[id] || typeof state.q[id] !== "object") state.q[id] = { wrong: [], solved: false, shown: false, sel: null, wager: null, val: null, order: null };
    if (!Array.isArray(state.q[id].wrong)) state.q[id].wrong = [];
    return state.q[id];
  }
  function resolved(q) { var s = qState(q.id); return s.solved || s.shown; }
  function firstTry(q) { var s = qState(q.id); return s.solved && !s.shown && s.wrong.length === 0; }
  function stageDone(i) { return W.stages[i].questions.every(resolved); }
  function stageClean(i) { return W.stages[i].questions.every(firstTry); }
  function stageUnlocked(i) { return i === 0 || stageDone(i - 1); }
  function allDone() { return W.stages.every(function (_, i) { return stageDone(i); }); }
  function resolvedCount() { return ALL_QUESTIONS.filter(resolved).length; }
  function firstTryCount() { return ALL_QUESTIONS.filter(firstTry).length; }

  /* ---------- points, streaks, badges ---------- */

  function xpInfo() {
    var sum = 0;
    ALL_QUESTIONS.forEach(function (q) { var s = qState(q.id); sum += ERP.questionXP(s, s.wager); });
    var flags = ALL_QUESTIONS.map(function (q) { return { resolved: resolved(q), firstTry: firstTry(q) }; });
    var si = ERP.streakInfo(flags);
    return { points: sum + si.bonus, base: sum, streak: si };
  }

  function matchItems() { return W.closing.match; }
  function matchAllCorrect() {
    var items = matchItems();
    return items.every(function (it, i) { return String(state.match[i]) === String(it.stage); });
  }

  function badgeCtx() {
    return {
      resolved: resolvedCount(), total: ALL_QUESTIONS.length, firstTry: firstTryCount(),
      anyShown: ALL_QUESTIONS.some(function (q) { return qState(q.id).shown; }),
      anyComeback: ALL_QUESTIONS.some(function (q) { var s = qState(q.id); return s.solved && !s.shown && s.wrong.length > 0; }),
      cleanStage: W.stages.some(function (_, i) { return stageDone(i) && stageClean(i); }),
      certainWin: ALL_QUESTIONS.some(function (q) { var s = qState(q.id); return s.solved && s.wrong.length === 0 && !s.shown && s.wager === "certain"; }),
      labUsed: !!state.labUsed, allDone: allDone(),
      perfectMatch: !!state.matchChecked && matchAllCorrect(),
      challengeDone: !!state.challengeCompleted
    };
  }

  // Toast + celebrate any badges earned since last render; idempotent via seenBadges.
  function syncBadges() {
    var earned = ERP.earnedBadges(badgeCtx());
    var fresh = earned.filter(function (id) { return !state.seenBadges[id]; });
    if (!fresh.length) return;
    fresh.forEach(function (id) {
      state.seenBadges[id] = true;
      var b = ERP.badgeById(id);
      if (b) toast(b.icon, "Badge unlocked", b.title);
    });
    saveState();
    playSound("badge");
    burst({ big: false });
  }

  /* ---------- navigation with transitions ---------- */

  var LEAVE_MS = 170;
  var busy = false;
  var lastPercent = 0;
  var lastXP = 0;
  var lastFilled = null;
  var freshFeedback = null;

  function position(s) {
    if (s.screen === "home") return 0;
    if (s.screen === "setting") return 1;
    if (s.screen === "lab") return 1.5;
    if (s.screen === "finish") return 1000;
    return 2 + s.stage * STEPS.length + s.step;
  }

  function go(patch, focusId) {
    if (busy) return;
    var before = position(state);
    var beforeKey = state.screen + ":" + state.stage + ":" + state.step;
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    sanitizeLocation();
    // Challenge clock starts the moment the learner first enters a stage.
    if (state.settings.challenge && state.screen === "stage" && !state.startedAt) state.startedAt = now();
    // Record the finish time on first arrival at the finish screen in a challenge run.
    if (state.screen === "finish" && state.settings.challenge && state.startedAt && !state.finishedAt) state.finishedAt = now();
    saveState();
    var moved = beforeKey !== state.screen + ":" + state.stage + ":" + state.step;
    pendingFocus = focusId || (moved ? "main-heading" : null);
    if (!moved) { render(); return; }

    var dir = position(state) >= before ? "fwd" : "back";
    var main = document.getElementById("main");
    if (prefersReducedMotion() || !main) { render(); window.scrollTo(0, 0); return; }
    busy = true;
    main.classList.add("is-leaving", "leave-" + dir);
    var file = document.querySelector(".layout .file");
    var fileStays = file && state.screen === "stage";
    if (file && !fileStays) file.classList.add("is-leaving", "leave-" + dir);
    setTimeout(function () { render(dir); window.scrollTo(0, 0); busy = false; }, LEAVE_MS);
  }

  function sanitizeLocation() {
    if (state.screen === "stage") {
      while (state.stage > 0 && !stageUnlocked(state.stage)) { state.stage--; state.step = 0; }
      if (state.step === 3 && !stageDone(state.stage)) state.step = 2;
      // In challenge mode the "Watch Juma" hint step is skipped.
      if (state.settings.challenge && state.step === 1) state.step = 2;
    }
    if (state.screen === "finish" && !allDone()) state.screen = "stage";
  }

  /* ---------- DOM helpers ---------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function img(file, alt, cls) {
    return h("img", { src: "assets/img/" + file, alt: alt || "", class: cls || null, loading: "lazy",
      onerror: function () { this.style.display = "none"; } });
  }
  function now() { return (window.performance && performance.now) ? Date.now() : Date.now(); }

  /* ---------- render ---------- */

  function render(enterDir) {
    var hadFile = !!document.querySelector(".layout .file");
    root.textContent = "";
    root.appendChild(header());
    var layout = h("div", { class: "layout" + (state.screen === "stage" ? " with-file" : "") });
    var main = h("main", { class: "main" + (enterDir ? " enter-" + enterDir : ""), id: "main" });
    if (state.screen === "home") main.appendChild(homeView());
    else if (state.screen === "setting") main.appendChild(settingView());
    else if (state.screen === "lab") main.appendChild(labView());
    else if (state.screen === "finish") main.appendChild(finishView());
    else main.appendChild(stageView());
    layout.appendChild(main);
    if (state.screen === "stage") {
      var pf = projectFile(false);
      if (enterDir && !hadFile) pf.classList.add("enter-" + enterDir);
      layout.appendChild(pf);
    }
    root.appendChild(layout);
    animateMeter();
    animateXP();
    lastFilled = W.stages.map(function (_, i) { return stageDone(i); });
    freshFeedback = null;
    if (enterDir) {
      setTimeout(function () {
        var m = document.getElementById("main"); if (m) m.classList.remove("enter-fwd", "enter-back");
        var f = document.querySelector(".layout .file"); if (f) f.classList.remove("enter-fwd", "enter-back");
      }, 600);
    }
    root.appendChild(h("footer", { class: "foot" }, "Experimental Research Project  |  Experimental Design and A/B Testing"));

    if (pendingFocus) {
      var el = document.getElementById(pendingFocus);
      if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
      pendingFocus = null;
    }
    ensureTimer();
    syncBadges();
  }

  function animateMeter() {
    var fill = document.getElementById("meter-fill");
    if (!fill) return;
    var target = parseInt(fill.getAttribute("data-target"), 10) || 0;
    lastPercent = target;
    if (prefersReducedMotion()) { fill.style.width = target + "%"; return; }
    void fill.offsetWidth;
    requestAnimationFrame(function () { fill.style.width = target + "%"; });
  }

  function animateXP() {
    var el = document.getElementById("hud-xp-num");
    if (!el) return;
    var target = parseInt(el.getAttribute("data-target"), 10) || 0;
    if (prefersReducedMotion() || target === lastXP) { el.textContent = String(target); lastXP = target; return; }
    var from = lastXP, start = null, dur = 500;
    function tick(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / dur);
      el.textContent = String(Math.round(from + (target - from) * (p * (2 - p))));
      if (p < 1) requestAnimationFrame(tick); else lastXP = target;
    }
    requestAnimationFrame(tick);
  }

  /* ---------- header ---------- */

  function header() {
    var done = resolvedCount(), total = ALL_QUESTIONS.length;
    var xp = xpInfo();
    var pills = W.stages.map(function (s, i) {
      var unlocked = stageUnlocked(i);
      var current = state.screen === "stage" && state.stage === i;
      var cls = "pill" + (current ? " is-current" : "") + (stageDone(i) ? " is-done" : "") + (!unlocked ? " is-locked" : "");
      return h("li", null, h("button", {
        class: cls, type: "button", disabled: !unlocked,
        "aria-current": current ? "step" : null,
        "aria-label": "Stage " + s.num + ": " + s.title + (stageDone(i) ? " (complete)" : unlocked ? "" : " (locked)"),
        title: s.title,
        onclick: function () { go({ screen: "stage", stage: i, step: 0 }); }
      }, h("span", { class: "pill-num" }, stageDone(i) ? "✓" : String(s.num)), h("span", { class: "pill-label" }, s.title)));
    });

    var hud = h("div", { class: "hud" },
      h("button", { class: "hud-chip hud-xp", type: "button", title: ERP.rankForXP(xp.points) + " · open the Lab",
        onclick: function () { go({ screen: "lab" }); } },
        h("span", { class: "hud-ico", "aria-hidden": "true" }, "✦"),
        h("span", null, h("span", { id: "hud-xp-num", "data-target": String(xp.points) }, String(lastXP)), " XP"),
        h("span", { class: "sr-only" }, ", rank " + ERP.rankForXP(xp.points))
      ),
      xp.streak.current >= 2 ? h("span", { class: "hud-chip hud-streak", title: xp.streak.current + " in a row" },
        h("span", { class: "hud-ico", "aria-hidden": "true" }, "🔥"), String(xp.streak.current),
        h("span", { class: "sr-only" }, " question streak")) : null,
      state.settings.challenge ? h("span", { class: "hud-chip hud-timer", id: "hud-timer", title: "Challenge time" },
        h("span", { class: "hud-ico", "aria-hidden": "true" }, "⏱"), h("span", { id: "hud-time" }, fmtTime(elapsedMs()))) : null,
      h("button", { class: "hud-chip hud-btn", type: "button", "aria-pressed": String(!!state.settings.sound),
        title: state.settings.sound ? "Sound on" : "Sound off",
        onclick: function () { state.settings.sound = !state.settings.sound; saveState(); if (state.settings.sound) playSound("badge"); render(); } },
        h("span", { class: "hud-ico", "aria-hidden": "true" }, state.settings.sound ? "🔊" : "🔇"),
        h("span", { class: "sr-only" }, "Toggle sound")),
      h("button", { class: "hud-chip hud-btn" + (state.screen === "lab" ? " is-on" : ""), type: "button",
        title: "Experiment Lab", onclick: function () { go({ screen: "lab" }); } },
        h("span", { class: "hud-ico", "aria-hidden": "true" }, "🧪"), "Lab")
    );

    return h("header", { class: "top" },
      h("div", { class: "top-inner" },
        h("button", { class: "brand", type: "button", onclick: function () { go({ screen: "home" }); } }, W.title),
        h("nav", { "aria-label": "Stages" }, h("ol", { class: "pills" }, pills)),
        hud,
        h("div", { class: "meter", role: "progressbar", "aria-label": "Questions answered", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(done) },
          h("div", { class: "meter-bar" }, h("span", { id: "meter-fill", "data-target": String(Math.round(done / total * 100)), style: "width:" + lastPercent + "%" })),
          h("span", { class: "meter-text" }, done + " of " + total + " answered")
        )
      )
    );
  }

  /* ---------- home and setting ---------- */

  function homeView() {
    var started = !!state.started;
    var stagesList = h("ol", { class: "stage-list" }, W.stages.map(function (s) {
      return h("li", null, h("strong", null, s.title), h("span", null, s.tagline));
    }));
    return h("section", { class: "hero" },
      h("div", { class: "hero-band" },
        h("div", { class: "hero-text" },
          h("h1", { id: "main-heading", tabindex: "-1" }, W.title),
          h("p", { class: "lede" }, W.subtitle),
          h("div", { class: "actions" },
            h("button", { class: "btn btn-primary", type: "button", onclick: function () {
              if (started) go({ screen: allDone() ? "finish" : "stage" });
              else go({ screen: "setting", started: true });
            } }, started ? (allDone() ? "See your project file" : "Continue where you left off") : "Start the project"),
            h("button", { class: "btn btn-ghost-light", type: "button", onclick: function () { go({ screen: "lab" }); } }, "🧪 Open the Lab"),
            started ? h("button", { class: "btn btn-ghost-light", type: "button", onclick: resetAll }, "Start over") : null
          ),
          h("label", { class: "chal-toggle" },
            h("input", { type: "checkbox", checked: !!state.settings.challenge,
              onchange: function (e) { setChallenge(e.target.checked); } }),
            h("span", null, h("strong", null, "⚡ Challenge mode"), " — Juma's hints are hidden and the clock runs. For a second pass.")
          )
        ),
        img("skyline.png", "", "hero-art")
      ),
      h("div", { class: "howto" },
        h("h2", null, "How this works"),
        h("p", null, "You work one experimental research project, from a business problem to a decision, in five stages. Each stage has four steps:"),
        h("ol", { class: "how-steps" },
          h("li", null, h("strong", null, "Learn."), " The skill in plain language, the steps, and the failure it prevents."),
          h("li", null, h("strong", null, "Watch Juma."), " How he did this stage on last quarter's referral test."),
          h("li", null, h("strong", null, "Your turn."), " The same stage on the verification redesign. Answer, wager how sure you are, and earn points."),
          h("li", null, h("strong", null, "Reveal."), " The answer, the reason, and the entry for Juma's project file.")
        ),
        h("p", null, "Answer well to earn XP, build a first-try streak, and unlock badges. Nine questions in all, plus an Experiment Lab to play in. Your progress is saved in this browser, so you can stop and come back."),
        h("h2", null, "The five stages"),
        stagesList
      )
    );
  }

  function setChallenge(on) {
    state.settings.challenge = on;
    state.startedAt = 0; state.finishedAt = 0; state.challengeCompleted = false;
    saveState();
    render();
  }

  function settingView() {
    var s = W.setting, p = W.persona;
    return h("section", null,
      h("h1", { id: "main-heading", tabindex: "-1" }, "The setting: Tuma, a Nairobi mobile wallet"),
      h("p", { class: "lede dark" }, s.intro),
      h("ul", { class: "stats" }, s.stats.map(function (st) { return h("li", null, h("strong", null, st[0]), h("span", null, st[1])); })),
      h("div", { class: "problem" },
        img("dashboard.png", "Chart: many installs, 55 percent verified"),
        h("div", null, h("h2", null, "The business problem"), h("p", null, s.problem))
      ),
      h("div", { class: "persona" },
        img("juma.png", "Illustration of Juma at his desk", "avatar"),
        h("div", null,
          h("h2", null, "You are " + p.name),
          h("p", { class: "muted" }, p.role),
          h("p", null, p.bio),
          h("p", null, p.job),
          h("p", null, h("strong", null, "His last project, the referral bonus test. "), p.lastProject + " At each stage you will see what he did on the referral test, then do the same stage yourself on the verification redesign.")
        )
      ),
      navRow(
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { go({ screen: "home" }); } }, "Back"),
        h("button", { class: "btn btn-primary", type: "button", onclick: function () { go({ screen: "stage", stage: 0, step: 0 }); } }, "Begin stage 1")
      )
    );
  }

  /* ---------- stage ---------- */

  function stageView() {
    var st = W.stages[state.stage];
    var done = stageDone(state.stage);
    var tabs = h("div", { class: "steps", role: "list", "aria-label": "Steps in this stage" }, STEPS.map(function (step, i) {
      var locked = (i === 3 && !done) || (i === 1 && state.settings.challenge);
      var current = state.step === i;
      return h("div", { role: "listitem" }, h("button", {
        type: "button", class: "step" + (current ? " is-current" : ""), disabled: locked,
        "aria-current": current ? "step" : null,
        onclick: function () { go({ step: i }); }
      }, h("span", { class: "step-num" }, String(i + 1)), step.label,
        locked && i === 3 ? h("span", { class: "sr-only" }, " (answer the questions first)") : null,
        locked && i === 1 ? h("span", { class: "sr-only" }, " (hidden in challenge mode)") : null));
    }));

    var body;
    if (state.step === 0) body = learnView(st);
    else if (state.step === 1) body = state.settings.challenge ? challengeWatchView() : watchView(st);
    else if (state.step === 2) body = turnView(st);
    else body = revealView(st);

    var isLastStage = state.stage === W.stages.length - 1;
    var nextBtn;
    if (state.step < 2) {
      var target = state.settings.challenge && state.step === 0 ? 2 : state.step + 1;
      nextBtn = h("button", { class: "btn btn-primary", type: "button", onclick: function () { go({ step: target }); } }, "Next: " + STEPS[target].label);
    } else if (state.step === 2) {
      nextBtn = done
        ? h("button", { class: "btn btn-primary", type: "button", onclick: function () { go({ step: 3 }); } }, "Next: Reveal")
        : h("span", { class: "hint" }, "Answer the question" + (st.questions.length > 1 ? "s" : "") + " above to unlock the reveal.");
    } else {
      nextBtn = isLastStage
        ? h("button", { class: "btn btn-primary", type: "button", onclick: function () { go({ screen: "finish" }); } }, "See your project file")
        : h("button", { class: "btn btn-primary", type: "button", onclick: function () { go({ stage: state.stage + 1, step: 0 }); } }, "Start stage " + (state.stage + 2));
    }
    var backBtn = state.step > 0
      ? h("button", { class: "btn btn-quiet", type: "button", onclick: function () { go({ step: state.settings.challenge && state.step === 2 ? 0 : state.step - 1 }); } }, "Back")
      : h("button", { class: "btn btn-quiet", type: "button", onclick: function () {
          if (state.stage > 0) go({ stage: state.stage - 1, step: 3 }); else go({ screen: "setting" });
        } }, state.stage > 0 ? "Back to stage " + state.stage : "Back to the setting");

    return h("section", { class: "stage" },
      h("div", { class: "stage-head" },
        h("span", { class: "badge", "aria-hidden": "true" }, String(st.num)),
        h("div", null,
          h("p", { class: "kicker" }, "Stage " + st.num + " of " + W.stages.length + ", " + st.clock),
          h("h1", { id: "main-heading", tabindex: "-1" }, st.title)
        )
      ),
      tabs, body, navRow(backBtn, nextBtn)
    );
  }

  function learnView(st) {
    return h("div", { class: "grid-2" },
      h("div", null,
        h("p", { class: "tagline" }, st.tagline),
        st.learn.map(function (p) { return h("p", null, h("strong", null, p[0]), " " + p[1]); }),
        h("div", { class: "failure" }, h("h3", null, "The failure this prevents"), h("p", null, st.failure)),
        st.num === 3 ? h("div", { class: "lab-callout" },
          h("p", null, h("strong", null, "Feel it in the Lab. "), "Sample size is abstract until you watch a test wobble. Open the Experiment Lab, set a small sample, and run it a few times."),
          h("button", { class: "btn btn-quiet small", type: "button", onclick: function () { go({ screen: "lab" }); } }, "🧪 Open the Lab")) : null
      ),
      h("aside", { class: "panel-dark" },
        h("h3", null, "How you do this stage"),
        h("ol", null, st.steps.map(function (s) { return h("li", null, s); }))
      )
    );
  }

  function watchView(st) {
    var w = st.watch;
    return h("div", null,
      h("p", { class: "tagline" }, "The referral bonus test, last quarter"),
      h("div", { class: "grid-2" },
        h("div", null,
          h("h3", null, "The situation"), h("p", null, w.situation),
          h("h3", null, "What he did"), h("p", null, w.did),
          h("p", { class: "result" }, h("strong", null, "Result. "), w.result)
        ),
        h("aside", { class: "panel-dark" },
          h("div", { class: "artifact-head" }, img("juma.png", "", "avatar-sm"), h("h3", null, "The artifact this stage produced")),
          h("dl", { class: "artifact" }, w.artifact.map(function (row) { return [h("dt", null, row[0]), h("dd", null, row[1])]; }))
        )
      )
    );
  }

  function challengeWatchView() {
    return h("div", { class: "challenge-lock" },
      h("p", { class: "tagline" }, "Challenge mode"),
      h("div", { class: "panel-dark" },
        h("h3", null, "⚡ Juma's worked example is hidden"),
        h("p", null, "You turned on Challenge mode, so you are on your own for this one. Trust the Learn step and back your judgement. Turn Challenge off on the home screen to see how Juma did it."),
        h("button", { class: "btn btn-quiet small", type: "button", onclick: function () { go({ step: 2 }); } }, "Go to the question")
      )
    );
  }

  function turnView(st) {
    return h("div", null,
      h("p", { class: "tagline" }, "The verification redesign. Answer, wager how sure you are, then check."),
      st.questions.map(function (q, i) { return questionCard(q, i, st.questions.length); })
    );
  }

  /* ---------- wager (feature 7) ---------- */

  function wagerRow(q) {
    var s = qStateW(q.id);
    var locked = s.solved || s.shown || s.wrong.length > 0;
    if (locked) {
      if (!s.wager) return null;
      var w = ERP.WAGERS.filter(function (x) { return x.id === s.wager; })[0];
      return h("p", { class: "wager-locked" }, "Your wager: ", h("strong", null, w ? w.label : s.wager), w ? " (×" + w.mult + ")" : "");
    }
    return h("div", { class: "wager" },
      h("span", { class: "wager-label" }, "How sure are you?"),
      h("div", { class: "wager-opts", role: "group", "aria-label": "Confidence wager" }, ERP.WAGERS.map(function (w) {
        return h("button", { type: "button", class: "wager-btn" + (s.wager === w.id ? " is-on" : ""),
          title: w.note, "aria-pressed": String(s.wager === w.id),
          onclick: function () { s.wager = s.wager === w.id ? null : w.id; saveState(); render(); } },
          w.label, h("span", { class: "wager-mult" }, "×" + w.mult));
      }))
    );
  }

  /* ---------- question cards by type (feature 6) ---------- */

  function questionCard(q, idx, count) {
    if (qType(q) === "slider") return sliderCard(q, idx, count);
    if (qType(q) === "order") return orderCard(q, idx, count);
    return mcqCard(q, idx, count);
  }

  function questionShell(q, idx, count, inner, doneCls) {
    return h("article", { class: "question" + doneCls + (freshFeedback === q.id ? " is-fresh" : "") },
      h("div", { class: "desk" },
        h("div", null, h("h3", null, "On Juma's desk"), h("p", null, q.desk)),
        q.image ? img(q.image, "", "desk-art") : null
      ),
      h("div", { class: "q-body" },
        h("p", { class: "kicker" }, "Question " + (ALL_QUESTIONS.indexOf(q) + 1) + " of " + ALL_QUESTIONS.length + (count > 1 ? " (" + (idx + 1) + " of " + count + " in this stage)" : "")),
        inner
      )
    );
  }

  function mcqCard(q, idx, count) {
    var s = qStateW(q.id);
    var done = s.solved || s.shown;
    var correctOpt = q.options.filter(function (o) { return o.key === q.answer; })[0];
    var lastWrong = s.wrong.length ? s.wrong[s.wrong.length - 1] : null;
    var name = "opt-" + q.id, fbId = "fb-" + q.id;

    var opts = h("div", { class: "options", role: "radiogroup", "aria-labelledby": "prompt-" + q.id, "aria-describedby": fbId },
      q.options.map(function (o) {
        var isWrong = s.wrong.indexOf(o.key) >= 0;
        var isRight = done && o.key === q.answer;
        var cls = "option" + (isWrong ? " is-wrong" : "") + (isRight ? " is-right" : "") + (s.sel === o.key && !done && !isWrong ? " is-selected" : "");
        var inputId = name + "-" + o.key;
        return h("label", { class: cls, for: inputId },
          h("input", { type: "radio", name: name, id: inputId, value: o.key,
            checked: s.sel === o.key && !isWrong, disabled: done || isWrong,
            onchange: function () { s.sel = o.key; saveState(); selectInPlace(q, o.key); } }),
          h("span", { class: "opt-key", "aria-hidden": "true" }, isRight ? "✓" : isWrong ? "✕" : o.key),
          h("span", { class: "opt-text" }, h("span", { class: "sr-only" }, "Option " + o.key + ". "), o.text,
            isWrong ? h("span", { class: "sr-only" }, " (incorrect)") : null, isRight ? h("span", { class: "sr-only" }, " (correct)") : null)
        );
      })
    );

    var fb = h("div", { class: "feedback-wrap" + (freshFeedback === q.id ? " is-fresh" : ""), id: fbId, "aria-live": "polite" });
    if (s.solved) fb.appendChild(h("div", { class: "feedback ok" },
      h("p", { class: "fb-title" }, xpLine(s, s.wrong.length === 0 ? "Correct, first time." : "Correct.")), h("p", null, correctOpt.feedback)));
    else if (s.shown) fb.appendChild(h("div", { class: "feedback info" },
      h("p", { class: "fb-title" }, "The best option is " + q.answer.toUpperCase() + "."), h("p", null, correctOpt.feedback)));
    else if (lastWrong) {
      var wo = q.options.filter(function (o) { return o.key === lastWrong; })[0];
      fb.appendChild(h("div", { class: "feedback bad" },
        h("p", { class: "fb-title" }, "Not quite. Option " + lastWrong.toUpperCase() + " is one of the common mistakes."),
        h("p", null, wo ? wo.feedback : ""), h("p", { class: "fb-next" }, "Try another option.")));
    }

    var controls = null;
    if (!done) controls = h("div", { class: "q-actions" },
      h("button", { class: "btn btn-primary", type: "button", id: "check-" + q.id, disabled: !s.sel,
        onclick: function () { checkMcq(q); } }, "Check answer"),
      s.wrong.length >= MAX_WRONG_BEFORE_HELP ? h("button", { class: "btn btn-quiet", type: "button",
        onclick: function () { s.shown = true; s.sel = q.answer; saveState(); pendingFocus = fbId; freshFeedback = q.id; render(); }
      }, "Show me the answer") : null,
      !s.sel ? h("span", { class: "hint" }, "Select an option first.") : null);

    var history = null;
    if (s.wrong.length > (done ? 0 : 1)) {
      var shownWrong = done ? s.wrong : s.wrong.slice(0, -1);
      history = h("details", { class: "history" }, h("summary", null, "Why the other options you tried are wrong"),
        shownWrong.map(function (k) { var o = q.options.filter(function (x) { return x.key === k; })[0];
          return o ? h("p", null, h("strong", null, k.toUpperCase() + ". "), o.feedback) : null; }));
    }
    var others = null;
    if (done) {
      var untried = q.options.filter(function (o) { return o.key !== q.answer && s.wrong.indexOf(o.key) < 0; });
      if (untried.length) others = h("details", { class: "history" }, h("summary", null, "Why the options you did not pick are wrong"),
        untried.map(function (o) { return h("p", null, h("strong", null, o.key.toUpperCase() + ". "), o.feedback); }));
    }

    return questionShell(q, idx, count, [
      h("h2", { id: "prompt-" + q.id, class: "prompt" }, q.prompt),
      opts, wagerRow(q), controls, fb, history, others,
      q.id === "q7" ? decisionConsequence(q) : null
    ], done ? " is-done" : "");
  }

  function xpLine(s, label) {
    var pts = ERP.questionXP(s, s.wager);
    return [label, h("span", { class: "xp-earn" }, "+" + pts + " XP")];
  }

  function selectInPlace(q, key) {
    var group = document.querySelector('[aria-labelledby="prompt-' + q.id + '"]');
    if (!group) { render(); return; }
    Array.prototype.forEach.call(group.querySelectorAll(".option"), function (lab) {
      var input = lab.querySelector("input");
      var on = input && input.value === key && !input.disabled;
      lab.classList.toggle("is-selected", on);
    });
    var btn = document.getElementById("check-" + q.id);
    if (btn) { btn.disabled = false; var hint = btn.parentNode.querySelector(".hint"); if (hint) hint.remove(); }
  }

  function checkMcq(q) {
    var s = qStateW(q.id);
    if (!s.sel || s.solved || s.shown) return;
    var firstTryWin = s.wrong.length === 0 && s.sel === q.answer;
    if (s.sel === q.answer) s.solved = true;
    else if (s.wrong.indexOf(s.sel) < 0) { s.wrong.push(s.sel); s.sel = null; }
    afterCheck(q, s, firstTryWin);
  }

  /* ---------- slider question ---------- */

  function sliderCard(q, idx, count) {
    var s = qStateW(q.id);
    var done = s.solved || s.shown;
    if (s.val === null || s.val === undefined) s.val = q.start;
    var fbId = "fb-" + q.id;

    var readout = h("div", { class: "slider-readout" },
      h("span", { class: "slider-val", id: "sv-" + q.id }, String(s.val) + (q.unit || "")));

    var range = h("input", { type: "range", class: "slider-range", id: "sr-" + q.id,
      min: String(q.min), max: String(q.max), step: String(q.step), value: String(s.val),
      disabled: done, "aria-describedby": fbId,
      oninput: function (e) { s.val = parseInt(e.target.value, 10); saveState();
        var out = document.getElementById("sv-" + q.id); if (out) out.textContent = String(s.val) + (q.unit || ""); } });

    var fb = h("div", { class: "feedback-wrap" + (freshFeedback === q.id ? " is-fresh" : ""), id: fbId, "aria-live": "polite" });
    if (s.solved) fb.appendChild(h("div", { class: "feedback ok" },
      h("p", { class: "fb-title" }, xpLine(s, "Right in the band.")), h("p", null, q.feedback)));
    else if (s.shown) fb.appendChild(h("div", { class: "feedback info" },
      h("p", { class: "fb-title" }, "The answer is about " + q.answer + (q.unit || "") + "."), h("p", null, q.feedback)));
    else if (s.wrong.length) {
      var hint = ERP.sliderHint(parseInt(s.wrong[s.wrong.length - 1], 10), q.answer, q.tolerance);
      var msg = hint === "high" ? "Too high — that many would only buy delay." :
        hint === "low" ? "Too low — that few could only catch a huge lift." :
        hint === "closeHigh" ? "Close, but a touch high. Nudge it down." : "Close, but a touch low. Nudge it up.";
      fb.appendChild(h("div", { class: "feedback bad" }, h("p", { class: "fb-title" }, "Not in the band yet."), h("p", null, msg)));
    }

    var controls = null;
    if (!done) controls = h("div", { class: "q-actions" },
      h("button", { class: "btn btn-primary", type: "button", onclick: function () { checkSlider(q); } }, "Check answer"),
      s.wrong.length >= MAX_WRONG_BEFORE_HELP ? h("button", { class: "btn btn-quiet", type: "button",
        onclick: function () { s.shown = true; saveState(); pendingFocus = fbId; freshFeedback = q.id; render(); } }, "Show me the answer") : null);

    return questionShell(q, idx, count, [
      h("h2", { id: "prompt-" + q.id, class: "prompt" }, q.prompt),
      h("div", { class: "slider-wrap" }, readout, range,
        h("div", { class: "slider-scale" }, h("span", null, String(q.min)), h("span", null, String(q.max) + (q.unit || "")))),
      wagerRow(q), controls, fb
    ], done ? " is-done" : "");
  }

  function checkSlider(q) {
    var s = qStateW(q.id);
    if (s.solved || s.shown) return;
    var firstTryWin = s.wrong.length === 0 && ERP.sliderCorrect(s.val, q.answer, q.tolerance);
    if (ERP.sliderCorrect(s.val, q.answer, q.tolerance)) s.solved = true;
    else s.wrong.push(String(s.val));
    afterCheck(q, s, firstTryWin);
  }

  /* ---------- ordering question ---------- */

  function orderCard(q, idx, count) {
    var s = qStateW(q.id);
    var done = s.solved || s.shown;
    var n = q.sequence.length;
    if (!s.order || s.order.length !== n) s.order = (q.shuffle && q.shuffle.length === n) ? q.shuffle.slice() : q.sequence.map(function (_, i) { return i; });
    var fbId = "fb-" + q.id;
    var showCorrect = s.shown;
    var display = showCorrect ? q.sequence.map(function (_, i) { return i; }) : s.order;

    var list = h("ol", { class: "order-list" + (done ? " is-locked" : ""), id: "ord-" + q.id }, display.map(function (itemIdx, pos) {
      var correctHere = done && itemIdx === pos;
      var row = h("li", { class: "order-item" + (correctHere ? " is-right" : "") + (done && !correctHere && !showCorrect ? " is-off" : ""),
        draggable: !done, "data-pos": String(pos),
        ondragstart: done ? null : function (e) { e.dataTransfer.setData("text/plain", String(pos)); e.dataTransfer.effectAllowed = "move"; this.classList.add("dragging"); },
        ondragend: function () { this.classList.remove("dragging"); },
        ondragover: done ? null : function (e) { e.preventDefault(); this.classList.add("drop-hint"); },
        ondragleave: function () { this.classList.remove("drop-hint"); },
        ondrop: done ? null : function (e) { e.preventDefault(); this.classList.remove("drop-hint"); moveOrder(q, parseInt(e.dataTransfer.getData("text/plain"), 10), pos); } },
        h("span", { class: "order-grip", "aria-hidden": "true" }, "≡"),
        h("span", { class: "order-text" }, q.sequence[itemIdx]),
        done ? null : h("span", { class: "order-moves" },
          h("button", { type: "button", class: "order-move", disabled: pos === 0, "aria-label": "Move up", onclick: function () { moveOrder(q, pos, pos - 1); } }, "▲"),
          h("button", { type: "button", class: "order-move", disabled: pos === n - 1, "aria-label": "Move down", onclick: function () { moveOrder(q, pos, pos + 1); } }, "▼"))
      );
      return row;
    }));

    var fb = h("div", { class: "feedback-wrap" + (freshFeedback === q.id ? " is-fresh" : ""), id: fbId, "aria-live": "polite" });
    if (s.solved) fb.appendChild(h("div", { class: "feedback ok" },
      h("p", { class: "fb-title" }, xpLine(s, s.wrong.length === 0 ? "In order, first time." : "In order.")), h("p", null, q.feedback)));
    else if (s.shown) fb.appendChild(h("div", { class: "feedback info" },
      h("p", { class: "fb-title" }, "Shown in the right order above."), h("p", null, q.feedback)));
    else if (s.wrong.length) fb.appendChild(h("div", { class: "feedback bad" },
      h("p", { class: "fb-title" }, "Not the right order yet."), h("p", null, "Drag the rows, or use the arrows, then check again.")));

    var controls = null;
    if (!done) controls = h("div", { class: "q-actions" },
      h("button", { class: "btn btn-primary", type: "button", onclick: function () { checkOrder(q); } }, "Check order"),
      s.wrong.length >= MAX_WRONG_BEFORE_HELP ? h("button", { class: "btn btn-quiet", type: "button",
        onclick: function () { s.shown = true; saveState(); pendingFocus = fbId; freshFeedback = q.id; render(); } }, "Show me the order") : null);

    return questionShell(q, idx, count, [
      h("h2", { id: "prompt-" + q.id, class: "prompt" }, q.prompt),
      h("p", { class: "muted small" }, "Drag the rows into order, or use the arrow buttons."),
      list, wagerRow(q), controls, fb
    ], done ? " is-done" : "");
  }

  function moveOrder(q, from, to) {
    var s = qStateW(q.id);
    var n = q.sequence.length;
    if (to < 0 || to >= n || from === to) return;
    var arr = s.order.slice();
    var moved = arr.splice(from, 1)[0];
    arr.splice(to, 0, moved);
    s.order = arr; saveState();
    // Re-render just this card's list would be ideal; a full render keeps state simple.
    freshFeedback = null; render();
    var el = document.getElementById("ord-" + q.id);
    if (el) { var rows = el.querySelectorAll(".order-item"); if (rows[to]) rows[to].focus && rows[to].focus(); }
  }

  function checkOrder(q) {
    var s = qStateW(q.id);
    if (s.solved || s.shown) return;
    var ok = ERP.orderCorrect(s.order, q.sequence.length);
    var firstTryWin = s.wrong.length === 0 && ok;
    if (ok) s.solved = true;
    else s.wrong.push(s.order.join("-"));
    afterCheck(q, s, firstTryWin);
  }

  /* ---------- shared post-check (celebrations, feature 4) ---------- */

  function afterCheck(q, s, firstTryWin) {
    saveState();
    var stageWasDone = stageDone(state.stage);
    pendingFocus = "fb-" + q.id;
    freshFeedback = q.id;
    if (s.solved) {
      playSound(firstTryWin ? "great" : "correct");
      if (firstTryWin) burst({ big: false });
    } else playSound("wrong");
    render();
    // A solve that finishes the stage gets a bigger moment.
    if (s.solved && stageDone(state.stage)) { burst({ big: true }); playSound("stage"); toast("✓", "Stage complete", W.stages[state.stage].title); }
    var el = document.getElementById("fb-" + q.id);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- reveal ---------- */

  function revealView(st) {
    return h("div", null,
      h("p", { class: "tagline" }, "The answer, the reason, and the entry for the project file."),
      h("div", { class: "reveal-grid" }, st.questions.map(function (q) { return revealCard(q); })),
      st.num === 5 ? decisionConsequence(st.questions[0], true) : null,
      h("div", { class: "file-entry" }, h("h3", null, "Juma's project file, stage " + st.num), h("p", null, st.fileEntry))
    );
  }

  function revealCard(q) {
    var s = qState(q.id);
    var mark = firstTry(q) ? "You got this first time." : s.solved ? "You got there after " + s.wrong.length + " wrong " + (s.wrong.length === 1 ? "try." : "tries.") : "You viewed the answer.";
    if (qType(q) === "slider") return h("div", { class: "reveal-card" },
      h("span", { class: "reveal-letter", "aria-hidden": "true" }, String(q.answer)),
      h("p", { class: "reveal-answer" }, "About " + q.answer + (q.unit || "")),
      h("h3", null, "Why"), h("p", null, q.feedback), h("p", { class: "muted small" }, mark));
    if (qType(q) === "order") return h("div", { class: "reveal-card" },
      h("span", { class: "reveal-letter", "aria-hidden": "true" }, "≡"),
      h("ol", { class: "reveal-order" }, q.sequence.map(function (t) { return h("li", null, t); })),
      h("h3", null, "Why"), h("p", null, q.feedback), h("p", { class: "muted small" }, mark));
    var o = q.options.filter(function (x) { return x.key === q.answer; })[0];
    return h("div", { class: "reveal-card" },
      h("span", { class: "reveal-letter", "aria-hidden": "true" }, q.answer.toUpperCase()),
      h("p", { class: "reveal-answer" }, h("span", { class: "sr-only" }, "Answer " + q.answer.toUpperCase() + ": "), o.text),
      h("h3", null, "Why"), h("p", null, o.feedback), h("p", { class: "muted small" }, mark));
  }

  // Branching consequence for the decision (feature 8).
  function decisionConsequence(q, inReveal) {
    if (!q || !q.options) return null;
    var s = qState(q.id);
    if (!(s.solved || s.shown)) return null;
    var picked = s.solved ? q.answer : null;
    var right = q.options.filter(function (o) { return o.key === q.answer; })[0];
    var others = q.options.filter(function (o) { return o.key !== q.answer && o.outcome; });
    return h("div", { class: "consequence" + (inReveal ? " in-reveal" : "") },
      h("h3", null, "🌱 What happens next"),
      h("p", { class: "consequence-good" }, right.outcome),
      h("details", { class: "history" }, h("summary", null, "What if you had decided differently?"),
        others.map(function (o) { return h("p", null, h("strong", null, o.text.split(":")[0] + ". "), o.outcome); })));
  }

  /* ---------- project file ---------- */

  function projectFile(full) {
    var entries = W.stages.map(function (s, i) {
      var ok = stageDone(i);
      var isNew = ok && lastFilled && !lastFilled[i];
      return h("li", { class: (ok ? "filled" : "empty") + (isNew ? " just-filled" : "") },
        h("span", { class: "entry-num", "aria-hidden": "true" }, ok ? "✓" : String(s.num)),
        h("div", null, h("h4", null, s.title), h("p", null, ok ? s.fileEntry : "Complete stage " + s.num + " to add this entry.")));
    });
    var anyDone = W.stages.some(function (_, i) { return stageDone(i); });
    return h("aside", { class: "file" + (full ? " file-full" : ""), "aria-label": "Juma's project file" },
      h("div", { class: "file-head" }, img("juma.png", "", "avatar-sm"), h("h2", null, "Juma's project file")),
      h("ol", { class: "entries" }, entries),
      h("button", { class: "btn btn-quiet small", type: "button", disabled: !anyDone, onclick: downloadFile }, "Download as text"));
  }

  function downloadFile() {
    var xp = xpInfo();
    var lines = ["Juma's project file", W.title, "Tuma verification redesign", ""];
    W.stages.forEach(function (s, i) {
      lines.push(s.num + ". " + s.title);
      lines.push(stageDone(i) ? s.fileEntry : "(not completed yet)");
      lines.push("");
    });
    lines.push("Score: " + firstTryCount() + " of " + ALL_QUESTIONS.length + " correct on the first try");
    lines.push("XP: " + xp.points + " (" + ERP.rankForXP(xp.points) + "), best streak " + xp.streak.best);
    lines.push("Badges: " + ERP.earnedBadges(badgeCtx()).length + " of " + ERP.BADGES.length);
    lines.push("Lesson: " + W.closing.lesson);
    try {
      var blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = h("a", { href: url, download: "juma-project-file.txt" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    } catch (e) { window.alert("Your browser blocked the download. Use your browser's print option to save this page instead."); }
  }

  /* ---------- experiment lab / simulator (feature 1) ---------- */

  var lab = { baseline: 55, lift: 6, n: 1500, runs: [] };

  function labView() {
    return h("section", { class: "lab" },
      h("h1", { id: "main-heading", tabindex: "-1" }, "🧪 The Experiment Lab"),
      h("p", { class: "lede dark" }, W.lab.intro),
      h("div", { class: "lab-grid" },
        h("div", { class: "lab-controls panel-dark" },
          labSlider("baseline", "Baseline verify rate", lab.baseline, 30, 70, 1, "%"),
          labSlider("lift", "True lift the new flow has", lab.lift, 0, 15, 1, " pts"),
          labSlider("n", "Users per arm", lab.n, 100, 8000, 100, ""),
          h("div", { class: "lab-actions" },
            h("button", { class: "btn btn-primary", type: "button", onclick: runExperiment }, "▶ Run one experiment"),
            h("button", { class: "btn btn-ghost-light", type: "button", onclick: function () { lab.runs = []; render(); } }, "Clear runs"))
        ),
        h("div", { class: "lab-panel" }, labReadout(), labViz(), labRunsSummary())
      ),
      h("p", { class: "muted small" }, W.lab.note),
      navRow(
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { go({ screen: state.started ? (allDone() ? "finish" : "stage") : "home" }); } }, "Back to the project"),
        null)
    );
  }

  function labSlider(key, label, val, min, max, step, unit) {
    return h("div", { class: "lab-field" },
      h("label", { for: "lab-" + key }, label, h("span", { class: "lab-num", id: "labn-" + key }, String(val) + unit)),
      h("input", { type: "range", class: "slider-range light", id: "lab-" + key, min: String(min), max: String(max), step: String(step), value: String(val),
        oninput: function (e) { lab[key] = parseInt(e.target.value, 10);
          var out = document.getElementById("labn-" + key); if (out) out.textContent = String(lab[key]) + unit;
          refreshLabPanel(); } }));
  }

  function labStats() {
    var p1 = lab.baseline / 100, p2 = (lab.baseline + lab.lift) / 100;
    p2 = Math.min(0.999, p2);
    return {
      p1: p1, p2: p2,
      req: ERP.requiredSamplePerArm(p1, p2),
      power: ERP.abPower(p1, p2, lab.n),
      st: ERP.abStats(p1, p2, lab.n)
    };
  }

  function labReadout() {
    var s = labStats();
    var powered = lab.n >= s.req;
    return h("div", { class: "lab-readout", id: "lab-readout" },
      h("div", { class: "lab-stat" }, h("span", { class: "lab-stat-num" }, s.req === Infinity ? "∞" : String(s.req)),
        h("span", null, "needed per arm for 80% power")),
      h("div", { class: "lab-stat" }, h("span", { class: "lab-stat-num" }, Math.round(s.power * 100) + "%"),
        h("span", null, "power at " + lab.n + " per arm")),
      h("div", { class: "lab-badge " + (powered ? "ok" : "warn") }, powered ? "✓ Big enough to see this lift" : "⚠ Underpowered — a real lift may hide"));
  }

  function labViz() {
    var s = labStats();
    var span = 16; // percentage points shown either side of zero
    var W2 = 100; // viewBox units
    function x(pct) { return ERP.clamp((pct / span) * (W2 / 2) + W2 / 2, 2, W2 - 2); }
    var truePts = lab.lift;
    var kids = [];
    kids.push(h("line", { x1: String(x(0)), y1: "6", x2: String(x(0)), y2: "84", class: "viz-zero" }));
    kids.push(h("text", { x: String(x(0)), y: "96", class: "viz-tick" }, "0"));
    kids.push(h("line", { x1: String(x(truePts)), y1: "6", x2: String(x(truePts)), y2: "84", class: "viz-true" }));
    kids.push(h("text", { x: String(ERP.clamp(x(truePts), 8, W2 - 8)), y: "96", class: "viz-tick true" }, "true +" + truePts));
    // Each run: a dot at the observed diff with a 95% CI whisker.
    lab.runs.slice(-8).forEach(function (r, i) {
      var y = 14 + i * 8;
      var lo = x(r.lo * 100), hi = x(r.hi * 100), c = x(r.diff * 100);
      kids.push(h("line", { x1: String(lo), y1: String(y), x2: String(hi), y2: String(y), class: "viz-ci " + (r.sig ? "sig" : "ns") }));
      kids.push(h("circle", { cx: String(c), cy: String(y), r: "1.6", class: "viz-dot " + (r.sig ? "sig" : "ns") }));
    });
    return h("div", { class: "lab-viz", id: "lab-viz" },
      h("svg", { viewBox: "0 0 100 100", class: "viz-svg", role: "img", "aria-label": "Number line of observed effects with confidence intervals" }, kids),
      h("div", { class: "viz-key" },
        h("span", null, h("i", { class: "k-true" }), " true effect"),
        h("span", null, h("i", { class: "k-sig" }), " significant run"),
        h("span", null, h("i", { class: "k-ns" }), " not significant")));
  }

  function labRunsSummary() {
    var n = lab.runs.length;
    var sig = lab.runs.filter(function (r) { return r.sig; }).length;
    return h("p", { class: "lab-runs muted small", id: "lab-runs" },
      n === 0 ? "No runs yet. Hit “Run one experiment” a few times and watch the read move while the truth stays put."
        : sig + " of " + n + " runs came back significant. " + (lab.lift === 0 ? "With a true lift of zero, every “significant” run is a false positive — that is the 5% talking." : "Same true lift every time; the wobble is sampling noise."));
  }

  function refreshLabPanel() {
    var r = document.getElementById("lab-readout"); if (r) { var nr = labReadout(); r.parentNode.replaceChild(nr, r); }
    var v = document.getElementById("lab-viz"); if (v) { var nv = labViz(); v.parentNode.replaceChild(nv, v); }
    var u = document.getElementById("lab-runs"); if (u) { var nu = labRunsSummary(); u.parentNode.replaceChild(nu, u); }
  }

  function runExperiment() {
    var s = labStats();
    // Observed arm rates: true rate plus normal sampling error.
    var ph1 = s.p1 + gauss() * Math.sqrt(s.p1 * (1 - s.p1) / lab.n);
    var ph2 = s.p2 + gauss() * Math.sqrt(s.p2 * (1 - s.p2) / lab.n);
    ph1 = ERP.clamp(ph1, 0, 1); ph2 = ERP.clamp(ph2, 0, 1);
    var obs = ERP.abStats(ph1, ph2, lab.n);
    lab.runs.push({ diff: obs.diff, lo: obs.lo, hi: obs.hi, sig: obs.significant });
    if (!state.labUsed) { state.labUsed = true; saveState(); }
    refreshLabPanel();
    playSound(obs.significant ? "correct" : "wrong");
    syncBadges();
  }

  // Box-Muller standard normal. Math.random is available in the browser.
  function gauss() {
    var u = 1 - Math.random(), v = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- finish ---------- */

  function finishView() {
    var score = firstTryCount(), total = ALL_QUESTIONS.length, xp = xpInfo();
    updateRecords(xp);
    if (!state.finishCelebrated) { state.finishCelebrated = true; saveState(); setTimeout(function () { burst({ big: true }); playSound("stage"); }, 250); }
    var decisionRight = firstTry(ALL_QUESTIONS.filter(function (q) { return q.id === "q7"; })[0] || {});
    var msg = score === total ? "Every question right on the first try. You think like an analyst the head of product can trust."
      : score >= total - 2 ? "Strong work. Reread the reveals for the questions that took more than one try."
      : "You finished the project. Go back through the stages where you needed extra tries; the feedback on each wrong option is the lesson.";

    return h("section", null,
      h("h1", { id: "main-heading", tabindex: "-1" }, "By 5pm: Juma's project file"),
      h("p", { class: "lede dark" }, "From 'onboarding is broken' to 'ship it, here is the number'. Five entries, one for each stage you worked through."),
      scoreBoard(score, total, xp, msg),
      badgeShelf(),
      shareBlock(score, total, xp),
      h("div", { class: "epilogue" }, h("h2", null, "The epilogue"), h("p", null, decisionRight ? W.closing.epilogueGood : W.closing.epilogueBad)),
      projectFile(true),
      matchActivity(),
      h("div", { class: "lesson" }, h("h2", null, "The lesson Juma filed"), h("p", null, W.closing.lesson)),
      navRow(
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { go({ screen: "stage", stage: W.stages.length - 1, step: 3 }); } }, "Back to stage 5"),
        h("button", { class: "btn btn-quiet", type: "button", onclick: resetAll }, "Start over"))
    );
  }

  function scoreBoard(score, total, xp, msg) {
    var rec = state.records;
    return h("div", { class: "score" },
      h("div", { class: "score-main" },
        h("p", { class: "score-num" }, String(xp.points), h("span", null, " XP")),
        h("div", null, h("h2", null, ERP.rankForXP(xp.points)), h("p", null, msg))),
      h("ul", { class: "score-stats" },
        h("li", null, h("strong", null, score + " / " + total), h("span", null, "first try")),
        h("li", null, h("strong", null, String(xp.streak.best)), h("span", null, "best streak")),
        h("li", null, h("strong", null, ERP.earnedBadges(badgeCtx()).length + " / " + ERP.BADGES.length), h("span", null, "badges")),
        state.settings.challenge && state.finishedAt ? h("li", null, h("strong", null, fmtTime(state.finishedAt - state.startedAt)), h("span", null, "challenge time" + (rec.bestTimeMs ? " (best " + fmtTime(rec.bestTimeMs) + ")" : ""))) : null
      ));
  }

  function badgeShelf() {
    var earned = ERP.earnedBadges(badgeCtx());
    return h("div", { class: "badges" },
      h("h2", null, "Badges (" + earned.length + " of " + ERP.BADGES.length + ")"),
      h("ul", { class: "badge-grid" }, ERP.BADGES.map(function (b) {
        var got = earned.indexOf(b.id) >= 0;
        return h("li", { class: "badge-card" + (got ? " got" : " locked"), title: b.desc },
          h("span", { class: "badge-ico", "aria-hidden": "true" }, got ? b.icon : "🔒"),
          h("span", { class: "badge-name" }, b.title),
          h("span", { class: "badge-desc" }, b.desc),
          h("span", { class: "sr-only" }, got ? "unlocked" : "locked"));
      })));
  }

  function updateRecords(xp) {
    var r = state.records, changed = false;
    if (firstTryCount() > r.bestScore) { r.bestScore = firstTryCount(); changed = true; }
    if (xp.streak.best > r.bestStreak) { r.bestStreak = xp.streak.best; changed = true; }
    if (state.settings.challenge && state.finishedAt && state.startedAt) {
      var t = state.finishedAt - state.startedAt;
      if (t > 0 && (!r.bestTimeMs || t < r.bestTimeMs)) { r.bestTimeMs = t; changed = true; }
      if (!state.challengeCompleted) { state.challengeCompleted = true; changed = true; }
    }
    if (changed) saveState();
  }

  /* ---------- share card (feature 9) ---------- */

  function shareBlock(score, total, xp) {
    var wrap = h("div", { class: "share" },
      h("h2", null, "Share your result"),
      h("p", { class: "muted" }, "Make a card and post it to the meetup WhatsApp group."),
      h("label", { class: "share-name" }, "Your name (optional)",
        h("input", { type: "text", value: state.playerName || "", maxlength: "24", placeholder: "e.g. Amina",
          oninput: function (e) { state.playerName = e.target.value.slice(0, 24); saveState(); } })),
      h("div", { class: "share-preview", id: "share-preview" }),
      h("div", { class: "share-actions" },
        h("button", { class: "btn btn-primary", type: "button", id: "share-go", onclick: function () { shareCard(score, total, xp); } }, "📤 Share…"),
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { downloadCard(score, total, xp); } }, "⬇ Download card"),
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { whatsappText(score, total, xp); } }, "WhatsApp text"))
    );
    // Draw the preview after it mounts.
    setTimeout(function () { drawCard(document.getElementById("share-preview"), score, total, xp, true); }, 0);
    return wrap;
  }

  function cardCanvas(score, total, xp) {
    var c = document.createElement("canvas");
    c.width = 1080; c.height = 1080;
    var g = c.getContext("2d");
    // Background
    g.fillStyle = "#0c3532"; g.fillRect(0, 0, 1080, 1080);
    g.fillStyle = "#0f423d"; g.fillRect(0, 0, 1080, 250);
    // Accent bar
    g.fillStyle = "#e2a12e"; g.fillRect(0, 250, 1080, 8);
    g.textBaseline = "top";
    g.fillStyle = "#d8e6e3";
    g.font = "600 34px Georgia, serif";
    g.fillText("Experimental Research Project", 70, 78);
    g.fillStyle = "#ffffff";
    g.font = "700 60px Georgia, serif";
    g.fillText(ERP.rankForXP(xp.points), 70, 128);
    // Name
    var name = (state.playerName || "").trim();
    g.fillStyle = "#e2a12e";
    g.font = "700 46px Georgia, serif";
    g.fillText(name ? name : "A Tuma analyst", 70, 300);
    // Big XP
    g.fillStyle = "#ffffff";
    g.font = "800 190px Georgia, serif";
    g.fillText(String(xp.points), 70, 360);
    g.fillStyle = "#9fc3bd";
    g.font = "600 46px Georgia, serif";
    var xpw = g.measureText(String(xp.points)).width;
    g.fillText("XP", 70 + xpw + 24, 490);
    // Stat row
    var stats = [[score + "/" + total, "first try"], [String(xp.streak.best), "best streak"], [ERP.earnedBadges(badgeCtx()).length + "/" + ERP.BADGES.length, "badges"]];
    var bx = 70, bw = 300, by = 640;
    stats.forEach(function (st, i) {
      var x = bx + i * (bw + 20);
      g.fillStyle = "#12433e"; roundRect(g, x, by, bw, 150, 18); g.fill();
      g.fillStyle = "#ffffff"; g.font = "800 64px Georgia, serif"; g.fillText(st[0], x + 28, by + 24);
      g.fillStyle = "#9fc3bd"; g.font = "600 30px Georgia, serif"; g.fillText(st[1], x + 28, by + 100);
    });
    // Badges earned (emoji row)
    var earned = ERP.earnedBadges(badgeCtx()).map(function (id) { return ERP.badgeById(id); }).filter(Boolean);
    g.font = "64px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    earned.slice(0, 10).forEach(function (b, i) { g.fillText(b.icon, 70 + i * 92, 840); });
    // Footer
    g.fillStyle = "#9fc3bd"; g.font = "600 30px Georgia, serif";
    g.fillText("Set the bar in shillings before the test, not in points after it.", 70, 980);
    g.fillStyle = "#6f948e"; g.font = "500 26px Georgia, serif";
    g.fillText("Experimental Design & A/B Testing · Nairobi meetup", 70, 1024);
    return c;
  }

  function roundRect(g, x, y, w, h2, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h2, r); g.arcTo(x + w, y + h2, x, y + h2, r);
    g.arcTo(x, y + h2, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawCard(host, score, total, xp, preview) {
    if (!host) return;
    var c = cardCanvas(score, total, xp);
    host.textContent = "";
    if (preview) { c.style.width = "100%"; c.style.height = "auto"; c.setAttribute("role", "img"); c.setAttribute("aria-label", "Your result card, " + xp.points + " XP"); }
    host.appendChild(c);
    return c;
  }

  function cardBlob(score, total, xp) {
    return new Promise(function (resolve) {
      var c = cardCanvas(score, total, xp);
      if (c.toBlob) c.toBlob(function (b) { resolve(b); }, "image/png");
      else resolve(dataURLtoBlob(c.toDataURL("image/png")));
    });
  }
  function dataURLtoBlob(u) {
    var parts = u.split(","), bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: "image/png" });
  }

  function shareCard(score, total, xp) {
    cardBlob(score, total, xp).then(function (blob) {
      var file = new File([blob], "my-result.png", { type: "image/png" });
      var text = shareText(score, total, xp);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "My Experimental Research result", text: text })
          .catch(function () { /* user dismissed */ });
      } else {
        // No file-share support (most desktops): download the card and open WhatsApp text.
        triggerDownload(blob, "experimental-research-result.png");
        toast("⬇", "Card downloaded", "Attach it in WhatsApp");
        setTimeout(function () { window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"); }, 400);
      }
    });
  }

  function downloadCard(score, total, xp) {
    cardBlob(score, total, xp).then(function (blob) { triggerDownload(blob, "experimental-research-result.png"); toast("⬇", "Saved", "Result card (PNG)"); });
  }

  function whatsappText(score, total, xp) {
    window.open("https://wa.me/?text=" + encodeURIComponent(shareText(score, total, xp)), "_blank");
  }

  function shareText(score, total, xp) {
    var name = (state.playerName || "").trim();
    return (name ? name + " — " : "") + "I finished the Experimental Research Project as " + ERP.rankForXP(xp.points) +
      " with " + xp.points + " XP, " + score + "/" + total + " first-try, best streak " + xp.streak.best + ". #ABtesting";
  }

  function triggerDownload(blob, name) {
    try {
      var url = URL.createObjectURL(blob);
      var a = h("a", { href: url, download: name });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    } catch (e) { window.alert("Download blocked by the browser."); }
  }

  /* ---------- matching, drag and drop (feature 5) ---------- */

  function matchActivity() {
    var items = matchItems();
    var placedCount = items.filter(function (_, i) { return state.match[i]; }).length;
    var allPlaced = placedCount === items.length;
    var correct = items.filter(function (it, i) { return String(state.match[i]) === String(it.stage); }).length;

    // Pool: question chips not yet placed.
    var pool = h("div", { class: "match-pool", "aria-label": "Unplaced questions",
      ondragover: function (e) { e.preventDefault(); this.classList.add("drop-hint"); },
      ondragleave: function () { this.classList.remove("drop-hint"); },
      ondrop: function (e) { e.preventDefault(); this.classList.remove("drop-hint"); var qi = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(qi)) { delete state.match[qi]; state.matchChecked = false; saveState(); render(); } } },
      items.map(function (it, i) { return state.match[i] ? null : chip(i, it); }).filter(Boolean).length
        ? items.map(function (it, i) { return state.match[i] ? null : chip(i, it); })
        : h("p", { class: "muted small pool-empty" }, "All placed. Check your matches, or drag a chip back here to change it."));

    var slots = h("ol", { class: "match-slots" }, W.stages.map(function (stg) {
      var qi = items.reduce(function (acc, it, i) { return String(state.match[i]) === String(stg.num) ? i : acc; }, -1);
      var checked = state.matchChecked;
      var placed = qi >= 0;
      var right = checked && placed && String(items[qi].stage) === String(stg.num);
      var wrong = checked && placed && !right;
      return h("li", { class: "match-slot" + (right ? " is-right" : "") + (wrong ? " is-wrong" : ""),
        ondragover: function (e) { e.preventDefault(); this.classList.add("drop-hint"); },
        ondragleave: function () { this.classList.remove("drop-hint"); },
        ondrop: function (e) { e.preventDefault(); this.classList.remove("drop-hint"); dropOnStage(e, stg.num); },
        onclick: function () { if (state.matchSel !== null && state.matchSel !== undefined) placeSel(stg.num); } },
        h("div", { class: "slot-head" }, h("span", { class: "slot-num" }, String(stg.num)), h("span", { class: "slot-title" }, stg.title)),
        placed ? chip(qi, items[qi], true) : h("span", { class: "slot-empty" }, "Drop a question here, or select one then click here"),
        checked && placed ? h("p", { class: "match-fb" }, right ? "Correct." : "This one belongs to stage " + items[qi].stage + ".") : null
      );
    }));

    return h("div", { class: "match" + (state.matchChecked ? " is-checked" : "") },
      h("h2", null, "Final check: five questions to ask of your next experiment"),
      h("p", null, "Drag each question onto the stage it belongs to (or tap a question, then tap a stage). If any one of these has no written answer, that is the work to do before anything is built."),
      h("div", { class: "match-board" }, pool, slots),
      h("div", { class: "q-actions" },
        h("button", { class: "btn btn-primary", type: "button", disabled: !allPlaced,
          onclick: function () { state.matchChecked = true; saveState(); pendingFocus = "match-result"; render();
            if (matchAllCorrect()) { burst({ big: true }); playSound("stage"); } else playSound("wrong"); syncBadges(); } }, "Check matches"),
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { state.match = {}; state.matchSel = null; state.matchChecked = false; saveState(); render(); } }, "Reset"),
        !allPlaced ? h("span", { class: "hint" }, "Place every question first." ) : null),
      h("div", { id: "match-result", tabindex: "-1", "aria-live": "polite" },
        state.matchChecked ? h("div", { class: "feedback " + (correct === items.length ? "ok" : "bad") },
          h("p", { class: "fb-title" }, correct === items.length ? "All five matched." : correct + " of " + items.length + " matched."),
          h("p", null, correct === items.length ? "You have the checklist for your next experiment." : "Move the ones marked wrong and check again.")) : null));
  }

  function chip(qi, it, placed) {
    var selected = state.matchSel === qi;
    return h("button", { type: "button", class: "match-chip" + (placed ? " is-placed" : "") + (selected ? " is-sel" : ""),
      draggable: true, "aria-pressed": String(selected),
      ondragstart: function (e) { e.dataTransfer.setData("text/plain", String(qi)); e.dataTransfer.effectAllowed = "move"; this.classList.add("dragging"); },
      ondragend: function () { this.classList.remove("dragging"); },
      onclick: function (e) { e.stopPropagation(); state.matchSel = selected ? null : qi; saveState(); render(); } },
      h("span", { class: "chip-grip", "aria-hidden": "true" }, "≡"), it.text);
  }

  function dropOnStage(e, stageNum) {
    var qi = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(qi)) return;
    assignMatch(qi, stageNum);
  }
  function placeSel(stageNum) {
    if (state.matchSel === null || state.matchSel === undefined) return;
    assignMatch(state.matchSel, stageNum);
    state.matchSel = null;
  }
  function assignMatch(qi, stageNum) {
    var items = matchItems();
    // One chip per slot: evict whoever currently sits in this stage.
    items.forEach(function (_, i) { if (String(state.match[i]) === String(stageNum)) delete state.match[i]; });
    state.match[qi] = stageNum;
    state.matchChecked = false;
    saveState(); render();
  }

  /* ---------- celebrations: confetti, toast, sound (feature 4) ---------- */

  function burst(opts) {
    if (prefersReducedMotion() || state.settings.reduceViz) return;
    opts = opts || {};
    var canvas = document.getElementById("fx-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "fx-canvas";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
    }
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    var g = canvas.getContext("2d");
    var colors = ["#e2a12e", "#2f7e76", "#1b7446", "#ffffff", "#145a54"];
    var count = opts.big ? 130 : 60;
    var cx = window.innerWidth / 2, cy = opts.big ? window.innerHeight * 0.32 : window.innerHeight * 0.28;
    var parts = [];
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2, spd = 4 + Math.random() * (opts.big ? 11 : 8);
      parts.push({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 3,
        g: 0.22 + Math.random() * 0.12, s: 5 + Math.random() * 6, r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length], life: 1 });
    }
    var start = null, dur = opts.big ? 1500 : 1100;
    function frame(t) {
      if (start === null) start = t;
      var p = (t - start) / dur;
      g.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(function (o) {
        o.vy += o.g; o.x += o.vx; o.y += o.vy; o.r += o.vr; o.life = 1 - p;
        g.save(); g.globalAlpha = Math.max(0, o.life); g.translate(o.x, o.y); g.rotate(o.r);
        g.fillStyle = o.c; g.fillRect(-o.s / 2, -o.s / 2, o.s, o.s * 0.6); g.restore();
      });
      if (p < 1) requestAnimationFrame(frame);
      else { g.clearRect(0, 0, canvas.width, canvas.height); }
    }
    requestAnimationFrame(frame);
  }

  function toast(icon, kicker, title) {
    var host = document.getElementById("toasts");
    if (!host) { host = h("div", { id: "toasts", "aria-live": "polite" }); document.body.appendChild(host); }
    var el = h("div", { class: "toast" },
      h("span", { class: "toast-ico", "aria-hidden": "true" }, icon),
      h("span", null, h("span", { class: "toast-kicker" }, kicker), h("span", { class: "toast-title" }, title)));
    host.appendChild(el);
    if (prefersReducedMotion()) { setTimeout(function () { el.remove(); }, 3200); return; }
    requestAnimationFrame(function () { el.classList.add("in"); });
    setTimeout(function () { el.classList.remove("in"); setTimeout(function () { el.remove(); }, 300); }, 3000);
  }

  var audioCtx = null;
  function playSound(type) {
    if (!state.settings.sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      var seq = {
        correct: [[660, 0], [880, 0.09]],
        great: [[660, 0], [880, 0.08], [1174, 0.16]],
        stage: [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.32]],
        badge: [[784, 0], [1046, 0.12]],
        wrong: [[220, 0], [180, 0.12]]
      }[type] || [[660, 0]];
      seq.forEach(function (n) {
        var o = audioCtx.createOscillator(), gn = audioCtx.createGain();
        o.type = "triangle"; o.frequency.value = n[0];
        var t0 = audioCtx.currentTime + n[1];
        gn.gain.setValueAtTime(0.0001, t0);
        gn.gain.exponentialRampToValueAtTime(0.13, t0 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(gn); gn.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.24);
      });
    } catch (e) { /* audio not available */ }
  }

  /* ---------- challenge timer (feature 10) ---------- */

  var timerId = null;
  function elapsedMs() {
    if (!state.startedAt) return 0;
    return (state.finishedAt || Date.now()) - state.startedAt;
  }
  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60); s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function ensureTimer() {
    var running = state.settings.challenge && state.startedAt && !state.finishedAt;
    if (running && !timerId) {
      timerId = window.setInterval(function () {
        var el = document.getElementById("hud-time");
        if (el) el.textContent = fmtTime(elapsedMs());
      }, 1000);
    } else if (!running && timerId) { window.clearInterval(timerId); timerId = null; }
  }

  /* ---------- misc ---------- */

  function navRow(a, b) { return h("div", { class: "nav-row" }, a, b); }

  function resetAll() {
    if (!window.confirm("Start over? This clears your answers, points and badges in this browser.")) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    var keepChallenge = state.settings.challenge, keepSound = state.settings.sound;
    state = freshState();
    state.settings.challenge = keepChallenge; state.settings.sound = keepSound;
    lastFilled = null; lastXP = 0;
    go({ screen: "home", stage: 0, step: 0 });
  }

  sanitizeLocation();
  render();
})();
