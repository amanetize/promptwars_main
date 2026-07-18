// Mood is categorical, not a quantity, so this renders labeled chips (the
// mood name is always visible text, never color-only) rather than
// fabricating a bar height for data with no real magnitude. A text table
// alongside it is the required accessible fallback.
function renderMoodChart(containerEl, tableBodyEl, moodTrend) {
  containerEl.innerHTML = '';
  tableBodyEl.innerHTML = '';

  const chronological = [...moodTrend].reverse();
  for (const entry of chronological) {
    const chip = document.createElement('div');
    chip.className = 'mood-bar';
    chip.dataset.mood = entry.mood;
    chip.textContent = entry.mood;
    chip.title = `${entry.day}: ${entry.mood}`;
    containerEl.appendChild(chip);

    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(entry.day)}</td><td>${escapeHtml(entry.mood)}</td>`;
    tableBodyEl.appendChild(row);
  }
}
