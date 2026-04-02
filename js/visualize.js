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

// Cells
var cellData = [];
justices.forEach(function(a, i) {
  justices.forEach(function(b, j) {
    cellData.push({ a: a, b: b, i: i, j: j, rate: getRate(a, b), cases: getCaseCount(a, b) });
  });
});

// Set color scale domain from actual data range
var rates = cellData.filter(function(d) { return d.rate !== null; }).map(function(d) { return d.rate; });
var minRate = Math.min.apply(null, rates);
var maxRate = Math.max.apply(null, rates);
var midRate = (minRate + maxRate) / 2;
colorScale.domain([minRate, midRate, maxRate]);

// Update legend range labels
document.getElementById('legend-min').textContent = Math.round(minRate) + '%';
document.getElementById('legend-max').textContent = Math.round(maxRate) + '%';

var hmCells = hmSvg.selectAll('.heatmap-cell')
  .data(cellData)
  .join('rect')
  .attr('class', 'heatmap-cell')
  .attr('x', function(d) { return labelWidth + d.j * cellSize; })
  .attr('y', function(d) { return labelWidth + d.i * cellSize; })
  .attr('width', cellSize - 2)
  .attr('height', cellSize - 2)
  .attr('rx', 3)
  .attr('fill', function(d) { return d.rate !== null ? colorScale(d.rate) : '#161b22'; })
  .on('click', function(ev, d) {
    if (d.a !== d.b) togglePair(d.a, d.b);
  })
  .on('mouseover', function(ev, d) {
    if (d.rate !== null) {
      showTooltip(ev, d.a + ' + ' + d.b, d.rate + '% agreement (' + d.cases + ' cases)');
    }
  })
  .on('mouseout', function() { tooltip.style('opacity', 0); });

// Cell text
hmSvg.selectAll('.cell-text')
  .data(cellData.filter(function(d) { return d.rate !== null; }))
  .join('text')
  .attr('class', 'cell-text')
  .attr('x', function(d) { return labelWidth + d.j * cellSize + cellSize / 2 - 1; })
  .attr('y', function(d) { return labelWidth + d.i * cellSize + cellSize / 2 + 4; })
  .attr('text-anchor', 'middle')
  .attr('fill', '#f0f6fc')
  .attr('font-size', '12px')
  .attr('font-weight', '500')
  .attr('pointer-events', 'none')
  .text(function(d) { return Math.round(d.rate); });

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
var tlMargin = { top: 10, right: 30, bottom: 50, left: 50 };
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

// Group for all timeline lines and dots
var tlLinesGroup = tlSvg.append('g').attr('class', 'tl-lines');
var tlDotsGroup = tlSvg.append('g').attr('class', 'tl-dots');

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

