// Must match MOOD_OPTIONS in src/habitTypes.js.
const MOOD_OPTIONS = ['calm', 'stressed', 'anxious', 'bored', 'happy', 'sad', 'angry', 'tired'];

const habitSelect = document.getElementById('habit-select');
const customLabelField = document.getElementById('custom-label-field');
const customLabelInput = document.getElementById('custom-label-input');

const logForm = document.getElementById('log-form');
const logValueInput = document.getElementById('log-value');
const logValueLabel = document.getElementById('log-value-label');
const logMoodSelect = document.getElementById('log-mood');
const logTriggerInput = document.getElementById('log-trigger');
const logNotesInput = document.getElementById('log-notes');
const logError = document.getElementById('log-error');
const logStatus = document.getElementById('log-status');

const progressEmpty = document.getElementById('progress-empty');
const progressStats = document.getElementById('progress-stats');
const moodChartWrapper = document.getElementById('mood-chart-wrapper');
const moodChartEl = document.getElementById('mood-chart');
const moodChartTableBody = document.querySelector('#mood-chart-table tbody');

const nudgeBtn = document.getElementById('nudge-btn');
const nudgeResult = document.getElementById('nudge-result');

const insightBtn = document.getElementById('insight-btn');
const insightResult = document.getElementById('insight-result');

const intentionsList = document.getElementById('intentions-list');
const intentionsForm = document.getElementById('intentions-form');
const intentionsError = document.getElementById('intentions-error');

const supportResourcesList = document.getElementById('support-resources-list');

let habitTypes = [];
let currentHabitType = null;

function getHabitTypeConfig(key) {
  return habitTypes.find((h) => h.key === key);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function populateMoodSelect() {
  for (const mood of MOOD_OPTIONS) {
    const option = document.createElement('option');
    option.value = mood;
    option.textContent = mood;
    logMoodSelect.appendChild(option);
  }
}

async function loadHabitTypes() {
  const data = await fetchJson('/api/habit-types');
  habitTypes = data.habitTypes;
  habitSelect.innerHTML = '';
  for (const habitType of habitTypes) {
    const option = document.createElement('option');
    option.value = habitType.key;
    option.textContent = habitType.label;
    habitSelect.appendChild(option);
  }
  currentHabitType = habitTypes[0].key;
  habitSelect.value = currentHabitType;
  onHabitChanged();
}

function onHabitChanged() {
  currentHabitType = habitSelect.value;
  const config = getHabitTypeConfig(currentHabitType);
  customLabelField.hidden = config.key !== 'custom';
  logValueLabel.textContent = config.valueLabel;
  clearResult(nudgeResult);
  clearResult(insightResult);
  refreshProgress();
  loadIntentions();
}

function clearResult(el) {
  el.innerHTML = '';
}

function renderProgress(state) {
  if (!state) {
    progressEmpty.hidden = false;
    progressStats.hidden = true;
    moodChartWrapper.hidden = true;
    return;
  }
  progressEmpty.hidden = true;
  progressStats.hidden = false;

  const stats = [
    ['Stage of change', state.stageOfChange],
    ['Completion rate', state.completionRate ? state.completionRate.label : 'Not tracked (custom habit)'],
    ['Current streak', `${state.currentRunDays} day(s)`],
    ['Top trigger', state.topTriggers[0]?.trigger || 'None logged yet'],
  ];
  progressStats.innerHTML = stats
    .map(([term, def]) => `<div><dt>${term}</dt><dd>${escapeHtml(def)}</dd></div>`)
    .join('');

  if (state.moodTrend.length > 0) {
    moodChartWrapper.hidden = false;
    renderMoodChart(moodChartEl, moodChartTableBody, state.moodTrend);
  } else {
    moodChartWrapper.hidden = true;
  }
}

async function refreshProgress() {
  try {
    const data = await fetchJson(`/api/state?habitType=${encodeURIComponent(currentHabitType)}`);
    renderProgress(data.state);
  } catch {
    progressEmpty.hidden = false;
    progressEmpty.textContent = 'Could not load progress right now.';
  }
}

logForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  logError.textContent = '';
  logStatus.textContent = '';

  const config = getHabitTypeConfig(currentHabitType);
  const payload = {
    habitType: currentHabitType,
    value: Number(logValueInput.value),
    mood: logMoodSelect.value || undefined,
    triggerTag: logTriggerInput.value.trim() || undefined,
    notes: logNotesInput.value.trim() || undefined,
  };
  if (config.key === 'custom') {
    payload.label = customLabelInput.value.trim();
  }

  try {
    await fetchJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logStatus.textContent = 'Logged.';
    logForm.reset();
    await refreshProgress();
  } catch (err) {
    logError.textContent = err.message;
  }
});

