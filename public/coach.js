const coachLog = document.getElementById('coach-log');
const coachForm = document.getElementById('coach-form');
const coachInput = document.getElementById('coach-input');
const coachError = document.getElementById('coach-error');
const crisisPanel = document.getElementById('coach-crisis-panel');
const crisisResourcesList = document.getElementById('crisis-resources-list');

function appendCoachMessage(role, content) {
  const div = document.createElement('div');
  div.className = `coach-message ${role}`;
  div.textContent = content;
  coachLog.appendChild(div);
  coachLog.scrollTop = coachLog.scrollHeight;
}

async function loadCoachHistory() {
  try {
    const data = await fetchJson('/api/coach/history');
    coachLog.innerHTML = '';
    for (const message of data.messages) {
      if (message.crisis) {
        appendCoachMessage(message.role, '[Support resources were shown for this message]');
      } else if (message.content) {
        appendCoachMessage(message.role, message.content);
      }
    }
  } catch {
    // Non-critical — chat still works without prior history loaded.
  }
}

coachForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  coachError.textContent = '';
  const message = coachInput.value.trim();
  if (!message) return;

  appendCoachMessage('user', message);
  coachInput.value = '';
  crisisPanel.hidden = true;

  const submitBtn = coachForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const data = await fetchJson('/api/coach/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, habitTypeContext: currentHabitType }),
    });
    if (data.crisis) {
      // Rendered as a visually distinct alert component, not a chat bubble,
      // so it never reads as "the AI's canned reply."
      crisisResourcesList.innerHTML = data.resources
        .map((r) => `<li><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.body)}</li>`)
        .join('');
      crisisPanel.hidden = false;
      crisisPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      appendCoachMessage('assistant', data.message);
    }
  } catch (err) {
    coachError.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

window.loadCoachHistory = loadCoachHistory;
loadCoachHistory();
