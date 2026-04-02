// ============================================
// DATA TAB: Case List + Vote Detail
// ============================================
window.addEventListener('scotusgami-data-ready', function() {
  var DATA = window.DATA;
  if (!DATA) return;

  var parseDate = window.parseDate;

  // Sort cases reverse chronologically (most recent first)
  var cases = DATA.cases.slice().sort(function(a, b) {
    return parseDate(b.date) - parseDate(a.date);
  });

  // Index votes by case_id
  var votesByCase = {};
  DATA.votes.forEach(function(v) {
    if (!votesByCase[v.case_id]) votesByCase[v.case_id] = [];
    votesByCase[v.case_id].push(v);
  });

  var caseListEl = d3.select('#case-list');
  var detailEl = document.getElementById('case-detail');

  cases.forEach(function(c) {
    var li = caseListEl.append('li')
      .datum(c)
      .on('click', function() {
        caseListEl.selectAll('li').classed('selected', false);
        d3.select(this).classed('selected', true);
        showCaseDetail(c);
      });
    var nameDiv = document.createElement('div');
    nameDiv.className = 'case-name';
    nameDiv.textContent = c.name;
    li.node().appendChild(nameDiv);
    var dateDiv = document.createElement('div');
    dateDiv.className = 'case-date';
    dateDiv.textContent = c.date + (c.docket ? ' \u2014 ' + c.docket : '');
    li.node().appendChild(dateDiv);
  });

  var statusBar = document.getElementById('status-bar');
  statusBar.textContent = cases.length + ' cases loaded';

  // Show default stats card
  showDefaultStats();

  // Search filter for case list
  var dataSearchInput = document.getElementById('data-search');
  if (dataSearchInput) {
    dataSearchInput.addEventListener('input', function() {
      var term = dataSearchInput.value.trim().toLowerCase();
      var caseListItems = document.querySelectorAll('#case-list li');
      caseListItems.forEach(function(li) {
        var datum = d3.select(li).datum();
        if (!datum) return;
        var name = datum.name.toLowerCase();
        if (!term || name.indexOf(term) >= 0) {
          li.style.display = '';
        } else {
          li.style.display = 'none';
        }
      });
    });
  }

  function showDefaultStats() {
    while (detailEl.firstChild) detailEl.removeChild(detailEl.firstChild);

    var card = document.createElement('div');
    card.className = 'data-stats-card';

    function addStat(label, value) {
      var row = document.createElement('div');
      row.className = 'stat-row';
      var lbl = document.createElement('span');
      lbl.className = 'stat-label';
      lbl.textContent = label;
      row.appendChild(lbl);
      var val = document.createElement('span');
      val.className = 'stat-value';
      val.textContent = value;
      row.appendChild(val);
      card.appendChild(row);
    }

    addStat('Total Cases', cases.length);

    // Date range
    if (cases.length > 0) {
      addStat('Date Range', cases[cases.length - 1].date + ' \u2014 ' + cases[0].date);
    }

    // Most and least agreeing pair
    var bestPair = null, bestRate = 0, worstPair = null, worstRate = 100;
    var currentJustices = DATA.justices;
    for (var i = 0; i < currentJustices.length; i++) {
      for (var j = i + 1; j < currentJustices.length; j++) {
        var a = currentJustices[i], b = currentJustices[j];
        var key1 = a + '-' + b, key2 = b + '-' + a;
        var d = DATA.agreements[key1] || DATA.agreements[key2];
        if (d && d.cases >= 10) {
          if (d.rate > bestRate) { bestRate = d.rate; bestPair = a + ' + ' + b; }
          if (d.rate < worstRate) { worstRate = d.rate; worstPair = a + ' + ' + b; }
        }
      }
    }
    if (bestPair) addStat('Most Agreeing', bestPair + ' (' + bestRate + '%)');
    if (worstPair) addStat('Least Agreeing', worstPair + ' (' + worstRate + '%)');

    // Term range
    var termYears = [];
    var seenTerms = {};
    cases.forEach(function(c) {
      if (!seenTerms[c.term_year]) { seenTerms[c.term_year] = true; termYears.push(c.term_year); }
    });
    termYears.sort(function(a, b) { return a - b; });
    if (termYears.length > 0) {
      addStat('Term Coverage', 'OT' + termYears[0] + ' \u2014 OT' + termYears[termYears.length - 1]);
    }

    detailEl.appendChild(card);
  }

  function showCaseDetail(c) {
    // Clear existing
    while (detailEl.firstChild) detailEl.removeChild(detailEl.firstChild);

    // Case header
    var title = document.createElement('div');
    title.className = 'feed-card-headline';
    title.textContent = c.name;
    detailEl.appendChild(title);

    var date = document.createElement('div');
    date.className = 'feed-card-meta';
    date.textContent = c.date + (c.docket ? ' \u2014 Docket: ' + c.docket : '');
    detailEl.appendChild(date);

    var caseVotes = votesByCase[c.id] || [];
    if (caseVotes.length === 0) {
      var noData = document.createElement('div');
      noData.className = 'pair-detail-placeholder';
      noData.style.marginTop = '20px';
      noData.textContent = 'No vote data available for this case';
      detailEl.appendChild(noData);
      return;
    }

    // Group by vote type
    var groups = { majority: [], concurrence: [], dissent: [] };
    caseVotes.forEach(function(v) {
      var type = v.vote;
      if (type === 'majority') groups.majority.push(v.justice);
      else if (type === 'concurrence') groups.concurrence.push(v.justice);
      else if (type === 'dissent') groups.dissent.push(v.justice);
      else {
        // Other types go to concurrence bucket
        if (!groups[type]) groups[type] = [];
        groups[type].push(v.justice);
      }
    });

    // Split summary
    var majCount = groups.majority.length + groups.concurrence.length;
    var disCount = groups.dissent.length;
    var splitDiv = document.createElement('div');
    splitDiv.style.cssText = 'margin-top: 12px; font-size: 18px; font-weight: 600; color: #f0f6fc;';
    splitDiv.textContent = majCount + '-' + disCount;
    detailEl.appendChild(splitDiv);

    // Vote summary with scorigami context (from feed.js shared builder)
    if (window.buildVoteSummary && window.feedItemsByCase) {
      var caseFeedItems = window.feedItemsByCase[c.id] || [];
      var voteSummary = window.buildVoteSummary(c.id, caseFeedItems);
      if (voteSummary) {
        var summaryDiv = document.createElement('div');
        summaryDiv.className = 'feed-case-summary';
        summaryDiv.style.marginTop = '8px';
        summaryDiv.appendChild(voteSummary.textNode);
        detailEl.appendChild(summaryDiv);
      }
    }

    var breakdown = document.createElement('div');
    breakdown.className = 'vote-breakdown';

    // Majority
    if (groups.majority.length > 0) {
      var majGroup = document.createElement('div');
      majGroup.className = 'vote-group';
      var majLabel = document.createElement('div');
      majLabel.className = 'vote-group-label';
      majLabel.textContent = 'Majority (' + groups.majority.length + ')';
      majGroup.appendChild(majLabel);
      groups.majority.sort().forEach(function(j) {
        var row = document.createElement('div');
        row.className = 'vote-justice majority';
        row.textContent = j;
        majGroup.appendChild(row);
      });
      breakdown.appendChild(majGroup);
    }

    // Concurrence
    if (groups.concurrence.length > 0) {
      var conGroup = document.createElement('div');
      conGroup.className = 'vote-group';
      var conLabel = document.createElement('div');
      conLabel.className = 'vote-group-label';
      conLabel.textContent = 'Concurrence (' + groups.concurrence.length + ')';
      conGroup.appendChild(conLabel);
      groups.concurrence.sort().forEach(function(j) {
        var row = document.createElement('div');
        row.className = 'vote-justice concurrence';
        row.textContent = j;
        conGroup.appendChild(row);
      });
      breakdown.appendChild(conGroup);
    }

    // Dissent
    if (groups.dissent.length > 0) {
      var disGroup = document.createElement('div');
      disGroup.className = 'vote-group';
      var disLabel = document.createElement('div');
      disLabel.className = 'vote-group-label';
      disLabel.textContent = 'Dissent (' + groups.dissent.length + ')';
      disGroup.appendChild(disLabel);
      groups.dissent.sort().forEach(function(j) {
        var row = document.createElement('div');
        row.className = 'vote-justice dissent';
        row.textContent = j;
        disGroup.appendChild(row);
      });
      breakdown.appendChild(disGroup);
    }

    detailEl.appendChild(breakdown);

    // Sources section
    if (c.source_url || c.oyez_url || c.scotusblog_url) {
      var sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'case-sources';

      var sourcesLabel = document.createElement('div');
      sourcesLabel.className = 'vote-group-label';
      sourcesLabel.textContent = 'Sources';
      sourcesDiv.appendChild(sourcesLabel);

      if (c.source_url) {
        var sourceRow = document.createElement('div');
        sourceRow.className = 'case-source-row';
        var sourcePrefix = document.createElement('span');
        sourcePrefix.className = 'case-source-label';
        sourcePrefix.textContent = 'Primary: ';
        sourceRow.appendChild(sourcePrefix);
        var sourceLink = document.createElement('a');
        sourceLink.href = c.source_url;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener';
        sourceLink.className = 'case-source-link';
        sourceLink.textContent = c.source_name || 'Source';
        sourceRow.appendChild(sourceLink);
        sourcesDiv.appendChild(sourceRow);
      }

      if (c.oyez_url) {
        var oyezRow = document.createElement('div');
        oyezRow.className = 'case-source-row';
        var oyezPrefix = document.createElement('span');
        oyezPrefix.className = 'case-source-label';
        oyezPrefix.textContent = 'Verify: ';
        oyezRow.appendChild(oyezPrefix);
        var oyezLink = document.createElement('a');
        oyezLink.href = c.oyez_url;
        oyezLink.target = '_blank';
        oyezLink.rel = 'noopener';
        oyezLink.className = 'case-source-link';
        oyezLink.textContent = 'Oyez';
        oyezRow.appendChild(oyezLink);
        sourcesDiv.appendChild(oyezRow);
      }

      if (c.scotusblog_url) {
        var blogRow = document.createElement('div');
        blogRow.className = 'case-source-row';
        var blogPrefix = document.createElement('span');
        blogPrefix.className = 'case-source-label';
        blogPrefix.textContent = 'Verify: ';
        blogRow.appendChild(blogPrefix);
        var blogLink = document.createElement('a');
        blogLink.href = c.scotusblog_url;
        blogLink.target = '_blank';
        blogLink.rel = 'noopener';
        blogLink.className = 'case-source-link';
        blogLink.textContent = 'SCOTUSblog';
        blogRow.appendChild(blogLink);
        sourcesDiv.appendChild(blogRow);
      }

      detailEl.appendChild(sourcesDiv);
    }
  }
});
