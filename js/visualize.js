// ============================================
// DATA LOADING & GLOBALS
// ============================================
var PAIR_COLORS = ['#58a6ff', '#f78166', '#d2a8ff', '#7ee787', '#ffa657', '#ff7b72', '#79c0ff', '#56d4dd'];

fetch('data/dashboard_data.json').then(function(r) { return r.json(); }).then(function(DATA) {


// Make DATA available globally for other scripts
window.DATA = DATA;

var justices = DATA.justices;
var cases = DATA.cases.slice().sort(function(a, b) {
  var pa = a.date.split('/'), pb = b.date.split('/');
  var ya = parseInt(pa[2], 10) + (parseInt(pa[2], 10) < 50 ? 2000 : 1900);
  var yb = parseInt(pb[2], 10) + (parseInt(pb[2], 10) < 50 ? 2000 : 1900);
  var da = new Date(ya, parseInt(pa[0], 10) - 1, parseInt(pa[1], 10));
  var db = new Date(yb, parseInt(pb[0], 10) - 1, parseInt(pb[1], 10));
  return da - db;
});
var agreements = DATA.agreements;
var timeline = DATA.timeline;
var tooltip = d3.select('#tooltip');

// Selected pairs: array of { key: "A-B", names: [A, B], color: string }
var selectedPairs = [];
// Track which pair sections are collapsed (by pair key)
var collapsedPairs = {};
// Timeline overlay state (persists across updateTimeline calls)
var showCloseOverlay = false;
var showRollingOverlay = false;
var rollingWindowSize = 20;

var pairKey = window.pairKey;

function getRate(a, b) {
  if (a === b) return null;
  var key1 = a + '-' + b, key2 = b + '-' + a;
  var d = agreements[key1] || agreements[key2];
  return d ? d.rate : null;
}

function getCaseCount(a, b) {
  if (a === b) return 0;
  var key1 = a + '-' + b, key2 = b + '-' + a;
  var d = agreements[key1] || agreements[key2];
  return d ? d.cases : 0;
}

// Close-case (5-4 / 6-3) agreement utilities
var voteIndex = {};
DATA.votes.forEach(function(v) {
  if (!voteIndex[v.case_id]) voteIndex[v.case_id] = [];
  voteIndex[v.case_id].push(v);
});

function getCloseCaseIds(caseList) {
  var closeSet = new Set();
  caseList.forEach(function(c) {
    var cv = voteIndex[c.id];
    if (!cv) return;
    var disCount = 0;
    cv.forEach(function(v) { if (v.vote === 'dissent') disCount++; });
    if (disCount === 3 || disCount === 4) closeSet.add(c.id);
  });
  return closeSet;
}

function getCloseAgreements(closeCaseIds) {
  var result = {};
  Object.keys(timeline).forEach(function(key) {
    var tlData = timeline[key];
    var count = 0, agreed = 0;
    tlData.forEach(function(d) {
      if (closeCaseIds.has(d.case_id)) {
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

function getCloseRate(a, b, closeAgreements) {
  if (a === b) return null;
  if (!closeAgreements) return null;
  var key1 = a + '-' + b, key2 = b + '-' + a;
  var d = closeAgreements[key1] || closeAgreements[key2];
  return d ? d.rate : null;
}

function getCloseCaseCount(a, b, closeAgreements) {
  if (a === b) return 0;
  if (!closeAgreements) return 0;
  var key1 = a + '-' + b, key2 = b + '-' + a;
  var d = closeAgreements[key1] || closeAgreements[key2];
  return d ? d.cases : 0;
}

// Color scale (domain set after computing cell data)
var colorScale = d3.scaleLinear()
  .range(['#da3633', '#d29922', '#2ea043'])
  .clamp(true);

// ============================================
// TAB SWITCHING
// ============================================
(function() {
  var tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tabName = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(function(tc) {
        tc.classList.remove('active');
      });
      document.getElementById('tab-' + tabName).classList.add('active');
    });
  });
})();

// ============================================
// HEATMAP
// ============================================
var heatmapDiv = d3.select('#heatmap');
var hm = justices.length;
var cellSize = 48;
var labelWidth = 70;
var hmW = labelWidth + hm * cellSize;
var hmH = labelWidth + hm * cellSize + 20;

var hmSvg = heatmapDiv.append('svg')
  .attr('width', hmW)
  .attr('height', hmH);

// Row labels
hmSvg.selectAll('.row-label')
  .data(justices)
  .join('text')
  .attr('class', 'heatmap-label')
  .attr('x', labelWidth - 6)
  .attr('y', function(d, i) { return labelWidth + i * cellSize + cellSize / 2 + 4; })
  .attr('text-anchor', 'end')
  .text(function(d) { return d; });

// Col labels (rotated full names)
hmSvg.selectAll('.col-label')
  .data(justices)
  .join('text')
  .attr('class', 'heatmap-label')
  .attr('x', function(d, i) { return labelWidth + i * cellSize + cellSize / 2; })
  .attr('y', labelWidth - 6)
  .attr('text-anchor', 'start')
  .attr('transform', function(d, i) {
    var x = labelWidth + i * cellSize + cellSize / 2;
    return 'rotate(-45,' + x + ',' + (labelWidth - 6) + ')';
  })
  .text(function(d) { return d; });

// Cells — split triangle: upper = overall, lower = close-case
var initCloseCaseIds = getCloseCaseIds(cases);
var initCloseAgreements = getCloseAgreements(initCloseCaseIds);

var cellData = [];
justices.forEach(function(a, i) {
  justices.forEach(function(b, j) {
    var metric, rate, caseCount;
    if (i === j) {
      metric = 'diagonal'; rate = null; caseCount = 0;
    } else if (j > i) {
      metric = 'overall'; rate = getRate(a, b); caseCount = getCaseCount(a, b);
    } else {
      metric = 'close';
      rate = getCloseRate(a, b, initCloseAgreements);
      caseCount = getCloseCaseCount(a, b, initCloseAgreements);
    }
    cellData.push({ a: a, b: b, i: i, j: j, rate: rate, cases: caseCount, metric: metric });
  });
});

// Set color scale domain from actual data range (both triangles)
var rates = cellData.filter(function(d) { return d.rate !== null; }).map(function(d) { return d.rate; });
var minRate = Math.min.apply(null, rates);
var maxRate = Math.max.apply(null, rates);
var midRate = (minRate + maxRate) / 2;
colorScale.domain([minRate, midRate, maxRate]);

// Update legend range labels
document.getElementById('legend-min').textContent = Math.round(minRate) + '%';
document.getElementById('legend-max').textContent = Math.round(maxRate) + '%';

// Triangle legend
var triangleLegend = document.createElement('div');
triangleLegend.className = 'heatmap-triangle-legend';
var upperLabel = document.createElement('span');
upperLabel.textContent = '\u25e4 Upper: Overall';
triangleLegend.appendChild(upperLabel);
var sep = document.createElement('span');
sep.textContent = ' \u00b7 ';
sep.style.color = '#30363d';
triangleLegend.appendChild(sep);
var lowerLabel = document.createElement('span');
lowerLabel.textContent = '\u25e3 Lower: Close cases (5-4 / 6-3)';
triangleLegend.appendChild(lowerLabel);
document.getElementById('heatmap-legend').appendChild(triangleLegend);

function hmCellFill(d) {
  if (d.metric === 'diagonal') return '#161b22';
  if (d.rate === null) return '#0d1117';
  return colorScale(d.rate);
}

function hmTooltipText(d) {
  var label = d.metric === 'close' ? 'Close-case agreement' : 'Overall agreement';
  if (d.rate !== null) return label + ': ' + d.rate + '% (' + d.cases + ' cases)';
  return label + ': no close cases';
}

var hmCells = hmSvg.selectAll('.heatmap-cell')
  .data(cellData)
  .join('rect')
  .attr('class', 'heatmap-cell')
  .attr('x', function(d) { return labelWidth + d.j * cellSize; })
  .attr('y', function(d) { return labelWidth + d.i * cellSize; })
  .attr('width', cellSize - 2)
  .attr('height', cellSize - 2)
  .attr('rx', 3)
  .attr('fill', hmCellFill)
  .on('click', function(ev, d) {
    if (d.metric !== 'diagonal') togglePair(d.a, d.b);
  })
  .on('mouseover', function(ev, d) {
    if (d.metric !== 'diagonal') {
      showTooltip(ev, d.a + ' + ' + d.b, hmTooltipText(d));
    }
  })
  .on('mouseout', function() { tooltip.style('opacity', 0); });

// Cell text
hmSvg.selectAll('.cell-text')
  .data(cellData.filter(function(d) { return d.metric !== 'diagonal'; }))
  .join('text')
  .attr('class', 'cell-text')
  .attr('x', function(d) { return labelWidth + d.j * cellSize + cellSize / 2 - 1; })
  .attr('y', function(d) { return labelWidth + d.i * cellSize + cellSize / 2 + 4; })
  .attr('text-anchor', 'middle')
  .attr('fill', '#f0f6fc')
  .attr('font-size', '12px')
  .attr('font-weight', '500')
  .attr('pointer-events', 'none')
  .text(function(d) {
    if (d.rate !== null) return Math.round(d.rate);
    return '\u2014';
  });

// ============================================
// NETWORK GRAPH
// ============================================
var netDiv = d3.select('#network');
var netW = 440, netH = 380;
var netSvg = netDiv.append('svg')
  .attr('width', netW)
  .attr('height', netH);

// Wrap all network content in a <g> for zoom/pan
var networkG = netSvg.append('g');

var nodes = justices.map(function(name) { return { id: name }; });

var links = [];
var seen = new Set();
Object.keys(agreements).forEach(function(key) {
  var parts = key.split('-');
  var a = parts[0], b = parts[1];
  var sortedKey = [a, b].sort().join('-');
  if (seen.has(sortedKey)) return;
  seen.add(sortedKey);
  var rate = agreements[key].rate;
  if (rate > 0) {
    links.push({ source: a, target: b, rate: rate, cases: agreements[key].cases });
  }
});

var simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(function(d) { return d.id; }).distance(function(d) { return 180 - d.rate * 1.2; }).strength(function(d) { return d.rate / 200; }))
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(netW / 2, netH / 2))
  .force('collision', d3.forceCollide().radius(28));

var linkEls = networkG.append('g')
  .selectAll('.link')
  .data(links)
  .join('line')
  .attr('class', 'link')
  .attr('stroke', function(d) { return colorScale(d.rate); })
  .attr('stroke-width', function(d) { return Math.max(1, d.rate / 25); })
  .attr('stroke-opacity', function(d) { return 0.3 + d.rate / 200; })
  .on('click', function(ev, d) {
    togglePair(d.source.id, d.target.id);
  })
  .on('mouseover', function(ev, d) {
    showTooltip(ev, d.source.id + ' + ' + d.target.id, d.rate + '% agreement (' + d.cases + ' cases)');
  })
  .on('mouseout', function() { tooltip.style('opacity', 0); });

var nodeEls = networkG.append('g')
  .selectAll('.node')
  .data(nodes)
  .join('g')
  .attr('class', 'node')
  .call(d3.drag()
    .on('start', function(ev, d) { if (!ev.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', function(ev, d) { d.fx = ev.x; d.fy = ev.y; })
    .on('end', function(ev, d) { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
  );

nodeEls.append('circle')
  .attr('r', 20)
  .attr('fill', '#21262d');

nodeEls.append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '0.35em')
  .text(function(d) { return d.id.slice(0, 3); });

simulation.on('tick', function() {
  var pad = 35;
  nodes.forEach(function(d) {
    d.x = Math.max(pad, Math.min(netW - pad, d.x));
    d.y = Math.max(pad, Math.min(netH - pad, d.y));
  });
  linkEls
    .attr('x1', function(d) { return d.source.x; }).attr('y1', function(d) { return d.source.y; })
    .attr('x2', function(d) { return d.target.x; }).attr('y2', function(d) { return d.target.y; });
  nodeEls.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
});

// ============================================
// NETWORK ZOOM/PAN
// ============================================
var zoom = d3.zoom()
  .scaleExtent([0.3, 4])
  .on('zoom', function(event) {
    networkG.attr('transform', event.transform);
  });
netSvg.call(zoom);

// Zoom control buttons
(function() {
  var panel = document.querySelector('.panel-network');
  var controls = document.createElement('div');
  controls.className = 'network-zoom-controls';

  var btnIn = document.createElement('button');
  btnIn.textContent = '+';
  btnIn.title = 'Zoom in';
  btnIn.addEventListener('click', function() {
    netSvg.transition().duration(300).call(zoom.scaleBy, 1.4);
  });

  var btnOut = document.createElement('button');
  btnOut.textContent = '\u2212';
  btnOut.title = 'Zoom out';
  btnOut.addEventListener('click', function() {
    netSvg.transition().duration(300).call(zoom.scaleBy, 0.7);
  });

  var btnReset = document.createElement('button');
  btnReset.textContent = '\u21BA';
  btnReset.title = 'Reset zoom';
  btnReset.addEventListener('click', function() {
    netSvg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  });

  controls.appendChild(btnIn);
  controls.appendChild(btnOut);
  controls.appendChild(btnReset);
  panel.appendChild(controls);
})();

// ============================================
// TIMELINE
// ============================================
var tlDiv = d3.select('#timeline');
var tlMargin = { top: 18, right: 30, bottom: 50, left: 50 };
var tlH = 180;

// Responsive width
function getTimelineWidth() {
  var container = document.querySelector('.panel-timeline');
  if (!container) return 900;
  return container.clientWidth - 40 - tlMargin.left - tlMargin.right; // 40 for panel padding
}

var tlW = getTimelineWidth();

var tlSvgEl = tlDiv.append('svg')
  .attr('width', tlW + tlMargin.left + tlMargin.right)
  .attr('height', tlH + tlMargin.top + tlMargin.bottom);

var tlSvg = tlSvgEl.append('g')
  .attr('transform', 'translate(' + tlMargin.left + ',' + tlMargin.top + ')');

var yScale = d3.scaleLinear().domain([0, 100]).range([tlH, 0]);

// Axis groups (will be redrawn on filter change)
var tlXAxisGroup = tlSvg.append('g')
  .attr('class', 'axis')
  .attr('transform', 'translate(0,' + tlH + ')');

var tlYAxisGroup = tlSvg.append('g')
  .attr('class', 'axis')
  .call(d3.axisLeft(yScale).ticks(5).tickFormat(function(d) { return d + '%'; }));

var tlGridGroup = tlSvg.append('g')
  .attr('class', 'grid');

// Placeholder text
var tlPlaceholder = tlSvg.append('text')
  .attr('x', tlW / 2)
  .attr('y', tlH / 2)
  .attr('text-anchor', 'middle')
  .attr('fill', '#484f58')
  .attr('font-size', '14px')
  .text('Select a pair to see their agreement over time');

// Group for term stripes (behind everything), then lines and dots
var tlStripesGroup = tlSvg.append('g').attr('class', 'tl-stripes');
var tlTermLabelsGroup = tlSvg.append('g').attr('class', 'tl-term-labels');
var tlLinesGroup = tlSvg.append('g').attr('class', 'tl-lines');
var tlDotsGroup = tlSvg.append('g').attr('class', 'tl-dots');

// Timeline overlay toggle controls
(function() {
  var tlPanel = document.querySelector('.panel-timeline');
  if (!tlPanel) return;

  var controls = document.createElement('div');
  controls.id = 'timeline-overlay-controls';

  // Close-case checkbox
  var closeLabel = document.createElement('label');
  closeLabel.className = 'tl-overlay-label';
  var closeCheck = document.createElement('input');
  closeCheck.type = 'checkbox';
  closeCheck.id = 'tl-close-overlay-check';
  closeLabel.appendChild(closeCheck);
  var closeText = document.createElement('span');
  closeText.textContent = ' Close cases (5-4/6-3)';
  closeLabel.appendChild(closeText);
  controls.appendChild(closeLabel);

  var sep = document.createElement('span');
  sep.className = 'tl-overlay-sep';
  sep.textContent = ' \u00b7 ';
  controls.appendChild(sep);

  // Rolling window checkbox
  var rollingLabel = document.createElement('label');
  rollingLabel.className = 'tl-overlay-label';
  var rollingCheck = document.createElement('input');
  rollingCheck.type = 'checkbox';
  rollingCheck.id = 'tl-rolling-overlay-check';
  rollingLabel.appendChild(rollingCheck);
  var rollingText = document.createElement('span');
  rollingText.textContent = ' Rolling: ';
  rollingLabel.appendChild(rollingText);
  controls.appendChild(rollingLabel);

  // Window size select
  var sizeSelect = document.createElement('select');
  sizeSelect.id = 'tl-rolling-size';
  [10, 20, 30, 50].forEach(function(n) {
    var opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n + ' cases';
    if (n === 20) opt.selected = true;
    sizeSelect.appendChild(opt);
  });
  controls.appendChild(sizeSelect);

  tlPanel.appendChild(controls);

  closeCheck.addEventListener('change', function() {
    showCloseOverlay = this.checked;
    updateTimeline();
  });
  rollingCheck.addEventListener('change', function() {
    showRollingOverlay = this.checked;
    updateTimeline();
  });
  sizeSelect.addEventListener('change', function() {
    rollingWindowSize = parseInt(this.value, 10);
    if (showRollingOverlay) updateTimeline();
  });
})();

// ============================================
// TERM FILTER STATE
// ============================================
var currentTermFilter = 'last10';

// Build sorted list of distinct term years from data
var availableTermYears = [];
(function() {
  var seen = {};
  cases.forEach(function(c) {
    if (!seen[c.term_year]) { seen[c.term_year] = true; availableTermYears.push(c.term_year); }
  });
  availableTermYears.sort(function(a, b) { return a - b; });

  // Dynamically label Current/Last Term options with actual years
  var termSelect = document.getElementById('term-filter');
  if (termSelect && availableTermYears.length >= 2) {
    termSelect.options[0].text = 'Current Term (' + availableTermYears[availableTermYears.length - 1] + ')';
    termSelect.options[1].text = 'Last Term (' + availableTermYears[availableTermYears.length - 2] + ')';
  }
})();

// Expose filter state globally for other scripts (feed.js)
window.currentTermFilter = currentTermFilter;

function getTermRange() {
  var n = availableTermYears.length;
  switch (currentTermFilter) {
    case 'current': return [availableTermYears[n - 1], availableTermYears[n - 1]];
    case 'last': return [availableTermYears[n - 2], availableTermYears[n - 2]];
    case 'last3': {
      var start = availableTermYears[Math.max(0, n - 3)];
      return [start, availableTermYears[n - 1]];
    }
    case 'all': return [availableTermYears[0], availableTermYears[n - 1]];
    case 'last10':
    default: {
      var start = availableTermYears[Math.max(0, n - 10)];
      return [start, availableTermYears[n - 1]];
    }
  }
}

function getFilteredCases() {
  var range = getTermRange();
  return cases.filter(function(c) {
    return c.term_year >= range[0] && c.term_year <= range[1];
  });
}

// Expose globally for feed.js
window.getFilteredCases = getFilteredCases;

// Recompute agreement rates from only the cases in the selected term range
function getFilteredAgreements() {
  if (currentTermFilter === 'all') return null; // use original data
  var filteredCaseIds = new Set(getFilteredCases().map(function(c) { return c.id; }));
  var result = {};
  Object.keys(timeline).forEach(function(key) {
    var tlData = timeline[key];
    var count = 0, agreed = 0;
    tlData.forEach(function(d) {
      if (filteredCaseIds.has(d.case_id)) {
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

function getFilteredRate(a, b, filteredAgreements) {
  if (a === b) return null;
  if (!filteredAgreements) return getRate(a, b);
  var key1 = a + '-' + b, key2 = b + '-' + a;
  var d = filteredAgreements[key1] || filteredAgreements[key2];
  return d ? d.rate : null;
}

function getFilteredCaseCount(a, b, filteredAgreements) {
  if (a === b) return 0;
  if (!filteredAgreements) return getCaseCount(a, b);
  var key1 = a + '-' + b, key2 = b + '-' + a;
  var d = filteredAgreements[key1] || filteredAgreements[key2];
  return d ? d.cases : 0;
}

function parseTermDate(dateStr) {
  var parts = dateStr.split('/');
  var month = parseInt(parts[0], 10);
  var day = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  year += year < 50 ? 2000 : 1900;
  return new Date(year, month - 1, day);
}

// Header term range display
var headerTermRange = document.getElementById('header-term-range');
function updateHeaderTermRange() {
  if (!headerTermRange) return;
  var range = getTermRange();
  var filteredCases = getFilteredCases();
  if (range[0] === range[1]) {
    headerTermRange.textContent = 'OT' + range[0] + ' \u2022 ' + filteredCases.length + ' cases';
  } else {
    headerTermRange.textContent = 'OT' + range[0] + '\u2013' + range[1] + ' \u2022 ' + filteredCases.length + ' cases';
  }
}
updateHeaderTermRange();

// Term filter controls
(function() {
  var termSelect = document.getElementById('term-filter');

  termSelect.addEventListener('change', function() {
    currentTermFilter = termSelect.value;
    window.currentTermFilter = currentTermFilter;
    updateHeaderTermRange();
    updateAllSelections();
    window.dispatchEvent(new Event('scotusgami-filter-change'));
  });
})();

// Responsive resize
window.addEventListener('resize', function() {
  tlW = getTimelineWidth();
  tlSvgEl.attr('width', tlW + tlMargin.left + tlMargin.right);
  tlPlaceholder.attr('x', tlW / 2);
  updateTimeline();
});

// ============================================
// TOOLTIP HELPER
// ============================================
function showTooltip(ev, titleText, detailText) {
  var el = tooltip.node();
  while (el.firstChild) el.removeChild(el.firstChild);
  var spanPair = document.createElement('span');
  spanPair.className = 'pair';
  spanPair.textContent = titleText;
  el.appendChild(spanPair);
  el.appendChild(document.createElement('br'));
  var spanRate = document.createElement('span');
  spanRate.className = 'rate';
  spanRate.textContent = detailText;
  el.appendChild(spanRate);
  tooltip.style('opacity', 1)
    .style('left', (ev.clientX + 12) + 'px')
    .style('top', (ev.clientY - 10) + 'px');
}

function showDotTooltip(ev, caseName, rate, agreed) {
  var el = tooltip.node();
  while (el.firstChild) el.removeChild(el.firstChild);
  var spanPair = document.createElement('span');
  spanPair.className = 'pair';
  spanPair.textContent = caseName;
  el.appendChild(spanPair);
  el.appendChild(document.createElement('br'));
  var spanLabel = document.createTextNode('Running: ');
  el.appendChild(spanLabel);
  var spanRate = document.createElement('span');
  spanRate.className = 'rate';
  spanRate.textContent = rate.toFixed(0) + '%';
  el.appendChild(spanRate);
  el.appendChild(document.createElement('br'));
  var statusText = document.createTextNode(agreed ? '\u2713 Agreed' : '\u2717 Disagreed');
  el.appendChild(statusText);
  tooltip.style('opacity', 1)
    .style('left', (ev.clientX + 12) + 'px')
    .style('top', (ev.clientY - 10) + 'px');
}

// ============================================
// MULTI-SELECT: TOGGLE PAIR
// ============================================
function togglePair(a, b) {
  var key = pairKey(a, b);
  var idx = selectedPairs.findIndex(function(p) { return p.key === key; });

  if (idx >= 0) {
    // Deselect
    delete collapsedPairs[key];
    selectedPairs.splice(idx, 1);
    // Reassign colors to keep them sequential
    selectedPairs.forEach(function(p, i) { p.color = PAIR_COLORS[i % PAIR_COLORS.length]; });
  } else {
    // Select
    var color = PAIR_COLORS[selectedPairs.length % PAIR_COLORS.length];
    selectedPairs.push({ key: key, names: [a, b].sort(), color: color });
  }

  updateAllSelections();
}

function clearAllPairs() {
  selectedPairs = [];
  collapsedPairs = {};
  updateAllSelections();
}

document.getElementById('btn-clear-all').addEventListener('click', clearAllPairs);

function updateAllSelections() {
  var filteredAgreements = getFilteredAgreements();
  updateHeatmapData(filteredAgreements);
  updateHeatmapSelection();
  updateNetworkData(filteredAgreements);
  updateNetworkSelection();
  updateTimeline();
  updatePairDetail();

  // Show/hide clear button
  document.getElementById('btn-clear-all').style.display = selectedPairs.length > 0 ? 'inline-block' : 'none';
}

// ============================================
// HEATMAP DATA UPDATE (term filter)
// ============================================
function updateHeatmapData(filteredAgreements) {
  // Compute close-case data for filtered range
  var filteredCases = getFilteredCases();
  var closeCaseIds = getCloseCaseIds(filteredCases);
  var closeAgreements = getCloseAgreements(closeCaseIds);

  // Update cellData rates by metric
  cellData.forEach(function(d) {
    if (d.metric === 'diagonal') return;
    if (d.metric === 'overall') {
      d.rate = getFilteredRate(d.a, d.b, filteredAgreements);
      d.cases = getFilteredCaseCount(d.a, d.b, filteredAgreements);
    } else {
      d.rate = getCloseRate(d.a, d.b, closeAgreements);
      d.cases = getCloseCaseCount(d.a, d.b, closeAgreements);
    }
  });

  // Recompute color scale domain from all non-null rates
  var rates = cellData.filter(function(d) { return d.rate !== null; }).map(function(d) { return d.rate; });
  if (rates.length > 0) {
    var minR = Math.min.apply(null, rates);
    var maxR = Math.max.apply(null, rates);
    var midR = (minR + maxR) / 2;
    colorScale.domain([minR, midR, maxR]);
    document.getElementById('legend-min').textContent = Math.round(minR) + '%';
    document.getElementById('legend-max').textContent = Math.round(maxR) + '%';
  }

  // Update cell fill colors
  hmCells.attr('fill', hmCellFill);

  // Update cell text values
  hmSvg.selectAll('.cell-text').remove();
  hmSvg.selectAll('.cell-text')
    .data(cellData.filter(function(d) { return d.metric !== 'diagonal'; }))
    .join('text')
    .attr('class', 'cell-text')
    .attr('x', function(d) { return labelWidth + d.j * cellSize + cellSize / 2 - 1; })
    .attr('y', function(d) { return labelWidth + d.i * cellSize + cellSize / 2 + 4; })
    .attr('text-anchor', 'middle')
    .attr('fill', '#f0f6fc')
    .attr('font-size', '12px')
    .attr('font-weight', '500')
    .attr('pointer-events', 'none')
    .text(function(d) {
      if (d.rate !== null) return Math.round(d.rate);
      return '\u2014';
    });

  // Update heatmap tooltip on hover
  hmCells.on('mouseover', function(ev, d) {
    if (d.metric !== 'diagonal') {
      showTooltip(ev, d.a + ' + ' + d.b, hmTooltipText(d));
    }
  });

}

// ============================================
// NETWORK DATA UPDATE (term filter)
// ============================================
function updateNetworkData(filteredAgreements) {
  // Update link data rates
  links.forEach(function(lk) {
    var srcId = typeof lk.source === 'object' ? lk.source.id : lk.source;
    var tgtId = typeof lk.target === 'object' ? lk.target.id : lk.target;
    var r = getFilteredRate(srcId, tgtId, filteredAgreements);
    var c = getFilteredCaseCount(srcId, tgtId, filteredAgreements);
    lk.rate = r !== null ? r : 0;
    lk.cases = c;
  });

  // Update link visuals
  linkEls
    .attr('stroke', function(d) { return colorScale(d.rate); })
    .attr('stroke-width', function(d) { return Math.max(1, d.rate / 25); })
    .attr('stroke-opacity', function(d) { return 0.3 + d.rate / 200; });

  // Update link tooltips
  linkEls.on('mouseover', function(ev, d) {
    var srcId = typeof d.source === 'object' ? d.source.id : d.source;
    var tgtId = typeof d.target === 'object' ? d.target.id : d.target;
    showTooltip(ev, srcId + ' + ' + tgtId, d.rate + '% agreement (' + d.cases + ' cases)');
  });

  // Update simulation link forces
  simulation.force('link')
    .distance(function(d) { return 180 - d.rate * 1.2; })
    .strength(function(d) { return d.rate / 200; });
  simulation.alpha(0.3).restart();
}

// ============================================
// HEATMAP SELECTION (with white stroke highlight)
// ============================================
function updateHeatmapSelection() {
  hmCells.each(function(d) {
    var cellKey = pairKey(d.a, d.b);
    var sel = selectedPairs.find(function(p) { return p.key === cellKey; });
    var el = d3.select(this);
    if (sel) {
      el.classed('selected', true).attr('stroke', '#f0f6fc').attr('stroke-width', 3);
    } else {
      el.classed('selected', false).attr('stroke', '#0d1117').attr('stroke-width', 1.5);
    }
  });
}

// ============================================
// NETWORK SELECTION
// ============================================
function updateNetworkSelection() {
  var hasSelection = selectedPairs.length > 0;
  var selectedJustices = new Set();
  selectedPairs.forEach(function(p) {
    selectedJustices.add(p.names[0]);
    selectedJustices.add(p.names[1]);
  });

  linkEls.each(function(d) {
    var lk = pairKey(d.source.id, d.target.id);
    var sel = selectedPairs.find(function(p) { return p.key === lk; });
    var el = d3.select(this);
    if (sel) {
      el.classed('selected', true).classed('dimmed', false).attr('stroke', sel.color);
    } else if (hasSelection) {
      el.classed('selected', false).classed('dimmed', true).attr('stroke', colorScale(d.rate));
    } else {
      el.classed('selected', false).classed('dimmed', false).attr('stroke', colorScale(d.rate));
    }
  });

  nodeEls.classed('dimmed', function(d) {
    return hasSelection && !selectedJustices.has(d.id);
  });
}

// ============================================
// TIMELINE UPDATE
// ============================================
function updateTimeline() {
  // Clear old
  tlLinesGroup.selectAll('*').remove();
  tlDotsGroup.selectAll('*').remove();
  tlXAxisGroup.selectAll('*').remove();
  tlGridGroup.selectAll('*').remove();
  tlStripesGroup.selectAll('*').remove();
  tlTermLabelsGroup.selectAll('*').remove();
  tlYAxisGroup.selectAll('*').remove();

  // Recompute responsive width
  tlW = getTimelineWidth();
  tlSvgEl.attr('width', tlW + tlMargin.left + tlMargin.right);
  tlPlaceholder.attr('x', tlW / 2);

  // Get filtered cases and build X scale
  var filteredCases = getFilteredCases();
  var filteredCaseIds = new Set(filteredCases.map(function(c) { return c.id; }));

  var xScale = d3.scalePoint()
    .domain(filteredCases.map(function(c) { return c.id; }))
    .range([0, tlW])
    .padding(0.5);

  // --- Term stripes and labels (always drawn, even with no pairs selected) ---
  var termGroups = [];
  var currentTerm = null;
  filteredCases.forEach(function(c) {
    if (!currentTerm || currentTerm.term !== c.term_year) {
      currentTerm = { term: c.term_year, firstId: c.id, lastId: c.id };
      termGroups.push(currentTerm);
    } else {
      currentTerm.lastId = c.id;
    }
  });

  var step = xScale.step ? xScale.step() : (filteredCases.length > 1 ? tlW / (filteredCases.length - 1) : tlW);
  var halfStep = step / 2;

  termGroups.forEach(function(tg, i) {
    var x1 = Math.max(0, xScale(tg.firstId) - halfStep);
    var x2 = Math.min(tlW, xScale(tg.lastId) + halfStep);

    // Alternating stripe background
    if (i % 2 === 1) {
      tlStripesGroup.append('rect')
        .attr('x', x1)
        .attr('y', 0)
        .attr('width', x2 - x1)
        .attr('height', tlH)
        .attr('fill', '#161b22')
        .attr('opacity', 0.6);
    }

    // Term label at top
    tlTermLabelsGroup.append('text')
      .attr('x', (x1 + x2) / 2)
      .attr('y', -2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#484f58')
      .attr('font-size', '10px')
      .text('OT' + tg.term);
  });

  if (selectedPairs.length === 0) {
    tlPlaceholder.style('display', 'block');
    // Default Y-axis 0-100
    yScale.domain([0, 100]);
    tlYAxisGroup.call(d3.axisLeft(yScale).ticks(5).tickFormat(function(d) { return d + '%'; }));
    tlGridGroup.call(d3.axisLeft(yScale).ticks(5).tickSize(-tlW).tickFormat(''));
    tlGridGroup.select('.domain').remove();
    return;
  }

  tlPlaceholder.style('display', 'none');

  // --- Compute all points first to determine dynamic Y range ---
  var caseOrder = {};
  cases.forEach(function(c, idx) { caseOrder[c.id] = idx; });

  // Justice start terms to filter bad data
  var JUSTICE_START_TERM = {
    'Roberts': 2005, 'Thomas': 2005, 'Alito': 2005, 'Stevens': 2005,
    'Souter': 2005, 'Ginsburg': 2005, 'Breyer': 2005, 'OConnor': 2005,
    'Kennedy': 2005, 'Scalia': 2005,
    'Sotomayor': 2009, 'Kagan': 2010, 'Gorsuch': 2016,
    'Kavanaugh': 2018, 'Barrett': 2020, 'Jackson': 2022
  };

  // Case -> term_year lookup
  var caseTermYear = {};
  cases.forEach(function(c) { caseTermYear[c.id] = c.term_year; });

  var closeCaseIdsSet = getCloseCaseIds(filteredCases);

  var allPairPoints = [];
  selectedPairs.forEach(function(pair) {
    var key1 = pair.names[0] + '-' + pair.names[1];
    var key2 = pair.names[1] + '-' + pair.names[0];
    var tlData = timeline[key1] || timeline[key2] || [];
    if (tlData.length === 0) return;

    // Filter out cases before either justice joined the court
    var minStart = Math.max(
      JUSTICE_START_TERM[pair.names[0]] || 2005,
      JUSTICE_START_TERM[pair.names[1]] || 2005
    );

    var sortedTlData = tlData.slice()
      .filter(function(d) {
        var termYear = caseTermYear[d.case_id];
        return termYear === undefined || termYear >= minStart;
      })
      .sort(function(a, b) {
        return (caseOrder[a.case_id] || 0) - (caseOrder[b.case_id] || 0);
      });

    var running = 0;
    var allPoints = sortedTlData.map(function(d, i) {
      running += d.agreed;
      return { case_id: d.case_id, rate: (running / (i + 1)) * 100, agreed: d.agreed };
    });

    var points = allPoints.filter(function(p) {
      return filteredCaseIds.has(p.case_id);
    });

    // Close-case overlay data
    var closePts = [];
    if (showCloseOverlay) {
      var closeRunning = 0, closeCount = 0;
      sortedTlData.forEach(function(d) {
        if (filteredCaseIds.has(d.case_id) && closeCaseIdsSet.has(d.case_id)) {
          closeCount++;
          closeRunning += d.agreed;
          closePts.push({ case_id: d.case_id, rate: (closeRunning / closeCount) * 100 });
        }
      });
    }

    // Rolling window overlay data
    var rollingPts = [];
    if (showRollingOverlay) {
      var N = rollingWindowSize;
      var filteredSorted = sortedTlData.filter(function(d) { return filteredCaseIds.has(d.case_id); });
      filteredSorted.forEach(function(d, i) {
        var start = Math.max(0, i - N + 1);
        var slice = filteredSorted.slice(start, i + 1);
        var sum = slice.reduce(function(acc, s) { return acc + s.agreed; }, 0);
        rollingPts.push({ case_id: d.case_id, rate: (sum / slice.length) * 100 });
      });
    }

    if (points.length > 0) {
      allPairPoints.push({ pair: pair, points: points, closePts: closePts, rollingPts: rollingPts });
    }
  });

  // Dynamic Y-axis: find min/max across all visible points, add 5% padding
  var yMin = 100, yMax = 0;
  allPairPoints.forEach(function(pp) {
    pp.points.forEach(function(p) {
      if (p.rate < yMin) yMin = p.rate;
      if (p.rate > yMax) yMax = p.rate;
    });
    (pp.closePts || []).forEach(function(p) {
      if (p.rate < yMin) yMin = p.rate;
      if (p.rate > yMax) yMax = p.rate;
    });
    (pp.rollingPts || []).forEach(function(p) {
      if (p.rate < yMin) yMin = p.rate;
      if (p.rate > yMax) yMax = p.rate;
    });
  });
  var yPad = Math.max(3, (yMax - yMin) * 0.1);
  yMin = Math.max(0, Math.floor(yMin - yPad));
  yMax = Math.min(100, Math.ceil(yMax + yPad));
  if (yMin === yMax) { yMin = Math.max(0, yMin - 5); yMax = Math.min(100, yMax + 5); }

  yScale.domain([yMin, yMax]);
  tlYAxisGroup.call(d3.axisLeft(yScale).ticks(5).tickFormat(function(d) { return d + '%'; }));

  // X axis labels
  var isSingleTerm = (currentTermFilter === 'current' || currentTermFilter === 'last');
  var isAllTerms = (currentTermFilter === 'last10');

  if (isAllTerms || (!isSingleTerm && filteredCases.length > 50)) {
    var termYearTicks = [];
    var seenYears = new Set();
    filteredCases.forEach(function(c) {
      if (!seenYears.has(c.term_year)) {
        seenYears.add(c.term_year);
        termYearTicks.push(c.id);
      }
    });
    tlXAxisGroup.call(
      d3.axisBottom(xScale)
        .tickValues(termYearTicks)
        .tickFormat(function(id) {
          var c = filteredCases.find(function(fc) { return fc.id === id; });
          return c ? String(c.term_year) : '';
        })
    );
    tlXAxisGroup.selectAll('text')
      .attr('text-anchor', 'middle');
  } else {
    var tickValues = filteredCases.map(function(c) { return c.id; });
    if (tickValues.length > 30) {
      var tvStep = Math.ceil(tickValues.length / 30);
      tickValues = tickValues.filter(function(v, i) { return i % tvStep === 0; });
    }
    tlXAxisGroup.call(
      d3.axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(function(id) {
          var c = filteredCases.find(function(fc) { return fc.id === id; });
          return c ? c.date : '';
        })
    );
    tlXAxisGroup.selectAll('text')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.5em');
  }

  // Grid
  tlGridGroup.call(d3.axisLeft(yScale).ticks(5).tickSize(-tlW).tickFormat(''));
  tlGridGroup.select('.domain').remove();

  // Draw lines
  allPairPoints.forEach(function(pp) {
    var line = d3.line()
      .x(function(d) { return xScale(d.case_id); })
      .y(function(d) { return yScale(d.rate); })
      .curve(d3.curveMonotoneX);

    tlLinesGroup.append('path')
      .attr('class', 'timeline-path')
      .datum(pp.points)
      .attr('d', line)
      .attr('stroke', pp.pair.color)
      .attr('stroke-opacity', 1);

    // Invisible wider path for hover detection
    tlDotsGroup.append('path')
      .datum(pp.points)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 14)
      .attr('d', line)
      .on('mousemove', (function(pair, points) {
        return function(event) {
          var coords = d3.pointer(event, tlSvg.node());
          var xPos = coords[0];
          // Find closest point by x position
          var closest = points.reduce(function(best, p) {
            var dist = Math.abs(xScale(p.case_id) - xPos);
            var bestDist = Math.abs(xScale(best.case_id) - xPos);
            return dist < bestDist ? p : best;
          });
          var c = cases.find(function(fc) { return fc.id === closest.case_id; });
          var caseName = c ? c.name : closest.case_id;
          showTooltip(event, pair.names[0] + ' + ' + pair.names[1], closest.rate.toFixed(1) + '% \u2014 ' + caseName);
        };
      })(pp.pair, pp.points))
      .on('mouseout', function() {
        tooltip.style('opacity', 0);
      });

    // Close-case overlay (dashed)
    if (showCloseOverlay && pp.closePts.length > 1) {
      tlLinesGroup.append('path')
        .datum(pp.closePts)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', pp.pair.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-opacity', 0.7);

      tlDotsGroup.append('path')
        .datum(pp.closePts)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 14)
        .attr('d', line)
        .on('mousemove', (function(pair, pts) {
          return function(event) {
            var coords = d3.pointer(event, tlSvg.node());
            var xPos = coords[0];
            var closest = pts.reduce(function(best, p) {
              return Math.abs(xScale(p.case_id) - xPos) < Math.abs(xScale(best.case_id) - xPos) ? p : best;
            });
            var c = cases.find(function(fc) { return fc.id === closest.case_id; });
            showTooltip(event, pair.names[0] + ' + ' + pair.names[1] + ' (close cases)', closest.rate.toFixed(1) + '% \u2014 ' + (c ? c.name : ''));
          };
        })(pp.pair, pp.closePts))
        .on('mouseout', function() { tooltip.style('opacity', 0); });
    }

    // Rolling window overlay (dotted)
    if (showRollingOverlay && pp.rollingPts.length > 1) {
      tlLinesGroup.append('path')
        .datum(pp.rollingPts)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', pp.pair.color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,3')
        .attr('stroke-opacity', 0.65);

      tlDotsGroup.append('path')
        .datum(pp.rollingPts)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 14)
        .attr('d', line)
        .on('mousemove', (function(pair, pts) {
          return function(event) {
            var coords = d3.pointer(event, tlSvg.node());
            var xPos = coords[0];
            var closest = pts.reduce(function(best, p) {
              return Math.abs(xScale(p.case_id) - xPos) < Math.abs(xScale(best.case_id) - xPos) ? p : best;
            });
            var c = cases.find(function(fc) { return fc.id === closest.case_id; });
            showTooltip(event, pair.names[0] + ' + ' + pair.names[1] + ' (' + rollingWindowSize + '-case rolling)', closest.rate.toFixed(1) + '% \u2014 ' + (c ? c.name : ''));
          };
        })(pp.pair, pp.rollingPts))
        .on('mouseout', function() { tooltip.style('opacity', 0); });
    }
  });
}

// ============================================
// PAIR DETAIL PANEL
// ============================================
function updatePairDetail() {
  var container = document.getElementById('pair-detail');
  while (container.firstChild) container.removeChild(container.firstChild);

  if (selectedPairs.length === 0) {
    var placeholder = document.createElement('div');
    placeholder.className = 'pair-detail-placeholder';
    placeholder.textContent = 'Select pairs from the heatmap or network to see details';
    container.appendChild(placeholder);
    return;
  }

  selectedPairs.forEach(function(pair) {
    var section = document.createElement('div');
    section.className = 'pair-section';

    // Header (clickable to collapse)
    var header = document.createElement('div');
    header.className = 'pair-section-header';
    var chevron = document.createElement('span');
    chevron.className = 'pair-section-chevron';
    chevron.textContent = '\u25BC';
    header.appendChild(chevron);
    var dot = document.createElement('div');
    dot.className = 'pair-color-dot';
    dot.style.backgroundColor = pair.color;
    header.appendChild(dot);
    var title = document.createElement('div');
    title.className = 'pair-section-title';
    title.textContent = pair.names[0] + ' + ' + pair.names[1];
    header.appendChild(title);
    section.appendChild(header);

    // Collapsible body
    var body = document.createElement('div');
    body.className = 'pair-section-body';

    // Stats (lifetime agreement)
    var rate = getRate(pair.names[0], pair.names[1]);
    var caseCount = getCaseCount(pair.names[0], pair.names[1]);
    var stats = document.createElement('div');
    stats.className = 'pair-section-stats';
    var statsText = (rate !== null ? rate + '% agreement' : 'No data') + ' \u2014 ' + caseCount + ' cases';
    if (currentTermFilter !== 'all') statsText += ' (lifetime)';
    stats.textContent = statsText;
    body.appendChild(stats);

    // Case list — filtered to selected term range
    var key1 = pair.names[0] + '-' + pair.names[1];
    var key2 = pair.names[1] + '-' + pair.names[0];
    var tlData = timeline[key1] || timeline[key2] || [];
    var filteredCaseIds = new Set(getFilteredCases().map(function(c) { return c.id; }));
    var filteredTlData = tlData.filter(function(d) { return filteredCaseIds.has(d.case_id); });

    // Show most recent cases first
    filteredTlData = filteredTlData.slice().reverse();

    if (filteredTlData.length > 0) {
      var ul = document.createElement('ul');
      ul.className = 'pair-case-list';
      filteredTlData.forEach(function(d) {
        var li = document.createElement('li');
        var icon = document.createElement('span');
        icon.className = 'pair-case-icon ' + (d.agreed ? 'agreed' : 'disagreed');
        icon.textContent = d.agreed ? '\u2713' : '\u2717';
        li.appendChild(icon);
        var c = cases.find(function(c) { return c.id === d.case_id; });
        var nameLink = document.createElement('a');
        nameLink.className = 'pair-case-name pair-case-link';
        nameLink.textContent = c ? c.name : d.case_id;
        nameLink.href = '#';
        nameLink.addEventListener('click', function(ev) {
          ev.preventDefault();
          var caseId = d.case_id;
          switchToTab('data', function() {
            var caseListItems = document.querySelectorAll('#case-list li');
            caseListItems.forEach(function(item) {
              var datum = d3.select(item).datum();
              if (datum && datum.id === caseId) {
                item.click();
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            });
          });
        });
        li.appendChild(nameLink);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    section.appendChild(body);

    // Restore collapse state if previously collapsed
    if (collapsedPairs[pair.key]) {
      body.classList.add('collapsed');
      chevron.classList.add('collapsed');
    }

    // Toggle collapse on header click
    header.addEventListener('click', function() {
      var isCollapsed = body.classList.toggle('collapsed');
      collapsedPairs[pair.key] = isCollapsed;
      if (isCollapsed) {
        chevron.classList.add('collapsed');
      } else {
        chevron.classList.remove('collapsed');
      }
    });

    container.appendChild(section);
  });
}

// ============================================
// TOP COALITIONS VIZ PANEL
// Consumes shared data from coalitions-tab.js (window.coalitionMajEntries/DisEntries)
// ============================================
(function() {
  var vizMajList = document.getElementById('coalition-viz-maj');
  var vizDisList = document.getElementById('coalition-viz-dis');
  if (!vizMajList || !vizDisList) return;

  function renderVizGroupList(listEl, entries, topN) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (!entries || entries.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No groups in selected range';
      listEl.appendChild(empty);
      return;
    }
    entries.slice(0, topN).forEach(function(entry) {
      var item = document.createElement('div');
      item.className = 'coalition-group-item';

      var header = document.createElement('div');
      header.className = 'coalition-group-header';

      var namesSpan = document.createElement('span');
      namesSpan.className = 'coalition-group-names';
      namesSpan.textContent = entry.names.join(', ');
      header.appendChild(namesSpan);

      var countBadge = document.createElement('span');
      countBadge.className = 'coalition-group-count';
      countBadge.textContent = entry.cases.length + (entry.cases.length === 1 ? ' case' : ' cases');
      header.appendChild(countBadge);

      var sizeLabel = document.createElement('span');
      sizeLabel.className = 'coalition-group-size';
      sizeLabel.textContent = entry.names.length + 'J';
      header.appendChild(sizeLabel);

      item.appendChild(header);

      // Expandable case list
      var caseList = document.createElement('div');
      caseList.className = 'coalition-case-list collapsed';

      entry.cases.slice().sort(function(a, b) {
        return parseDate(b.date) - parseDate(a.date);
      }).forEach(function(c) {
        var caseRow = document.createElement('a');
        caseRow.href = '#';
        caseRow.className = 'coalition-case-row';
        caseRow.textContent = c.name + ' (' + c.date + ')';
        caseRow.addEventListener('click', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          switchToTab('data', function() {
            var caseListItems = document.querySelectorAll('#case-list li');
            caseListItems.forEach(function(li) {
              var datum = d3.select(li).datum();
              if (datum && datum.id === c.id) {
                li.click();
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            });
          });
        });
        caseList.appendChild(caseRow);
      });

      item.appendChild(caseList);

      header.addEventListener('click', function() {
        var isCollapsed = caseList.classList.contains('collapsed');
        if (isCollapsed) {
          caseList.classList.remove('collapsed');
          item.classList.add('expanded');
        } else {
          caseList.classList.add('collapsed');
          item.classList.remove('expanded');
        }
      });

      listEl.appendChild(item);
    });
  }

  function renderCoalitionViz() {
    renderVizGroupList(vizMajList, window.coalitionMajEntries, 10);
    renderVizGroupList(vizDisList, window.coalitionDisEntries, 10);
  }

  // Data comes from coalitions-tab.js after scotusgami-indexes-ready
  window.addEventListener('scotusgami-indexes-ready', renderCoalitionViz);
  window.addEventListener('scotusgami-filter-change', renderCoalitionViz);
})();

// ============================================
// PANEL HELP TOOLTIPS
// Adds ? icon to panel headers with hover descriptions
// ============================================
(function() {
  var tips = {
    'Agreement Heatmap': 'How often each pair of justices votes on the same side, as a percentage.\n\nUpper triangle = overall agreement. Lower triangle = close-case agreement (5-4 and 6-3 only). Click any cell for full history.\n\nRed = low agreement \u00b7 Yellow = mid \u00b7 Green = high',
    'Coalition Network': 'Justices that agree more are pulled closer together.\n\nThicker lines = higher agreement. Drag nodes to rearrange. Zoom with +/\u2013 or scroll wheel.',
    'SCOTUSgami Feed': 'A feed of notable voting events, newest first.\n\nGold border = SCOTUSgami (a genuinely novel coalition)',
    'Agreement Over Time': 'Cumulative agreement percentage over time for your selected pairs.\n\nSelect pairs by clicking cells in the heatmap or nodes in the network.\n\nOptional overlays: Close cases (dashed) shows 5-4/6-3 only. Rolling window (dotted) shows a moving N-case average.\n\nSolid = cumulative \u00b7 Dashed = close cases \u00b7 Dotted = rolling',
    'Vote Configuration Grid': 'How many cases had each combination of majority size and concurrence count.\n\nDashes mark vote splits that have never occurred \u2014 a SCOTUSgami waiting to happen.',
    'Top Coalitions': 'The most common majority and dissent groupings in the selected time range.\n\nClick any group to expand and see individual cases.',
    'Swing Score (Close Decisions)': 'How often each justice ends up on the winning side in close decisions (5-4 and 6-3).\n\nHigher percentage = more often in the majority on contested cases.',
    'Ideology Drift': 'Each justice\u2019s ideological lean over time, measured as liberal bloc agreement minus conservative bloc agreement.\n\nClick names in the legend to toggle lines.\n\nAbove zero = more liberal-aligned \u00b7 Below zero = more conservative-aligned',
    'Unusual Bedfellows': 'Cases where justice pairs agreed after a long streak of consecutive disagreements.\n\nClick any entry to expand the pair grid showing all streak-breaking alignments.\n\nRed = 10+ disagreements \u00b7 Yellow = 6\u20139 \u00b7 Blue = 3\u20135'
  };

  var panels = document.querySelectorAll('#tab-visualize .panel-title');
  panels.forEach(function(titleEl) {
    var text = titleEl.textContent.trim();
    if (!tips[text]) return;

    var helpIcon = document.createElement('span');
    helpIcon.className = 'panel-help-icon';
    helpIcon.textContent = '?';
    helpIcon.setAttribute('tabindex', '0');

    var tooltip = document.createElement('div');
    tooltip.className = 'panel-help-tooltip';
    tips[text].split('\n\n').forEach(function(para, i) {
      var p = document.createElement('p');
      p.textContent = para;
      if (i > 0) p.style.marginTop = '6px';
      tooltip.appendChild(p);
    });

    helpIcon.appendChild(tooltip);
    titleEl.appendChild(helpIcon);
  });
})();

// Dispatch event so other scripts know data is ready
window.dispatchEvent(new Event('scotusgami-data-ready'));

// Hide loading overlay
var loadingOverlay = document.getElementById('loading-overlay');
if (loadingOverlay) loadingOverlay.classList.add('hidden');

}).catch(function(err) {
  console.error('Failed to load dashboard data:', err);
  var loadingEl = document.getElementById('loading-overlay');
  if (loadingEl) loadingEl.classList.add('hidden');
  var body = document.querySelector('.viz-grid') || document.body;
  var errDiv = document.createElement('div');
  errDiv.className = 'pair-detail-placeholder';
  errDiv.style.cssText = 'padding: 40px; grid-column: 1 / -1;';
  errDiv.textContent = 'Failed to load data. Run "python export_data.py" to generate data/dashboard_data.json';
  body.appendChild(errDiv);
}); // end fetch callback