// Term filter controls
(function() {
  var termSelect = document.getElementById('term-filter');

  termSelect.addEventListener('change', function() {
    currentTermFilter = termSelect.value;
    window.currentTermFilter = currentTermFilter;
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
  // Update cellData rates
  cellData.forEach(function(d) {
    d.rate = getFilteredRate(d.a, d.b, filteredAgreements);
    d.cases = getFilteredCaseCount(d.a, d.b, filteredAgreements);
  });

  // Recompute color scale domain from filtered rates
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
  hmCells.attr('fill', function(d) { return d.rate !== null ? colorScale(d.rate) : '#161b22'; });

  // Update cell text values
  hmSvg.selectAll('.cell-text').remove();
  hmSvg.selectAll('.cell-text')
    .data(cellData.filter(function(d) { return d.rate !== null; }))
    .join('text')
    .attr('class', 'cell-text')
    .attr('x', function(d) { return labelWidth + d.j * cellSize + cellSize / 2 - 1; })
    .attr('y', function(d) { return labelWidth + d.i * cellSize + cellSize / 2 + 4; })
    .attr('text-anchor', 'middle')
    .attr('fill', '#f0f6fc')
    .attr('font-size', '12px')
    .attr('font-weight', '500')
    .attr('pointer-events', 'none')
    .text(function(d) { return Math.round(d.rate); });

  // Update heatmap tooltip on hover
  hmCells.on('mouseover', function(ev, d) {
    if (d.rate !== null) {
      showTooltip(ev, d.a + ' + ' + d.b, d.rate + '% agreement (' + d.cases + ' cases)');
    }
  });

  // Re-apply delta overlay if active (prevents click from resetting to rate mode)
  if (window.heatmapDelta && window.heatmapDelta.isActive()) {
    window.heatmapDelta.reapply();
  }
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

  // Recompute responsive width
  tlW = getTimelineWidth();
  tlSvgEl.attr('width', tlW + tlMargin.left + tlMargin.right);
  tlPlaceholder.attr('x', tlW / 2);

  if (selectedPairs.length === 0) {
    tlPlaceholder.style('display', 'block');
    // Still draw grid
    tlGridGroup.call(d3.axisLeft(yScale).ticks(5).tickSize(-tlW).tickFormat(''));
    tlGridGroup.select('.domain').remove();
    return;
  }

  tlPlaceholder.style('display', 'none');

  // Get filtered cases and build X scale
  var filteredCases = getFilteredCases();
  var filteredCaseIds = new Set(filteredCases.map(function(c) { return c.id; }));
  var isSingleTerm = (currentTermFilter === 'current' || currentTermFilter === 'last');
  var isAllTerms = (currentTermFilter === 'last10');

  var xScale = d3.scalePoint()
    .domain(filteredCases.map(function(c) { return c.id; }))
    .range([0, tlW])
    .padding(0.5);

  // X axis labels
  if (isAllTerms || (!isSingleTerm && filteredCases.length > 50)) {
    // Show term year labels at boundaries
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
    // Show case dates for single term or small ranges
    var tickValues = filteredCases.map(function(c) { return c.id; });
    // Limit ticks if too many
    if (tickValues.length > 30) {
      var step = Math.ceil(tickValues.length / 30);
      tickValues = tickValues.filter(function(v, i) { return i % step === 0; });
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

  selectedPairs.forEach(function(pair) {
    var key1 = pair.names[0] + '-' + pair.names[1];
    var key2 = pair.names[1] + '-' + pair.names[0];
    var tlData = timeline[key1] || timeline[key2] || [];

    if (tlData.length === 0) return;

    // Sort timeline data to match the chronologically sorted cases array
    var caseOrder = {};
    cases.forEach(function(c, idx) { caseOrder[c.id] = idx; });
    var sortedTlData = tlData.slice().sort(function(a, b) {
      return (caseOrder[a.case_id] || 0) - (caseOrder[b.case_id] || 0);
    });

    // Compute running rate, then filter to visible cases
    var running = 0;
    var allPoints = sortedTlData.map(function(d, i) {
      running += d.agreed;
      return { case_id: d.case_id, rate: (running / (i + 1)) * 100, agreed: d.agreed };
    });

    var points = allPoints.filter(function(p) {
      return filteredCaseIds.has(p.case_id);
    });

    if (points.length === 0) return;

    var line = d3.line()
      .x(function(d) { return xScale(d.case_id); })
      .y(function(d) { return yScale(d.rate); })
      .curve(d3.curveMonotoneX);

    tlLinesGroup.append('path')
      .attr('class', 'timeline-path')
      .datum(points)
      .attr('d', line)
      .attr('stroke', pair.color)
      .attr('stroke-opacity', 1);

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
// Two-column layout matching coalitions tab style
// ============================================
(function() {
  var vizMajList = document.getElementById('coalition-viz-maj');
  var vizDisList = document.getElementById('coalition-viz-dis');
  if (!vizMajList || !vizDisList) return;

  // Build vote lookup
  var vizVotesByCase = {};
  DATA.votes.forEach(function(v) {
    if (!vizVotesByCase[v.case_id]) vizVotesByCase[v.case_id] = {};
    vizVotesByCase[v.case_id][v.justice] = v.vote;
  });

  function renderVizGroupList(listEl, entries, topN) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (entries.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No groups in selected range';
      listEl.appendChild(empty);
      return;
    }
    var shown = entries.slice(0, topN);
    shown.forEach(function(entry) {
      var item = document.createElement('div');
      item.className = 'coalition-group-item';
      item.style.cursor = 'pointer';

      var header = document.createElement('div');
      header.className = 'coalition-group-header';

      var namesSpan = document.createElement('span');
      namesSpan.className = 'coalition-group-names';
      namesSpan.textContent = entry.names.join(', ');
      header.appendChild(namesSpan);

      var countBadge = document.createElement('span');
      countBadge.className = 'coalition-group-count';
      countBadge.textContent = entry.count + (entry.count === 1 ? ' case' : ' cases');
      header.appendChild(countBadge);

      var sizeLabel = document.createElement('span');
      sizeLabel.className = 'coalition-group-size';
      sizeLabel.textContent = entry.names.length + 'J';
      header.appendChild(sizeLabel);

      item.appendChild(header);

      // Click to go to Coalitions tab
      item.addEventListener('click', function() {
        switchToTab('coalitions');
      });

      listEl.appendChild(item);
    });
  }

  function renderCoalitionViz() {
    var filteredCases = getFilteredCases();
    var majIdx = {};
    var disIdx = {};

    filteredCases.forEach(function(c) {
      var cv = vizVotesByCase[c.id];
      if (!cv) return;
      var maj = [], dis = [];
      Object.keys(cv).sort().forEach(function(j) {
        if (cv[j] === 'dissent') dis.push(j);
        else maj.push(j);
      });
      if (dis.length === 0) return;
      var majKey = maj.join(',');
      var disKey = dis.join(',');
      if (!majIdx[majKey]) majIdx[majKey] = 0;
      majIdx[majKey]++;
      if (!disIdx[disKey]) disIdx[disKey] = 0;
      disIdx[disKey]++;
    });

    var majEntries = Object.keys(majIdx).map(function(key) {
      return { names: key.split(','), count: majIdx[key] };
    }).sort(function(a, b) { return b.count - a.count; });

    var disEntries = Object.keys(disIdx).map(function(key) {
      return { names: key.split(','), count: disIdx[key] };
    }).sort(function(a, b) { return b.count - a.count; });

    renderVizGroupList(vizMajList, majEntries, 10);
    renderVizGroupList(vizDisList, disEntries, 10);
  }

  renderCoalitionViz();
  window.addEventListener('scotusgami-filter-change', renderCoalitionViz);
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
