// ============================================
// TERM-OVER-TERM DELTA TOGGLE FOR HEATMAP
// ============================================
(function() {
  'use strict';

  var deltaMode = false;

  // Expose delta state and re-apply function for other scripts
  window.heatmapDelta = {
    isActive: function() { return deltaMode; },
    reapply: function() { if (deltaMode) applyDelta(); }
  };

  window.addEventListener('scotusgami-data-ready', function() {
    buildToggle();
    window.addEventListener('scotusgami-filter-change', function() {
      if (deltaMode) applyDelta();
    });
  });

  // ---- Build toggle button group ----
  function buildToggle() {
    var panelTitle = document.querySelector('.panel-heatmap .panel-title');
    if (!panelTitle) return;

    var group = document.createElement('span');
    group.className = 'heatmap-toggle';

    var btnRate = document.createElement('button');
    btnRate.className = 'heatmap-toggle-btn active';
    btnRate.textContent = 'Rate';
    btnRate.type = 'button';

    var btnDelta = document.createElement('button');
    btnDelta.className = 'heatmap-toggle-btn';
    btnDelta.textContent = 'Delta';
    btnDelta.type = 'button';

    btnRate.addEventListener('click', function() {
      if (!deltaMode) return;
      deltaMode = false;
      btnRate.classList.add('active');
      btnDelta.classList.remove('active');
      restoreRate();
    });

    btnDelta.addEventListener('click', function() {
      if (deltaMode) return;
      deltaMode = true;
      btnDelta.classList.add('active');
      btnRate.classList.remove('active');
      applyDelta();
    });

    group.appendChild(btnRate);
    group.appendChild(btnDelta);
    panelTitle.appendChild(group);
  }

  // ---- Helpers ----

  // Build sorted list of unique term years from DATA.cases
  function getTermYears() {
    var seen = {};
    var years = [];
    window.DATA.cases.forEach(function(c) {
      if (!seen[c.term_year]) {
        seen[c.term_year] = true;
        years.push(c.term_year);
      }
    });
    years.sort(function(a, b) { return a - b; });
    return years;
  }

  // Given a term year, compute agreement rates for all pairs
  // Returns { "A-B": { rate: number, cases: number }, ... }
  function computeTermAgreements(termYear) {
    var DATA = window.DATA;
    var termCaseIds = new Set();
    DATA.cases.forEach(function(c) {
      if (c.term_year === termYear) termCaseIds.add(c.id);
    });

    var result = {};
    var timeline = DATA.timeline;
    Object.keys(timeline).forEach(function(key) {
      var entries = timeline[key];
      var count = 0;
      var agreed = 0;
      entries.forEach(function(d) {
        if (termCaseIds.has(d.case_id)) {
          count++;
          if (d.agreed) agreed++;
        }
      });
      if (count > 0) {
        result[key] = { rate: Math.round((agreed / count) * 100), cases: count };
      }
    });
    return result;
  }

  function getAgreementRate(agreements, a, b) {
    if (a === b) return null;
    var key1 = a + '-' + b;
    var key2 = b + '-' + a;
    var d = agreements[key1] || agreements[key2];
    return d || null;
  }

  // Determine which two terms to compare based on current filter
  function getDeltaTerms() {
    var termYears = getTermYears();
    var n = termYears.length;
    if (n < 2) return null;

    var filter = window.currentTermFilter;
    var currentTerm, prevTerm;

    switch (filter) {
      case 'current':
        currentTerm = termYears[n - 1];
        prevTerm = termYears[n - 2];
        break;
      case 'last':
        currentTerm = termYears[n - 2];
        prevTerm = (n >= 3) ? termYears[n - 3] : null;
        break;
      default:
        // For multi-term filters, compare latest vs second-latest
        currentTerm = termYears[n - 1];
        prevTerm = termYears[n - 2];
        break;
    }

    if (prevTerm === null) return null;
    return { current: currentTerm, previous: prevTerm };
  }

  // Diverging color scale: red (-) -> white (0) -> green (+)
  function deltaColor(delta) {
    if (delta === null) return '#161b22';
    // Clamp to [-40, 40] for color mapping
    var t = Math.max(-40, Math.min(40, delta)) / 40; // -1 to 1
    if (t < 0) {
      // Interpolate red (#da3633) to dark neutral (#1c1c1c)
      var f = -t; // 0 to 1
      var r = Math.round(28 + f * (218 - 28));
      var g = Math.round(28 + f * (54 - 28));
      var b = Math.round(28 + f * (51 - 28));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    } else if (t > 0) {
      // Interpolate dark neutral (#1c1c1c) to green (#2ea043)
      var f = t;
      var r = Math.round(28 + f * (46 - 28));
      var g = Math.round(28 + f * (160 - 28));
      var b = Math.round(28 + f * (67 - 28));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    return '#1c1c1c';
  }

  function deltaText(delta) {
    if (delta === null) return 'N/A';
    var rounded = Math.round(delta);
    if (rounded > 0) return '+' + rounded;
    if (rounded < 0) return '' + rounded;
    return '0';
  }

  // ---- Apply delta mode to heatmap ----
  function applyDelta() {
    var terms = getDeltaTerms();
    if (!terms) {
      // Not enough terms — show N/A everywhere
      showNoData();
      updateLegendDelta();
      return;
    }

    var currentAg = computeTermAgreements(terms.current);
    var prevAg = computeTermAgreements(terms.previous);
    var justices = window.DATA.justices;

    var svg = d3.select('#heatmap svg');

    // Build delta map
    var deltaMap = {};
    justices.forEach(function(a) {
      justices.forEach(function(b) {
        if (a === b) return;
        var key = window.pairKey(a, b);
        if (deltaMap[key] !== undefined) return; // already computed
        var cur = getAgreementRate(currentAg, a, b);
        var prev = getAgreementRate(prevAg, a, b);
        var MIN_CASES = 2;
        if (!cur || cur.cases < MIN_CASES || !prev || prev.cases < MIN_CASES) {
          deltaMap[key] = null;
        } else {
          deltaMap[key] = cur.rate - prev.rate;
        }
      });
    });

    // Update rect fills
    svg.selectAll('.heatmap-cell').each(function(d) {
      if (d.a === d.b) return;
      var key = window.pairKey(d.a, d.b);
      var delta = deltaMap[key];
      d3.select(this).attr('fill', deltaColor(delta));
    });

    // Update cell text
    svg.selectAll('.cell-text').remove();
    var cellData = [];
    justices.forEach(function(a, i) {
      justices.forEach(function(b, j) {
        if (a === b) return;
        var key = window.pairKey(a, b);
        cellData.push({ a: a, b: b, i: i, j: j, delta: deltaMap[key] });
      });
    });

    var cellSize = 48;
    var labelWidth = 70;

    svg.selectAll('.cell-text-delta')
      .data(cellData)
      .join('text')
      .attr('class', 'cell-text cell-text-delta')
      .attr('x', function(d) { return labelWidth + d.j * cellSize + cellSize / 2 - 1; })
      .attr('y', function(d) { return labelWidth + d.i * cellSize + cellSize / 2 + 4; })
      .attr('text-anchor', 'middle')
      .attr('fill', function(d) {
        if (d.delta === null) return '#484f58';
        return '#f0f6fc';
      })
      .attr('font-size', function(d) {
        return d.delta === null ? '9px' : '11px';
      })
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')
      .text(function(d) { return deltaText(d.delta); });

    // Update tooltips
    svg.selectAll('.heatmap-cell')
      .on('mouseover', function(ev, d) {
        if (d.a === d.b) return;
        var key = window.pairKey(d.a, d.b);
        var delta = deltaMap[key];
        var tooltip = d3.select('#tooltip');
        var el = tooltip.node();
        while (el.firstChild) el.removeChild(el.firstChild);
        var spanPair = document.createElement('span');
        spanPair.className = 'pair';
        spanPair.textContent = d.a + ' + ' + d.b;
        el.appendChild(spanPair);
        el.appendChild(document.createElement('br'));
        var spanRate = document.createElement('span');
        spanRate.className = 'rate';
        if (delta === null) {
          spanRate.textContent = 'N/A (insufficient cases in one or both terms)';
        } else {
          spanRate.textContent = deltaText(delta) + ' pp change (' + terms.current + ' vs ' + terms.previous + ')';
        }
        el.appendChild(spanRate);
        tooltip.style('opacity', 1)
          .style('left', (ev.clientX + 12) + 'px')
          .style('top', (ev.clientY - 10) + 'px');
      });

    updateLegendDelta();
  }

  function showNoData() {
    var svg = d3.select('#heatmap svg');
    svg.selectAll('.heatmap-cell').attr('fill', '#161b22');
    svg.selectAll('.cell-text').remove();
  }

  function updateLegendDelta() {
    var legendMin = document.getElementById('legend-min');
    var legendMax = document.getElementById('legend-max');
    var legendBar = document.querySelector('#heatmap-legend .legend-bar');
    if (legendMin) legendMin.textContent = '-40';
    if (legendMax) legendMax.textContent = '+40';
    if (legendBar) legendBar.style.background = 'linear-gradient(to right, #da3633, #1c1c1c, #2ea043)';
  }

  function restoreLegendRate() {
    var legendBar = document.querySelector('#heatmap-legend .legend-bar');
    if (legendBar) legendBar.style.background = 'linear-gradient(to right, #da3633, #d29922, #2ea043)';
  }

  // ---- Restore rate mode ----
  function restoreRate() {
    // Remove delta text elements
    d3.select('#heatmap svg').selectAll('.cell-text-delta').remove();

    restoreLegendRate();

    // Fire a change event on the term-filter select to trigger visualize.js's
    // own handler, which calls updateAllSelections and rebuilds the heatmap in rate mode.
    var termSelect = document.getElementById('term-filter');
    if (termSelect) {
      termSelect.dispatchEvent(new Event('change'));
    }
  }

})();
