/* Experimental Research Project: self-paced activity.
   Plain JavaScript, no build step, no external libraries. */
(function () {
  "use strict";

  var W = window.WORKSHOP;
  var root = document.getElementById("app");
  if (!W || !root) {
    if (root) root.textContent = "The activity content failed to load. Check that assets/data.js is in the repository.";
    return;
  }

  var STORAGE_KEY = "erp-activity-v1";
  var STEPS = [
    { id: "learn", label: "Learn" },
    { id: "watch", label: "Watch Juma" },
    { id: "turn", label: "Your turn" },
    { id: "reveal", label: "Reveal" }
  ];
  var MAX_WRONG_BEFORE_HELP = 2;
  var ALL_QUESTIONS = [];
  W.stages.forEach(function (s) { s.questions.forEach(function (q) { ALL_QUESTIONS.push(q); }); });

  /* ---------- state ---------- */

  function freshState() {
    return { v: 1, started: false, screen: "home", stage: 0, step: 0, q: {}, match: {}, matchChecked: false };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || typeof s !== "object") return freshState();
      var base = freshState();
      Object.keys(base).forEach(function (k) { if (s[k] === undefined || s[k] === null) s[k] = base[k]; });
      if (["home", "setting", "stage", "finish"].indexOf(s.screen) < 0) s.screen = "home";
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
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode or storage full: progress simply is not kept */ }
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  var state = loadState();
  var pendingFocus = null;

  // Read-only view of a question's state; does not create an entry.
  function qState(id) {
    var s = state.q[id];
    if (!s || typeof s !== "object") return { wrong: [], solved: false, shown: false, sel: null };
    if (!Array.isArray(s.wrong)) s.wrong = [];
    return s;
  }
  // Writable state for a question; creates the entry when the learner interacts.
  function qStateW(id) {
    if (!state.q[id] || typeof state.q[id] !== "object") state.q[id] = { wrong: [], solved: false, shown: false, sel: null };
    return qState(id);
  }
  function resolved(q) { var s = qState(q.id); return s.solved || s.shown; }
  function stageDone(i) { return W.stages[i].questions.every(resolved); }
  function stageUnlocked(i) { return i === 0 || stageDone(i - 1); }
  function allDone() { return W.stages.every(function (_, i) { return stageDone(i); }); }
  function resolvedCount() { return ALL_QUESTIONS.filter(resolved).length; }
  function firstTryCount() {
    return ALL_QUESTIONS.filter(function (q) { var s = qState(q.id); return s.solved && !s.shown && s.wrong.length === 0; }).length;
  }

  // Never land on a locked stage or step (e.g. after editing data or stale storage).
  function sanitizeLocation() {
    if (state.screen === "stage") {
      while (state.stage > 0 && !stageUnlocked(state.stage)) { state.stage--; state.step = 0; }
      if (state.step === 3 && !stageDone(state.stage)) state.step = 2;
    }
    if (state.screen === "finish" && !allDone()) { state.screen = "stage"; }
  }

  /* ---------- navigation with transitions ---------- */

  var LEAVE_MS = 170;
  var busy = false;
  var lastPercent = 0;
  var lastFilled = null;     // stages whose file entry was filled at the previous render
  var freshFeedback = null;  // question id whose feedback should animate in

  // Linear position of a location, used to pick the slide direction.
  function position(s) {
    if (s.screen === "home") return 0;
    if (s.screen === "setting") return 1;
    if (s.screen === "finish") return 1000;
    return 2 + s.stage * STEPS.length + s.step;
  }

  function go(patch, focusId) {
    if (busy) return;
    var before = position(state);
    var beforeKey = state.screen + ":" + state.stage + ":" + state.step;
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    sanitizeLocation();
    saveState();
    var moved = beforeKey !== state.screen + ":" + state.stage + ":" + state.step;
    pendingFocus = focusId || (moved ? "main-heading" : null);
    if (!moved) { render(); return; }

    var dir = position(state) >= before ? "fwd" : "back";
    var main = document.getElementById("main");
    if (prefersReducedMotion() || !main) {
      render();
      window.scrollTo(0, 0);
      return;
    }
    busy = true;
    main.classList.add("is-leaving", "leave-" + dir);
    var file = document.querySelector(".layout .file");
    var fileStays = file && state.screen === "stage";
    if (file && !fileStays) file.classList.add("is-leaving", "leave-" + dir);
    setTimeout(function () {
      render(dir);
      window.scrollTo(0, 0);
      busy = false;
    }, LEAVE_MS);
  }

  /* ---------- DOM helper ---------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
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
    return h("img", {
      src: "assets/img/" + file, alt: alt || "", class: cls || null, loading: "lazy",
      onerror: function () { this.style.display = "none"; }
    });
  }

  /* ---------- layout ---------- */

  function render(enterDir) {
    var hadFile = !!document.querySelector(".layout .file");
    root.textContent = "";
    root.appendChild(header());
    var layout = h("div", { class: "layout" + (state.screen === "stage" ? " with-file" : "") });
    var main = h("main", { class: "main" + (enterDir ? " enter-" + enterDir : ""), id: "main" });
    if (state.screen === "home") main.appendChild(homeView());
    else if (state.screen === "setting") main.appendChild(settingView());
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
    lastFilled = W.stages.map(function (_, i) { return stageDone(i); });
    freshFeedback = null;
    if (enterDir) {
      // Clean up the entrance class so later re-renders of the same page do not replay it.
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
  }

  function animateMeter() {
    var fill = document.getElementById("meter-fill");
    if (!fill) return;
    var target = parseInt(fill.getAttribute("data-target"), 10) || 0;
    lastPercent = target;
    if (prefersReducedMotion()) { fill.style.width = target + "%"; return; }
    // Force layout at the old width, then move to the new width so the CSS transition runs.
    void fill.offsetWidth;
    requestAnimationFrame(function () { fill.style.width = target + "%"; });
  }

  function header() {
    var done = resolvedCount(), total = ALL_QUESTIONS.length;
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
      }, h("span", { class: "pill-num" }, stageDone(i) ? "\u2713" : String(s.num)), h("span", { class: "pill-label" }, s.title)));
    });
    return h("header", { class: "top" },
      h("div", { class: "top-inner" },
        h("button", { class: "brand", type: "button", onclick: function () { go({ screen: "home" }); } }, W.title),
        h("nav", { "aria-label": "Stages" }, h("ol", { class: "pills" }, pills)),
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
            started ? h("button", { class: "btn btn-ghost-light", type: "button", onclick: resetAll }, "Start over") : null
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
          h("li", null, h("strong", null, "Your turn."), " The same stage on the verification redesign. Pick the best option and check it; you get feedback on every choice."),
          h("li", null, h("strong", null, "Reveal."), " The answer, the reason, and the entry for Juma's project file.")
        ),
        h("p", null, "Every question has one best option. The other three are the mistakes analysts actually make. No calculation is needed; where numbers appear, the question is about the shape of the answer. Seven questions in all. Your progress is saved in this browser, so you can stop and come back."),
        h("h2", null, "The five stages"),
        stagesList
      )
    );
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
      var locked = i === 3 && !done;
      var current = state.step === i;
      return h("div", { role: "listitem" }, h("button", {
        type: "button", class: "step" + (current ? " is-current" : ""), disabled: locked,
        "aria-current": current ? "step" : null,
        onclick: function () { go({ step: i }); }
      }, h("span", { class: "step-num" }, String(i + 1)), step.label, locked ? h("span", { class: "sr-only" }, " (answer the questions first)") : null));
    }));

    var body;
    if (state.step === 0) body = learnView(st);
    else if (state.step === 1) body = watchView(st);
    else if (state.step === 2) body = turnView(st);
    else body = revealView(st);

    var isLastStage = state.stage === W.stages.length - 1;
    var nextBtn;
    if (state.step < 2) {
      nextBtn = h("button", { class: "btn btn-primary", type: "button", onclick: function () { go({ step: state.step + 1 }); } }, "Next: " + STEPS[state.step + 1].label);
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
      ? h("button", { class: "btn btn-quiet", type: "button", onclick: function () { go({ step: state.step - 1 }); } }, "Back")
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
      tabs,
      body,
      navRow(backBtn, nextBtn)
    );
  }

  function learnView(st) {
    return h("div", { class: "grid-2" },
      h("div", null,
        h("p", { class: "tagline" }, st.tagline),
        st.learn.map(function (p) { return h("p", null, h("strong", null, p[0]), " " + p[1]); }),
        h("div", { class: "failure" }, h("h3", null, "The failure this prevents"), h("p", null, st.failure))
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

  function turnView(st) {
    return h("div", null,
      h("p", { class: "tagline" }, "The verification redesign. Choose the best option, then check your answer."),
      st.questions.map(function (q, i) { return questionCard(q, i, st.questions.length); })
    );
  }

  function questionCard(q, idx, count) {
    var s = qStateW(q.id);
    var done = s.solved || s.shown;
    var correctOpt = q.options.filter(function (o) { return o.key === q.answer; })[0];
    var lastWrong = s.wrong.length ? s.wrong[s.wrong.length - 1] : null;
    var name = "opt-" + q.id;
    var fbId = "fb-" + q.id;

    var opts = h("div", { class: "options", role: "radiogroup", "aria-labelledby": "prompt-" + q.id, "aria-describedby": fbId },
      q.options.map(function (o) {
        var isWrong = s.wrong.indexOf(o.key) >= 0;
        var isRight = done && o.key === q.answer;
        var cls = "option" + (isWrong ? " is-wrong" : "") + (isRight ? " is-right" : "") + (s.sel === o.key && !done && !isWrong ? " is-selected" : "");
        var inputId = name + "-" + o.key;
        return h("label", { class: cls, for: inputId },
          h("input", {
            type: "radio", name: name, id: inputId, value: o.key,
            checked: s.sel === o.key && !isWrong, disabled: done || isWrong,
            onchange: function () { s.sel = o.key; saveState(); selectInPlace(q, o.key); }
          }),
          h("span", { class: "opt-key", "aria-hidden": "true" }, isRight ? "\u2713" : isWrong ? "\u2715" : o.key),
          h("span", { class: "opt-text" }, h("span", { class: "sr-only" }, "Option " + o.key + ". "), o.text, isWrong ? h("span", { class: "sr-only" }, " (incorrect)") : null, isRight ? h("span", { class: "sr-only" }, " (correct)") : null)
        );
      })
    );

    var fb = h("div", { class: "feedback-wrap" + (freshFeedback === q.id ? " is-fresh" : ""), id: fbId, "aria-live": "polite" });
    if (s.solved) {
      fb.appendChild(h("div", { class: "feedback ok" },
        h("p", { class: "fb-title" }, s.wrong.length === 0 ? "Correct, first time." : "Correct."),
        h("p", null, correctOpt.feedback)));
    } else if (s.shown) {
      fb.appendChild(h("div", { class: "feedback info" },
        h("p", { class: "fb-title" }, "The best option is " + q.answer.toUpperCase() + "."),
        h("p", null, correctOpt.feedback)));
    } else if (lastWrong) {
      var wo = q.options.filter(function (o) { return o.key === lastWrong; })[0];
      fb.appendChild(h("div", { class: "feedback bad" },
        h("p", { class: "fb-title" }, "Not quite. Option " + lastWrong.toUpperCase() + " is one of the common mistakes."),
        h("p", null, wo ? wo.feedback : ""),
        h("p", { class: "fb-next" }, "Try another option.")));
    }

    var controls = null;
    if (!done) {
      controls = h("div", { class: "q-actions" },
        h("button", {
          class: "btn btn-primary", type: "button", id: "check-" + q.id, disabled: !s.sel,
          onclick: function () { checkAnswer(q); }
        }, "Check answer"),
        s.wrong.length >= MAX_WRONG_BEFORE_HELP ? h("button", {
          class: "btn btn-quiet", type: "button",
          onclick: function () { s.shown = true; s.sel = q.answer; saveState(); pendingFocus = fbId; freshFeedback = q.id; render(); }
        }, "Show me the answer") : null,
        !s.sel ? h("span", { class: "hint" }, "Select an option first.") : null
      );
    }

    // Earlier wrong answers stay listed so the learner can reread each explanation.
    var history = null;
    if (s.wrong.length > (s.solved || s.shown ? 0 : 1)) {
      var shownWrong = (s.solved || s.shown) ? s.wrong : s.wrong.slice(0, -1);
      history = h("details", { class: "history" },
        h("summary", null, "Why the other options you tried are wrong"),
        shownWrong.map(function (k) {
          var o = q.options.filter(function (x) { return x.key === k; })[0];
          return o ? h("p", null, h("strong", null, k.toUpperCase() + ". "), o.feedback) : null;
        })
      );
    }
    var others = null;
    if (done) {
      var untried = q.options.filter(function (o) { return o.key !== q.answer && s.wrong.indexOf(o.key) < 0; });
      if (untried.length) {
        others = h("details", { class: "history" },
          h("summary", null, "Why the options you did not pick are wrong"),
          untried.map(function (o) { return h("p", null, h("strong", null, o.key.toUpperCase() + ". "), o.feedback); })
        );
      }
    }

    return h("article", { class: "question" + (done ? " is-done" : "") + (freshFeedback === q.id ? " is-fresh" : "") },
      h("div", { class: "desk" },
        h("div", null,
          h("h3", null, "On Juma's desk"),
          h("p", null, q.desk)
        ),
        q.image ? img(q.image, "", "desk-art") : null
      ),
      h("div", { class: "q-body" },
        h("p", { class: "kicker" }, "Question " + (ALL_QUESTIONS.indexOf(q) + 1) + " of " + ALL_QUESTIONS.length + (count > 1 ? " (" + (idx + 1) + " of " + count + " in this stage)" : "")),
        h("h2", { id: "prompt-" + q.id, class: "prompt" }, q.prompt),
        opts, controls, fb, history, others
      )
    );
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
    if (btn) {
      btn.disabled = false;
      var hint = btn.parentNode.querySelector(".hint");
      if (hint) hint.remove();
    }
  }

  function checkAnswer(q) {
    var s = qStateW(q.id);
    if (!s.sel || s.solved || s.shown) return;
    if (s.sel === q.answer) {
      s.solved = true;
    } else if (s.wrong.indexOf(s.sel) < 0) {
      s.wrong.push(s.sel);
      s.sel = null;
    }
    saveState();
    pendingFocus = "fb-" + q.id;
    freshFeedback = q.id;
    render();
    var el = document.getElementById("fb-" + q.id);
    if (el) { el.setAttribute("tabindex", "-1"); if (el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" }); }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function revealView(st) {
    return h("div", null,
      h("p", { class: "tagline" }, "The answer, the reason, and the entry for the project file."),
      h("div", { class: "reveal-grid" }, st.questions.map(function (q) {
        var o = q.options.filter(function (x) { return x.key === q.answer; })[0];
        var s = qState(q.id);
        var mark = s.solved && s.wrong.length === 0 && !s.shown ? "You got this first time." : s.solved ? "You got there after " + s.wrong.length + " wrong " + (s.wrong.length === 1 ? "try." : "tries.") : "You viewed the answer.";
        return h("div", { class: "reveal-card" },
          h("span", { class: "reveal-letter", "aria-hidden": "true" }, q.answer.toUpperCase()),
          h("p", { class: "reveal-answer" }, h("span", { class: "sr-only" }, "Answer " + q.answer.toUpperCase() + ": "), o.text),
          h("h3", null, "Why"),
          h("p", null, o.feedback),
          h("p", { class: "muted small" }, mark)
        );
      })),
      h("div", { class: "file-entry" },
        h("h3", null, "Juma's project file, stage " + st.num),
        h("p", null, st.fileEntry)
      )
    );
  }

  /* ---------- project file ---------- */

  function projectFile(full) {
    var entries = W.stages.map(function (s, i) {
      var ok = stageDone(i);
      var isNew = ok && lastFilled && !lastFilled[i];
      return h("li", { class: (ok ? "filled" : "empty") + (isNew ? " just-filled" : "") },
        h("span", { class: "entry-num", "aria-hidden": "true" }, ok ? "\u2713" : String(s.num)),
        h("div", null,
          h("h4", null, s.title),
          h("p", null, ok ? s.fileEntry : "Complete stage " + s.num + " to add this entry.")
        )
      );
    });
    var anyDone = W.stages.some(function (_, i) { return stageDone(i); });
    return h("aside", { class: "file" + (full ? " file-full" : ""), "aria-label": "Juma's project file" },
      h("div", { class: "file-head" }, img("juma.png", "", "avatar-sm"), h("h2", null, "Juma's project file")),
      h("ol", { class: "entries" }, entries),
      h("button", { class: "btn btn-quiet small", type: "button", disabled: !anyDone, onclick: downloadFile }, "Download as text")
    );
  }

  function downloadFile() {
    var lines = ["Juma's project file", W.title, "Tuma verification redesign", ""];
    W.stages.forEach(function (s, i) {
      lines.push(s.num + ". " + s.title);
      lines.push(stageDone(i) ? s.fileEntry : "(not completed yet)");
      lines.push("");
    });
    lines.push("Score: " + firstTryCount() + " of " + ALL_QUESTIONS.length + " correct on the first try");
    lines.push("Lesson: " + W.closing.lesson);
    try {
      var blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = h("a", { href: url, download: "juma-project-file.txt" });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    } catch (e) {
      window.alert("Your browser blocked the download. Use your browser's print option to save this page instead.");
    }
  }

  /* ---------- finish ---------- */

  function finishView() {
    var score = firstTryCount(), total = ALL_QUESTIONS.length;
    var msg = score === total ? "Every question right on the first try. You think like an analyst the head of product can trust."
      : score >= 5 ? "Strong work. Reread the reveals for the questions that took more than one try."
      : "You finished the project. Go back through the stages where you needed extra tries; the feedback on each wrong option is the lesson.";

    return h("section", null,
      h("h1", { id: "main-heading", tabindex: "-1" }, "By 5pm: Juma's project file"),
      h("p", { class: "lede dark" }, "From 'onboarding is broken' to 'ship it, here is the number'. Five entries, one for each stage you worked through."),
      h("div", { class: "score" },
        h("p", { class: "score-num" }, String(score), h("span", null, " / " + total)),
        h("div", null, h("h2", null, "Correct on the first try"), h("p", null, msg))
      ),
      projectFile(true),
      matchActivity(),
      h("div", { class: "lesson" }, h("h2", null, "The lesson Juma filed"), h("p", null, W.closing.lesson)),
      navRow(
        h("button", { class: "btn btn-quiet", type: "button", onclick: function () { go({ screen: "stage", stage: W.stages.length - 1, step: 3 }); } }, "Back to stage 5"),
        h("button", { class: "btn btn-quiet", type: "button", onclick: resetAll }, "Start over")
      )
    );
  }

  function matchActivity() {
    var items = W.closing.match;
    // Fixed shuffled order so the list does not mirror the stage order.
    var order = [2, 4, 0, 3, 1].filter(function (i) { return i < items.length; });
    items.forEach(function (_, i) { if (order.indexOf(i) < 0) order.push(i); });
    var allChosen = order.every(function (i) { return state.match[i]; });
    var correct = order.filter(function (i) { return String(state.match[i]) === String(items[i].stage); }).length;

    var rows = order.map(function (i, n) {
      var it = items[i];
      var chosen = state.match[i] ? String(state.match[i]) : "";
      var checked = state.matchChecked;
      var right = checked && chosen === String(it.stage);
      var selId = "match-" + i;
      var sel = h("select", {
        id: selId, class: "match-select",
        onchange: function (e) { state.match[i] = e.target.value; state.matchChecked = false; saveState(); pendingFocus = selId; render(); }
      },
        h("option", { value: "", selected: !chosen }, "Choose a stage"),
        W.stages.map(function (s) { return h("option", { value: String(s.num), selected: chosen === String(s.num) }, s.num + ". " + s.title); })
      );
      return h("li", { class: "match-row" + (checked ? (right ? " is-right" : " is-wrong") : "") },
        h("label", { for: selId }, h("span", { class: "match-n" }, String(n + 1) + "."), it.text),
        sel,
        checked ? h("p", { class: "match-fb" }, right ? "Correct." : "Not quite. This question belongs to stage " + it.stage + ", " + W.stages[it.stage - 1].title.toLowerCase() + ".") : null
      );
    });

    return h("div", { class: "match" },
      h("h2", null, "Final check: five questions to ask of your next experiment"),
      h("p", null, "Match each question to the stage it belongs to. If any one of these has no written answer, that is the work to do before anything is built."),
      h("ol", { class: "match-list" }, rows),
      h("div", { class: "q-actions" },
        h("button", { class: "btn btn-primary", type: "button", id: "match-check", disabled: !allChosen, onclick: function () { state.matchChecked = true; saveState(); pendingFocus = "match-result"; render(); var r = document.querySelector(".match"); if (r) r.classList.add("is-checked"); } }, "Check matches"),
        !allChosen ? h("span", { class: "hint" }, "Choose a stage for every question first.") : null
      ),
      h("div", { id: "match-result", tabindex: "-1", "aria-live": "polite" },
        state.matchChecked ? h("div", { class: "feedback " + (correct === items.length ? "ok" : "bad") },
          h("p", { class: "fb-title" }, correct === items.length ? "All five matched." : correct + " of " + items.length + " matched."),
          h("p", null, correct === items.length ? "You have the checklist for your next experiment." : "Change the ones marked wrong and check again.")
        ) : null
      )
    );
  }

  /* ---------- misc ---------- */

  function navRow(a, b) { return h("div", { class: "nav-row" }, a, b); }

  function resetAll() {
    if (!window.confirm("Start over? This clears your answers and progress in this browser.")) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    var fresh = freshState();
    Object.keys(state).forEach(function (k) { if (k !== "screen" && k !== "stage" && k !== "step") state[k] = fresh[k]; });
    lastFilled = null;
    go({ screen: "home", stage: 0, step: 0 });
  }

  sanitizeLocation();
  render();
})();
