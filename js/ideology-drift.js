// ============================================
// IDEOLOGY DRIFT TIMELINE
// ============================================
(function() {
  var LIBERAL = ['Jackson', 'Kagan', 'Sotomayor'];
  var CONSERVATIVE = ['Alito', 'Thomas', 'Gorsuch'];

  // First term year each justice served (to filter out bad data)
  var JUSTICE_START_TERM = {
    'Roberts': 2005, 'Thomas': 2005, 'Alito': 2005, 'Stevens': 2005,
    'Souter': 2005, 'Ginsburg': 2005, 'Breyer': 2005, 'OConnor': 2005,
    'Kennedy': 2005, 'Scalia': 2005,
    'Sotomayor': 2009, 'Kagan': 2010, 'Gorsuch': 2016,
    'Kavanaugh': 2018, 'Barrett': 2020, 'Jackson': 2022
  };

  // Distinct colors for each justice line
  var JUSTICE_COLORS = {
    'Roberts': '#58a6ff',
    'Thomas': '#f85149',
    'Alito': '#ff7b72',
    'Sotomayor': '#d2a8ff',
    'Kagan': '#bc8cff',
    'Gorsuch': '#ffa657',
    'Kavanaugh': '#7ee787',
    'Barrett': '#56d4dd',
    'Jackson': '#e2c08d',
    'Kennedy': '#79c0ff',
    'Ginsburg': '#f0883e',
    'Breyer': '#a5d6ff',
    'Scalia': '#ff9492',
    'Stevens': '#b392f0',
    'Souter': '#85e89d',
    'OConnor': '#ffdf5d'
  };

  function render() {
    var DATA = window.DATA;
    if (!DATA) return;

    var container = document.getElementById('ideology-chart');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var votes = DATA.votes;
    var cases = window.getFilteredCases ? window.getFilteredCases() : DATA.cases;

    // Build case -> term_year lookup
    var caseTerm = {};
    cases.forEach(function(c) { caseTerm[c.id] = c.term_year; });

    // Build vote index: case_id -> { justice: vote }
    var votesByCase = {};
    votes.forEach(function(v) {
      if (!votesByCase[v.case_id]) votesByCase[v.case_id] = {};
      votesByCase[v.case_id][v.justice] = v.vote;
    });

    // Get all justices and term years
    var allJustices = DATA.justices;
    var termYearsSet = {};
    cases.forEach(function(c) { termYearsSet[c.term_year] = true; });
    var termYears = Object.keys(termYearsSet).map(Number).sort(function(a, b) { return a - b; });

    // Compute ideology score per justice per term
    // ideology_score = liberal_alignment - conservative_alignment
    var justiceData = {}; // justice -> [{ term, score }]

    allJustices.forEach(function(justice) {
      // Skip bloc members from being charted against themselves
      var libBloc = LIBERAL.filter(function(j) { return j !== justice; });
      var conBloc = CONSERVATIVE.filter(function(j) { return j !== justice; });
      if (libBloc.length === 0 && conBloc.length === 0) return;

      var points = [];

      termYears.forEach(function(term) {
        // Skip terms before justice joined the court
        var startTerm = JUSTICE_START_TERM[justice];
        if (startTerm && term < startTerm) return;

        // Get cases in this term where justice participated
        var termCases = cases.filter(function(c) { return c.term_year === term; });

        // Compute agreement with liberal bloc
        var libAgreements = [];
        libBloc.forEach(function(blocJ) {
          var agreed = 0, total = 0;
          termCases.forEach(function(c) {
            var cv = votesByCase[c.id];
            if (!cv) return;
            var jVote = cv[justice];
            var bVote = cv[blocJ];
            if (jVote === undefined || bVote === undefined) return;
            total++;
            var jDissent = jVote === 'dissent';
            var bDissent = bVote === 'dissent';
            if (jDissent === bDissent) agreed++;
          });
          if (total > 0) libAgreements.push((agreed / total) * 100);
        });

        // Compute agreement with conservative bloc
        var conAgreements = [];
        conBloc.forEach(function(blocJ) {
          var agreed = 0, total = 0;
          termCases.forEach(function(c) {
            var cv = votesByCase[c.id];
            if (!cv) return;
            var jVote = cv[justice];
            var bVote = cv[blocJ];
            if (jVote === undefined || bVote === undefined) return;
            total++;
            var jDissent = jVote === 'dissent';
            var bDissent = bVote === 'dissent';
            if (jDissent === bDissent) agreed++;
          });
          if (total > 0) conAgreements.push((agreed / total) * 100);
        });

        if (libAgreements.length === 0 && conAgreements.length === 0) return;

        var libAvg = libAgreements.length > 0
          ? libAgreements.reduce(function(s, v) { return s + v; }, 0) / libAgreements.length
          : 0;
        var conAvg = conAgreements.length > 0
          ? conAgreements.reduce(function(s, v) { return s + v; }, 0) / conAgreements.length
          : 0;

        points.push({ term: term, score: libAvg - conAvg });
      });

      if (points.length > 0) {
        justiceData[justice] = points;
      }
    });

    // Chart dimensions
    var margin = { top: 20, right: 20, bottom: 40, left: 50 };
    var width = container.clientWidth - margin.left - margin.right;
    if (width < 300) width = 600;
    var height = 280;

    var svg = d3.select(container).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    var g = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Scales
    var xScale = d3.scaleLinear()
      .domain(d3.extent(termYears))
      .range([0, width]);

    // Find min/max scores for y domain
    var allScores = [];
    Object.keys(justiceData).forEach(function(j) {
      justiceData[j].forEach(function(d) { allScores.push(d.score); });
    });
    var yMin = Math.min(-50, d3.min(allScores) - 5);
    var yMax = Math.max(50, d3.max(allScores) + 5);

    var yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height, 0]);

    // X axis
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(Math.min(termYears.length, 12)));

    // Y axis
    g.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(8));

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8b949e')
      .attr('font-size', '11px')
      .text('Liberal \u2190 Score \u2192 Conservative');

    // Zero line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#484f58')
      .attr('stroke-dasharray', '6,4')
      .attr('stroke-width', 1.5);

    // Line generator
    var line = d3.line()
      .x(function(d) { return xScale(d.term); })
      .y(function(d) { return yScale(d.score); })
      .curve(d3.curveMonotoneX);

    // Track visibility state
    var hiddenJustices = {};

    // Draw lines
    var justiceNames = Object.keys(justiceData).sort();
    var paths = {};

    justiceNames.forEach(function(justice) {
      var color = JUSTICE_COLORS[justice] || '#8b949e';
      var path = g.append('path')
        .datum(justiceData[justice])
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('d', line)
        .attr('opacity', 0.85);

      paths[justice] = path;
    });

    // Tooltip for hover
    var tooltip = d3.select('#tooltip');

    // Add invisible wider paths for hover detection
    justiceNames.forEach(function(justice) {
      var color = JUSTICE_COLORS[justice] || '#8b949e';
      g.append('path')
        .datum(justiceData[justice])
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .attr('d', line)
        .attr('class', 'ideology-hover-' + justice.replace(/'/g, ''))
        .on('mousemove', function(event) {
          if (hiddenJustices[justice]) return;
          var coords = d3.pointer(event, g.node());
          var xVal = xScale.invert(coords[0]);
          var closest = justiceData[justice].reduce(function(best, d) {
            return Math.abs(d.term - xVal) < Math.abs(best.term - xVal) ? d : best;
          });
          tooltip.style('opacity', 1)
            .style('left', (event.clientX + 12) + 'px')
            .style('top', (event.clientY - 20) + 'px');
          // Clear and rebuild tooltip content
          var tipNode = tooltip.node();
          while (tipNode.firstChild) tipNode.removeChild(tipNode.firstChild);
          var pairSpan = document.createElement('span');
          pairSpan.className = 'pair';
          pairSpan.textContent = justice + ' (OT' + closest.term + ')';
          tipNode.appendChild(pairSpan);
          tipNode.appendChild(document.createElement('br'));
          var rateSpan = document.createElement('span');
          rateSpan.className = 'rate';
          rateSpan.textContent = 'Score: ' + closest.score.toFixed(1);
          tipNode.appendChild(rateSpan);
        })
        .on('mouseout', function() {
          tooltip.style('opacity', 0);
        });
    });

    // Legend
    var legendDiv = document.createElement('div');
    legendDiv.className = 'ideology-legend';

    justiceNames.forEach(function(justice) {
      var color = JUSTICE_COLORS[justice] || '#8b949e';
      var item = document.createElement('span');
      item.className = 'ideology-legend-item';
      item.textContent = justice;
      item.style.borderLeft = '3px solid ' + color;
      item.style.color = '#c9d1d9';

      item.addEventListener('click', function() {
        if (hiddenJustices[justice]) {
          hiddenJustices[justice] = false;
          item.classList.remove('hidden');
          paths[justice].attr('opacity', 0.85);
          g.select('.ideology-hover-' + justice.replace(/'/g, '')).attr('pointer-events', 'auto');
        } else {
          hiddenJustices[justice] = true;
          item.classList.add('hidden');
          paths[justice].attr('opacity', 0);
          g.select('.ideology-hover-' + justice.replace(/'/g, '')).attr('pointer-events', 'none');
        }
      });

      legendDiv.appendChild(item);
    });

    container.appendChild(legendDiv);
  }

  // Listen for data ready
  window.addEventListener('scotusgami-data-ready', function() {
    render();
  });

  // Re-render on filter change
  window.addEventListener('scotusgami-filter-change', function() {
    render();
  });

  // If data already loaded
  if (window.DATA) {
    render();
  }
})();
