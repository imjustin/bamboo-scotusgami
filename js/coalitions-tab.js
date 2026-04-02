// ============================================
// COALITIONS TAB: Explore majority/dissent groups
// Responds to global term filter via scotusgami-filter-change
// ============================================
window.addEventListener('scotusgami-indexes-ready', function() {
  var container = document.getElementById('tab-coalitions');
  if (!container) return;

  var layout = document.createElement('div');
  layout.className = 'coalitions-layout';

  // Title
  var title = document.createElement('div');
  title.className = 'panel-title';
  title.textContent = 'Coalition Explorer';
  layout.appendChild(title);

  // Search
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'tab-search';
  searchInput.placeholder = 'Search by justice name...';
  searchInput.addEventListener('input', function() {
    renderGroups();
  });
  layout.appendChild(searchInput);

  // Stats bar
  var statsBar = document.createElement('div');
  statsBar.className = 'coalitions-stats';
  layout.appendChild(statsBar);

  // Two-column layout for majority and dissent groups
  var columns = document.createElement('div');
  columns.className = 'coalitions-columns';

  var majColumn = document.createElement('div');
  majColumn.className = 'coalitions-column';
  var majTitle = document.createElement('div');
  majTitle.className = 'coalitions-column-title';
  majTitle.textContent = 'Majority Groups';
  majColumn.appendChild(majTitle);
  var majList = document.createElement('div');
  majList.className = 'coalitions-group-list';
  majColumn.appendChild(majList);
  columns.appendChild(majColumn);

  var disColumn = document.createElement('div');
  disColumn.className = 'coalitions-column';
  var disTitle = document.createElement('div');
  disTitle.className = 'coalitions-column-title';
  disTitle.textContent = 'Dissent Groups';
  disColumn.appendChild(disTitle);
  var disList = document.createElement('div');
  disList.className = 'coalitions-group-list';
  disColumn.appendChild(disList);
  columns.appendChild(disColumn);

  layout.appendChild(columns);
  container.appendChild(layout);

  // Build vote lookup from all votes (used to compute filtered indexes)
  var votesByCase = {};
  window.DATA.votes.forEach(function(v) {
    if (!votesByCase[v.case_id]) votesByCase[v.case_id] = {};
    votesByCase[v.case_id][v.justice] = v.vote;
  });

  // Current computed indexes (recomputed on filter change)
  var majEntries = [];
  var disEntries = [];

  function computeFilteredIndexes() {
    var filteredCases = window.getFilteredCases();
    var majIdx = {};
    var disIdx = {};
    var coalIdx = {};

    filteredCases.forEach(function(c) {
      var cv = votesByCase[c.id];
      if (!cv) return;
      var maj = [];
      var dis = [];
      Object.keys(cv).sort().forEach(function(j) {
        if (cv[j] === 'dissent') dis.push(j);
        else maj.push(j);
      });
      if (dis.length === 0) return; // skip unanimous

      var majKey = maj.join(',');
      var disKey = dis.join(',');
      var sig = majKey + '|' + disKey;

      if (!majIdx[majKey]) majIdx[majKey] = [];
      majIdx[majKey].push(c);
      if (!disIdx[disKey]) disIdx[disKey] = [];
      disIdx[disKey].push(c);
      if (!coalIdx[sig]) coalIdx[sig] = [];
      coalIdx[sig].push(c);
    });

    // Update stats
    var totalCoalitions = Object.keys(coalIdx).length;
    var totalMajGroups = Object.keys(majIdx).length;
    var totalDisGroups = Object.keys(disIdx).length;
    statsBar.textContent = totalCoalitions + ' unique coalitions \u2022 ' + totalMajGroups + ' majority groups \u2022 ' + totalDisGroups + ' dissent groups';

    // Sort by count descending
    majEntries = Object.keys(majIdx).map(function(key) {
      return { key: key, names: key.split(','), cases: majIdx[key] };
    }).sort(function(a, b) { return b.cases.length - a.cases.length; });

    disEntries = Object.keys(disIdx).map(function(key) {
      return { key: key, names: key.split(','), cases: disIdx[key] };
    }).sort(function(a, b) { return b.cases.length - a.cases.length; });

    // Expose for viz panel reuse
    window.coalitionMajEntries = majEntries;
    window.coalitionDisEntries = disEntries;
  }

  function renderGroups() {
    var search = searchInput.value.trim().toLowerCase();
    renderGroupList(majList, majEntries, search, 'majority');
    renderGroupList(disList, disEntries, search, 'dissent');
  }

  function renderGroupList(listEl, entries, search, side) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    var filtered = entries;
    if (search) {
      filtered = entries.filter(function(e) {
        return e.names.some(function(n) { return n.toLowerCase().indexOf(search) >= 0; });
      });
    }

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No ' + side + ' groups match';
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach(function(entry) {
      var item = document.createElement('div');
      item.className = 'coalition-group-item';

      var header = document.createElement('div');
      header.className = 'coalition-group-header';

      var namesSpan = document.createElement('span');
      namesSpan.className = 'coalition-group-names';
      namesSpan.textContent = entry.names.join(', ');
      header.appendChild(namesSpan);

      // Year range span
      var years = entry.cases.map(function(c) { return parseDate(c.date).getFullYear(); });
      var minYear = Math.min.apply(null, years);
      var maxYear = Math.max.apply(null, years);
      var yearSpan = document.createElement('span');
      yearSpan.className = 'coalition-group-years';
      yearSpan.textContent = minYear === maxYear ? '(' + minYear + ')' : '(' + minYear + '–' + maxYear + ')';
      header.appendChild(yearSpan);

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

      // Toggle expand/collapse on header click
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

  // Initial render
  computeFilteredIndexes();
  renderGroups();

  // Re-render on filter change
  window.addEventListener('scotusgami-filter-change', function() {
    computeFilteredIndexes();
    renderGroups();
  });

  // Listen for coalition highlight from feed tab
  window.addEventListener('scotusgami-show-coalition', function(ev) {
    var sig = ev.detail && ev.detail.sig;
    if (!sig) return;

    var parts = sig.split('|');
    var majKey = parts[0];
    var disKey = parts[1];

    // Clear search and re-render
    searchInput.value = '';
    renderGroups();

    // Find and expand the matching majority group
    var majItems = majList.querySelectorAll('.coalition-group-item');
    majItems.forEach(function(item) {
      var nameText = item.querySelector('.coalition-group-names').textContent;
      if (nameText === majKey.split(',').join(', ')) {
        var cl = item.querySelector('.coalition-case-list');
        if (cl) {
          cl.classList.remove('collapsed');
          item.classList.add('expanded');
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    // Find and expand the matching dissent group
    var disItems = disList.querySelectorAll('.coalition-group-item');
    disItems.forEach(function(item) {
      var nameText = item.querySelector('.coalition-group-names').textContent;
      if (nameText === disKey.split(',').join(', ')) {
        var cl = item.querySelector('.coalition-case-list');
        if (cl) {
          cl.classList.remove('collapsed');
          item.classList.add('expanded');
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  });
});
