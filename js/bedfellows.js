// ============================================
// UNUSUAL BEDFELLOWS PANEL
// Surfaces cases where a pair agrees after a long disagreement streak
// ============================================
(function() {
  'use strict';

  var MIN_STREAK = 3; // minimum disagreement streak to qualify
  var MAX_ITEMS = 20;

  window.addEventListener('scotusgami-data-ready', function() {
    init();
    window.addEventListener('scotusgami-filter-change', render);
  });

  var votesByCase = {};
  var caseMap = {};
  var parseDate = window.parseDate;

  function init() {
    window.DATA.votes.forEach(function(v) {
      if (!votesByCase[v.case_id]) votesByCase[v.case_id] = {};
      votesByCase[v.case_id][v.justice] = v.vote;
    });
    window.DATA.cases.forEach(function(c) {
      caseMap[c.id] = c;
    });
    render();
  }

  function isDissent(vote) {
    return vote && vote.toLowerCase().indexOf('dissent') !== -1;
  }

  function render() {
    var container = document.getElementById('bedfellows-list');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var filteredCases = window.getFilteredCases();

    // Sort filtered cases chronologically
    var sorted = filteredCases.slice().sort(function(a, b) {
      return parseDate(a.date) - parseDate(b.date);
    });

    // Build filtered case ID set for quick lookup
    var filteredIds = new Set(sorted.map(function(c) { return c.id; }));

    // For each pair, walk through ALL cases chronologically to build streak history,
    // but only report bedfellow events for cases in the filtered set
    var allCasesSorted = window.DATA.cases.slice().sort(function(a, b) {
      return parseDate(a.date) - parseDate(b.date);
    });

    // Track streaks per pair
    var pairStreaks = {}; // "A-B" -> current disagreement streak count

    var bedfellows = [];

    allCasesSorted.forEach(function(c) {
      var cv = votesByCase[c.id];
      if (!cv) return;
      var justices = Object.keys(cv).sort();

      for (var i = 0; i < justices.length; i++) {
        for (var j = i + 1; j < justices.length; j++) {
          var a = justices[i];
          var b = justices[j];
          var key = a + '-' + b;
          if (pairStreaks[key] === undefined) pairStreaks[key] = 0;

          var sameVote = isDissent(cv[a]) === isDissent(cv[b]);

          if (sameVote) {
            // They agreed — check if this breaks a streak
            var streak = pairStreaks[key];
            if (streak >= MIN_STREAK && filteredIds.has(c.id)) {
              bedfellows.push({
                caseId: c.id,
                caseName: c.name,
                caseDate: c.date,
                justiceA: a,
                justiceB: b,
                streak: streak
              });
            }
            pairStreaks[key] = 0;
          } else {
            pairStreaks[key]++;
          }
        }
      }
    });

    // Group by case, keeping the max streak per case and all pairs
    var caseGroups = {};
    bedfellows.forEach(function(bf) {
      if (!caseGroups[bf.caseId]) {
        caseGroups[bf.caseId] = { caseId: bf.caseId, caseName: bf.caseName, caseDate: bf.caseDate, maxStreak: 0, pairs: [] };
      }
      var g = caseGroups[bf.caseId];
      g.pairs.push({ a: bf.justiceA, b: bf.justiceB, streak: bf.streak });
      if (bf.streak > g.maxStreak) g.maxStreak = bf.streak;
    });

    // Expose for data tab case detail
    window.bedfellowsByCase = caseGroups;

    var grouped = Object.keys(caseGroups).map(function(k) { return caseGroups[k]; });
    grouped.sort(function(a, b) { return b.maxStreak - a.maxStreak; });
    grouped = grouped.slice(0, MAX_ITEMS);

    if (grouped.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No streak-breaking agreements in this range';
      container.appendChild(empty);
      return;
    }

    grouped.forEach(function(g) {
      var wrapper = document.createElement('div');
      wrapper.className = 'bedfellow-wrapper';

      var item = document.createElement('div');
      item.className = 'bedfellow-item';

      // Max streak indicator
      var rarity = document.createElement('span');
      rarity.className = 'bedfellow-rarity';
      if (g.maxStreak >= 10) {
        rarity.style.background = '#da3633';
      } else if (g.maxStreak >= 6) {
        rarity.style.background = '#d29922';
      } else {
        rarity.style.background = '#388bfd';
      }
      rarity.textContent = g.maxStreak + ' max';

      // Content area
      var content = document.createElement('div');
      content.className = 'bedfellow-content';

      // Case name link with date
      var caseLink = document.createElement('a');
      caseLink.className = 'bedfellow-case-link';
      caseLink.textContent = g.caseName + ' (' + g.caseDate + ')';
      caseLink.href = '#';
      caseLink.addEventListener('click', (function(caseId) {
        return function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.switchToTab('data', function() {
            var caseListItems = document.querySelectorAll('#case-list li');
            caseListItems.forEach(function(li) {
              var datum = d3.select(li).datum();
              if (datum && datum.id === caseId) {
                li.click();
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            });
          });
        };
      })(g.caseId));

      // Pairs summary — sort by streak descending, show top pairs
      g.pairs.sort(function(a, b) { return b.streak - a.streak; });
      var pairInfo = document.createElement('div');
      pairInfo.className = 'bedfellow-pair-info';
      var pairTexts = g.pairs.slice(0, 4).map(function(p) {
        return p.a + ' + ' + p.b + ' (' + p.streak + ')';
      });
      if (g.pairs.length > 4) pairTexts.push('+' + (g.pairs.length - 4) + ' more');
      pairInfo.textContent = pairTexts.join(', ');

      content.appendChild(caseLink);
      content.appendChild(pairInfo);

      // Pair count badge
      var score = document.createElement('span');
      score.className = 'bedfellow-score';
      score.textContent = g.pairs.length + (g.pairs.length === 1 ? ' pair' : ' pairs');

      item.appendChild(rarity);
      item.appendChild(content);
      item.appendChild(score);
      wrapper.appendChild(item);

      // Expandable detail: pair grid
      var detail = document.createElement('div');
      detail.className = 'bedfellow-detail collapsed';

      // Build grid from pairs
      var justiceSet = {};
      g.pairs.forEach(function(p) { justiceSet[p.a] = true; justiceSet[p.b] = true; });
      var justices = Object.keys(justiceSet).sort();

      // Build pair lookup for quick access
      var pairLookup = {};
      g.pairs.forEach(function(p) {
        pairLookup[p.a + '-' + p.b] = p.streak;
        pairLookup[p.b + '-' + p.a] = p.streak;
      });

      var table = document.createElement('table');
      table.className = 'bedfellow-grid';

      // Header row
      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      var cornerTh = document.createElement('th');
      cornerTh.textContent = '';
      headerRow.appendChild(cornerTh);
      justices.forEach(function(j) {
        var th = document.createElement('th');
        th.textContent = j.length > 8 ? j.substring(0, 7) + '.' : j;
        th.title = j;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body rows
      var tbody = document.createElement('tbody');
      justices.forEach(function(rowJ, ri) {
        var tr = document.createElement('tr');
        var rowTh = document.createElement('th');
        rowTh.textContent = rowJ;
        tr.appendChild(rowTh);
        justices.forEach(function(colJ, ci) {
          var td = document.createElement('td');
          if (ri === ci) {
            td.className = 'bedfellow-grid-self';
            td.textContent = '\u2014';
          } else {
            var streak = pairLookup[rowJ + '-' + colJ];
            if (streak !== undefined) {
              td.textContent = streak;
              td.title = rowJ + ' + ' + colJ + ': agreed after ' + streak + ' consecutive disagreements';
              if (streak >= 10) {
                td.className = 'bedfellow-grid-high';
              } else if (streak >= 6) {
                td.className = 'bedfellow-grid-med';
              } else {
                td.className = 'bedfellow-grid-low';
              }
            }
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      // Caption
      var caption = document.createElement('div');
      caption.className = 'bedfellow-grid-caption';
      caption.textContent = 'Numbers = consecutive disagreements before agreeing in this case';
      detail.appendChild(caption);
      detail.appendChild(table);
      wrapper.appendChild(detail);

      // Toggle expand/collapse on header click
      item.addEventListener('click', function() {
        var isCollapsed = detail.classList.contains('collapsed');
        if (isCollapsed) {
          detail.classList.remove('collapsed');
          wrapper.classList.add('expanded');
        } else {
          detail.classList.add('collapsed');
          wrapper.classList.remove('expanded');
        }
      });

      container.appendChild(wrapper);
    });
  }
})();
