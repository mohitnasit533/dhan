const connectForm = document.getElementById('connectForm');
const connectMessage = document.getElementById('connectMessage');
const connectionStatus = document.getElementById('connectionStatus');
const connectionMetric = document.getElementById('connectionMetric');
const marketDataStatus = document.getElementById('marketDataStatus');
const scannerRows = document.getElementById('scannerRows');
const positionRows = document.getElementById('positionRows');
const positionSummary = document.getElementById('positionSummary');
const paperModeButton = document.getElementById('paperModeButton');
const liveModeButton = document.getElementById('liveModeButton');
const disconnectButton = document.getElementById('disconnectButton');
const tradeForm = document.getElementById('tradeForm');
const tradeMessage = document.getElementById('tradeMessage');
const autoTradeToggle = document.getElementById('autoTradeToggle');
const autoTradeLabel = document.getElementById('autoTradeLabel');
const refreshButton = document.getElementById('refreshScanner');
const previewDialog = document.getElementById('orderPreviewDialog');
const previewDetails = document.getElementById('previewDetails');
const previewWarning = document.getElementById('previewWarning');
const confirmPreviewButton = document.getElementById('confirmPreview');

const priceFormatter = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  : '--';
const currencyFormatter = (value) => priceFormatter(Number(value));

const state = {
  mode: 'PAPER',
  connected: false,
  profile: null,
  previewId: null,
  scannerInFlight: false,
  autoTrade: false,
  lastLiveAutoSignal: null,
  settings: { lotSize: 1, maxTrades: 5, stopLossPct: 1.2, targetPct: 3, trailingStopPct: 15 }
};

function appendCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value === null || value === undefined || value === '' ? '--' : String(value);
  row.append(cell);
  return cell;
}

function setMessage(element, message, type = 'neutral') {
  element.textContent = message;
  element.className = `message ${type}`;
}

function updateModeControls() {
  const sidebar = document.querySelector('.sidebar');
  const brandTitle = document.getElementById('brandTitle');
  const brandSubtitle = document.getElementById('brandSubtitle');
  const accountName = state.profile?.name || 'Dhan account';
  sidebar.classList.toggle('is-connected', state.connected);
  brandTitle.textContent = state.connected ? accountName : 'Dhan';
  brandTitle.title = state.connected ? accountName : 'Dhan';
  brandSubtitle.textContent = state.connected ? `Connected · ${state.mode}` : 'Intraday Desk';
  paperModeButton.classList.toggle('active', state.mode === 'PAPER');
  liveModeButton.classList.toggle('active', state.mode === 'LIVE');
  paperModeButton.setAttribute('aria-pressed', String(state.mode === 'PAPER'));
  liveModeButton.setAttribute('aria-pressed', String(state.mode === 'LIVE'));
  liveModeButton.disabled = !state.connected;
  autoTradeToggle.disabled = !state.connected;
  autoTradeToggle.checked = state.autoTrade;
  autoTradeLabel.textContent = !state.autoTrade ? 'Manual' : state.mode === 'LIVE' ? 'Auto signal review' : 'Auto trade';
  connectionStatus.textContent = state.connected ? `${state.profile?.name || 'Connected'} · ${state.mode}` : 'Not connected';
  connectionMetric.textContent = state.connected ? 'Connected' : 'Offline';
  disconnectButton.hidden = !state.connected;
}

