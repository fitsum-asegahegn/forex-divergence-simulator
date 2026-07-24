(function(){
  "use strict";

  // ---------- Regime model (illustrative v1 point estimates) ----------
  const REGIMES = {
    low:  { mean: 0.08, sd: 0.015 },
    high: { mean: 0.22, sd: 0.04  }
  };
  const TRANSITION = {
    low:  { low: 0.85, high: 0.15 },
    high: { low: 0.25, high: 0.75 }
  };
  const WEEKS_PER_MONTH = 4.33;
  const N_PATHS = 5000;
  const N_FAN_PATHS = 800;
  const SHOCK_WEEKS = 8; // ~2 months forced-regime window

  // Assumed effective sample size behind the point estimates above.
  // Matches the 50-100 weekly observations planned for the real data pull.
  // Used only to size the parameter-uncertainty (bootstrap-style) resampling below.
  const EFFECTIVE_N = 75;

  function gaussian(mean, sd){
    // Box-Muller
    let u1 = Math.random() || 1e-9, u2 = Math.random();
    let z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * sd;
  }

  // Draw one path's regime parameters by resampling the estimated means
  // around their standard error. This is a simplified stand-in for a full
  // block bootstrap: it adds parameter uncertainty on top of the
  // week-to-week stochastic variation already in the model, so the
  // simulated distribution doesn't understate risk.
  function drawPathParams(){
    const se = {
      low:  REGIMES.low.sd  / Math.sqrt(EFFECTIVE_N),
      high: REGIMES.high.sd / Math.sqrt(EFFECTIVE_N)
    };
    return {
      low:  { mean: gaussian(REGIMES.low.mean,  se.low),  sd: REGIMES.low.sd  },
      high: { mean: gaussian(REGIMES.high.mean, se.high), sd: REGIMES.high.sd }
    };
  }

  function nextRegime(current){
    // TRANSITION[current].low = P(next week is "low" | current regime)
    const p = TRANSITION[current];
    return Math.random() < p.low ? "low" : "high";
  }

  function drawSpread(regime, params){
    const r = params[regime];
    const s = gaussian(r.mean, r.sd);
    return Math.max(0.005, s); // spread can't sensibly go negative
  }

  // shock: null, or { type: 'devaluation' | 'crackdown' }
  function simulatePath(weeks, weeklyImportVolume, pctParallel, pathParams, shock, recordSpreads){
    let regime = shock ? (shock.type === 'crackdown' ? 'high' : 'low') : 'low';
    let total = 0;
    const spreadTrace = recordSpreads ? new Array(weeks) : null;

    for (let w = 0; w < weeks; w++){
      const forced = shock && w < SHOCK_WEEKS;
      if (forced) regime = shock.type === 'crackdown' ? 'high' : 'low';

      let spread = drawSpread(regime, pathParams);

      if (forced){
        if (shock.type === 'crackdown') spread += 0.10;      // widening beyond normal "high"
        else spread = Math.max(0.005, spread - 0.06);        // compression beyond normal "low"
      }

      if (spreadTrace) spreadTrace[w] = spread;

      const costThisWeek = weeklyImportVolume * pctParallel * spread;
      total += costThisWeek;

      if (!forced) regime = nextRegime(regime);
    }
    return { total, spreadTrace };
  }

  function monteCarlo(months, importVolumeMonthly, pctParallelPct, shock){
    const weeks = Math.round(months * WEEKS_PER_MONTH);
    const weeklyVolume = importVolumeMonthly / WEEKS_PER_MONTH;
    const pctParallel = pctParallelPct / 100;
    const results = new Array(N_PATHS);
    for (let i = 0; i < N_PATHS; i++){
      const pathParams = drawPathParams();
      results[i] = simulatePath(weeks, weeklyVolume, pctParallel, pathParams, shock, false).total;
    }
    return results;
  }

  function simulateFan(months){
    const weeks = Math.round(months * WEEKS_PER_MONTH);
    const traces = new Array(N_FAN_PATHS);
    for (let i = 0; i < N_FAN_PATHS; i++){
      const pathParams = drawPathParams();
      traces[i] = simulatePath(weeks, 1, 1, pathParams, null, true).spreadTrace;
    }
    // percentile per week across all paths
    const bands = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    for (let w = 0; w < weeks; w++){
      const col = traces.map(t => t[w]).sort((a,b) => a-b);
      bands.p5.push(percentile(col, 0.05));
      bands.p25.push(percentile(col, 0.25));
      bands.p50.push(percentile(col, 0.5));
      bands.p75.push(percentile(col, 0.75));
      bands.p95.push(percentile(col, 0.95));
    }
    return bands;
  }

  function percentile(sortedArr, p){
    const idx = (sortedArr.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
  }

  function summarize(results, threshold){
    const sorted = [...results].sort((a,b) => a-b);
    const median = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const exceedCount = results.filter(v => v > threshold).length;
    const probExceed = (exceedCount / results.length) * 100;
    return { median, p95, probExceed };
  }

  function fmtBirr(n){
    return Math.round(n).toLocaleString('en-US') + " Birr";
  }

  function fmtDelta(baselineVal, shockedVal, isPercentagePoints){
    if (baselineVal === 0) return '';
    const pctChange = ((shockedVal - baselineVal) / baselineVal) * 100;
    const arrow = pctChange >= 0 ? '▲' : '▼';
    return `${arrow} ${Math.abs(pctChange).toFixed(0)}% vs baseline`;
  }

  // ---------- UI wiring ----------
  const runBtn = document.getElementById('runBtn');
  const shockBtn = document.getElementById('shockBtn');
  const resetBtn = document.getElementById('resetBtn');
  const chartEl = document.getElementById('chart');
  const chartPlaceholder = document.getElementById('chartPlaceholder');
  const regimePill = document.getElementById('regimePill');
  const narrativeEl = document.getElementById('narrative');
  const fanChartEl = document.getElementById('fanChart');
  const fanPanel = document.querySelector('.fan-panel');

  const digitProb = document.getElementById('digitProb');
  const digitMedian = document.getElementById('digitMedian');
  const digitWorst = document.getElementById('digitWorst');
  const deltaProb = document.getElementById('deltaProb');
  const deltaMedian = document.getElementById('deltaMedian');
  const deltaWorst = document.getElementById('deltaWorst');

  let baselineResults = null;
  let baselineStats = null;
  let baselineParams = null;
  let plotted = false;
  let fanPlotted = false;

  function getInputs(){
    return {
      importVolume: parseFloat(document.getElementById('importVolume').value) || 0,
      pctParallel: parseFloat(document.getElementById('pctParallel').value) || 0,
      months: parseFloat(document.getElementById('horizon').value) || 1,
      threshold: parseFloat(document.getElementById('threshold').value) || 0,
    };
  }

  function getShockType(){
    const el = document.querySelector('input[name="shockType"]:checked');
    return el ? el.value : 'devaluation';
  }

  function renderDigits(stats, shocked){
    digitProb.innerHTML = stats.probExceed.toFixed(1) + ' <span class="unit">%</span>';
    digitMedian.textContent = fmtBirr(stats.median);
    digitWorst.textContent = fmtBirr(stats.p95);
    [digitProb, digitMedian, digitWorst].forEach(el => el.classList.toggle('is-shocked', !!shocked));
  }

  function renderDeltas(baseline, shocked){
    deltaProb.textContent = fmtDelta(baseline.probExceed, shocked.probExceed);
    deltaMedian.textContent = fmtDelta(baseline.median, shocked.median);
    deltaWorst.textContent = fmtDelta(baseline.p95, shocked.p95);
  }

  function clearDeltas(){
    deltaProb.textContent = '';
    deltaMedian.textContent = '';
    deltaWorst.textContent = '';
  }

  function renderNarrative(stats, threshold, shocked, shockLabel){
    narrativeEl.classList.toggle('is-shocked', !!shocked);
    const lead = shocked ? `Under a ${shockLabel} scenario: ` : "";
    narrativeEl.innerHTML = `${lead}There's a <b>${stats.probExceed.toFixed(1)}%</b> chance your extra cost from the parallel rate exceeds <b>${fmtBirr(threshold)}</b>. Median expected extra cost is <b>${fmtBirr(stats.median)}</b>, with a worst-case (95th percentile) of <b>${fmtBirr(stats.p95)}</b>.`;
  }

  function plotHistogram(baseline, shockResults){
    const traces = [{
      x: baseline,
      type: 'histogram',
      histnorm: 'probability',
      name: 'Baseline',
      marker: { color: 'rgba(242,184,75,0.75)' },
      nbinsx: 40
    }];
    if (shockResults){
      traces.push({
        x: shockResults,
        type: 'histogram',
        histnorm: 'probability',
        name: 'Shock scenario',
        marker: { color: 'rgba(224,72,63,0.65)' },
        nbinsx: 40
      });
    }
    const layout = {
      barmode: 'overlay',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#eae6db', family: 'JetBrains Mono, monospace', size: 11 },
      margin: { t: 10, r: 10, l: 50, b: 40 },
      xaxis: { title: 'Total extra cost (Birr)', gridcolor: '#2c3542', zerolinecolor: '#2c3542' },
      yaxis: { title: 'Probability', gridcolor: '#2c3542', zerolinecolor: '#2c3542' },
      legend: { orientation: 'h', y: -0.25 }
    };
    Plotly.react(chartEl, traces, layout, { displayModeBar: false, responsive: true });
  }

  function plotFan(bands){
    const weeks = bands.p50.map((_, i) => i + 1);
    const pct = arr => arr.map(v => v * 100);
    const traces = [
      { x: weeks, y: pct(bands.p95), mode:'lines', line:{width:0}, showlegend:false, hoverinfo:'skip' },
      { x: weeks, y: pct(bands.p5),  mode:'lines', fill:'tonexty', fillcolor:'rgba(242,184,75,0.12)', line:{width:0}, name:'5–95% band' },
      { x: weeks, y: pct(bands.p75), mode:'lines', line:{width:0}, showlegend:false, hoverinfo:'skip' },
      { x: weeks, y: pct(bands.p25), mode:'lines', fill:'tonexty', fillcolor:'rgba(242,184,75,0.28)', line:{width:0}, name:'25–75% band' },
      { x: weeks, y: pct(bands.p50), mode:'lines', line:{color:'#f2b84b', width:2}, name:'Median spread' }
    ];
    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#eae6db', family: 'JetBrains Mono, monospace', size: 11 },
      margin: { t: 10, r: 10, l: 50, b: 40 },
      xaxis: { title: 'Week', gridcolor: '#2c3542', zerolinecolor: '#2c3542' },
      yaxis: { title: 'Spread (%)', gridcolor: '#2c3542', zerolinecolor: '#2c3542' },
      legend: { orientation: 'h', y: -0.3 }
    };
    Plotly.react(fanChartEl, traces, layout, { displayModeBar: false, responsive: true });
  }

  runBtn.addEventListener('click', function(){
    const inputs = getInputs();
    baselineParams = inputs;
    baselineResults = monteCarlo(inputs.months, inputs.importVolume, inputs.pctParallel, null);
    baselineStats = summarize(baselineResults, inputs.threshold);

    regimePill.textContent = 'Baseline simulated';
    regimePill.classList.add('active');
    renderDigits(baselineStats, false);
    clearDeltas();
    renderNarrative(baselineStats, inputs.threshold, false);

    chartPlaceholder.style.display = 'none';
    chartEl.style.display = 'block';
    plotHistogram(baselineResults, null);
    plotted = true;

    shockBtn.disabled = false;

    if (fanPanel.open){
      const bands = simulateFan(inputs.months);
      plotFan(bands);
      fanPlotted = true;
    }
  });

  shockBtn.addEventListener('click', function(){
    if (!baselineResults || !baselineParams) return;
    const shockType = getShockType();
    const shock = { type: shockType };
    const shockResults = monteCarlo(baselineParams.months, baselineParams.importVolume, baselineParams.pctParallel, shock);
    const stats = summarize(shockResults, baselineParams.threshold);
    const shockLabel = shockType === 'crackdown' ? 'parallel crackdown' : 'official devaluation';

    regimePill.textContent = 'Shock scenario active';
    renderDigits(stats, true);
    renderDeltas(baselineStats, stats);
    renderNarrative(stats, baselineParams.threshold, true, shockLabel);
    plotHistogram(baselineResults, shockResults);
  });

  resetBtn.addEventListener('click', function(){
    baselineResults = null;
    baselineStats = null;
    baselineParams = null;
    shockBtn.disabled = true;
    regimePill.textContent = 'Awaiting input';
    regimePill.classList.remove('active');
    digitProb.innerHTML = '— <span class="unit">%</span>';
    digitMedian.textContent = '—';
    digitWorst.textContent = '—';
    clearDeltas();
    [digitProb, digitMedian, digitWorst].forEach(el => el.classList.remove('is-shocked'));
    narrativeEl.classList.remove('is-shocked');
    narrativeEl.textContent = 'Run a simulation to see your exposure translated into plain language.';
    chartEl.style.display = 'none';
    chartPlaceholder.style.display = 'flex';
    if (plotted) Plotly.purge(chartEl);
    plotted = false;
    if (fanPlotted) { Plotly.purge(fanChartEl); fanPlotted = false; }
  });

  fanPanel.addEventListener('toggle', function(){
    if (fanPanel.open && baselineParams && !fanPlotted){
      const bands = simulateFan(baselineParams.months);
      plotFan(bands);
      fanPlotted = true;
    }
  });

})();
