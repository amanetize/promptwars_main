// The one genuinely real, unsimulated telemetry source: actual time this
// tab was visible, via the Page Visibility API. No permission dialog, no
// simulation — tagged server-side as source='browser_telemetry', distinct
// from the device-sync simulator's 'device_sync' rows.
(function () {
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  let accumulatedMs = 0;

  function flush() {
    if (visibleSince) {
      accumulatedMs += Date.now() - visibleSince;
      visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    }
    if (accumulatedMs < 1000) return;

    const minutes = Math.round((accumulatedMs / 60000) * 100) / 100;
    accumulatedMs = 0;
    const recordedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    fetch('/api/telemetry/browser-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes, recordedAt: new Date().toISOString(), recordedTz }),
      keepalive: true,
    }).catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    } else {
      visibleSince = Date.now();
    }
  });

  window.addEventListener('pagehide', flush);
  setInterval(flush, 5 * 60 * 1000);
})();