function renderPositions(paperPositions = [], brokerPositions = []) {
  positionRows.replaceChildren();

  const positions = state.mode === 'LIVE'
    ? brokerPositions.filter((position) => Number(position.netQty) !== 0)
    : paperPositions.filter((position) => position.status === 'OPEN');
  positionSummary.textContent = `${positions.length} open ${state.mode === 'LIVE' ? 'broker' : 'paper'} positions`;
  document.getElementById('activeTradeCount').textContent = state.mode === 'LIVE'
    ? `${positions.length} / 5`
    : `${positions.length} / 5`;

  if (!positions.length) {
    const row = document.createElement('tr');
    const cell = appendCell(row, state.connected ? 'No open positions' : 'Connect Dhan to load account positions');
    cell.colSpan = 7;
    positionRows.append(row);
    return;
  }

  positions.forEach((position) => {
    const row = document.createElement('tr');
    if (state.mode === 'LIVE') {
      appendCell(row, position.tradingSymbol || position.securityId);
      appendCell(row, position.positionType || (Number(position.netQty) > 0 ? 'LONG' : 'SHORT'));
      appendCell(row, position.netQty);
      appendCell(row, priceFormatter(Number(position.buyAvg || position.sellAvg)));
      appendCell(row, currencyFormatter(Number(position.realizedProfit || 0) + Number(position.unrealizedProfit || 0)));
      appendCell(row, position.productType || 'LIVE');
      appendCell(row, 'Manage in Dhan');
    } else {
      appendCell(row, position.symbol);
      appendCell(row, position.side);
      appendCell(row, position.lotSize);
      appendCell(row, priceFormatter(position.entryPrice));
      appendCell(row, currencyFormatter((Number(position.entryPrice) - Number(position.currentPrice || position.entryPrice)) * Number(position.quantity || 1)));
      appendCell(row, position.status);
      const actionCell = document.createElement('td');
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'ghost-btn small';
      closeButton.textContent = 'Close paper';
      closeButton.addEventListener('click', () => closePaperPosition(position.symbol));
      actionCell.append(closeButton);
      row.append(actionCell);
    }
    positionRows.append(row);
  });
}

function renderScanner(results = [], data = {}) {
  scannerRows.replaceChildren();
  marketDataStatus.textContent = data.liveData
    ? `Dhan live data · ${state.mode} mode`
    : state.connected && data.message ? `Dhan data error · ${data.message}` : 'Connect Dhan to load live market data';
  if (data.autoTrade?.lastError) setMessage(tradeMessage, data.autoTrade.lastError);

  const liveSignal = results.find((item) => item.signal === 'BUY' || item.signal === 'SELL');
  if (state.autoTrade && state.mode === 'LIVE' && liveSignal) {
    const signalKey = `${liveSignal.symbol}:${liveSignal.lastCandleAt}:${liveSignal.signal}`;
    if (signalKey !== state.lastLiveAutoSignal) {
      state.lastLiveAutoSignal = signalKey;
      setMessage(tradeMessage, `Auto detected ${liveSignal.signal} on ${liveSignal.symbol}. Review and confirm the Dhan order from the scanner.`);
    }
  }

  const snapshot = results[0];
  document.getElementById('snapshotSymbol').textContent = snapshot?.symbol || '--';
  document.getElementById('snapshotPrice').textContent = priceFormatter(snapshot?.price);
  document.getElementById('snapshotEma').textContent = snapshot
    ? `${priceFormatter(snapshot.ema21)} / ${priceFormatter(snapshot.ema34)}`
    : '--';
  document.getElementById('snapshotVwap').textContent = priceFormatter(snapshot?.vwap);
  document.getElementById('snapshotTrend').textContent = snapshot?.supertrend || '--';
  document.getElementById('snapshotSignal').textContent = snapshot?.signal || 'Waiting for connection';
  document.getElementById('snapshotTime').textContent = snapshot?.lastCandleAt
    ? `Last closed 15-minute candle: ${new Date(snapshot.lastCandleAt).toLocaleString()}`
    : snapshot?.dataError || (data.liveData ? 'Waiting for Dhan candle data.' : '15-minute candles are sourced from Dhan.');

  if (!results.length) {
    const row = document.createElement('tr');
    const cell = appendCell(row, data.message || 'No market data available');
    cell.colSpan = 6;
    scannerRows.append(row);
    return;
  }

  results.forEach((item) => {
    const row = document.createElement('tr');
    appendCell(row, item.symbol);
    appendCell(row, priceFormatter(item.price));
    appendCell(row, priceFormatter(item.vwap));
    appendCell(row, item.trend || item.supertrend);
    const setupCell = appendCell(row, item.dataError ? `Data unavailable: ${item.dataError}` : item.setup);
    if (item.dataError) setupCell.classList.add('data-error');

    const actionCell = document.createElement('td');
    const signal = document.createElement('span');
    signal.className = `signal-badge ${item.signal === 'BUY' ? 'buy' : item.signal === 'SELL' ? 'sell' : 'watch'}`;
    signal.textContent = item.signal || 'WATCH';
    actionCell.append(signal);

    const openAlready = (data.activePositions || []).some((trade) => trade.symbol === item.symbol && trade.status === 'OPEN');
    const canPreview = data.connected && !openAlready && (item.signal === 'BUY' || item.signal === 'SELL');
    if (canPreview) {
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'ghost-btn small';
      previewButton.textContent = 'Preview';
      previewButton.addEventListener('click', () => previewOrder(item));
      actionCell.append(previewButton);
    }
    row.append(actionCell);
    scannerRows.append(row);
  });
}

