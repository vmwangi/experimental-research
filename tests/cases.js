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

  // Deterministic PRNG (mulberry32) so property tests are reproducible.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function forAll(n, seed, fn) { var r = mulberry32(seed); for (var i = 0; i < n; i++) fn(r, i); }
  function ri(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function rf(r, lo, hi) { return lo + r() * (hi - lo); }
  function rankTier(name) { return ["Analyst in Training", "Junior Analyst", "Product Analyst", "Senior Analyst", "Head of Insight"].indexOf(name); }

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
      eq(n, 9, "question count"); eq(W.stages.length, 5, "stage count"); } },

    /* ============ property-based tests: thousands of random cases ============ */

    { name: "PROPERTY: shuffle is always a permutation (2000 cases)", run: function (ERP) {
      forAll(2000, 1, function (r) {
        var len = ri(r, 1, 8), arr = [];
        for (var k = 0; k < len; k++) arr.push("k" + k);
        var out = ERP.shuffle(arr, r);
        eq(out.length, arr.length, "length preserved");
        var a = arr.slice().sort(), b = out.slice().sort();
        for (var i = 0; i < a.length; i++) ok(a[i] === b[i], "same multiset");
      });
    } },

    { name: "PROPERTY: shuffle covers every position and can reorder", run: function (ERP) {
      var seen = { a: {}, b: {}, c: {}, d: {} }, nonIdentity = false;
      forAll(4000, 7, function (r) {
        var out = ERP.shuffle(["a", "b", "c", "d"], r);
        out.forEach(function (key, pos) { seen[key][pos] = true; });
        if (out.join("") !== "abcd") nonIdentity = true;
      });
      ok(nonIdentity, "produced at least one reordering");
      ["a", "b", "c", "d"].forEach(function (key) {
        for (var p = 0; p < 4; p++) ok(seen[key][p], key + " never landed in position " + p);
      });
    } },

    { name: "PROPERTY: questionXP stays in [0,200] and honours the rules (3000 cases)", run: function (ERP) {
      var wagers = [null, "hunch", "confident", "certain"];
      forAll(3000, 11, function (r) {
        var solved = r() < 0.7, shown = !solved && r() < 0.4, wrongN = ri(r, 0, 4);
        var wrong = []; for (var k = 0; k < wrongN; k++) wrong.push("x" + k);
        var wager = wagers[ri(r, 0, 3)];
        var xp = ERP.questionXP({ solved: solved, shown: shown, wrong: wrong }, wager);
        ok(!isNaN(xp), "not NaN"); ok(xp >= 0, "non-negative"); ok(xp <= 200, "at most 200");
        if (shown || !solved) eq(xp, 0, "no points unless solved without a reveal");
        if (solved && wrongN === 0 && !shown) {
          if (!wager || wager === "hunch") eq(xp, 100, "clean first try = 100");
          if (wager === "confident") eq(xp, 150, "confident clean = 150");
          if (wager === "certain") eq(xp, 200, "certain clean = 200");
        }
      });
    } },

    { name: "PROPERTY: more wrong tries never increases XP (1500 cases)", run: function (ERP) {
      var wagers = [null, "hunch", "confident", "certain"];
      forAll(1500, 21, function (r) {
        var wager = wagers[ri(r, 0, 3)], base = ri(r, 0, 3);
        var lo = ERP.questionXP({ solved: true, wrong: mk(base) }, wager);
        var hi = ERP.questionXP({ solved: true, wrong: mk(base + 1) }, wager);
        ok(hi <= lo, "extra wrong try did not raise XP (" + hi + " > " + lo + ")");
      });
      function mk(n) { var a = []; for (var i = 0; i < n; i++) a.push("w" + i); return a; }
    } },

    { name: "PROPERTY: streakInfo invariants hold (2000 random flag lists)", run: function (ERP) {
      forAll(2000, 33, function (r) {
        var len = ri(r, 0, 14), flags = [];
        for (var k = 0; k < len; k++) flags.push({ resolved: r() < 0.85, firstTry: r() < 0.6 });
        var si = ERP.streakInfo(flags);
        ok(si.current >= 0 && si.best >= 0 && si.bonus >= 0, "non-negative");
        ok(si.current <= si.best, "current <= best");
        ok(si.best <= len, "best <= length");
        ok(si.bonus % 25 === 0, "bonus is a multiple of 25");
        // independent reference
        var run = 0, best = 0, bonus = 0, cur = 0;
        flags.forEach(function (f) { if (!f.resolved) return; if (f.firstTry) { run++; if (run >= 2) bonus += 25; } else run = 0; cur = run; if (run > best) best = run; });
        eq(si.current, cur, "current matches reference"); eq(si.best, best, "best matches"); eq(si.bonus, bonus, "bonus matches");
      });
    } },

    { name: "PROPERTY: requiredSamplePerArm is positive, symmetric, shrinks with effect (2000 cases)", run: function (ERP) {
      forAll(2000, 44, function (r) {
        var p1 = rf(r, 0.05, 0.9), e1 = rf(r, 0.01, 0.05), e2 = e1 + rf(r, 0.01, 0.05);
        var p2a = Math.min(0.98, p1 + e1), p2b = Math.min(0.98, p1 + e2);
        var small = ERP.requiredSamplePerArm(p1, p2a), big = ERP.requiredSamplePerArm(p1, p2b);
        ok(small > 0 && small === Math.floor(small), "positive integer");
        eq(ERP.requiredSamplePerArm(p1, p2a), ERP.requiredSamplePerArm(p2a, p1), "symmetric");
        ok(big <= small, "bigger effect needs no more sample (" + big + " > " + small + ")");
        eq(ERP.requiredSamplePerArm(p1, p1), Infinity, "zero effect => infinite");
      });
    } },

    { name: "PROPERTY: abStats CI brackets the diff and tightens with n (2000 cases)", run: function (ERP) {
      forAll(2000, 55, function (r) {
        var p1 = rf(r, 0.05, 0.95), p2 = rf(r, 0.05, 0.95), n1 = ri(r, 50, 8000), n2 = n1 + ri(r, 100, 8000);
        var s = ERP.abStats(p1, p2, n1);
        ok(s.lo <= s.diff + 1e-9 && s.diff <= s.hi + 1e-9, "CI brackets the point estimate");
        ok(s.half >= 0, "half-width non-negative");
        eq(s.significant, s.lo > 0 || s.hi < 0, "significance matches the interval");
        var s2 = ERP.abStats(p1, p2, n2);
        ok(s2.half <= s.half + 1e-12, "more sample => tighter interval");
      });
    } },

    { name: "PROPERTY: abPower in [0,1], rising with n and with effect (1500 cases)", run: function (ERP) {
      forAll(1500, 66, function (r) {
        var p1 = rf(r, 0.1, 0.8), eff = rf(r, 0.02, 0.15), p2 = Math.min(0.97, p1 + eff), n = ri(r, 200, 6000);
        var pw = ERP.abPower(p1, p2, n);
        ok(pw >= 0 && pw <= 1, "power is a probability");
        ok(ERP.abPower(p1, p2, n + 1500) >= pw - 1e-9, "more n, more power");
        var p2b = Math.min(0.98, p1 + eff + 0.03);
        ok(ERP.abPower(p1, p2b, n) >= pw - 1e-9, "bigger effect, more power");
      });
    } },

    { name: "PROPERTY: at the required sample, power is about 80% (500 cases)", run: function (ERP) {
      forAll(500, 77, function (r) {
        var p1 = rf(r, 0.1, 0.8), eff = rf(r, 0.03, 0.12), p2 = Math.min(0.97, p1 + eff);
        var need = ERP.requiredSamplePerArm(p1, p2);
        var pw = ERP.abPower(p1, p2, need);
        ok(pw >= 0.75 && pw <= 0.9, "power near 0.8 at required n, got " + pw.toFixed(3));
      });
    } },

    { name: "PROPERTY: normCdf is monotone, bounded and symmetric (1000 cases)", run: function (ERP) {
      forAll(1000, 88, function (r) {
        var x = rf(r, -4, 4), d = rf(r, 0.01, 2);
        var a = ERP.normCdf(x), b = ERP.normCdf(x + d);
        ok(a > 0 && a < 1, "in (0,1)");
        ok(b >= a - 1e-9, "monotone increasing");
        near(ERP.normCdf(-x), 1 - ERP.normCdf(x), 2e-3, "symmetric");
      });
    } },

    { name: "PROPERTY: sliderHint agrees with sliderCorrect and points the right way (2000 cases)", run: function (ERP) {
      forAll(2000, 99, function (r) {
        var ans = ri(r, 100, 6000), tol = ri(r, 50, 500), val = ri(r, 0, 8000);
        var hint = ERP.sliderHint(val, ans, tol), correct = ERP.sliderCorrect(val, ans, tol);
        eq(hint === "correct", correct, "hint 'correct' iff within tolerance");
        if (!correct) {
          if (val > ans) ok(hint === "high" || hint === "closeHigh", "over-estimate points high");
          if (val < ans) ok(hint === "low" || hint === "closeLow", "under-estimate points low");
        }
      });
    } },

    { name: "PROPERTY: orderCorrect true only for the identity permutation (2000 cases)", run: function (ERP) {
      forAll(2000, 101, function (r) {
        var n = ri(r, 2, 6), perm = ERP.shuffle(seq(n), r);
        var identity = perm.every(function (v, i) { return v === i; });
        eq(ERP.orderCorrect(perm, n), identity, "matches identity check");
      });
      ok(ERP.orderCorrect(seq(5), 5), "identity is correct");
      function seq(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
    } },

    { name: "PROPERTY: rankForXP never decreases as XP rises (1000 sorted cases)", run: function (ERP) {
      forAll(1000, 111, function (r) {
        var lo = ri(r, 0, 2000), hi = lo + ri(r, 0, 500);
        var a = rankTier(ERP.rankForXP(lo)), b = rankTier(ERP.rankForXP(hi));
        ok(a >= 0 && b >= 0, "rank is a known tier");
        ok(b >= a, "higher XP never gives a lower rank");
      });
    } },

    { name: "PROPERTY: earning the Lab badge only adds badges, never removes (1000 cases)", run: function (ERP) {
      forAll(1000, 122, function (r) {
        var ctx = { resolved: ri(r, 0, 9), total: 9, firstTry: ri(r, 0, 9), anyShown: r() < 0.5, anyComeback: r() < 0.5,
          cleanStage: r() < 0.5, certainWin: r() < 0.5, allDone: r() < 0.5, perfectMatch: r() < 0.5, challengeDone: r() < 0.5, labUsed: false };
        var before = ERP.earnedBadges(ctx);
        ctx.labUsed = true;
        var after = ERP.earnedBadges(ctx);
        before.forEach(function (id) { ok(after.indexOf(id) >= 0, "badge " + id + " must not disappear"); });
        ok(after.indexOf("experimenter") >= 0, "lab badge now present");
      });
    } },

    { name: "PROPERTY: a flawless finish always implies the finisher badge (1000 cases)", run: function (ERP) {
      forAll(1000, 133, function (r) {
        var ctx = { resolved: 9, total: 9, firstTry: ri(r, 0, 9), anyShown: r() < 0.5, allDone: r() < 0.7,
          anyComeback: r() < 0.5, cleanStage: r() < 0.5, certainWin: r() < 0.5, labUsed: r() < 0.5, perfectMatch: r() < 0.5, challengeDone: r() < 0.5 };
        var e = ERP.earnedBadges(ctx);
        if (e.indexOf("flawless") >= 0) ok(e.indexOf("finisher") >= 0, "flawless implies finished");
        if (e.indexOf("no-hints") >= 0) ok(e.indexOf("finisher") >= 0, "no-hints implies finished");
      });
    } }
  ];
});
