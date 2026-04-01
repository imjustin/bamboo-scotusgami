// ============================================
// COALITIONS TAB: Explore majority/dissent groups
// ============================================
window.addEventListener('scotusgami-data-ready', function() {
  var container = document.getElementById('tab-coalitions');
  if (!container) return;

  // Wait a tick for feed.js to build indexes
  setTimeout(function() {
    var majIndex = window.majorityGroupIndex || {};
    var disIndex = window.dissentGroupIndex || {};
    var coalIndex = window.coalitionIndex || {};

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
    var totalCoalitions = Object.keys(coalIndex).length;
    var totalMajGroups = Object.keys(majIndex).length;
    var totalDisGroups = Object.keys(disIndex).length;
    statsBar.textContent = totalCoalitions + ' unique coalitions \u2022 ' + totalMajGroups + ' majority groups \u2022 ' + totalDisGroups + ' dissent groups';
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

    // Sort groups by count descending
    function sortedEntries(index) {
      return Object.keys(index).map(function(key) {
        return { key: key, names: key.split(','), cases: index[key] };
      }).sort(function(a, b) {
        return b.cases.length - a.cases.length;
      });
    }

    var majEntries = sortedEntries(majIndex);
    var disEntries = sortedEntries(disIndex);

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

        entry.cases.sort(function(a, b) {
          // Reverse chronological
          return b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
        }).forEach(function(c) {
          var caseRow = document.createElement('a');
          caseRow.href = '#';
          caseRow.className = 'coalition-case-row';
          caseRow.textContent = c.name + ' (' + c.date + ')';
          caseRow.addEventListener('click', function(ev) {
            ev.preventDefault();
            // Switch to Data tab and select this case
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); });
            var dataBtn = document.querySelector('.tab-btn[data-tab="data"]');
            if (dataBtn) dataBtn.classList.add('active');
            var dataTab = document.getElementById('tab-data');
            if (dataTab) dataTab.classList.add('active');
            var caseListItems = document.querySelectorAll('#case-list li');
            caseListItems.forEach(function(li) {
              var datum = d3.select(li).datum();
              if (datum && datum.id === c.id) {
                li.click();
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
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

    renderGroups();

    // Listen for coalition highlight from feed tab
    window.addEventListener('scotusgami-show-coalition', function(ev) {
      var sig = ev.detail && ev.detail.sig;
      if (!sig) return;

      // Parse sig to get majority and dissent groups
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
  }, 50);
});