async function parseResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`);
  return result;
}

async function loadConnection() {
  try {
    const response = await fetch('/api/connection');
    const result = await parseResponse(response);
    state.connected = result.connected;
    state.profile = result.profile;
    state.mode = result.mode || 'PAPER';
    state.autoTrade = Boolean(result.autoTrade);
    if (result.settings) state.settings = result.settings;
    document.getElementById('lotSize').value = state.settings.lotSize;
    document.getElementById('maxTrades').value = state.settings.maxTrades;
    document.getElementById('stopLoss').value = state.settings.stopLossPct;
    document.getElementById('target').value = state.settings.targetPct;
    document.getElementById('trailingStop').value = state.settings.trailingStopPct;
    updateModeControls();
  } catch (error) {
    setMessage(connectMessage, error.message);
  }
}

async function connectDhan(event) {
  event.preventDefault();
  const accessTokenInput = document.getElementById('accessToken');
  const payload = {
    clientId: document.getElementById('clientId').value,
    accessToken: accessTokenInput.value
  };

  try {
    const result = await parseResponse(await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }));
    accessTokenInput.value = '';
    state.connected = true;
    state.profile = result.profile;
    state.mode = result.mode || 'PAPER';
    updateModeControls();
    setMessage(connectMessage, result.message, 'success');
    await loadAccount();
    await loadScanner();
  } catch (error) {
    accessTokenInput.value = '';
    setMessage(connectMessage, error.message);
  }
}

async function disconnectDhan() {
  try {
    const result = await parseResponse(await fetch('/api/disconnect', { method: 'POST' }));
    state.connected = false;
    state.profile = null;
    state.mode = 'PAPER';
    updateModeControls();
    document.getElementById('capitalInPlay').textContent = '--';
    document.getElementById('dailyPnl').textContent = '--';
    setMessage(connectMessage, result.message);
    renderScanner([], { connected: false });
    renderPositions();
  } catch (error) {
    setMessage(connectMessage, error.message);
  }
}

async function setMode(mode) {
  try {
    const result = await parseResponse(await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }));
    state.mode = result.mode;
    updateModeControls();
    setMessage(tradeMessage, result.message);
    await loadAccount();
    await loadScanner();
  } catch (error) {
    setMessage(tradeMessage, error.message);
  }
}

async function loadAccount() {
  if (!state.connected) return;
  try {
    const result = await parseResponse(await fetch('/api/account'));
    const funds = result.funds || {};
    const pnl = (result.positions || []).reduce((total, position) => total
      + Number(position.realizedProfit || 0) + Number(position.unrealizedProfit || 0), 0);
    document.getElementById('capitalInPlay').textContent = currencyFormatter(Number(funds.availabelBalance));
    document.getElementById('dailyPnl').textContent = currencyFormatter(pnl);
    if (state.mode === 'LIVE') renderPositions([], result.positions || []);
  } catch (error) {
    document.getElementById('capitalInPlay').textContent = '--';
    setMessage(connectMessage, error.message);
  }
}

async function loadScanner() {
  if (state.scannerInFlight) return;
  state.scannerInFlight = true;
  try {
    const response = await fetch('/api/scanner');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Scanner unavailable');
    renderScanner(data.results || [], data);
    renderPositions(data.activePositions || [], data.brokerPositions || []);
  } catch (error) {
    renderScanner([], { message: error.message });
  } finally {
    state.scannerInFlight = false;
  }
}

async function previewOrder(item) {
  const payload = {
    symbol: item.symbol,
    signal: item.signal,
    lots: state.settings.lotSize,
    stopLossPct: state.settings.stopLossPct,
    targetPct: state.settings.targetPct,
    trailingStopPct: state.settings.trailingStopPct
  };

  try {
    const result = await parseResponse(await fetch('/api/trade/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }));
    state.previewId = result.previewId;
    document.getElementById('previewTitle').textContent = `${result.mode} order preview`;
    previewDetails.replaceChildren();
    Object.entries(result.preview).forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value === null || value === undefined ? '--' : String(value);
      previewDetails.append(term, detail);
    });
    previewWarning.textContent = result.warning;
    confirmPreviewButton.textContent = result.mode === 'LIVE' ? 'Confirm live order' : 'Confirm paper order';
    confirmPreviewButton.classList.toggle('live-confirm', result.mode === 'LIVE');
    previewDialog.showModal();
  } catch (error) {
    setMessage(tradeMessage, error.message);
  }
}

async function confirmPreview() {
  if (!state.previewId) return;
  confirmPreviewButton.disabled = true;
  try {
    const result = await parseResponse(await fetch('/api/trade/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId: state.previewId })
    }));
    previewDialog.close();
    state.previewId = null;
    setMessage(tradeMessage, result.message, 'success');
    await loadAccount();
    await loadScanner();
  } catch (error) {
    setMessage(tradeMessage, error.message);
  } finally {
    confirmPreviewButton.disabled = false;
  }
}

async function closePaperPosition(symbol) {
  try {
    const result = await parseResponse(await fetch('/api/trade/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    }));
    setMessage(tradeMessage, result.message, 'success');
    await loadScanner();
  } catch (error) {
    setMessage(tradeMessage, error.message);
  }
}

connectForm.addEventListener('submit', connectDhan);
paperModeButton.addEventListener('click', () => setMode('PAPER'));
liveModeButton.addEventListener('click', () => setMode('LIVE'));
disconnectButton.addEventListener('click', disconnectDhan);
confirmPreviewButton.addEventListener('click', confirmPreview);
document.getElementById('cancelPreview').addEventListener('click', () => previewDialog.close());
refreshButton.addEventListener('click', loadScanner);

tradeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveAutoTradeSettings(autoTradeToggle.checked);
});

async function saveAutoTradeSettings(enabled) {
  const settings = {
    lotSize: Number(document.getElementById('lotSize').value),
    maxTrades: Math.min(Number(document.getElementById('maxTrades').value), 5),
    stopLossPct: Number(document.getElementById('stopLoss').value),
    targetPct: Number(document.getElementById('target').value),
    trailingStopPct: Number(document.getElementById('trailingStop').value)
  };

  try {
    const response = await fetch('/api/auto-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, ...settings })
    });
    const result = await parseResponse(response);
    state.settings = result.settings;
    state.autoTrade = result.enabled;
    updateModeControls();
    setMessage(tradeMessage, result.message, 'success');
    await loadScanner();
  } catch (error) {
    autoTradeToggle.checked = state.autoTrade;
    setMessage(tradeMessage, error.message);
  }
}

autoTradeToggle.addEventListener('change', () => saveAutoTradeSettings(autoTradeToggle.checked));

document.querySelectorAll('.nav-item[data-target]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.nav-item.active')?.classList.remove('active');
    button.classList.add('active');
    document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

loadConnection().then(async () => {
  updateModeControls();
  await loadAccount();
  await loadScanner();
});
setInterval(loadScanner, 1000);