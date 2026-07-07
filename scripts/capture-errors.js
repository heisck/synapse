// Init script to capture errors from the very beginning
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
// Check after 5 seconds
setTimeout(function() {
  var body = document.body;
  body.style.border = '5px solid red';
  // Use title to communicate errors back
  document.title = 'ERRCAP:' + JSON.stringify(errs);
}, 5000);
