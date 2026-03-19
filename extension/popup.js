// popup.js

const TYPE_LABELS = {
  JOB_CHANGE:            '🔴 Job Change',
  HIRING_POST:           '🟡 Hiring',
  FUNDING_SIGNAL:        '🟢 Funding',
  DECISION_MAKER_ACTIVE: '🔵 Decision Maker',
  COMPANY_MILESTONE:     '🟣 Milestone',
  WARM_PATH_OPENED:      '🟠 Warm Path',
};

function renderSignals(signals) {
  const content = document.getElementById('content');
  const countEl = document.getElementById('count');
  const active = signals.filter(s => s.status !== 'dismissed');
  countEl.textContent = active.length;

  if (active.length === 0) {
    content.innerHTML = `
      <div class="empty">
        <div class="icon">📡</div>
        <p>No signals yet.</p>
        <p class="hint">Open LinkedIn and scroll your feed.<br>Signals appear here automatically.</p>
      </div>`;
    return;
  }

  // Sort: tier 1 first, then confidence desc, then recency
  const sorted = [...active].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.confidence !== a.confidence) return (b.confidence || 0) - (a.confidence || 0);
    return (a.timeMinutes || 0) - (b.timeMinutes || 0);
  });

  content.innerHTML = sorted.map(s => `
    <div class="signal-card" data-id="${s.id}">
      <div class="card-header">
        <span class="signal-badge badge-${s.type}">${TYPE_LABELS[s.type] || s.type}</span>
        <span class="card-meta">
          <span class="tier-dot tier-${s.tier}"></span>${s.timeStr || 'recently'}
          <span class="confidence"> · ${s.confidence || 0}% conf</span>
        </span>
      </div>
      <div class="card-author">
        ${s.author}
        ${s.degree && s.degree !== 'unknown' ? `<span class="degree-badge">${s.degree}</span>` : ''}
        ${s.reactor ? `<span class="degree-badge">via ${s.reactor}</span>` : ''}
      </div>
      ${s.title ? `<div class="card-title">${s.title}</div>` : ''}
      ${s.reasoning ? `<div class="card-reasoning">${s.reasoning}</div>` : ''}
      ${s.outreachHook ? `<div class="card-hook">💬 "${s.outreachHook}"</div>` : ''}
      <div class="card-preview">${s.preview || ''}</div>
      <div class="card-actions">
        <button class="btn-primary draft-btn" data-id="${s.id}">Draft Outreach</button>
        <button class="btn-secondary dismiss-btn" data-id="${s.id}">Dismiss</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      chrome.storage.local.get(['signals'], (result) => {
        const updated = (result.signals || []).map(s => s.id === id ? { ...s, status: 'dismissed' } : s);
        chrome.storage.local.set({ signals: updated }, () => renderSignals(updated));
      });
    });
  });

  document.querySelectorAll('.draft-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const signal = active.find(s => s.id === id);
      if (signal) {
        console.log('[Jobseek] Draft outreach for signal:', JSON.stringify(signal, null, 2));
        alert(
          `Outreach opener:\n\n"${signal.outreachHook}"\n\n` +
          `Person: ${signal.author}\nTitle: ${signal.title || '—'}\n` +
          `Signal: ${signal.type}\nReasoning: ${signal.reasoning}`
        );
      }
    });
  });
}

// Load and render on open
chrome.storage.local.get(['signals', 'scanningPaused'], (result) => {
  const signals = result.signals || [];
  renderSignals(signals);
  if (signals.length > 0) {
    const last = new Date(signals[0].detectedAt);
    document.getElementById('scanStatus').textContent =
      `Last scan: ${last.toLocaleTimeString()} · ${signals.length} total`;
  }
  updatePauseBtn(!!result.scanningPaused);
});

// Pause / Resume toggle
function updatePauseBtn(paused) {
  const btn = document.getElementById('pauseBtn');
  if (paused) {
    btn.textContent = '▶ Resume';
    btn.classList.add('paused');
    document.getElementById('scanStatus').textContent = '⏸ Scanning paused — click Resume to restart';
  } else {
    btn.textContent = '⏸ Pause';
    btn.classList.remove('paused');
  }
}

document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.storage.local.get(['scanningPaused'], (result) => {
    const nowPaused = !result.scanningPaused;
    chrome.storage.local.set({ scanningPaused: nowPaused }, () => {
      updatePauseBtn(nowPaused);
      // On Resume: kick off an immediate scan, then normal schedule continues
      if (!nowPaused) {
        chrome.runtime.sendMessage({ action: 'TRIGGER_SCAN_NOW' });
      }
    });
  });
});

// Clear all
document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.storage.local.set({ signals: [], seenPostIds: [] }, () => {
    renderSignals([]);
    document.getElementById('scanStatus').textContent = 'Cleared. Open LinkedIn to rescan.';
  });
});
