/* Runs before core-js. On iOS 8, core-js swaps many fast native methods for JavaScript versions (to add features
   like regex named groups and Symbol.species that p5 and these apps don't use); measured on the iPad minis, that made
   p5 calls several times slower. Save the natives here; shim-ios8.js (after core-js) puts them back. ES5 only. */
var __ios8natives = (function () {
  var saved = {}, list = {
    RegExp: ['exec', 'test'],
    String: ['split', 'replace', 'match', 'search', 'trim', 'indexOf', 'lastIndexOf', 'slice', 'substring', 'substr', 'toLowerCase', 'toUpperCase', 'charAt', 'charCodeAt'],
    Array: ['map', 'forEach', 'filter', 'indexOf', 'lastIndexOf', 'slice', 'splice', 'concat', 'join', 'push', 'pop', 'shift', 'unshift', 'some', 'every', 'reduce', 'reduceRight', 'sort', 'reverse'],
  };
  for (var c in list) for (var i = 0; i < list[c].length; i++) saved[c + '.' + list[c][i]] = window[c].prototype[list[c][i]];
  return saved;
})();
