var errs = [];
var origError = console.error;
console.error = function() {
  errs.push(Array.from(arguments).map(String).join(' '));
  origError.apply(console, arguments);
};
window.addEventListener('error', function(e) {
  errs.push('[ERROR] ' + e.message + ' @ ' + (e.filename||'') + ':' + e.lineno + ':' + e.colno);
});
window.addEventListener('unhandledrejection', function(e) {
  errs.push('[REJECTION] ' + (e.reason && e.reason.stack || e.reason && e.reason.message || String(e.reason)));
});
setTimeout(function() {
  document.title = 'CAP:' + JSON.stringify(errs);
}, 5000);
