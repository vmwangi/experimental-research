/* Pure, DOM-free logic for the Experimental Research Project.
   Kept separate so the app and the test suite share exactly one implementation.
   Loads as window.ERP in the browser and as a CommonJS module under Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ERP = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Two-sided 5% significance, 80% power.
  var Z_ALPHA = 1.959964;
  var Z_POWER = 0.841621;

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function round(n) { return Math.round(n); }

  /* ---------- confidence wager (feature 7) ---------- */

  var WAGERS = [
    { id: "hunch", label: "Hunch", mult: 1, note: "A guess. Full marks if right, no sting if wrong." },
    { id: "confident", label: "Confident", mult: 1.5, note: "Fairly sure. Half again the points if you nail it first try." },
    { id: "certain", label: "Certain", mult: 2, note: "Double points if right first try, but a 20-point sting if wrong." }
  ];
  function wagerMult(id) {
    for (var i = 0; i < WAGERS.length; i++) if (WAGERS[i].id === id) return WAGERS[i].mult;
    return 1;
  }

  /* ---------- points / XP (feature 2) ----------
     qs: { solved:bool, shown:bool, wrong:[...] }. Pure: same input, same score. */
  function questionXP(qs, wager) {
    qs = qs || {};
    var wrong = (qs.wrong || []).length;
    if (qs.shown || !qs.solved) return 0;
    var base = wrong === 0 ? 100 : Math.max(30, 100 - 35 * wrong);
    var mult = wrong === 0 && wager ? wagerMult(wager) : 1;
    var penalty = wager === "certain" && wrong > 0 ? 20 : 0;
    return Math.max(0, round(base * mult) - penalty);
  }

  /* ---------- streaks (feature 2) ----------
     flags: ordered list of { resolved:bool, firstTry:bool } in play order.
     A streak is a run of first-try-correct answers; each extra one past the
     first adds a 25-point bonus. */
  function streakInfo(flags) {
    var run = 0, best = 0, bonus = 0, current = 0;
    (flags || []).forEach(function (f) {
      if (!f.resolved) return;
      if (f.firstTry) { run += 1; if (run >= 2) bonus += 25; }
      else run = 0;
      current = run;
      if (run > best) best = run;
    });
    return { current: current, best: best, bonus: bonus };
  }

  function rankForXP(total) {
    if (total >= 1600) return "Head of Insight";
    if (total >= 1150) return "Senior Analyst";
    if (total >= 700) return "Product Analyst";
    if (total >= 300) return "Junior Analyst";
    return "Analyst in Training";
  }

  /* ---------- answer checking for the new question types (feature 6) ---------- */

  function sliderCorrect(value, answer, tol) { return Math.abs(value - answer) <= tol; }
  function sliderHint(value, answer, tol) {
    if (sliderCorrect(value, answer, tol)) return "correct";
    if (Math.abs(value - answer) <= tol * 2.5) return value > answer ? "closeHigh" : "closeLow";
    return value > answer ? "high" : "low";
  }
  // order: array of item indices in the learner's current arrangement.
  function orderCorrect(order, n) {
    if (!order || order.length !== n) return false;
    for (var i = 0; i < n; i++) if (order[i] !== i) return false;
    return true;
  }

  /* ---------- A/B test simulator math (feature 1) ----------
     Proportions expressed as fractions (0.55), effects as fractions too. */
  function requiredSamplePerArm(p1, p2, zAlpha, zPower) {
    zAlpha = zAlpha == null ? Z_ALPHA : zAlpha;
    zPower = zPower == null ? Z_POWER : zPower;
    var diff = Math.abs(p2 - p1);
    if (diff === 0) return Infinity;
    var variance = p1 * (1 - p1) + p2 * (1 - p2);
    return Math.ceil(Math.pow(zAlpha + zPower, 2) * variance / (diff * diff));
  }
  function abStats(p1, p2, nPerArm) {
    var se = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / nPerArm);
    var diff = p2 - p1;
    var half = Z_ALPHA * se;
    var lo = diff - half, hi = diff + half;
    return { se: se, diff: diff, half: half, lo: lo, hi: hi, significant: lo > 0 || hi < 0 };
  }
  // Approximate two-sided power to detect the true effect at the given n.
  function abPower(p1, p2, nPerArm) {
    var diff = Math.abs(p2 - p1);
    if (diff === 0) return 0.05;
    var se = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / nPerArm);
    if (se === 0) return 1;
    return clamp(normCdf(diff / se - Z_ALPHA), 0, 1);
  }
  function normCdf(x) {
    // Abramowitz & Stegun 7.1.26 approximation of the standard normal CDF.
    var t = 1 / (1 + 0.2316419 * Math.abs(x));
    var d = 0.3989422804014327 * Math.exp(-x * x / 2);
    var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1 - p : p;
  }

  /* ---------- badges (feature 3) ----------
     Each test() takes a plain ctx object the app assembles from its state, so
     the predicates stay pure and testable. */
  var BADGES = [
    { id: "first-blood", icon: "🎯", title: "First Read", desc: "Answered your first question.",
      test: function (c) { return c.resolved >= 1; } },
    { id: "comeback", icon: "🔁", title: "Comeback", desc: "Got a question right after a wrong turn.",
      test: function (c) { return c.anyComeback; } },
    { id: "clean-stage", icon: "✨", title: "Clean Sweep", desc: "Cleared a whole stage with no wrong answers.",
      test: function (c) { return c.cleanStage; } },
    { id: "high-roller", icon: "🎲", title: "High Roller", desc: "Won a question you were Certain about.",
      test: function (c) { return c.certainWin; } },
    { id: "experimenter", icon: "🧪", title: "Experimenter", desc: "Ran a test in the Lab.",
      test: function (c) { return c.labUsed; } },
    { id: "no-hints", icon: "👓", title: "No Peeking", desc: "Finished without revealing a single answer.",
      test: function (c) { return c.allDone && !c.anyShown; } },
    { id: "flawless", icon: "🏅", title: "Flawless", desc: "Every question right on the first try.",
      test: function (c) { return c.allDone && c.firstTry === c.total; } },
    { id: "perfect-match", icon: "🧩", title: "Perfect Match", desc: "Matched all five closing questions.",
      test: function (c) { return c.perfectMatch; } },
    { id: "challenge", icon: "⚡", title: "Beat the Clock", desc: "Finished a run in Challenge mode.",
      test: function (c) { return c.challengeDone; } },
    { id: "finisher", icon: "📁", title: "Signed Off", desc: "Completed Juma's whole project file.",
      test: function (c) { return c.allDone; } }
  ];
  function earnedBadges(ctx) {
    return BADGES.filter(function (b) { try { return b.test(ctx); } catch (e) { return false; } }).map(function (b) { return b.id; });
  }
  function badgeById(id) {
    for (var i = 0; i < BADGES.length; i++) if (BADGES[i].id === id) return BADGES[i];
    return null;
  }

  return {
    WAGERS: WAGERS, wagerMult: wagerMult,
    questionXP: questionXP, streakInfo: streakInfo, rankForXP: rankForXP,
    sliderCorrect: sliderCorrect, sliderHint: sliderHint, orderCorrect: orderCorrect,
    requiredSamplePerArm: requiredSamplePerArm, abStats: abStats, abPower: abPower, normCdf: normCdf,
    BADGES: BADGES, earnedBadges: earnedBadges, badgeById: badgeById,
    Z_ALPHA: Z_ALPHA, Z_POWER: Z_POWER, clamp: clamp
  };
});
