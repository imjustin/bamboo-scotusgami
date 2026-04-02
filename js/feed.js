// ============================================
// FEED TAB: SCOTUSgami Feed
// ============================================
window.addEventListener('scotusgami-data-ready', function() {
  var DATA = window.DATA;
  if (!DATA) return;

  var CONSERVATIVE = ['Roberts', 'Thomas', 'Alito', 'Gorsuch', 'Kavanaugh', 'Barrett', 'Scalia', 'Kennedy', 'O\'Connor'];
  var LIBERAL = ['Sotomayor', 'Kagan', 'Jackson', 'Ginsburg', 'Breyer', 'Stevens', 'Souter'];

  function getWing(name) {
    if (CONSERVATIVE.indexOf(name) >= 0) return 'conservative';
    if (LIBERAL.indexOf(name) >= 0) return 'liberal';
    return 'unknown';
  }

  function isCrossWing(a, b) {
    var wa = getWing(a), wb = getWing(b);
    return wa !== wb && wa !== 'unknown' && wb !== 'unknown';
  }

  var parseDate = window.parseDate;
  var pairKey = window.pairKey;

  // Build case-level vote detail lookup for rendering
  var voteDetailByCase = {};
  DATA.votes.forEach(function(v) {
    if (!voteDetailByCase[v.case_id]) voteDetailByCase[v.case_id] = {};
    voteDetailByCase[v.case_id][v.justice] = v.vote;
  });

  // Shared: build vote summary text and table for a case
  // feedItems is optional — pass the grouped items for a case to get scorigami context
  function buildVoteSummary(caseId, feedItems) {
    var caseVotes = voteDetailByCase[caseId];
    if (!caseVotes) return null;

    var majNames = [], conNames = [], disNames = [];
    Object.keys(caseVotes).sort().forEach(function(j) {
      var vt = caseVotes[j];
      if (vt === 'dissent') disNames.push(j);
      else if (vt === 'majority') majNames.push(j);
      else conNames.push(j);
    });

    // Build summary as a DOM fragment (so coalition count can be clickable)
    var frag = document.createDocumentFragment();
    var parts = [];
    if (majNames.length > 0) parts.push(majNames.length + ' in the majority');
    if (conNames.length > 0) parts.push(conNames.length + ' concurrence' + (conNames.length > 1 ? 's' : ''));
    if (disNames.length > 0) parts.push(disNames.length + ' dissent' + (disNames.length > 1 ? 's' : ''));
    frag.appendChild(document.createTextNode(parts.join(', ') + '.'));

    // Scorigami context from feed items
    if (feedItems) {
      var scotusgamiItem = feedItems.find(function(it) { return it.type === 'vote_split'; });
      var coalitionItem = feedItems.find(function(it) { return it.type === 'coalition_count'; });
      if (disNames.length === 0) {
        frag.appendChild(document.createTextNode(' Unanimous \u2014 not a SCOTUSgami.'));
      } else if (scotusgamiItem) {
        frag.appendChild(document.createTextNode(' This is a SCOTUSgami \u2014 this exact coalition has never appeared before.'));
      } else if (coalitionItem && coalitionItem.coalition_sig) {
        var sig = coalitionItem.coalition_sig;
        var count = coalitionItem.coalition_count;
        frag.appendChild(document.createTextNode(' Not a SCOTUSgami \u2014 this coalition has been seen '));
        var link = document.createElement('a');
        link.href = '#';
        link.className = 'coalition-count-link';
        link.textContent = count + ' times';
        link.addEventListener('click', function(ev) {
          ev.preventDefault();
          switchToTab('coalitions', function() {
            requestAnimationFrame(function() {
              window.dispatchEvent(new CustomEvent('scotusgami-show-coalition', { detail: { sig: sig } }));
            });
          });
        });
        frag.appendChild(link);
        frag.appendChild(document.createTextNode(' before.'));
      } else {
        frag.appendChild(document.createTextNode(' Not a SCOTUSgami.'));
      }
    }

    // Build table element
    var table = null;
    if (majNames.length > 0 || conNames.length > 0 || disNames.length > 0) {
      table = document.createElement('table');
      table.className = 'feed-vote-table';
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      var hasColumns = [];
      if (majNames.length > 0) hasColumns.push({ label: 'Majority', names: majNames });
      if (conNames.length > 0) hasColumns.push({ label: 'Concurrence', names: conNames });
      if (disNames.length > 0) hasColumns.push({ label: 'Dissent', names: disNames });
      hasColumns.forEach(function(col) {
        var th = document.createElement('th');
        th.textContent = col.label + ' (' + col.names.length + ')';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      var maxRows = Math.max(majNames.length, conNames.length, disNames.length);
      for (var ri = 0; ri < maxRows; ri++) {
        var tr = document.createElement('tr');
        hasColumns.forEach(function(col) {
          var td = document.createElement('td');
          if (ri < col.names.length) {
            td.textContent = col.names[ri];
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
    }

    return { textNode: frag, table: table };
  }

  // Expose for data-tab.js to use
  window.buildVoteSummary = buildVoteSummary;

  // ============================================
  // COMPUTE FEED
  // ============================================

  // #3: outcome-based agreement — majority+concurrence = same side, only dissent is opposite
  function isSameSide(voteA, voteB) {
    var dissA = (voteA === 'dissent');
    var dissB = (voteB === 'dissent');
    return dissA === dissB;
  }

  // #1: Build a coalition signature for scorigami tracking
  function coalitionSignature(caseVotes, justiceNames) {
    var majority = [];
    var dissent = [];
    justiceNames.slice().sort().forEach(function(j) {
      if (caseVotes[j] === 'dissent') {
        dissent.push(j);
      } else {
        majority.push(j);
      }
    });
    // Only track non-unanimous splits
    if (dissent.length === 0) return null;
    return majority.join(',') + '|' + dissent.join(',');
  }

  // #6: Determine the majority bloc wing for defection detection
  function getBlocWing(caseVotes) {
    var majCon = 0, majLib = 0;
    Object.keys(caseVotes).forEach(function(j) {
      if (caseVotes[j] !== 'dissent') {
        if (getWing(j) === 'conservative') majCon++;
        if (getWing(j) === 'liberal') majLib++;
      }
    });
    if (majCon > majLib) return 'conservative';
    if (majLib > majCon) return 'liberal';
    return null;
  }

  function computeScotusgamiFeed() {
    var cases = DATA.cases;
    var votes = DATA.votes;
    var feedItems = [];

    // Track state across cases
    var pairFirstAgreement = {};
    var pairFirstDisagreement = {};
    var pairAgreeStreak = {};
    var pairDisagreeStreak = {};
    var pairPeakAgreeStreak = {};   // #5: track peak for streak-breaking
    var pairPeakDisagreeStreak = {};
    var pairAgreed = {};
    var pairTotal = {};
    var pairPrevRate = {};          // #7: track previous rate for reversal detection
    var pairRateDirection = {};     // #7: 'rising', 'falling', or null
    var seenScotusEvents = new Set();
    var coalitionCounts = {};       // #1: track coalition composition counts
    var unanimousPerTerm = {};      // #2: count unanimousper term

    // Index votes by case_id -> {justice: vote_type}
    var votesByCase = {};
    votes.forEach(function(v) {
      if (!votesByCase[v.case_id]) votesByCase[v.case_id] = {};
      votesByCase[v.case_id][v.justice] = v.vote;
    });

    // Sort cases chronologically
    var sortedCases = cases.slice().sort(function(a, b) {
      var da = parseDate(a.date), db = parseDate(b.date);
      return da - db;
    });

    sortedCases.forEach(function(caseObj) {
      var caseVotes = votesByCase[caseObj.id];
      if (!caseVotes) return;

      var justiceNames = Object.keys(caseVotes);
      var majorityJustices = [];
      var dissenters = [];

      justiceNames.forEach(function(j) {
        var vtype = caseVotes[j];
        if (vtype === 'dissent') {
          dissenters.push(j);
        } else {
          majorityJustices.push(j);
        }
      });

      var termYear = caseObj.term_year;

      // #1: Vote split pattern tracking (true scorigami) + coalition counter
      var sig = coalitionSignature(caseVotes, justiceNames);
      if (sig) {
        if (!coalitionCounts[sig]) coalitionCounts[sig] = 0;
        coalitionCounts[sig]++;
        var coalCount = coalitionCounts[sig];
        var isNewCoalition = (coalCount === 1);
        var splitLabel = majorityJustices.length + '-' + dissenters.length;
        var majWings = { conservative: 0, liberal: 0 };
        majorityJustices.forEach(function(j) { var w = getWing(j); if (majWings[w] !== undefined) majWings[w]++; });
        var isCrossWingCoalition = majWings.conservative > 0 && majWings.liberal > 0;

        if (isNewCoalition) {
          // Higher score for close splits
          var closeness = Math.min(majorityJustices.length, dissenters.length);
          var sigScore = 50 + closeness * 8;
          if (isCrossWingCoalition && dissenters.length >= 2) sigScore += 15;
          feedItems.push({
            case_id: caseObj.id,
            case_name: caseObj.name,
            case_date: caseObj.date,
            type: 'vote_split',
            is_scotusgami: true,
            headline: 'New ' + splitLabel + ' coalition' + (isCrossWingCoalition ? ' (cross-wing majority)' : ''),
            detail: 'First time this exact ' + splitLabel + ' grouping: ' + majorityJustices.slice().sort().join(', ') + ' vs. ' + dissenters.slice().sort().join(', ') + '.',
            justices: justiceNames,
            novelty_score: Math.min(95, sigScore)
          });
        }

        // Always emit coalition count for non-unanimous cases
        feedItems.push({
          case_id: caseObj.id,
          case_name: caseObj.name,
          case_date: caseObj.date,
          type: 'coalition_count',
          is_scotusgami: false,
          coalition_sig: sig,
          coalition_count: coalCount,
          headline: splitLabel + ' decision — ' + (isNewCoalition ? 'first time this coalition' : 'seen ' + coalCount + ' times'),
          detail: 'Majority: ' + majorityJustices.slice().sort().join(', ') + '. Dissent: ' + dissenters.slice().sort().join(', ') + '.' + (isNewCoalition ? ' This is a SCOTUSgami — never seen before.' : ' This exact coalition has occurred ' + coalCount + ' time' + (coalCount === 1 ? '' : 's') + '.'),
          justices: justiceNames,
          novelty_score: isNewCoalition ? 40 : Math.max(5, 20 - coalCount)
        });
      }

      // #2: Unanimous with term-scoped throttling
      if (dissenters.length === 0 && justiceNames.length >= 9) {
        if (!unanimousPerTerm[termYear]) unanimousPerTerm[termYear] = 0;
        unanimousPerTerm[termYear]++;
        var termCount = unanimousPerTerm[termYear];
        var eventKey = 'unanimous-' + justiceNames.length;
        var isNovel = !seenScotusEvents.has(eventKey);
        if (isNovel) seenScotusEvents.add(eventKey);
        var unanScore;
        if (termCount === 1) unanScore = isNovel ? 60 : 45;
        else if (termCount <= 3) unanScore = 15;
        else unanScore = 5;
        feedItems.push({
          case_id: caseObj.id,
          case_name: caseObj.name,
          case_date: caseObj.date,
          type: 'unanimous',
          is_scotusgami: isNovel,
          headline: 'Unanimous: All ' + justiceNames.length + ' justices agree',
          detail: caseObj.name + ' decided unanimously. (#' + termCount + ' this term)',
          justices: justiceNames,
          novelty_score: unanScore
        });
      }

      // Sole dissenter
      if (dissenters.length === 1) {
        var dissenter = dissenters[0];
        var eventKey2 = 'sole-dissent-' + dissenter;
        var isNovel2 = !seenScotusEvents.has(eventKey2);
        if (isNovel2) seenScotusEvents.add(eventKey2);
        feedItems.push({
          case_id: caseObj.id,
          case_name: caseObj.name,
          case_date: caseObj.date,
          type: 'sole_dissenter',
          is_scotusgami: isNovel2,
          headline: dissenter + ' stands alone in dissent',
          detail: dissenter + ' was the sole dissenter in ' + caseObj.name + '.',
          justices: [dissenter],
          novelty_score: isNovel2 ? 70 : 35
        });
      }

      // Sole dissenter pair
      if (dissenters.length === 2) {
        var cross = isCrossWing(dissenters[0], dissenters[1]);
        var eventKey3 = 'sole-pair-' + pairKey(dissenters[0], dissenters[1]);
        var isNovel3 = !seenScotusEvents.has(eventKey3);
        if (isNovel3) seenScotusEvents.add(eventKey3);
        var score3 = cross ? 85 : 55;
        feedItems.push({
          case_id: caseObj.id,
          case_name: caseObj.name,
          case_date: caseObj.date,
          type: 'sole_dissenter_pair',
          is_scotusgami: isNovel3 || cross,
          headline: dissenters[0] + ' and ' + dissenters[1] + ' dissent together' + (cross ? ' (cross-wing!)' : ''),
          detail: 'Only two dissenters in ' + caseObj.name + '.' + (cross ? ' Notable cross-ideological pairing.' : ''),
          justices: dissenters,
          novelty_score: isNovel3 ? score3 : score3 - 20
        });
      }

      // Unusual coalition: 3+ dissenters spanning both wings
      if (dissenters.length >= 3) {
        var hasConservative = false, hasLiberal = false;
        dissenters.forEach(function(d) {
          if (getWing(d) === 'conservative') hasConservative = true;
          if (getWing(d) === 'liberal') hasLiberal = true;
        });
        if (hasConservative && hasLiberal) {
          var coalKey = dissenters.slice().sort().join(',');
          var eventKey4 = 'unusual-coalition-' + coalKey;
          var isNovel4 = !seenScotusEvents.has(eventKey4);
          if (isNovel4) seenScotusEvents.add(eventKey4);
          feedItems.push({
            case_id: caseObj.id,
            case_name: caseObj.name,
            case_date: caseObj.date,
            type: 'unusual_coalition',
            is_scotusgami: isNovel4,
            headline: 'Unusual coalition: ' + dissenters.length + ' cross-wing dissenters',
            detail: dissenters.join(', ') + ' dissented together in ' + caseObj.name + '.',
            justices: dissenters,
            novelty_score: isNovel4 ? 80 : 40
          });
        }
      }

      // #6: Bloc defection detection
      var majBlocWing = getBlocWing(caseVotes);
      if (majBlocWing && dissenters.length >= 1 && dissenters.length <= 4) {
        // Check for justices on majority side who are from the minority bloc
        var defectors = [];
        majorityJustices.forEach(function(j) {
          var w = getWing(j);
          if (w !== 'unknown' && w !== majBlocWing) {
            defectors.push(j);
          }
        });
        // Also check dissenters from majority bloc
        dissenters.forEach(function(j) {
          var w = getWing(j);
          if (w !== 'unknown' && w === majBlocWing) {
            defectors.push(j);
          }
        });
        defectors.forEach(function(defector) {
          var defectorVote = caseVotes[defector];
          var defWing = getWing(defector);
          var crossedTo = (defectorVote === 'dissent') ? 'dissent' : 'majority';
          var eventKeyD = 'defection-' + defector + '-' + caseObj.id;
          var isNovelD = !seenScotusEvents.has(eventKeyD);
          seenScotusEvents.add(eventKeyD);
          // Only fire for close splits (5-4, 6-3, 5-3)
          if (dissenters.length >= 2) {
            feedItems.push({
              case_id: caseObj.id,
              case_name: caseObj.name,
              case_date: caseObj.date,
              type: 'bloc_defection',
              is_scotusgami: false,
              headline: defector + ' crosses to join ' + crossedTo,
              detail: defWing.charAt(0).toUpperCase() + defWing.slice(1) + ' ' + defector + ' voted with the ' + crossedTo + ' in a ' + majorityJustices.length + '-' + dissenters.length + ' decision.',
              justices: [defector],
              novelty_score: dissenters.length >= 3 ? 55 : 65
            });
          }
        });
      }

      // Pairwise analysis
      for (var ii = 0; ii < justiceNames.length; ii++) {
        for (var jj = ii + 1; jj < justiceNames.length; jj++) {
          var a = justiceNames[ii], b = justiceNames[jj];
          var pk = pairKey(a, b);
          var voteA = caseVotes[a], voteB = caseVotes[b];
          var sameSide = isSameSide(voteA, voteB); // #3: fixed

          if (!pairTotal[pk]) {
            pairTotal[pk] = 0;
            pairAgreed[pk] = 0;
            pairAgreeStreak[pk] = 0;
            pairDisagreeStreak[pk] = 0;
            pairPeakAgreeStreak[pk] = 0;
            pairPeakDisagreeStreak[pk] = 0;
          }

          pairTotal[pk]++;
          if (sameSide) {
            pairAgreed[pk]++;
          }

          // #8: First agreement for ALL pairs
          if (sameSide && !pairFirstAgreement[pk]) {
            pairFirstAgreement[pk] = true;
            var crossW = isCrossWing(a, b);
            seenScotusEvents.add('first-agree-' + pk);
            var faScore = crossW ? 75 : 30; // lower score for expected same-wing agreement
            if (crossW || (getWing(a) !== 'unknown' && getWing(b) !== 'unknown')) {
              feedItems.push({
                case_id: caseObj.id,
                case_name: caseObj.name,
                case_date: caseObj.date,
                type: 'first_agreement',
                is_scotusgami: crossW,
                headline: 'First agreement: ' + a + ' and ' + b + (crossW ? ' (cross-wing)' : ''),
                detail: (crossW ? 'Cross-wing pair ' : '') + a + ' and ' + b + ' agree for the first time in ' + caseObj.name + '.',
                justices: [a, b],
                novelty_score: faScore
              });
            }
          }

          // #8: First disagreement for ALL pairs
          if (!sameSide && !pairFirstDisagreement[pk]) {
            pairFirstDisagreement[pk] = true;
            var sameWing = !isCrossWing(a, b) && getWing(a) !== 'unknown' && getWing(b) !== 'unknown';
            seenScotusEvents.add('first-disagree-' + pk);
            var fdScore = sameWing ? 70 : 25; // lower score for expected cross-wing disagreement
            if (sameWing || (getWing(a) !== 'unknown' && getWing(b) !== 'unknown')) {
              feedItems.push({
                case_id: caseObj.id,
                case_name: caseObj.name,
                case_date: caseObj.date,
                type: 'first_disagreement',
                is_scotusgami: sameWing,
                headline: 'First split: ' + a + ' and ' + b + (sameWing ? ' (same-wing)' : ''),
                detail: (sameWing ? 'Same-wing pair ' : '') + a + ' and ' + b + ' disagree for the first time in ' + caseObj.name + '.',
                justices: [a, b],
                novelty_score: fdScore
              });
            }
          }

          // Streaks + #5 streak-breaking
          if (sameSide) {
            var prevDisStreak = pairDisagreeStreak[pk];
            // #5: Check if a notable disagreement streak just ended
            if (prevDisStreak >= 3) {
              var peakDis = pairPeakDisagreeStreak[pk];
              feedItems.push({
                case_id: caseObj.id,
                case_name: caseObj.name,
                case_date: caseObj.date,
                type: 'streak_broken',
                is_scotusgami: false,
                headline: a + ' and ' + b + ' end ' + prevDisStreak + '-case disagreement streak',
                detail: 'After disagreeing ' + prevDisStreak + ' times in a row, the pair agrees in ' + caseObj.name + '.',
                justices: [a, b],
                novelty_score: Math.min(75, 30 + prevDisStreak * 5)
              });
            }

            pairAgreeStreak[pk]++;
            pairDisagreeStreak[pk] = 0;
            if (pairAgreeStreak[pk] > pairPeakAgreeStreak[pk]) pairPeakAgreeStreak[pk] = pairAgreeStreak[pk];
            var streak = pairAgreeStreak[pk];

            // #4: Lower threshold for cross-wing agree streaks to 5
            var crossPair = isCrossWing(a, b);
            var agreeThresholds = crossPair ? [5, 10, 15, 20, 25, 30] : [10, 15, 20, 25, 30];
            if (agreeThresholds.indexOf(streak) >= 0) {
              var eventKey7 = 'agree-streak-' + pk + '-' + streak;
              var isNovel7 = !seenScotusEvents.has(eventKey7);
              seenScotusEvents.add(eventKey7);
              feedItems.push({
                case_id: caseObj.id,
                case_name: caseObj.name,
                case_date: caseObj.date,
                type: 'agreement_streak',
                is_scotusgami: isNovel7,
                headline: a + ' and ' + b + ': ' + streak + ' agreements in a row' + (crossPair ? ' (cross-wing)' : ''),
                detail: 'The pair has now agreed in ' + streak + ' consecutive cases.',
                justices: [a, b],
                novelty_score: Math.min(95, 40 + streak * 3)
              });
            }
          } else {
            var prevAgStreak = pairAgreeStreak[pk];
            // #5: Check if a notable agreement streak just ended
            if (prevAgStreak >= 5) {
              feedItems.push({
                case_id: caseObj.id,
                case_name: caseObj.name,
                case_date: caseObj.date,
                type: 'streak_broken',
                is_scotusgami: false,
                headline: a + ' and ' + b + ' end ' + prevAgStreak + '-case agreement streak',
                detail: 'After agreeing ' + prevAgStreak + ' times in a row, the pair splits in ' + caseObj.name + '.',
                justices: [a, b],
                novelty_score: Math.min(75, 30 + prevAgStreak * 3)
              });
            }

            pairDisagreeStreak[pk]++;
            pairAgreeStreak[pk] = 0;
            if (pairDisagreeStreak[pk] > pairPeakDisagreeStreak[pk]) pairPeakDisagreeStreak[pk] = pairDisagreeStreak[pk];
            var dStreak = pairDisagreeStreak[pk];
            if (dStreak === 3 || dStreak === 5 || dStreak === 8 || dStreak === 10) {
              var eventKey8 = 'disagree-streak-' + pk + '-' + dStreak;
              var isNovel8 = !seenScotusEvents.has(eventKey8);
              seenScotusEvents.add(eventKey8);
              feedItems.push({
                case_id: caseObj.id,
                case_name: caseObj.name,
                case_date: caseObj.date,
                type: 'disagreement_streak',
                is_scotusgami: isNovel8,
                headline: a + ' and ' + b + ': ' + dStreak + ' disagreements in a row',
                detail: 'The pair has now disagreed in ' + dStreak + ' consecutive cases.',
                justices: [a, b],
                novelty_score: Math.min(90, 35 + dStreak * 5)
              });
            }
          }

          // #7: Enhanced rate milestones + reversals
          if (pairTotal[pk] >= 10) {
            var currentRate = (pairAgreed[pk] / pairTotal[pk]) * 100;
            var prevRate = ((pairAgreed[pk] - (sameSide ? 1 : 0)) / (pairTotal[pk] - 1)) * 100;

            // Milestone crossings: 90%, 75%, 60% up, sub-50% down
            var milestones = [
              { threshold: 90, direction: 'up', label: 'cross 90% agreement', score: 75 },
              { threshold: 75, direction: 'up', label: 'cross 75% agreement', score: 55 },
              { threshold: 60, direction: 'down', label: 'drop below 60% agreement', score: 60 },
              { threshold: 50, direction: 'down', label: 'drop below 50% agreement', score: 70 }
            ];

            milestones.forEach(function(m) {
              var crossed = false;
              if (m.direction === 'up') {
                crossed = currentRate >= m.threshold && prevRate < m.threshold;
              } else {
                crossed = currentRate < m.threshold && prevRate >= m.threshold;
              }
              if (crossed) {
                var eventKeyM = 'milestone-' + m.threshold + '-' + m.direction + '-' + pk;
                var isNovelM = !seenScotusEvents.has(eventKeyM);
                seenScotusEvents.add(eventKeyM);
                feedItems.push({
                  case_id: caseObj.id,
                  case_name: caseObj.name,
                  case_date: caseObj.date,
                  type: 'milestone_rate',
                  is_scotusgami: isNovelM,
                  headline: a + ' and ' + b + ' ' + m.label,
                  detail: 'Now at ' + currentRate.toFixed(1) + '% over ' + pairTotal[pk] + ' cases.',
                  justices: [a, b],
                  novelty_score: isNovelM ? m.score : m.score - 25
                });
              }
            });

            // Rate direction reversal detection (after 20+ cases for stability)
            if (pairTotal[pk] >= 20) {
              var newDirection = currentRate > prevRate ? 'rising' : (currentRate < prevRate ? 'falling' : null);
              var oldDirection = pairRateDirection[pk] || null;
              if (oldDirection && newDirection && oldDirection !== newDirection) {
                // Only fire if the rate has moved meaningfully (at least 3 points swing)
                var rateAtDirectionStart = pairPrevRate[pk] || prevRate;
                var swing = Math.abs(currentRate - rateAtDirectionStart);
                if (swing >= 3) {
                  var revKey = 'reversal-' + pk + '-' + pairTotal[pk];
                  if (!seenScotusEvents.has(revKey)) {
                    seenScotusEvents.add(revKey);
                    feedItems.push({
                      case_id: caseObj.id,
                      case_name: caseObj.name,
                      case_date: caseObj.date,
                      type: 'rate_reversal',
                      is_scotusgami: false,
                      headline: a + ' and ' + b + ' agreement rate reverses (' + (newDirection === 'rising' ? 'now rising' : 'now falling') + ')',
                      detail: 'Rate shifted from ' + rateAtDirectionStart.toFixed(1) + '% to ' + currentRate.toFixed(1) + '% over ' + pairTotal[pk] + ' cases.',
                      justices: [a, b],
                      novelty_score: Math.min(65, 35 + Math.floor(swing))
                    });
                  }
                }
              }
              if (newDirection && newDirection !== oldDirection) {
                pairPrevRate[pk] = prevRate;
              }
              pairRateDirection[pk] = newDirection;
            }
          }
        }
      }
    });

    // Sort reverse chronological
    feedItems.sort(function(a, b) {
      var da = parseDate(a.case_date), db = parseDate(b.case_date);
      if (da > db) return -1;
      if (da < db) return 1;
      return b.novelty_score - a.novelty_score;
    });

    return feedItems;
  }

  // Make feed computation available globally
  window.computeScotusgamiFeed = computeScotusgamiFeed;

  // ============================================
  // RENDER FEED
  // ============================================
  var allFeedItems = computeScotusgamiFeed();

  // Build feed-items-by-case lookup for cross-tab use
  var feedItemsByCase = {};
  allFeedItems.forEach(function(item) {
    if (!feedItemsByCase[item.case_id]) feedItemsByCase[item.case_id] = [];
    feedItemsByCase[item.case_id].push(item);
  });
  window.feedItemsByCase = feedItemsByCase;

  // Build coalition indexes for Coalitions tab
  var coalitionIndex = {};    // full sig -> [case objects]
  var majorityGroupIndex = {}; // sorted maj names -> [case objects]
  var dissentGroupIndex = {};  // sorted dis names -> [case objects]
  var caseLookup = {};
  DATA.cases.forEach(function(c) { caseLookup[c.id] = c; });

  Object.keys(voteDetailByCase).forEach(function(caseId) {
    var cv = voteDetailByCase[caseId];
    var maj = [], dis = [];
    Object.keys(cv).sort().forEach(function(j) {
      if (cv[j] === 'dissent') dis.push(j);
      else maj.push(j);
    });
    if (dis.length === 0) return; // skip unanimous

    var sig = maj.join(',') + '|' + dis.join(',');
    var majKey = maj.join(',');
    var disKey = dis.join(',');
    var caseObj = caseLookup[caseId];
    if (!caseObj) return;

    if (!coalitionIndex[sig]) coalitionIndex[sig] = [];
    coalitionIndex[sig].push(caseObj);
    if (!majorityGroupIndex[majKey]) majorityGroupIndex[majKey] = [];
    majorityGroupIndex[majKey].push(caseObj);
    if (!dissentGroupIndex[disKey]) dissentGroupIndex[disKey] = [];
    dissentGroupIndex[disKey].push(caseObj);
  });

  window.coalitionIndex = coalitionIndex;
  window.majorityGroupIndex = majorityGroupIndex;
  window.dissentGroupIndex = dissentGroupIndex;
  window.dispatchEvent(new Event('scotusgami-indexes-ready'));

  var feedContainer = document.getElementById('tab-feed');
  if (!feedContainer) return;

  var layout = document.createElement('div');
  layout.className = 'feed-layout';

  // Title
  var title = document.createElement('div');
  title.className = 'panel-title';
  title.textContent = 'SCOTUSgami Feed';
  layout.appendChild(title);

  // Search input for Feed tab
  var feedSearchInput = document.createElement('input');
  feedSearchInput.type = 'text';
  feedSearchInput.id = 'feed-search';
  feedSearchInput.className = 'tab-search';
  feedSearchInput.placeholder = 'Search by case, justice, or event...';
  feedSearchInput.addEventListener('input', function() {
    renderFeedList();
  });
  layout.appendChild(feedSearchInput);

  // Controls
  var controls = document.createElement('div');
  controls.className = 'feed-controls';

  // SCOTUSgami-only toggle
  var scotusgamiOnly = false;
  var scotusgamiBtn = document.createElement('button');
  scotusgamiBtn.className = 'feed-filter-btn feed-filter-scotusgami';
  scotusgamiBtn.textContent = 'SCOTUSgami Only';
  scotusgamiBtn.addEventListener('click', function() {
    scotusgamiOnly = !scotusgamiOnly;
    scotusgamiBtn.classList.toggle('active', scotusgamiOnly);
    renderFeedList();
  });
  controls.appendChild(scotusgamiBtn);

  // Type filter buttons
  var typeLabel = document.createElement('label');
  typeLabel.textContent = 'Types:';
  controls.appendChild(typeLabel);

  var allTypes = [
    { key: 'vote_split', label: 'New Coalition' },
    { key: 'coalition_count', label: 'Coalition Count' },
    { key: 'unanimous', label: 'Unanimous' },
    { key: 'sole_dissenter', label: 'Sole Dissent' },
    { key: 'sole_dissenter_pair', label: 'Dissent Pair' },
    { key: 'unusual_coalition', label: 'Unusual Coalition' },
    { key: 'bloc_defection', label: 'Defection' },
    { key: 'first_agreement', label: 'First Agree' },
    { key: 'first_disagreement', label: 'First Split' },
    { key: 'agreement_streak', label: 'Agree Streak' },
    { key: 'disagreement_streak', label: 'Disagree Streak' },
    { key: 'streak_broken', label: 'Streak Broken' },
    { key: 'milestone_rate', label: 'Milestone' },
    { key: 'rate_reversal', label: 'Rate Reversal' }
  ];

  var hiddenByDefault = new Set(['agreement_streak', 'disagreement_streak']);
  var activeTypes = new Set(allTypes.filter(function(t) { return !hiddenByDefault.has(t.key); }).map(function(t) { return t.key; }));
  var typeButtons = [];

  allTypes.forEach(function(t) {
    var btn = document.createElement('button');
    btn.className = 'feed-filter-btn' + (hiddenByDefault.has(t.key) ? '' : ' active');
    btn.textContent = t.label;
    btn.dataset.type = t.key;
    btn.addEventListener('click', function() {
      if (activeTypes.has(t.key)) {
        activeTypes.delete(t.key);
        btn.classList.remove('active');
      } else {
        activeTypes.add(t.key);
        btn.classList.add('active');
      }
      renderFeedList();
    });
    typeButtons.push(btn);
    controls.appendChild(btn);
  });

  // Novelty slider
  var noveltyGroup = document.createElement('div');
  noveltyGroup.className = 'feed-novelty-group';

  var noveltyLabel = document.createElement('label');
  noveltyLabel.textContent = 'Min novelty:';
  noveltyGroup.appendChild(noveltyLabel);

  var noveltySlider = document.createElement('input');
  noveltySlider.type = 'range';
  noveltySlider.min = '0';
  noveltySlider.max = '100';
  noveltySlider.value = '0';
  noveltyGroup.appendChild(noveltySlider);

  var noveltyValue = document.createElement('span');
  noveltyValue.className = 'feed-novelty-label';
  noveltyValue.textContent = '0';
  noveltyGroup.appendChild(noveltyValue);

  noveltySlider.addEventListener('input', function() {
    noveltyValue.textContent = noveltySlider.value;
    renderFeedList();
  });

  controls.appendChild(noveltyGroup);
  layout.appendChild(controls);

  // Feed list container
  var feedList = document.createElement('div');
  feedList.className = 'feed-list';
  layout.appendChild(feedList);

  feedContainer.appendChild(layout);

  function getAccentClass(items) {
    var types = items.map(function(it) { return it.type; });
    if (types.indexOf('vote_split') >= 0 || types.indexOf('unusual_coalition') >= 0 || types.indexOf('coalition_count') >= 0) return 'accent-scotusgami';
    if (types.indexOf('agreement_streak') >= 0 || types.indexOf('first_agreement') >= 0 || types.indexOf('milestone_rate') >= 0) return 'accent-agreement';
    if (types.indexOf('disagreement_streak') >= 0 || types.indexOf('sole_dissenter') >= 0 || types.indexOf('sole_dissenter_pair') >= 0 || types.indexOf('first_disagreement') >= 0) return 'accent-disagreement';
    if (types.indexOf('bloc_defection') >= 0 || types.indexOf('streak_broken') >= 0 || types.indexOf('rate_reversal') >= 0) return 'accent-scotusgami';
    if (types.indexOf('unanimous') >= 0) return 'accent-routine';
    return 'accent-routine';
  }

  function renderFeedList() {
    while (feedList.firstChild) feedList.removeChild(feedList.firstChild);

    var minNovelty = parseInt(noveltySlider.value);
    var searchTerm = feedSearchInput.value.trim().toLowerCase();
    var filtered = allFeedItems.filter(function(item) {
      if (!activeTypes.has(item.type)) return false;
      if (item.novelty_score < minNovelty) return false;
      if (searchTerm) {
        var matchCase = item.case_name.toLowerCase().indexOf(searchTerm) !== -1;
        var matchHeadline = item.headline && item.headline.toLowerCase().indexOf(searchTerm) !== -1;
        var matchDetail = item.detail && item.detail.toLowerCase().indexOf(searchTerm) !== -1;
        var matchJustice = item.justices && item.justices.some(function(j) { return j.toLowerCase().indexOf(searchTerm) !== -1; });
        if (!matchCase && !matchHeadline && !matchDetail && !matchJustice) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No feed items match current filters';
      feedList.appendChild(empty);
      return;
    }

    // Group by case_id, preserving reverse-chronological order
    var caseOrder = [];
    var caseGroups = {};
    filtered.forEach(function(item) {
      if (!caseGroups[item.case_id]) {
        caseGroups[item.case_id] = [];
        caseOrder.push(item.case_id);
      }
      caseGroups[item.case_id].push(item);
    });

    // Filter to SCOTUSgami-only cases if toggled
    if (scotusgamiOnly) {
      caseOrder = caseOrder.filter(function(caseId) {
        return caseGroups[caseId].some(function(it) { return it.is_scotusgami; });
      });
    }

    caseOrder.forEach(function(caseId) {
      var items = caseGroups[caseId];
      var first = items[0];
      var hasScotus = items.some(function(it) { return it.is_scotusgami; });

      var card = document.createElement('div');
      card.className = 'feed-card';
      if (hasScotus) {
        card.classList.add('scotusgami');
      } else {
        // Determine accent color from dominant event type
        var accentClass = getAccentClass(items);
        if (accentClass) card.classList.add(accentClass);
      }

      // Case name + max novelty score
      var maxScore = Math.max.apply(null, items.map(function(it) { return it.novelty_score; }));
      var caseTitle = document.createElement('div');
      caseTitle.className = 'feed-card-headline';
      var caseName = document.createElement('span');
      caseName.textContent = first.case_name;
      caseTitle.appendChild(caseName);
      var scoreSpan = document.createElement('span');
      scoreSpan.className = 'feed-card-score';
      scoreSpan.textContent = ' (Novelty: ' + maxScore + ')';
      scoreSpan.title = 'Novelty score 0\u2013100. Higher = rarer event.';
      caseTitle.appendChild(scoreSpan);
      card.appendChild(caseTitle);

      // Date as subtitle
      var dateSub = document.createElement('div');
      dateSub.className = 'feed-card-meta';
      dateSub.textContent = first.case_date;
      card.appendChild(dateSub);

      // Case vote summary block (shared builder)
      var voteSummary = buildVoteSummary(caseId, items);
      if (voteSummary) {
        var summaryDiv = document.createElement('div');
        summaryDiv.className = 'feed-case-summary';
        summaryDiv.appendChild(voteSummary.textNode);
        card.appendChild(summaryDiv);
        if (voteSummary.table) card.appendChild(voteSummary.table);
      }

      // List all events for this case
      var eventList = document.createElement('ul');
      eventList.className = 'feed-event-list';
      items.forEach(function(item) {
        var li = document.createElement('li');
        li.className = 'feed-event-item';

        var tag = document.createElement('span');
        tag.className = 'feed-event-tag';
        if (item.is_scotusgami) tag.classList.add('scotusgami-tag');
        tag.textContent = item.type.replace(/_/g, ' ');
        li.appendChild(tag);

        var text = document.createElement('span');
        text.className = 'feed-event-text';
        text.textContent = item.headline;
        li.appendChild(text);

        eventList.appendChild(li);
      });
      card.appendChild(eventList);

      // Collect all unique pairs mentioned across events and show agreement rates
      var mentionedPairs = {};
      items.forEach(function(item) {
        if (item.justices && item.justices.length === 2) {
          var pk = pairKey(item.justices[0], item.justices[1]);
          if (!mentionedPairs[pk]) mentionedPairs[pk] = pk.split('-');
        }
      });
      var pairKeys = Object.keys(mentionedPairs);
      if (pairKeys.length > 0) {
        var pairStats = document.createElement('div');
        pairStats.className = 'feed-pair-stats';
        pairKeys.forEach(function(pk) {
          var names = mentionedPairs[pk];
          var key1 = names[0] + '-' + names[1];
          var key2 = names[1] + '-' + names[0];
          var agData = DATA.agreements[key1] || DATA.agreements[key2];
          if (agData) {
            var stat = document.createElement('span');
            stat.className = 'feed-pair-rate';
            stat.textContent = names[0] + ' + ' + names[1] + ': ' + agData.rate + '%';
            pairStats.appendChild(stat);
          }
        });
        if (pairStats.childNodes.length > 0) card.appendChild(pairStats);
      }

      // Collect all unique justices across events
      var allJustices = new Set();
      items.forEach(function(item) {
        if (item.justices) item.justices.forEach(function(j) { allJustices.add(j); });
      });
      if (allJustices.size > 0) {
        var badges = document.createElement('div');
        badges.className = 'feed-card-badges';
        var sortedJustices = Array.from(allJustices).sort();
        sortedJustices.forEach(function(j) {
          var badge = document.createElement('span');
          badge.className = 'feed-badge';
          badge.textContent = j;
          badges.appendChild(badge);
        });
        card.appendChild(badges);
      }

      feedList.appendChild(card);
    });
  }

  renderFeedList();

  // ============================================
  // VIZ PANEL FEED (condensed inline feed)
  // ============================================
  function renderVizFeed() {
    var vizContainer = document.getElementById('feed-viz');
    if (!vizContainer) return;

    while (vizContainer.firstChild) vizContainer.removeChild(vizContainer.firstChild);

    // Determine which cases are in the current term filter
    var filteredCaseIds = null;
    if (window.getFilteredCases) {
      var filteredCases = window.getFilteredCases();
      filteredCaseIds = new Set(filteredCases.map(function(c) { return c.id; }));
    }

    var vizItems = allFeedItems.filter(function(item) {
      if (filteredCaseIds && !filteredCaseIds.has(item.case_id)) return false;
      return true;
    });

    if (vizItems.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No feed events for selected term range';
      vizContainer.appendChild(empty);
      return;
    }

    // Group by case_id
    var caseOrder = [];
    var caseGroups = {};
    vizItems.forEach(function(item) {
      if (!caseGroups[item.case_id]) {
        caseGroups[item.case_id] = [];
        caseOrder.push(item.case_id);
      }
      caseGroups[item.case_id].push(item);
    });

    caseOrder.forEach(function(caseId) {
      var items = caseGroups[caseId];
      var first = items[0];
      var hasScotus = items.some(function(it) { return it.is_scotusgami; });

      var card = document.createElement('div');
      card.className = 'feed-viz-card';
      if (hasScotus) {
        card.classList.add('scotusgami');
      } else {
        var vizAccent = getAccentClass(items);
        if (vizAccent) card.classList.add(vizAccent);
      }

      // Case name as clickable link to Data tab
      var caseLink = document.createElement('a');
      caseLink.className = 'feed-viz-card-headline';
      caseLink.href = '#';
      caseLink.textContent = first.case_name;
      caseLink.addEventListener('click', function(ev) {
        ev.preventDefault();
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
      card.appendChild(caseLink);

      // Date
      var dateSub = document.createElement('div');
      dateSub.className = 'feed-viz-card-meta';
      dateSub.textContent = first.case_date;
      card.appendChild(dateSub);

      // Vote summary + table only (detailed events are in the Feed tab)
      var vizSummary = buildVoteSummary(caseId, items);
      if (vizSummary) {
        var vizSummaryDiv = document.createElement('div');
        vizSummaryDiv.className = 'feed-case-summary';
        vizSummaryDiv.appendChild(vizSummary.textNode);
        card.appendChild(vizSummaryDiv);
        if (vizSummary.table) card.appendChild(vizSummary.table);
      }

      vizContainer.appendChild(card);
    });
  }

  // Initial render of viz feed
  renderVizFeed();

  // Re-render viz feed when term filter changes
  window.addEventListener('scotusgami-filter-change', function() {
    renderVizFeed();
  });
});