nudgeBtn.addEventListener('click', async () => {
  clearResult(nudgeResult);
  nudgeBtn.disabled = true;
  nudgeResult.textContent = 'Thinking of something for you…';
  try {
    const data = await fetchJson(`/api/nudge?habitType=${encodeURIComponent(currentHabitType)}`);
    nudgeResult.innerHTML = `
      <p>${escapeHtml(data.nudgeText)} <span class="nudge-tone">${escapeHtml(data.tone)}</span></p>
      ${data.suggestedMicroAction ? `<p><strong>Try:</strong> ${escapeHtml(data.suggestedMicroAction)}</p>` : ''}
    `;
  } catch (err) {
    nudgeResult.textContent = err.message;
  } finally {
    nudgeBtn.disabled = false;
  }
});

insightBtn.addEventListener('click', async () => {
  clearResult(insightResult);
  insightBtn.disabled = true;
  insightResult.textContent = 'Looking for patterns in your data…';
  try {
    const data = await fetchJson(`/api/insight?habitType=${encodeURIComponent(currentHabitType)}`);
    insightResult.innerHTML = `
      <p>${escapeHtml(data.insightText)} <span class="insight-confidence">confidence: ${escapeHtml(data.confidence)}</span></p>
      <p class="status-message">Based on: ${escapeHtml(data.referencedStat)}</p>
    `;
  } catch (err) {
    insightResult.textContent = err.message;
  } finally {
    insightBtn.disabled = false;
  }
});

async function loadIntentions() {
  try {
    const data = await fetchJson(`/api/intentions?habitType=${encodeURIComponent(currentHabitType)}&active=true`);
    intentionsList.innerHTML = '';
    for (const intention of data.intentions) {
      const li = document.createElement('li');
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.textContent = 'Mark done';
      doneBtn.addEventListener('click', async () => {
        await fetchJson(`/api/intentions/${intention.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        });
        await loadIntentions();
      });
      li.textContent = `If ${intention.if_trigger}, then ${intention.then_action}. `;
      li.appendChild(doneBtn);
      intentionsList.appendChild(li);
    }
  } catch {
    // Non-critical — leave the list as-is rather than blocking the page.
  }
}

intentionsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  intentionsError.textContent = '';
  const ifTrigger = document.getElementById('intention-trigger').value.trim();
  const thenAction = document.getElementById('intention-action').value.trim();
  try {
    await fetchJson('/api/intentions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitType: currentHabitType, ifTrigger, thenAction }),
    });
    intentionsForm.reset();
    await loadIntentions();
  } catch (err) {
    intentionsError.textContent = err.message;
  }
});

async function loadSupportResources() {
  try {
    const data = await fetchJson('/api/support');
    supportResourcesList.innerHTML = data.resources
      .map((r) => `<li><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.body)}</li>`)
      .join('');
  } catch {
    supportResourcesList.innerHTML = '<li>Support resources are temporarily unavailable.</li>';
  }
}

habitSelect.addEventListener('change', onHabitChanged);

populateMoodSelect();
loadHabitTypes();
loadSupportResources();
