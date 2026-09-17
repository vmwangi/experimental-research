/* Shared test cases for the Experimental Research Project.
   Each case gets (ERP, WORKSHOP) and throws on failure. Runs under Node
   (tests/run-node.js) and in the browser (tests.html) from one source. */
(function (root, factory) {
  var cases = factory();
  if (typeof module === "object" && module.exports) module.exports = cases;
  root.ERP_CASES = cases;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function eq(a, b, msg) { if (a !== b) throw new Error((msg || "expected equal") + ": got " + a + ", wanted " + b); }
  function ok(c, msg) { if (!c) throw new Error(msg || "expected truthy"); }
  function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || "not near") + ": " + a + " vs " + b); }

  return [
    /* ---- scoring ---- */
    { name: "first-try correct scores full 100", run: function (ERP) {
      eq(ERP.questionXP({ solved: true, shown: false, wrong: [] }, null), 100); } },

    { name: "each wrong try lowers the score", run: function (ERP) {
      eq(ERP.questionXP({ solved: true, wrong: ["a"] }, null), 65);
      eq(ERP.questionXP({ solved: true, wrong: ["a", "b"] }, null), 30, "floor at 30"); } },

    { name: "revealing the answer scores zero", run: function (ERP) {
      eq(ERP.questionXP({ solved: false, shown: true, wrong: ["a", "b"] }, null), 0); } },

    { name: "unresolved question scores zero", run: function (ERP) {
      eq(ERP.questionXP({ solved: false, shown: false, wrong: [] }, null), 0); } },

    { name: "Certain wager doubles a first-try win", run: function (ERP) {
      eq(ERP.questionXP({ solved: true, wrong: [] }, "certain"), 200); } },

    { name: "Certain wager stings a miss by 20", run: function (ERP) {
      // base after one wrong = 65, minus 20 penalty = 45
      eq(ERP.questionXP({ solved: true, wrong: ["a"] }, "certain"), 45); } },

    { name: "wager multiplier only applies on a clean first try", run: function (ERP) {
      // confident (x1.5) but had a wrong try => no multiplier, base 65
      eq(ERP.questionXP({ solved: true, wrong: ["a"] }, "confident"), 65); } },

    /* ---- streaks ---- */
    { name: "streak counts consecutive first-try wins and bonus", run: function (ERP) {
      var si = ERP.streakInfo([
        { resolved: true, firstTry: true },
        { resolved: true, firstTry: true },
        { resolved: true, firstTry: true }
      ]);
      eq(si.current, 3, "current"); eq(si.best, 3, "best"); eq(si.bonus, 50, "bonus 25*2"); } },

    { name: "a wrong answer breaks the streak", run: function (ERP) {
      var si = ERP.streakInfo([
        { resolved: true, firstTry: true },
        { resolved: true, firstTry: false },
        { resolved: true, firstTry: true }
      ]);
      eq(si.current, 1); eq(si.best, 1); eq(si.bonus, 0); } },

    { name: "rank rises with XP", run: function (ERP) {
      eq(ERP.rankForXP(0), "Analyst in Training");
      eq(ERP.rankForXP(1600), "Head of Insight");
      ok(ERP.rankForXP(800) === "Product Analyst"); } },

    /* ---- new question types ---- */
    { name: "slider accepts values within tolerance", run: function (ERP) {
      ok(ERP.sliderCorrect(1550, 1550, 350));
      ok(ERP.sliderCorrect(1300, 1550, 350));
      ok(!ERP.sliderCorrect(900, 1550, 350)); } },

    { name: "slider hint points the right way", run: function (ERP) {
      eq(ERP.sliderHint(5000, 1550, 350), "high");
      eq(ERP.sliderHint(100, 1550, 350), "low");
      eq(ERP.sliderHint(1550, 1550, 350), "correct"); } },

    { name: "order is correct only when identity", run: function (ERP) {
      ok(ERP.orderCorrect([0, 1, 2, 3], 4));
      ok(!ERP.orderCorrect([1, 0, 2, 3], 4));
      ok(!ERP.orderCorrect([0, 1, 2], 4), "wrong length"); } },

    /* ---- simulator math ---- */
    { name: "required sample for 55% vs 60% is ~1550/arm", run: function (ERP) {
      near(ERP.requiredSamplePerArm(0.55, 0.60), 1550, 120, "sample size"); } },

    { name: "zero effect needs an infinite sample", run: function (ERP) {
      eq(ERP.requiredSamplePerArm(0.5, 0.5), Infinity); } },

    { name: "CI excludes zero when powered on a real effect", run: function (ERP) {
      var st = ERP.abStats(0.55, 0.62, 4000);
      ok(st.significant, "should be significant");
      ok(st.lo > 0, "lower bound above zero"); } },

    { name: "tiny sample cannot resolve a small effect", run: function (ERP) {
      var st = ERP.abStats(0.55, 0.56, 50);
      ok(!st.significant, "should not be significant"); } },

    { name: "power rises with sample size", run: function (ERP) {
      var lo = ERP.abPower(0.55, 0.60, 200);
      var hi = ERP.abPower(0.55, 0.60, 3000);
      ok(hi > lo, "more n, more power"); ok(hi > 0.8, "3000/arm well powered"); } },

    { name: "normCdf is calibrated at known points", run: function (ERP) {
      near(ERP.normCdf(0), 0.5, 0.001);
      near(ERP.normCdf(1.959964), 0.975, 0.002); } },

    /* ---- badges ---- */
    { name: "flawless badge needs every question first-try", run: function (ERP) {
      var base = { resolved: 9, total: 9, firstTry: 9, anyShown: false, allDone: true };
      ok(ERP.earnedBadges(base).indexOf("flawless") >= 0);
      base.firstTry = 8;
      ok(ERP.earnedBadges(base).indexOf("flawless") < 0); } },

    { name: "no-hints badge blocked by any reveal", run: function (ERP) {
      ok(ERP.earnedBadges({ allDone: true, anyShown: false }).indexOf("no-hints") >= 0);
      ok(ERP.earnedBadges({ allDone: true, anyShown: true }).indexOf("no-hints") < 0); } },

    { name: "lab badge unlocks from labUsed", run: function (ERP) {
      ok(ERP.earnedBadges({ labUsed: true }).indexOf("experimenter") >= 0); } },

    /* ---- content integrity (guards against data typos) ---- */
    { name: "every MCQ answer key exists in its options", run: function (ERP, W) {
      W.stages.forEach(function (s) { s.questions.forEach(function (q) {
        if (q.type) return;
        ok(q.options.some(function (o) { return o.key === q.answer; }), q.id + " answer not in options");
      }); }); } },

    { name: "every MCQ option has feedback", run: function (ERP, W) {
      W.stages.forEach(function (s) { s.questions.forEach(function (q) {
        if (q.type) return;
        q.options.forEach(function (o) { ok(o.feedback && o.feedback.length > 0, q.id + "/" + o.key + " missing feedback"); });
      }); }); } },

    { name: "ordering questions have a full shuffle permutation", run: function (ERP, W) {
      W.stages.forEach(function (s) { s.questions.forEach(function (q) {
        if (q.type !== "order") return;
        eq(q.shuffle.length, q.sequence.length, q.id + " shuffle length");
        var seen = q.shuffle.slice().sort(function (a, b) { return a - b; });
        seen.forEach(function (v, i) { eq(v, i, q.id + " shuffle is not a permutation"); });
      }); }); } },

    { name: "slider answer sits inside its own range", run: function (ERP, W) {
      W.stages.forEach(function (s) { s.questions.forEach(function (q) {
        if (q.type !== "slider") return;
        ok(q.answer >= q.min && q.answer <= q.max, q.id + " answer out of range");
      }); }); } },

    { name: "match items reference real stage numbers", run: function (ERP, W) {
      var nums = W.stages.map(function (s) { return s.num; });
      W.closing.match.forEach(function (it) { ok(nums.indexOf(it.stage) >= 0, "bad stage " + it.stage); }); } },

    { name: "decision options carry branching outcomes", run: function (ERP, W) {
      var q7 = null;
      W.stages.forEach(function (s) { s.questions.forEach(function (q) { if (q.id === "q7") q7 = q; }); });
      ok(q7, "q7 exists");
      q7.options.forEach(function (o) { ok(o.outcome && o.outcome.length > 0, "q7/" + o.key + " missing outcome"); }); } },

    { name: "there are nine gradable questions across five stages", run: function (ERP, W) {
      var n = 0; W.stages.forEach(function (s) { n += s.questions.length; });
      eq(n, 9, "question count"); eq(W.stages.length, 5, "stage count"); } }
  ];
});
