// ============================================
// JUSTICES TAB
// ============================================
(function() {
  'use strict';

  // ── Constants (mirrored from ideology-drift.js) ──────────────────────────
  var LIBERAL = ['Jackson', 'Kagan', 'Sotomayor'];
  var CONSERVATIVE = ['Alito', 'Thomas', 'Gorsuch'];

  var JUSTICE_START_TERM = {
    'Roberts': 2005, 'Thomas': 2005, 'Alito': 2005, 'Stevens': 2005,
    'Souter': 2005, 'Ginsburg': 2005, 'Breyer': 2005, 'OConnor': 2005,
    'Kennedy': 2005, 'Scalia': 2005,
    'Sotomayor': 2009, 'Kagan': 2010, 'Gorsuch': 2016,
    'Kavanaugh': 2018, 'Barrett': 2020, 'Jackson': 2022
  };

  var JUSTICE_COLORS = {
    'Roberts': '#58a6ff', 'Thomas': '#f85149', 'Alito': '#ff7b72',
    'Sotomayor': '#d2a8ff', 'Kagan': '#bc8cff', 'Gorsuch': '#ffa657',
    'Kavanaugh': '#7ee787', 'Barrett': '#56d4dd', 'Jackson': '#e2c08d',
    'Kennedy': '#79c0ff', 'Ginsburg': '#f0883e', 'Breyer': '#a5d6ff',
    'Scalia': '#ff9492', 'Stevens': '#b392f0', 'Souter': '#85e89d',
    'OConnor': '#ffdf5d'
  };

  var JUSTICE_APPOINTED_BY = {
    'Roberts': 'George W. Bush', 'Alito': 'George W. Bush',
    'Thomas': 'George H.W. Bush', 'Sotomayor': 'Barack Obama',
    'Kagan': 'Barack Obama', 'Gorsuch': 'Donald Trump',
    'Kavanaugh': 'Donald Trump', 'Barrett': 'Donald Trump',
    'Jackson': 'Joe Biden', 'Kennedy': 'Ronald Reagan',
    'Ginsburg': 'Bill Clinton', 'Breyer': 'Bill Clinton',
    'Scalia': 'Ronald Reagan', 'Stevens': 'Gerald Ford',
    'Souter': 'George H.W. Bush', 'OConnor': 'Ronald Reagan'
  };

  var JUSTICE_END_TERM = {
    'Roberts': null, 'Thomas': null, 'Alito': null, 'Sotomayor': null,
    'Kagan': null, 'Gorsuch': null, 'Kavanaugh': null, 'Barrett': null,
    'Jackson': null,
    'OConnor': 2005, 'Kennedy': 2017, 'Scalia': 2015,
    'Souter': 2008, 'Stevens': 2009, 'Ginsburg': 2019, 'Breyer': 2021
  };

  var CURRENT_JUSTICES = ['Roberts', 'Thomas', 'Alito', 'Sotomayor', 'Kagan',
                          'Gorsuch', 'Kavanaugh', 'Barrett', 'Jackson'];

  // ── Helper: compute per-justice vote stats ────────────────────────────────
  // Returns { total, majority, dissent, concurrence, majorityRate, dissentRate, concurrenceRate }
  function computeVoteStats(justice, votes) {
    var total = 0, majority = 0, dissent = 0, concurrence = 0;
    votes.forEach(function(v) {
      if (v.justice !== justice) return;
      total++;
      if (v.vote === 'majority') majority++;
      else if (v.vote === 'dissent') dissent++;
      else if (v.vote === 'concurrence') concurrence++;
    });
    return {
      total: total,
      majority: majority,
      dissent: dissent,
      concurrence: concurrence,
      majorityRate: total > 0 ? (majority / total * 100) : 0,
      dissentRate: total > 0 ? (dissent / total * 100) : 0,
      concurrenceRate: total > 0 ? (concurrence / total * 100) : 0
    };
  }

  // ── Helper: compute swing score for a justice ─────────────────────────────
  // Returns { score (%), total (close case count) }
  function computeSwingScore(justice, cases, votes) {
    var voteIndex = {};
    votes.forEach(function(v) {
      if (!voteIndex[v.case_id]) voteIndex[v.case_id] = [];
      voteIndex[v.case_id].push(v);
    });
    var total = 0, majority = 0;
    cases.forEach(function(c) {
      var cv = voteIndex[c.id];
      if (!cv) return;
      var dissenters = cv.filter(function(v) { return v.vote === 'dissent'; }).length;
      if (dissenters !== 3 && dissenters !== 4) return; // not a close case
      var jv = cv.find(function(v) { return v.justice === justice; });
      if (!jv) return;
      total++;
      if (jv.vote !== 'dissent') majority++;
    });
    return { score: total > 0 ? (majority / total * 100) : 0, total: total };
  }

  // ── Helper: compute ideology drift points for a justice ──────────────────
  // Returns [{ term, score }] (same algorithm as ideology-drift.js)
  function computeIdeologyPoints(justice, cases, votes) {
    var votesByCase = {};
    votes.forEach(function(v) {
      if (!votesByCase[v.case_id]) votesByCase[v.case_id] = {};
      votesByCase[v.case_id][v.justice] = v.vote;
    });

    var libBloc = LIBERAL.filter(function(j) { return j !== justice; });
    var conBloc = CONSERVATIVE.filter(function(j) { return j !== justice; });

    var termYearsSet = {};
    cases.forEach(function(c) { termYearsSet[c.term_year] = true; });
    var termYears = Object.keys(termYearsSet).map(Number).sort(function(a, b) { return a - b; });

    var startTerm = JUSTICE_START_TERM[justice] || 2005;
    var points = [];

    termYears.forEach(function(term) {
      if (term < startTerm) return;

      var termCases = cases.filter(function(c) { return c.term_year === term; });

      function avgAgreement(bloc) {
        var rates = [];
        bloc.forEach(function(blocJ) {
          var agreed = 0, total = 0;
          termCases.forEach(function(c) {
            var cv = votesByCase[c.id];
            if (!cv) return;
            var jVote = cv[justice];
            var bVote = cv[blocJ];
            if (jVote === undefined || bVote === undefined) return;
            total++;
            if ((jVote === 'dissent') === (bVote === 'dissent')) agreed++;
          });
          if (total > 0) rates.push((agreed / total) * 100);
        });
        return rates.length > 0
          ? rates.reduce(function(s, v) { return s + v; }, 0) / rates.length
          : 0;
      }

      var libAvg = avgAgreement(libBloc);
      var conAvg = avgAgreement(conBloc);
      if (libBloc.length === 0 && conBloc.length === 0) return;

      points.push({ term: term, score: libAvg - conAvg });
    });

    return points;
  }

  // ── Helper: get pairwise agreement for a justice ─────────────────────────
  // Returns array of { name, rate, cases } sorted by rate descending
  function getPeerAgreements(justice, agreements) {
    var peers = [];
    Object.keys(agreements).forEach(function(key) {
      var parts = key.split('-');
      if (parts[0] !== justice && parts[1] !== justice) return;
      var other = parts[0] === justice ? parts[1] : parts[0];
      var data = agreements[key];
      peers.push({ name: other, rate: data.rate, cases: data.cases });
    });
    peers.sort(function(a, b) { return b.rate - a.rate; });
    return peers;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var currentJustice = null; // null = roster, string = profile

  // ── Entry point ───────────────────────────────────────────────────────────
  function init() {
    renderRoster();
  }

  function renderRoster() {
    var container = document.getElementById('tab-justices');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var DATA = window.DATA;
    var grid = document.createElement('div');
    grid.className = 'justices-roster';

    CURRENT_JUSTICES.forEach(function(justice) {
      var stats = computeVoteStats(justice, DATA.votes);
      var peers = getPeerAgreements(justice, DATA.agreements);

      // Median agreement: find the peer closest to 50% cross-ideological agreement
      // (just use middle-ranked peer as a proxy for "median")
      var midPeer = peers[Math.floor(peers.length / 2)];

      var startTerm = JUSTICE_START_TERM[justice] || 2005;
      var endTerm = JUSTICE_END_TERM[justice];
      var tenureStr = startTerm + '\u2013' + (endTerm ? endTerm : 'present');

      var isLib = LIBERAL.indexOf(justice) >= 0;
      var isCon = CONSERVATIVE.indexOf(justice) >= 0;
      var lean = isLib ? 'liberal' : (isCon ? 'conservative' : 'moderate');

      var card = document.createElement('div');
      card.className = 'justice-card';

      var nameEl = document.createElement('div');
      nameEl.className = 'justice-card-name';
      nameEl.textContent = justice;
      card.appendChild(nameEl);

      var badge = document.createElement('span');
      badge.className = 'justice-card-badge ' + lean;
      badge.textContent = lean.charAt(0).toUpperCase() + lean.slice(1);
      card.appendChild(badge);

      var tenure = document.createElement('div');
      tenure.className = 'justice-card-tenure';
      tenure.textContent = tenureStr;
      card.appendChild(tenure);

      var statsDiv = document.createElement('div');
      statsDiv.className = 'justice-card-stats';

      function addCardStat(label, value) {
        var row = document.createElement('div');
        row.className = 'justice-card-stat';
        var lbl = document.createElement('span');
        lbl.className = 'justice-card-stat-label';
        lbl.textContent = label;
        var val = document.createElement('span');
        val.className = 'justice-card-stat-value';
        val.textContent = value;
        row.appendChild(lbl);
        row.appendChild(val);
        statsDiv.appendChild(row);
      }

      addCardStat('Majority rate', Math.round(stats.majorityRate) + '%');
      addCardStat('Dissent rate', Math.round(stats.dissentRate) + '%');
      if (midPeer) {
        addCardStat('Median agreement', Math.round(midPeer.rate) + '%');
      }

      card.appendChild(statsDiv);

      card.addEventListener('click', function() {
        showProfile(justice);
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function showProfile(justice) {
    currentJustice = justice;
    var container = document.getElementById('tab-justices');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var profile = document.createElement('div');
    profile.className = 'justice-profile';

    // Back button
    var backBtn = document.createElement('button');
    backBtn.className = 'justice-back-btn';
    backBtn.textContent = '\u2190 All Justices';
    backBtn.addEventListener('click', function() {
      currentJustice = null;
      renderRoster();
    });
    profile.appendChild(backBtn);

    renderProfileHeader(profile, justice);
    renderStatCards(profile, justice);
    renderIdeologyChart(profile, justice);
    renderPeers(profile, justice);
    renderCaseList(profile, justice);

    container.appendChild(profile);
  }

  function renderProfileHeader(parent, justice) {
    var DATA = window.DATA;
    var stats = computeVoteStats(justice, DATA.votes);

    var startTerm = JUSTICE_START_TERM[justice] || 2005;
    var endTerm = JUSTICE_END_TERM[justice];
    var tenureStr = startTerm + '\u2013' + (endTerm ? endTerm : 'present');
    var termCount = (endTerm || 2024) - startTerm + 1;

    var header = document.createElement('div');
    header.className = 'justice-profile-header';

    var nameEl = document.createElement('div');
    nameEl.className = 'justice-profile-name';
    nameEl.textContent = 'Justice ' + justice;
    header.appendChild(nameEl);

    var meta = document.createElement('div');
    meta.className = 'justice-profile-meta';

    function addMeta(text) {
      var span = document.createElement('span');
      span.textContent = text;
      meta.appendChild(span);
    }

    var appointer = JUSTICE_APPOINTED_BY[justice];
    if (appointer) addMeta('Appointed by ' + appointer);
    addMeta(tenureStr + ' \u00b7 ' + termCount + ' term' + (termCount !== 1 ? 's' : ''));
    addMeta(stats.total + ' cases');

    header.appendChild(meta);
    parent.appendChild(header);
  }

  function renderStatCards(parent, justice) {
    var DATA = window.DATA;
    var stats = computeVoteStats(justice, DATA.votes);
    var swing = computeSwingScore(justice, DATA.cases, DATA.votes);
    var driftPoints = computeIdeologyPoints(justice, DATA.cases, DATA.votes);
    var latestScore = driftPoints.length > 0 ? driftPoints[driftPoints.length - 1].score : null;

    var row = document.createElement('div');
    row.className = 'justice-stat-cards';

    function addCard(label, value, sub) {
      var card = document.createElement('div');
      card.className = 'justice-stat-card';
      var lbl = document.createElement('div');
      lbl.className = 'justice-stat-card-label';
      lbl.textContent = label;
      var val = document.createElement('div');
      val.className = 'justice-stat-card-value';
      val.textContent = value;
      card.appendChild(lbl);
      card.appendChild(val);
      if (sub) {
        var subEl = document.createElement('div');
        subEl.className = 'justice-stat-card-sub';
        subEl.textContent = sub;
        card.appendChild(subEl);
      }
      row.appendChild(card);
    }

    addCard('Majority Rate', Math.round(stats.majorityRate) + '%',
            stats.majority + ' of ' + stats.total + ' cases');
    addCard('Dissent Rate', Math.round(stats.dissentRate) + '%',
            stats.dissent + ' dissents');
    addCard('Swing Score', Math.round(swing.score) + '%',
            swing.total + ' close cases');

    if (latestScore !== null) {
      var lean = latestScore < 0 ? 'Conservative' : 'Liberal';
      addCard('Ideology Lean', latestScore.toFixed(1),
              lean + ' (most recent term)');
    } else {
      addCard('Ideology Lean', 'N/A', 'Insufficient data');
    }

    parent.appendChild(row);
  }

  function renderIdeologyChart(parent, justice) {
    var section = document.createElement('div');
    section.className = 'justice-section';

    var title = document.createElement('div');
    title.className = 'justice-section-title';
    title.textContent = 'Ideology Drift';
    section.appendChild(title);

    var chartDiv = document.createElement('div');
    chartDiv.id = 'justice-drift-chart';
    section.appendChild(chartDiv);
    parent.appendChild(section);

    var points = computeIdeologyPoints(justice, window.DATA.cases, window.DATA.votes);
    if (points.length === 0) {
      chartDiv.style.color = '#484f58';
      chartDiv.style.padding = '24px';
      var msg = document.createElement('span');
      msg.textContent = 'Not enough data to chart ideology drift.';
      chartDiv.appendChild(msg);
      return;
    }

    var color = JUSTICE_COLORS[justice] || '#8b949e';
    var margin = { top: 16, right: 20, bottom: 36, left: 50 };
    var width = (chartDiv.clientWidth || 600) - margin.left - margin.right;
    var height = 160;

    var svg = d3.select(chartDiv).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    var g = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var termYears = points.map(function(d) { return d.term; });

    var xScale = d3.scaleLinear()
      .domain(d3.extent(termYears))
      .range([0, width]);

    var allScores = points.map(function(d) { return d.score; });
    var yMin = Math.min(-50, d3.min(allScores) - 5);
    var yMax = Math.max(50, d3.max(allScores) + 5);

    var yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height, 0]);

    // Zero line
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', '#484f58')
      .attr('stroke-dasharray', '6,4')
      .attr('stroke-width', 1);

    // X axis
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(xScale)
        .tickFormat(function(d) { return 'OT' + d; })
        .ticks(Math.min(points.length, 10)));

    // Y axis
    g.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(5));

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8b949e')
      .attr('font-size', '10px')
      .text('Lib \u2190 Score \u2192 Con');

    // Line
    var line = d3.line()
      .x(function(d) { return xScale(d.term); })
      .y(function(d) { return yScale(d.score); })
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', line)
      .attr('opacity', 0.9);

    // Dots
    g.selectAll('.drift-dot')
      .data(points)
      .enter().append('circle')
      .attr('class', 'drift-dot')
      .attr('cx', function(d) { return xScale(d.term); })
      .attr('cy', function(d) { return yScale(d.score); })
      .attr('r', 3)
      .attr('fill', color)
      .attr('opacity', 0.85);

    // Tooltip
    var tooltip = d3.select('#tooltip');
    g.selectAll('.drift-dot-hover')
      .data(points)
      .enter().append('circle')
      .attr('class', 'drift-dot-hover')
      .attr('cx', function(d) { return xScale(d.term); })
      .attr('cy', function(d) { return yScale(d.score); })
      .attr('r', 10)
      .attr('fill', 'transparent')
      .on('mousemove', function(event, d) {
        tooltip.style('opacity', 1)
          .style('left', (event.clientX + 12) + 'px')
          .style('top', (event.clientY - 20) + 'px');
        var tipNode = tooltip.node();
        while (tipNode.firstChild) tipNode.removeChild(tipNode.firstChild);
        var pairSpan = document.createElement('span');
        pairSpan.className = 'pair';
        pairSpan.textContent = justice + ' OT' + d.term;
        tipNode.appendChild(pairSpan);
        tipNode.appendChild(document.createElement('br'));
        var rateSpan = document.createElement('span');
        rateSpan.className = 'rate';
        rateSpan.textContent = 'Score: ' + d.score.toFixed(1);
        tipNode.appendChild(rateSpan);
      })
      .on('mouseout', function() {
        tooltip.style('opacity', 0);
      });
  }

  function renderPeers(parent, justice) {
    var peers = getPeerAgreements(justice, window.DATA.agreements);
    var allies = peers.slice(0, 3);
    var opponents = peers.slice(-3).reverse();

    var section = document.createElement('div');
    section.className = 'justice-section';

    var title = document.createElement('div');
    title.className = 'justice-section-title';
    title.textContent = 'Allies & Opponents';
    section.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'justice-peers';

    function makeCol(heading, list) {
      var col = document.createElement('div');
      col.className = 'justice-peers-col';

      var colTitle = document.createElement('div');
      colTitle.className = 'justice-peers-col-title';
      colTitle.textContent = heading;
      col.appendChild(colTitle);

      list.forEach(function(peer) {
        var row = document.createElement('div');
        row.className = 'justice-peer-row';

        var nameEl = document.createElement('span');
        nameEl.className = 'justice-peer-name';
        nameEl.textContent = peer.name;

        var statEl = document.createElement('span');
        statEl.className = 'justice-peer-stat';
        statEl.textContent = Math.round(peer.rate) + '% (' + peer.cases + ' cases)';

        row.appendChild(nameEl);
        row.appendChild(statEl);
        col.appendChild(row);
      });

      return col;
    }

    grid.appendChild(makeCol('Top Allies', allies));
    grid.appendChild(makeCol('Top Opponents', opponents));

    section.appendChild(grid);
    parent.appendChild(section);
  }

  function renderCaseList(parent, justice) {
    var DATA = window.DATA;
    var parseDate = window.parseDate;

    // Build case lookup by id
    var caseById = {};
    DATA.cases.forEach(function(c) { caseById[c.id] = c; });

    // Get this justice's votes with case data attached, sorted reverse-chron
    var justiceVotes = DATA.votes
      .filter(function(v) { return v.justice === justice; })
      .map(function(v) { return { vote: v.vote, caseData: caseById[v.case_id] }; })
      .filter(function(entry) { return !!entry.caseData; })
      .sort(function(a, b) {
        return parseDate(b.caseData.date) - parseDate(a.caseData.date);
      });

    // Build vote-by-case index for co-voter lookup
    var votesByCase = {};
    DATA.votes.forEach(function(v) {
      if (!votesByCase[v.case_id]) votesByCase[v.case_id] = [];
      votesByCase[v.case_id].push(v);
    });

    // Get unique terms for filter dropdown
    var termsSet = {};
    justiceVotes.forEach(function(entry) { termsSet[entry.caseData.term_year] = true; });
    var termYears = Object.keys(termsSet).map(Number).sort(function(a, b) { return b - a; });

    var section = document.createElement('div');
    section.className = 'justice-section';

    var title = document.createElement('div');
    title.className = 'justice-section-title';
    title.textContent = 'Case History';
    section.appendChild(title);

    // Filter controls
    var filters = document.createElement('div');
    filters.className = 'justice-case-filters';

    var termSelect = document.createElement('select');
    var allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Terms';
    termSelect.appendChild(allOpt);
    termYears.forEach(function(y) {
      var opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = 'OT' + y;
      termSelect.appendChild(opt);
    });
    filters.appendChild(termSelect);

    var voteTypes = ['All', 'Majority', 'Dissent', 'Concurrence'];
    var activeVoteFilter = 'All';
    var voteButtons = {};
    voteTypes.forEach(function(type) {
      var btn = document.createElement('button');
      btn.textContent = type;
      if (type === 'All') btn.className = 'active';
      btn.addEventListener('click', function() {
        activeVoteFilter = type;
        Object.keys(voteButtons).forEach(function(t) {
          voteButtons[t].className = t === type ? 'active' : '';
        });
        updateList();
      });
      voteButtons[type] = btn;
      filters.appendChild(btn);
    });

    section.appendChild(filters);

    // Count label
    var countLabel = document.createElement('div');
    countLabel.style.fontSize = '12px';
    countLabel.style.color = '#484f58';
    countLabel.style.marginBottom = '8px';
    section.appendChild(countLabel);

    // Case list
    var listEl = document.createElement('ul');
    listEl.className = 'justice-case-list';
    section.appendChild(listEl);

    function updateList() {
      var termFilter = termSelect.value;
      var filtered = justiceVotes.filter(function(entry) {
        if (termFilter !== 'all' && entry.caseData.term_year !== parseInt(termFilter, 10)) return false;
        if (activeVoteFilter !== 'All' && entry.vote !== activeVoteFilter.toLowerCase()) return false;
        return true;
      });

      while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

      if (filtered.length === 0) {
        var empty = document.createElement('li');
        empty.className = 'justice-case-empty';
        empty.textContent = 'No cases match the selected filters.';
        listEl.appendChild(empty);
        countLabel.textContent = '0 cases';
        return;
      }

      countLabel.textContent = filtered.length + ' case' + (filtered.length !== 1 ? 's' : '');

      filtered.forEach(function(entry) {
        var c = entry.caseData;
        var li = document.createElement('li');
        li.className = 'justice-case-item';

        var left = document.createElement('div');
        left.className = 'justice-case-left';

        var nameLink = document.createElement('a');
        nameLink.className = 'justice-case-name';
        nameLink.textContent = c.name;
        nameLink.href = '#';
        nameLink.addEventListener('click', function(e) {
          e.preventDefault();
          // Switch to Data tab and select this case
          window.switchToTab('data', function() {
            var items = document.querySelectorAll('#case-list li');
            for (var i = 0; i < items.length; i++) {
              var datum = d3.select(items[i]).datum();
              if (datum && datum.id === c.id) {
                items[i].click();
                items[i].scrollIntoView({ block: 'center' });
                break;
              }
            }
          });
        });
        left.appendChild(nameLink);

        var meta = document.createElement('div');
        meta.className = 'justice-case-meta';
        meta.textContent = c.date + (c.docket ? ' \u2014 ' + c.docket : '');
        left.appendChild(meta);

        li.appendChild(left);

        // Show co-voters on the same side (skip for concurrence)
        if (entry.vote === 'majority' || entry.vote === 'dissent') {
          var caseVotes = votesByCase[c.id] || [];
          var sameVote = entry.vote === 'dissent' ? 'dissent' : 'majority';
          var coVoters = caseVotes
            .filter(function(v) {
              if (v.justice === justice) return false;
              if (sameVote === 'dissent') return v.vote === 'dissent';
              return v.vote !== 'dissent'; // majority + concurrence = same side
            })
            .map(function(v) { return v.justice; })
            .sort();
          if (coVoters.length > 0) {
            var coSpan = document.createElement('span');
            coSpan.className = 'justice-case-covote';
            coSpan.textContent = coVoters.join(', ');
            li.appendChild(coSpan);
          }
        }

        listEl.appendChild(li);
      });
    }

    termSelect.addEventListener('change', updateList);
    updateList();

    parent.appendChild(section);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  window.addEventListener('scotusgami-data-ready', function() {
    init();
  });
  if (window.DATA) {
    init();
  }
})();
