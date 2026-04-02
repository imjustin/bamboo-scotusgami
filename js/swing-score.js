// ============================================
// SWING SCORE — Close Decision Analysis
// ============================================
(function() {
  'use strict';

  function renderSwingScore() {
    var container = document.getElementById('swing-score');
    if (!container || !window.DATA) return;

    // Clear previous content
    while (container.firstChild) container.removeChild(container.firstChild);

    var filteredCases = window.getFilteredCases();
    var votes = window.DATA.votes;

    // Build vote index: case_id -> [{justice, vote}]
    var voteIndex = {};
    votes.forEach(function(v) {
      if (!voteIndex[v.case_id]) voteIndex[v.case_id] = [];
      voteIndex[v.case_id].push({ justice: v.justice, vote: v.vote });
    });

    // Find close cases (5-4 or 6-3 = exactly 3 or 4 dissenters)
    var closeCases = [];
    filteredCases.forEach(function(c) {
      var caseVotes = voteIndex[c.id];
      if (!caseVotes) return;
      var dissenterCount = caseVotes.filter(function(v) { return v.vote === 'dissent'; }).length;
      if (dissenterCount === 3 || dissenterCount === 4) {
        closeCases.push({ caseId: c.id, votes: caseVotes });
      }
    });

    // No close cases — show placeholder
    if (closeCases.length === 0) {
      var placeholder = document.createElement('div');
      placeholder.className = 'pair-detail-placeholder';
      placeholder.textContent = 'No close decisions (5-4 or 6-3) in the selected term range.';
      container.appendChild(placeholder);
      return;
    }

    // For each justice, count close-case participation and majority votes
    var justiceStats = {};
    closeCases.forEach(function(cc) {
      cc.votes.forEach(function(v) {
        if (!justiceStats[v.justice]) {
          justiceStats[v.justice] = { total: 0, majority: 0 };
        }
        justiceStats[v.justice].total += 1;
        if (v.vote !== 'dissent') {
          justiceStats[v.justice].majority += 1;
        }
      });
    });

    // Build sorted array
    var justiceData = Object.keys(justiceStats).map(function(name) {
      var s = justiceStats[name];
      return {
        name: name,
        total: s.total,
        majority: s.majority,
        score: (s.majority / s.total) * 100
      };
    }).sort(function(a, b) { return b.score - a.score; });

    // D3 horizontal bar chart
    var margin = { top: 8, right: 80, bottom: 20, left: 90 };
    var barHeight = 22;
    var barGap = 4;
    var chartHeight = justiceData.length * (barHeight + barGap);
    var width = container.clientWidth || 400;
    var innerWidth = width - margin.left - margin.right;
    var totalHeight = chartHeight + margin.top + margin.bottom;

    var svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', totalHeight);

    var g = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, innerWidth]);

    // Color scale: red (low) -> blue (high)
    var colorScale = d3.scaleLinear()
      .domain([0, 50, 100])
      .range(['#da3633', '#d29922', '#58a6ff'])
      .clamp(true);

    // Bars
    var bars = g.selectAll('.swing-bar')
      .data(justiceData)
      .enter().append('g')
      .attr('transform', function(d, i) {
        return 'translate(0,' + i * (barHeight + barGap) + ')';
      });

    // Justice name labels (left side)
    bars.append('text')
      .attr('x', -6)
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', '#c9d1d9')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(function(d) { return d.name; });

    // Bar rectangles
    bars.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', function(d) { return xScale(d.score); })
      .attr('height', barHeight)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', function(d) { return colorScale(d.score); })
      .attr('opacity', 0.85);

    // Score + case count labels (right side)
    bars.append('text')
      .attr('x', function(d) { return xScale(d.score) + 6; })
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .attr('fill', '#8b949e')
      .attr('font-size', '11px')
      .text(function(d) {
        return Math.round(d.score) + '% (' + d.total + ')';
      });

    // Subtitle showing total close cases
    var subtitle = document.createElement('div');
    subtitle.style.fontSize = '11px';
    subtitle.style.color = '#484f58';
    subtitle.style.marginTop = '8px';
    subtitle.textContent = closeCases.length + ' close decision' + (closeCases.length !== 1 ? 's' : '') + ' in selected range';
    container.appendChild(subtitle);
  }

  // Initial render when data is ready
  window.addEventListener('scotusgami-data-ready', function() {
    renderSwingScore();
  });

  // Re-render on filter change
  window.addEventListener('scotusgami-filter-change', function() {
    renderSwingScore();
  });

  // If data is already loaded (late script load)
  if (window.DATA && window.getFilteredCases) {
    renderSwingScore();
  }
})();
