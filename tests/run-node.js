/* Node test runner: node tests/run-node.js
   Loads the same logic.js the browser uses, shims window for data.js, and runs
   the shared cases in tests/cases.js. Exits non-zero on any failure. */
"use strict";
var path = require("path");

// data.js assigns to window.WORKSHOP; give it a window to write to.
global.window = global;
require(path.join(__dirname, "..", "assets", "data.js"));
var ERP = require(path.join(__dirname, "..", "assets", "logic.js"));
var WORKSHOP = global.window.WORKSHOP;
var cases = require(path.join(__dirname, "cases.js"));

var pass = 0, fail = 0;
cases.forEach(function (c) {
  try {
    c.run(ERP, WORKSHOP);
    pass++;
    console.log("  ✓ " + c.name);
  } catch (e) {
    fail++;
    console.log("  ✗ " + c.name + "\n      " + e.message);
  }
});

console.log("\n" + pass + " passed, " + fail + " failed, " + cases.length + " total");
process.exit(fail ? 1 : 0);
