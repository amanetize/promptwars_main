// Single shared DOM-escaping helper, loaded before every other script so
// app.js / coach.js / charts.js all use one definition instead of each
// relying on a copy defined in another file's global scope.
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}
