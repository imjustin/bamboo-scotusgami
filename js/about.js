// ============================================
// ABOUT TAB — Comprehensive Reference
// ============================================
(function() {
  var container = document.getElementById('tab-about');
  if (!container) return;

  var layout = document.createElement('div');
  layout.className = 'about-layout about-layout-expanded';

  // ---------------------
  // Helper functions
  // ---------------------
  function makeSection(title) {
    var div = document.createElement('div');
    div.className = 'about-section';

    // Collapsible header
    var header = document.createElement('div');
    header.className = 'about-section-header';
    var chevron = document.createElement('span');
    chevron.className = 'about-section-chevron';
    chevron.textContent = '\u25BC';
    header.appendChild(chevron);
    var h2 = document.createElement('h2');
    h2.textContent = title;
    header.appendChild(h2);
    div.appendChild(header);

    // Body container
    var body = document.createElement('div');
    body.className = 'about-section-body';
    div.appendChild(body);
    div._body = body;

    // Toggle collapse
    header.addEventListener('click', function() {
      var isCollapsed = body.classList.contains('collapsed');
      if (isCollapsed) {
        body.classList.remove('collapsed');
        chevron.classList.remove('collapsed');
      } else {
        body.classList.add('collapsed');
        chevron.classList.add('collapsed');
      }
    });

    return div;
  }

  function getBody(parent) {
    return parent._body || parent;
  }

  function addParagraph(parent, text) {
    var p = document.createElement('p');
    p.textContent = text;
    getBody(parent).appendChild(p);
    return p;
  }

  function addSubheading(parent, text) {
    var h3 = document.createElement('h3');
    h3.className = 'about-subheading';
    h3.textContent = text;
    getBody(parent).appendChild(h3);
    return h3;
  }

  function addList(parent, items) {
    var ul = document.createElement('ul');
    items.forEach(function(item) {
      var li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    getBody(parent).appendChild(ul);
    return ul;
  }

  function addCodeBlock(parent, text) {
    var pre = document.createElement('pre');
    pre.className = 'about-code-block';
    var code = document.createElement('code');
    code.textContent = text;
    pre.appendChild(code);
    getBody(parent).appendChild(pre);
    return pre;
  }

  function addBoldLine(parent, boldText, normalText) {
    var p = document.createElement('p');
    var strong = document.createElement('strong');
    strong.textContent = boldText;
    p.appendChild(strong);
    var span = document.createElement('span');
    span.textContent = ' ' + normalText;
    p.appendChild(span);
    getBody(parent).appendChild(p);
    return p;
  }

  // Build a table from header array and rows array-of-arrays
  function addTable(parent, headers, rows, options) {
    var wrapper = document.createElement('div');
    wrapper.className = 'about-table-wrapper';
    var table = document.createElement('table');
    table.className = 'about-table';

    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    headers.forEach(function(h) {
      var th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    rows.forEach(function(row, idx) {
      var tr = document.createElement('tr');
      if (idx % 2 === 1) tr.className = 'about-table-alt';
      row.forEach(function(cell) {
        var td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    getBody(parent).appendChild(wrapper);
    return table;
  }

  // =============================================
  // 1. What is SCOTUSgami?
  // =============================================
  var sec1 = makeSection('What is SCOTUSgami?');
  addParagraph(sec1, 'SCOTUSgami tracks how often U.S. Supreme Court justices agree with each other \u2014 case by case, term by term, across the entire Roberts Court era (2005\u2013present).');
  addParagraph(sec1, 'The name is a play on "scorigami," a concept popularized by Jon Bois for tracking genuinely novel score combinations in NFL games. In the same spirit, SCOTUSgami highlights when a pair of justices produces a voting pattern that has never occurred before \u2014 a first-time agreement between ideological opposites, a surprising streak of disagreement between allies, or an unusual coalition that defies conventional left-right expectations.');
  addParagraph(sec1, 'Unlike most SCOTUS trackers that focus on case outcomes or individual justice voting records, SCOTUSgami is built around pairwise relationships. Every cell in the heatmap represents one justice-to-justice relationship, measured across every case they both participated in. This makes it easy to spot shifting alliances, emerging blocs, and unexpected partnerships that raw vote tallies miss.');
  addParagraph(sec1, 'The dashboard covers every argued case from October Term 2005 through the current term, encompassing all 16 justices who have served on the Roberts Court.');
  layout.appendChild(sec1);

  // =============================================
  // Disclaimer
  // =============================================
  var disclaimer = document.createElement('div');
  disclaimer.className = 'about-section about-disclaimer';
  var disclaimerTitle = document.createElement('h2');
  disclaimerTitle.textContent = 'Disclaimer';
  disclaimer.appendChild(disclaimerTitle);
  var disclaimerText = document.createElement('p');
  disclaimerText.textContent = 'This data has not been manually audited and is subject to potential inaccuracies. Vote classifications are sourced from the Supreme Court Database (SCDB) and automated PDF parsing, neither of which have been individually verified against official court records. This dashboard is an exploratory visualization project and should not be relied upon for legal research, academic citation, or anything other than late night vibes.';
  disclaimer.appendChild(disclaimerText);
  layout.appendChild(disclaimer);

  // =============================================
  // 2. How to Read the Dashboard
  // =============================================
  var sec2 = makeSection('How to Read the Dashboard');

  addSubheading(sec2, 'Heatmap');
  addList(sec2, [
    'A 9\u00d79 grid of current justices, with each cell showing the pairwise agreement rate as a percentage.',
    'Color encodes agreement: red indicates low agreement (~45%), yellow is mid-range (~65%), and green is high agreement (~85%).',
    'Click any cell to select that pair and load its detail in the side panel. Multi-select is supported \u2014 click additional cells to compare pairs.',
    'The diagonal is blank because a justice cannot agree or disagree with themselves.',
    'The number in each cell is the percentage of co-participated cases where both justices voted on the same side (majority or dissent).'
  ]);

  addSubheading(sec2, 'Network Graph');
  addList(sec2, [
    'A force-directed layout where justices that agree more frequently are pulled closer together.',
    'Edge thickness corresponds to agreement strength \u2014 thicker lines mean higher agreement rates.',
    'Drag individual nodes to rearrange the layout manually.',
    'Zoom in and out with the +/\u2013 buttons in the corner, or use the scroll wheel.',
    'Pan the view by clicking and dragging the background.',
    'Natural clusters that emerge reveal ideological blocs \u2014 you will typically see conservative-leaning justices grouped on one side and liberal-leaning justices on the other, with swing justices positioned between them.'
  ]);

  addSubheading(sec2, 'Timeline');
  addList(sec2, [
    'Displays the rolling cumulative agreement percentage over time for selected justice pairs.',
    'Green dots indicate cases where the pair agreed; red dots indicate disagreement.',
    'Use the term filter dropdown to zoom into specific time ranges.',
    'When multiple pairs are selected, each is shown in a different color for comparison.'
  ]);

  addSubheading(sec2, 'Feed Tab');
  addList(sec2, [
    'A reverse-chronological feed of notable voting events detected by the scoring algorithm.',
    'SCOTUSgami events \u2014 genuinely novel coalition patterns \u2014 are highlighted with a gold accent border.',
    'Use the filter buttons to narrow by event type (e.g., first agreement, streak, sole dissenter).',
    'The novelty score slider lets you set a minimum threshold to hide routine events and focus on the most surprising ones.'
  ]);
  layout.appendChild(sec2);

  // =============================================
  // 3. Scoring Rubric
  // =============================================
  var sec3 = makeSection('Scoring Rubric');
  addParagraph(sec3, 'Each voting event is assigned a novelty score from 0 to 100. Events scoring 80 or above are flagged as SCOTUSgami \u2014 headline-worthy moments. The full rubric:');

  addTable(sec3,
    ['Event', 'Base Score', 'Boosted When'],
    [
      ['First agreement (cross-wing)', '75', '+5 per prior disagreement (cap 100)'],
      ['First agreement (same-wing)', '30', '\u2014'],
      ['First disagreement (same-wing)', '70', '+3 per prior agreement (cap 100)'],
      ['First disagreement (cross-wing)', '25', '\u2014'],
      ['Sole dissenter pair (cross-wing)', '85', 'Always SCOTUSgami'],
      ['Sole dissenter pair (same-wing)', '50', '\u2014'],
      ['Sole dissenter', '45\u201365', 'Higher if against own wing'],
      ['Unusual coalition (3+ cross-wing dissent)', '80\u201390', 'Scales with group size'],
      ['Agreement streak (10/15/20+)', '60\u201395', '+20 if cross-wing'],
      ['Disagreement streak (3/5/8+)', '60\u201395', '+20 if same-wing'],
      ['Rate milestone (90%+ or <50%)', '35\u201380', 'Higher if defies ideology'],
      ['Unanimous (9-0)', '15\u201325', 'Low \u2014 common']
    ]
  );

  addSubheading(sec3, 'Score Tiers');
  var tierTable = addTable(sec3,
    ['Range', 'Tier', 'Meaning'],
    [
      ['80\u2013100', 'Headline SCOTUSgami', 'A genuinely novel or rare coalition pattern'],
      ['50\u201379', 'Notable', 'Worth paying attention to'],
      ['25\u201349', 'Interesting', 'Mildly unusual but not shocking'],
      ['Below 25', 'Routine', 'Expected voting behavior']
    ]
  );
  // Apply tier color classes to rows
  var tierRows = tierTable.querySelectorAll('tbody tr');
  if (tierRows[0]) tierRows[0].className = 'score-tier-headline';
  if (tierRows[1]) tierRows[1].className = 'score-tier-notable';
  if (tierRows[2]) tierRows[2].className = 'score-tier-interesting';
  if (tierRows[3]) tierRows[3].className = 'score-tier-routine';

  addSubheading(sec3, 'Ideological Groupings');
  addBoldLine(sec3, 'Conservative-leaning:', 'Roberts, Thomas, Alito, Gorsuch, Kavanaugh, Barrett');
  addBoldLine(sec3, 'Liberal-leaning:', 'Sotomayor, Kagan, Jackson');
  addParagraph(sec3, 'These groupings are used solely for scoring purposes \u2014 to determine whether an agreement or disagreement crosses ideological lines, which makes it more or less surprising.');
  layout.appendChild(sec3);

  // =============================================
  // 4. Agreement Definition
  // =============================================
  var sec4 = makeSection('Agreement Definition');
  addBoldLine(sec4, 'Same Side (primary metric):', 'Both justices voted majority-side (majority opinion or any form of concurrence) OR both voted dissent-side.');
  addParagraph(sec4, 'Concurrences are lumped with the majority. A justice who concurs in the judgment only is counted as agreeing with a justice who joined the full majority opinion. This is the metric displayed throughout the dashboard.');
  addParagraph(sec4, 'A stricter "Agreed" metric \u2014 requiring an exact vote-type match (e.g., both must be majority joiners, not one majority and one concurrence) \u2014 is computed and stored in the database but is not currently displayed in the dashboard.');
  addParagraph(sec4, 'Because of the concurrence-lumping approach, agreement rates may be slightly inflated for pairs where one justice frequently concurs in judgment only rather than joining the majority opinion outright.');
  layout.appendChild(sec4);

  // =============================================
  // 5. Data Sources
  // =============================================
  var sec5 = makeSection('Data Sources');

  addSubheading(sec5, 'Primary: Supreme Court Database (SCDB)');
  addList(sec5, [
    'Maintained by Washington University in St. Louis (Harold Spaeth, Lee Epstein, et al.).',
    'The gold standard for empirical Supreme Court research, used in hundreds of published studies.',
    'Covers October Terms 2005\u20132023 with granular vote codes for every justice on every case.',
    'Each case is coded with 60+ variables per justice-vote, including vote type, opinion assignment, issue area, and disposition.',
    'Vote codes: 1 = majority opinion, 2 = dissent, 3 = regular concurrence, 4 = concurrence in judgment, 5 = concurrence in part and dissent in part, 6 = dissent in part, 7 = jurisdictional dissent, 8 = non-participation.'
  ]);

  addSubheading(sec5, 'Supplementary: supremecourt.gov PDF Scraping');
  addList(sec5, [
    'Used for OT2024 and OT2025 where SCDB data is not yet available.',
    'Slip opinion PDFs are downloaded directly from supremecourt.gov.',
    'Vote blocks are extracted using PyMuPDF and parsed via regex pattern matching.',
    'Less reliable than SCDB for edge cases \u2014 unusual opinion formatting or complex partial concurrences may be miscoded.'
  ]);

  addSubheading(sec5, 'Data Validation');
  addList(sec5, [
    'Vote splits have been cross-referenced against Wikipedia, SCOTUSblog, and official published opinions for 6 landmark cases.',
    'All vote splits were confirmed accurate against these sources.',
    'Known discrepancies exist across sources for partial concurrences \u2014 see the Limitations section below.'
  ]);
  layout.appendChild(sec5);

  // =============================================
  // 6. All 16 Roberts Court Justices
  // =============================================
  var sec6 = makeSection('All 16 Roberts Court Justices');

  addSubheading(sec6, 'Current Bench (2025)');
  addList(sec6, [
    'John Roberts (Chief Justice, 2005\u2013present) \u2014 Appointed by G.W. Bush',
    'Clarence Thomas (1991\u2013present) \u2014 Appointed by G.H.W. Bush',
    'Samuel Alito (2006\u2013present) \u2014 Appointed by G.W. Bush',
    'Sonia Sotomayor (2009\u2013present) \u2014 Appointed by Obama',
    'Elena Kagan (2010\u2013present) \u2014 Appointed by Obama',
    'Neil Gorsuch (2017\u2013present) \u2014 Appointed by Trump',
    'Brett Kavanaugh (2018\u2013present) \u2014 Appointed by Trump',
    'Amy Coney Barrett (2020\u2013present) \u2014 Appointed by Trump',
    'Ketanji Brown Jackson (2022\u2013present) \u2014 Appointed by Biden'
  ]);

  addSubheading(sec6, 'Former Justices (During Roberts Court)');
  addList(sec6, [
    'Sandra Day O\'Connor (1981\u20132006) \u2014 Appointed by Reagan',
    'David Souter (1990\u20132009) \u2014 Appointed by G.H.W. Bush',
    'John Paul Stevens (1975\u20132010) \u2014 Appointed by Ford',
    'Antonin Scalia (1986\u20132016) \u2014 Appointed by Reagan',
    'Anthony Kennedy (1988\u20132018) \u2014 Appointed by Reagan',
    'Ruth Bader Ginsburg (1993\u20132020) \u2014 Appointed by Clinton',
    'Stephen Breyer (1994\u20132022) \u2014 Appointed by Clinton'
  ]);
  layout.appendChild(sec6);

  // =============================================
  // 7. Methodology Detail
  // =============================================
  var sec7 = makeSection('Methodology');
  addList(sec7, [
    'Per curiam opinions (unsigned, issued by the Court as a whole) are currently excluded from analysis due to unreliable vote attribution.',
    'Cases with fewer than 2 participating justices are excluded.',
    'Agreement pairs are only computed for justices who both participated in the same case \u2014 recusals and non-participation reduce pair sample sizes.',
    'Historical data (October Terms 2005\u20132023) is sourced from the Supreme Court Database; OT2024 and OT2025 data comes from PDF scraping of slip opinions.',
    'Concurrence in part / dissent in part is coded as a concurrence (majority-side) for agreement calculation purposes.',
    'All vote data is normalized into a binary same-side / opposite-side classification before agreement rates are computed.'
  ]);
  layout.appendChild(sec7);

  // =============================================
  // 8. Limitations & Caveats
  // =============================================
  var sec8 = makeSection('Limitations & Caveats');
  addList(sec8, [
    'Vote coding for partial concurrences varies across sources. For example, Dobbs v. Jackson Women\'s Health Organization can be coded as 5-4 or 6-3 depending on whether Roberts\' concurrence in the judgment is counted as majority-side.',
    'The PDF parser for current-term cases may miss unusual opinion formatting or fail to extract vote blocks from non-standard layouts.',
    'Small sample sizes for newer justices affect reliability: Jackson has participated in roughly 130 cases compared to Thomas\'s approximately 1,080 cases during the Roberts Court era.',
    'Per curiam opinions are excluded entirely from the analysis.',
    'Cases without a clear majority/dissent structure (plurality decisions) are coded based on which side prevailed in the judgment.',
    'Recusals reduce the sample size for affected justice pairs and can skew agreement rates for pairs with frequent recusals.',
    'The ideological groupings used for scoring are simplified and static \u2014 they do not account for shifts in a justice\'s jurisprudence over time.',
    'Concurrence classification: Justices who joined the majority opinion AND wrote a separate concurring opinion may be classified as \'concurrence\' rather than \'majority\' in the vote breakdown. This is an artifact of the SCDB data source, which classifies by opinion authorship. It does not affect agreement calculations, since our \'same side\' metric treats majority and concurrence votes as being on the same side. However, the individual vote type labels in the Data tab may show some majority-side justices under \'Concurrence\' if they authored or joined a separate concurring opinion.'
  ]);
  layout.appendChild(sec8);

  // =============================================
  // =============================================
  // 9. Credits & Sources
  // =============================================
  var sec10 = makeSection('Credits & Sources');
  addList(sec10, [
    'Supreme Court Database (SCDB): Harold Spaeth, Lee Epstein, Andrew D. Martin, Jeffrey A. Segal, Theodore J. Ruger, and Sara C. Benesh. Washington University in St. Louis.',
    'D3.js \u2014 data-driven document visualization library, used for the heatmap, network graph, and timeline.',
    'supremecourt.gov \u2014 official source for current-term slip opinions.',
    'Built with Python 3.9+, SQLite, and vanilla JavaScript. No frameworks, no build step.'
  ]);
  layout.appendChild(sec10);

  // Append everything
  container.appendChild(layout);
})();
