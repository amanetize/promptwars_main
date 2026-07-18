const simForm = document.getElementById('sim-form');
const simEventType = document.getElementById('sim-event-type');
const simValueLabel = document.getElementById('sim-value-label');
const simValueInput = document.getElementById('sim-value');
const simError = document.getElementById('sim-error');
const simResult = document.getElementById('sim-result');

const VALUE_LABELS = {
  app_usage_summary: 'Minutes',
  device_charging_session: 'Minutes charging',
  step_count: 'Steps',
};

simEventType.addEventListener('change', () => {
  simValueLabel.textContent = VALUE_LABELS[simEventType.value];
});

simForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  simError.textContent = '';
  simResult.textContent = '';

  const recordedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const payload = {
    deviceId: 'simulator-demo-device',
    events: [
      {
        eventType: simEventType.value,
        value: Number(simValueInput.value),
        unit: simEventType.value === 'step_count' ? 'count' : 'minutes',
        recordedAt: new Date().toISOString(),
        recordedTz,
      },
    ],
  };

  try {
    const response = await fetch('/api/telemetry/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      simError.textContent = data.error || 'Simulated sync failed.';
      return;
    }
    simResult.innerHTML = `<p>Synced. ${escapeHtml(data.insertedCount)} event(s) inserted, ${escapeHtml(
      data.derivedHabitEvents
    )} habit event(s) derived. <a href="index.html">Go check your progress &rarr;</a></p>`;
    simForm.reset();
  } catch {
    simError.textContent = 'Could not reach the server.';
  }
});
