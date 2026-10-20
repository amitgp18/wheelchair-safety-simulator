// Run the logic tests in a terminal:  node tests/run-node.js
var vm = require('vm');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var ctx = vm.createContext({ console: console });
['js/config.js', 'js/structures.js', 'js/safety.js', 'js/simulation.js', 'js/scenarios.js', 'tests/tests.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
var results = vm.runInContext('WC.runTests()', ctx);
var failed = 0;
results.forEach(function (r) {
  if (!r.pass) { failed++; }
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name);
});
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
