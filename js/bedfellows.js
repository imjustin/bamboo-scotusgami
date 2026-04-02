// ============================================
// UNUSUAL BEDFELLOWS PANEL
// ============================================
(function() {
  'use strict';

  var THRESHOLD = 60; // agreement rate below this = "bedfellow" event
  var MAX_ITEMS = 20;

  window.addEventListener('scotusgami-data-ready', function() {
    init();
    window.addEventListener('scotusgami-filter-change', render);
  });

  // Agreement rate lookup: "A-B" -> { rate, cases }
  var agreementLookup = {};
  // Votes by case: case_id -> { justice: vote }
  var votesByCase = {};

  function init() {
    // Build agreement lookup
    var ag = window.DATA.agreements;
    Object.keys(ag).forEach(function(key) {
      agreementLookup[key] = ag[key];
    });

    // Build votes-by-case index
    window.DATA.votes.forEach(function(v) {
      if (!votesByCase[v.case_id]) votesByCase[v.case_id] = {};
      votesByCase[v.case_id][v.justice] = v.vote;
    });

    render();
  }

  function getAgreementRate(a, b) {
    var key1 = a + '-' + b;
    var key2 = b + '-' + a;
    var d = agreementLookup[key1] || agreementLookup[key2];
    return d ? d.rate : null;
  }

  function isDissent(vote) {
    return vote && vote.toLowerCase().indexOf('dissent') !== -1;
  }

  function sameSide(voteA, voteB) {
    return isDissent(voteA) === isDissent(voteB);
  }

  function render() {
    var container = document.getElementById('bedfellows-list');
    if (!container) return;

    // Clear
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    var filteredCases = window.getFilteredCases();
    var bedfellows = [];

    filteredCases.forEach(function(c) {
      var caseVotes = votesByCase[c.id];
      if (!caseVotes) return;

      var justiceNames = Object.keys(caseVotes);

      for (var i = 0; i < justiceNames.length; i++) {
        for (var j = i + 1; j < justiceNames.length; j++) {
          var a = justiceNames[i];
          var b = justiceNames[j];
          var voteA = caseVotes[a];
          var voteB = caseVotes[b];

          if (!sameSide(voteA, voteB)) continue;

          var rate = getAgreementRate(a, b);
          if (rate === null || rate >= THRESHOLD) continue;

          bedfellows.push({
            caseId: c.id,
            caseName: c.name,
            justiceA: a,
            justiceB: b,
            agreementRate: rate,
            surpriseScore: 100 - rate
          });
        }
      }
    });

    // Sort by surprise score descending, take top N
    bedfellows.sort(function(a, b) { return b.surpriseScore - a.surpriseScore; });
    bedfellows = bedfellows.slice(0, MAX_ITEMS);

    if (bedfellows.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'pair-detail-placeholder';
      empty.textContent = 'No unusual bedfellows in this term range';
      container.appendChild(empty);
      return;
    }

    bedfellows.forEach(function(bf) {
      var item = document.createElement('div');
      item.className = 'bedfellow-item';

      // Rarity indicator
      var rarity = document.createElement('span');
      rarity.className = 'bedfellow-rarity';
      if (bf.agreementRate < 30) {
        rarity.style.background = '#da3633';
        rarity.textContent = 'Rare';
      } else if (bf.agreementRate < 45) {
        rarity.style.background = '#d29922';
        rarity.textContent = 'Unusual';
      } else {
        rarity.style.background = '#388bfd';
        rarity.textContent = 'Notable';
      }

      // Content area
      var content = document.createElement('div');
      content.className = 'bedfellow-content';

      // Case name link
      var caseLink = document.createElement('a');
      caseLink.className = 'bedfellow-case-link';
      caseLink.textContent = bf.caseName;
      caseLink.href = '#';
      caseLink.addEventListener('click', (function(caseId) {
        return function(e) {
          e.preventDefault();
          window.switchToTab('data', function() {
            var event = new CustomEvent('scotusgami-select-case', { detail: { caseId: caseId } });
            window.dispatchEvent(event);
          });
        };
      })(bf.caseId));

      // Justice pair + rate
      var pairInfo = document.createElement('div');
      pairInfo.className = 'bedfellow-pair-info';
      pairInfo.textContent = bf.justiceA + ' + ' + bf.justiceB + '  \u2014  ' + bf.agreementRate.toFixed(1) + '% lifetime agreement';

      content.appendChild(caseLink);
      content.appendChild(pairInfo);

      // Surprise score
      var score = document.createElement('span');
      score.className = 'bedfellow-score';
      score.textContent = Math.round(bf.surpriseScore);

      item.appendChild(rarity);
      item.appendChild(content);
      item.appendChild(score);
      container.appendChild(item);
    });
  }
})();
