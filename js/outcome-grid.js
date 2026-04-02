// ============================================
// VOTE CONFIGURATION GRID (Outcome Patterns)
// ============================================
(function() {
  'use strict';

  var MAJ_SIZES = [5, 6, 7, 8, 9];
  var CONC_LABELS = ['0', '1', '2', '3', '4+'];
  var container = document.getElementById('outcome-grid');

  // Green gradient: lighter = rare, darker = common
  var COLORS = [
    '#0d2818', // 1 (very rare)
    '#1a4731', // 2
    '#22633f', // 3
    '#2a7f4e', // 4
    '#2ea043', // 5
    '#3fb950', // 6+
  ];

  function getColor(count, maxCount) {
    if (count === 0) return null; // scorigami
    if (maxCount <= 1) return COLORS[0];
    // Map count to color index
    var ratio = (count - 1) / (maxCount - 1);
    var idx = Math.min(Math.floor(ratio * COLORS.length), COLORS.length - 1);
    return COLORS[idx];
  }

  function computeGrid(cases, votes) {
    // Build a map of case_id -> vote breakdown
    var caseVotes = {};
    votes.forEach(function(v) {
      if (!caseVotes[v.case_id]) caseVotes[v.case_id] = { majority: 0, concurrence: 0, dissent: 0 };
      if (v.vote === 'majority') caseVotes[v.case_id].majority++;
      else if (v.vote === 'concurrence') caseVotes[v.case_id].concurrence++;
      else if (v.vote === 'dissent') caseVotes[v.case_id].dissent++;
    });

    // Build case ID set from filtered cases
    var filteredIds = {};
    cases.forEach(function(c) { filteredIds[c.id] = c; });

    // Build 2D frequency grid and case lists
    // grid[concRow][majCol] = { count, cases }
    var grid = [];
    for (var r = 0; r < 5; r++) {
      grid[r] = [];
      for (var c = 0; c < 5; c++) {
        grid[r][c] = { count: 0, cases: [] };
      }
    }

    Object.keys(caseVotes).forEach(function(caseId) {
      if (!filteredIds[caseId]) return;
      var v = caseVotes[caseId];
      var majSize = v.majority + v.concurrence;
      var concCount = v.concurrence;

      var colIdx = MAJ_SIZES.indexOf(majSize);
      if (colIdx === -1) return; // outside 5-9 range

      var rowIdx = Math.min(concCount, 4); // 4+ bucket

      grid[rowIdx][colIdx].count++;
      grid[rowIdx][colIdx].cases.push(filteredIds[caseId]);
    });

    return grid;
  }

  function render() {
    if (!window.DATA) return;

    var cases = window.getFilteredCases ? window.getFilteredCases() : window.DATA.cases;
    var grid = computeGrid(cases, window.DATA.votes);

    // Find max count for color scaling
    var maxCount = 0;
    grid.forEach(function(row) {
      row.forEach(function(cell) {
        if (cell.count > maxCount) maxCount = cell.count;
      });
    });

    // Clear container
    while (container.firstChild) container.removeChild(container.firstChild);

    // Build table
    var table = document.createElement('table');
    table.className = 'outcome-table';

    // Header row: corner + majority sizes
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');

    // Corner cell with axis labels
    var corner = document.createElement('th');
    corner.className = 'outcome-corner';
    var cornerMaj = document.createElement('span');
    cornerMaj.className = 'outcome-axis-label-x';
    cornerMaj.textContent = 'Majority \u2192';
    var cornerConc = document.createElement('span');
    cornerConc.className = 'outcome-axis-label-y';
    cornerConc.textContent = 'Concurrences \u2193';
    corner.appendChild(cornerMaj);
    corner.appendChild(document.createElement('br'));
    corner.appendChild(cornerConc);
    headerRow.appendChild(corner);

    MAJ_SIZES.forEach(function(size) {
      var th = document.createElement('th');
      th.className = 'outcome-header';
      th.textContent = size + '';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows
    var tbody = document.createElement('tbody');
    for (var r = 0; r < 5; r++) {
      var tr = document.createElement('tr');

      // Row header (concurrence count)
      var rowHeader = document.createElement('th');
      rowHeader.className = 'outcome-row-header';
      rowHeader.textContent = CONC_LABELS[r];
      tr.appendChild(rowHeader);

      for (var c = 0; c < 5; c++) {
        var cell = grid[r][c];
        var td = document.createElement('td');
        td.className = 'outcome-cell';

        if (cell.count === 0) {
          td.classList.add('empty');
          td.textContent = '\u2013';
        } else {
          td.textContent = cell.count + '';
          td.style.background = getColor(cell.count, maxCount);
          td.style.color = '#f0f6fc';
          td.style.cursor = 'pointer';
        }

        // Tooltip on hover
        (function(cellData, majSize, concLabel, tdEl) {
          tdEl.addEventListener('mouseenter', function(e) {
            var tooltip = document.getElementById('tooltip');
            while (tooltip.firstChild) tooltip.removeChild(tooltip.firstChild);

            var pairSpan = document.createElement('span');
            pairSpan.className = 'pair';
            if (cellData.count === 0) {
              pairSpan.textContent = majSize + '-' + (9 - majSize) + ' with ' + concLabel + ' concurrence(s)';
              tooltip.appendChild(pairSpan);
              tooltip.appendChild(document.createElement('br'));
              var scoriSpan = document.createElement('span');
              scoriSpan.style.color = '#d29922';
              scoriSpan.textContent = 'SCOTUSgami! Never occurred.';
              tooltip.appendChild(scoriSpan);
            } else {
              pairSpan.textContent = majSize + '-' + (9 - majSize) + ' (' + concLabel + ' concurring)';
              tooltip.appendChild(pairSpan);
              tooltip.appendChild(document.createElement('br'));
              var countSpan = document.createElement('span');
              countSpan.className = 'rate';
              countSpan.textContent = cellData.count + ' case' + (cellData.count !== 1 ? 's' : '');
              tooltip.appendChild(countSpan);
              // Show up to 3 case names
              var preview = cellData.cases.slice(0, 3);
              preview.forEach(function(cs) {
                tooltip.appendChild(document.createElement('br'));
                var nameSpan = document.createElement('span');
                nameSpan.style.fontSize = '11px';
                nameSpan.style.color = '#8b949e';
                nameSpan.textContent = cs.name;
                tooltip.appendChild(nameSpan);
              });
              if (cellData.cases.length > 3) {
                tooltip.appendChild(document.createElement('br'));
                var moreSpan = document.createElement('span');
                moreSpan.style.fontSize = '11px';
                moreSpan.style.color = '#6e7681';
                moreSpan.textContent = '+ ' + (cellData.cases.length - 3) + ' more';
                tooltip.appendChild(moreSpan);
              }
            }

            tooltip.style.left = (e.clientX + 12) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
            tooltip.style.opacity = '1';
          });

          tdEl.addEventListener('mouseleave', function() {
            var tooltip = document.getElementById('tooltip');
            tooltip.style.opacity = '0';
          });

          tdEl.addEventListener('mousemove', function(e) {
            var tooltip = document.getElementById('tooltip');
            tooltip.style.left = (e.clientX + 12) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
          });
        })(cell, MAJ_SIZES[c], CONC_LABELS[r], td);

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    // Legend
    var legend = document.createElement('div');
    legend.className = 'outcome-legend';

    var rareLabel = document.createElement('span');
    rareLabel.textContent = 'Rare';
    rareLabel.style.fontSize = '11px';
    rareLabel.style.color = '#8b949e';
    legend.appendChild(rareLabel);

    var bar = document.createElement('div');
    bar.className = 'legend-bar';
    bar.style.width = '80px';
    bar.style.background = 'linear-gradient(to right, ' + COLORS[0] + ', ' + COLORS[COLORS.length - 1] + ')';
    legend.appendChild(bar);

    var commonLabel = document.createElement('span');
    commonLabel.textContent = 'Common';
    commonLabel.style.fontSize = '11px';
    commonLabel.style.color = '#8b949e';
    legend.appendChild(commonLabel);

    var dashSpan = document.createElement('span');
    dashSpan.style.marginLeft = '12px';
    dashSpan.style.fontSize = '11px';
    dashSpan.style.color = '#6e7681';
    dashSpan.textContent = '\u2013 = SCOTUSgami';
    legend.appendChild(dashSpan);

    container.appendChild(legend);
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
