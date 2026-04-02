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
  // 1b. When Is It a SCOTUSgami?
  // =============================================
  var sec1b = makeSection('When Is It a SCOTUSgami?');
  addParagraph(sec1b, 'A SCOTUSgami occurs when a case produces an event the dashboard has never seen before. The most common trigger is a new coalition \u2014 an exact combination of justices on the majority and dissent sides that has never previously appeared in the dataset.');

  addSubheading(sec1b, 'What counts as a coalition?');
  addParagraph(sec1b, 'A coalition is the specific set of justices on each side of a decision. Majority and concurrence votes are grouped together as the majority side; only dissent is the opposite side. The coalition tracks exactly who is on each side, not just the numeric split.');

  addSubheading(sec1b, 'Examples');
  addBoldLine(sec1b, 'SCOTUSgami:', 'A 6\u20133 decision with Roberts, Thomas, Alito, Gorsuch, Kavanaugh, and Kagan in the majority, with Sotomayor, Jackson, and Barrett dissenting. If Barrett has never before dissented alongside the two liberal justices while Kagan sided with the conservatives, this exact grouping is new \u2014 it\u2019s a SCOTUSgami.');
  addBoldLine(sec1b, 'SCOTUSgami:', 'Thomas and Sotomayor agree for the first time ever. A cross-wing first agreement is always a SCOTUSgami, regardless of the overall vote split.');
  addBoldLine(sec1b, 'SCOTUSgami:', 'Gorsuch and Kavanaugh disagree for the first time. A same-wing first disagreement is always a SCOTUSgami.');
  addBoldLine(sec1b, 'Not a SCOTUSgami:', 'A 9\u20130 unanimous decision. Every justice is on the same side, so there\u2019s no coalition split to track. Unanimous cases are logged but are never SCOTUSgami events.');
  addBoldLine(sec1b, 'Not a SCOTUSgami:', 'A 6\u20133 with Roberts, Thomas, Alito, Gorsuch, Kavanaugh, Barrett in the majority and Sotomayor, Kagan, Jackson dissenting. This is the \u201Cdefault\u201D ideological split and has occurred dozens of times \u2014 it\u2019s tracked with a coalition count but is not novel.');
  addBoldLine(sec1b, 'Not a SCOTUSgami:', 'Thomas and Alito agree for the 400th time. Same-wing agreements are expected and score low. Only their first-ever agreement was a SCOTUSgami.');

  addSubheading(sec1b, 'Other SCOTUSgami triggers');
  addList(sec1b, [
    'First-ever agreement between a cross-wing pair (e.g., Thomas + Sotomayor)',
    'First-ever disagreement between a same-wing pair (e.g., Gorsuch + Kavanaugh)',
    'A sole dissenter pair that crosses ideological lines (e.g., Thomas + Kagan dissenting together)',
    'An unusual coalition with 3+ dissenters spanning both wings',
    'A novel cross-wing agreement streak milestone (e.g., 5 consecutive agreements between Thomas and Kagan)'
  ]);

  addParagraph(sec1b, 'The key idea: if the dashboard has seen this exact pattern before, it\u2019s not a SCOTUSgami. If it\u2019s genuinely new \u2014 a combination of justices, a first-time event, or a record streak \u2014 it is.');
  layout.appendChild(sec1b);

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
    'A 9\u00d79 grid of current justices. The upper triangle shows overall agreement rate; the lower triangle shows close-case agreement (5-4 and 6-3 decisions only).',
    'Close-case agreement strips out unanimous and lopsided decisions, revealing true ideological alignment on contested cases.',
    'Color encodes agreement across both halves on the same scale: red = low, yellow = mid, green = high. Colors are directly comparable between triangles.',
    'Cells showing a dash (\u2014) in the lower triangle mean that pair has no close-case data in the selected time range.',
    'Click any cell to select that pair and load its detail in the side panel. Multi-select is supported \u2014 click additional cells to compare pairs.',
    'The diagonal is blank because a justice cannot agree or disagree with themselves.'
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
    'Displays the cumulative agreement percentage over time for selected justice pairs (solid line).',
    'Use the term filter dropdown to zoom into specific time ranges.',
    'When multiple pairs are selected, each is shown in a different color for comparison.',
    'Close cases overlay (dashed line): opt-in toggle that shows cumulative agreement restricted to 5-4 and 6-3 decisions only. Useful for comparing tight-case alignment to overall agreement.',
    'Rolling window overlay (dotted line): opt-in toggle showing a moving average over the last N cases (10, 20, 30, or 50). Highlights recent momentum rather than long-run averages.',
    'All overlays share the pair\'s color. Line style distinguishes them: solid = cumulative, dashed = close cases, dotted = rolling window.'
  ]);

  addSubheading(sec2, 'Feed Tab');
  addList(sec2, [
    'A reverse-chronological feed of notable voting events detected by the scoring algorithm.',
    'SCOTUSgami events \u2014 genuinely novel coalition patterns \u2014 are highlighted with a gold accent border.',
    'Use the filter buttons to narrow by event type (e.g., first agreement, streak, sole dissenter).',
    'The novelty score slider lets you set a minimum threshold to hide routine events and focus on the most surprising ones.'
  ]);

  addSubheading(sec2, 'Top Coalitions');
  addList(sec2, [
    'Two-column panel showing the most frequently occurring majority groups (left) and dissent groups (right) within the selected time range.',
    'Each entry shows the group members, case count, and group size (e.g., 5J for a five-justice majority).',
    'Click any group to jump to the Coalitions tab for a deeper look at those cases.',
    'Responds to the global term filter \u2014 change the time range to see which coalitions dominate different eras.'
  ]);

  addSubheading(sec2, 'Coalitions Tab');
  addList(sec2, [
    'A standalone explorer for all majority and dissent groupings across the selected time period.',
    'Each entry includes a year range showing when that coalition was active (e.g., 2017\u20132024).',
    'Click any group to expand and see the individual cases, sorted by date.',
    'Click a case name to jump to the Data tab with that case selected.',
    'Use the search box to filter groups by justice name.',
    'When you click "X times" in the Feed, it links here and auto-expands the matching coalition.'
  ]);

  addSubheading(sec2, 'Vote Configuration Grid');
  addList(sec2, [
    'A scorigami-style grid where the X-axis is majority size (5 through 9) and the Y-axis is the number of concurrences (0 through 4+).',
    'Cells are colored by frequency \u2014 darker green means more cases with that exact vote configuration.',
    'Empty cells with dashes represent SCOTUSgami configurations \u2014 vote splits that have never occurred in the selected time range.',
    'Hover over a cell to see the count and example case names.'
  ]);

  addSubheading(sec2, 'Swing Score');
  addList(sec2, [
    'Shows how often each justice ends up on the winning side of close decisions (5-4 and 6-3 splits).',
    'A high swing score means the justice almost always votes with the majority in close cases; a low score means they frequently dissent.',
    'Bars are color-coded: blue/green for high percentages, yellow/red for low.',
    'The parenthetical shows the total number of close cases the justice participated in.',
    'Responds to the global term filter \u2014 narrow to a single term to see who was the swing vote that year.'
  ]);

  addSubheading(sec2, 'Ideology Drift');
  addList(sec2, [
    'A multi-line chart plotting each justice\u2019s ideological position over time, measured as agreement with the liberal bloc (Jackson, Kagan, Sotomayor) minus agreement with the conservative bloc (Alito, Thomas, Gorsuch).',
    'Positive scores indicate more liberal-aligned voting; negative scores indicate more conservative-aligned voting.',
    'The dashed zero line represents the midpoint \u2014 equal agreement with both blocs.',
    'Click justice names in the legend to toggle individual lines on and off.',
    'Hover over a line to see the exact score for a given term.',
    'Justices only appear in terms they actually served \u2014 Jackson starts in 2022, Barrett in 2020, etc.',
    'Responds to the global term filter to zoom into specific time periods.'
  ]);

  addSubheading(sec2, 'Unusual Bedfellows');
  addList(sec2, [
    'Surfaces cases where justice pairs agreed after a long streak of consecutive disagreements \u2014 genuinely surprising moments of alignment.',
    'Entries are grouped by case (not per-pair) to avoid repetition when one case breaks multiple streaks.',
    'The streak badge shows the longest disagreement streak broken by that case.',
    'Each entry lists the pairs involved with their individual streak lengths.',
    'A high streak number (10+, shown in red) means two justices had been on opposite sides for 10+ consecutive cases before finally agreeing.',
    'Click a case name to jump to the Data tab for the full vote breakdown.'
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
      ['New coalition (vote split scorigami)', '50\u201395', 'Close splits (5-4) score higher; cross-wing majority adds +15'],
      ['Coalition count', '5\u201340', 'Shows how many times this exact majority makeup has occurred'],
      ['Bloc defection', '55\u201365', 'Higher for 5-4 splits than 6-3'],
      ['First agreement (cross-wing)', '75', 'SCOTUSgami if cross-wing'],
      ['First agreement (same-wing)', '30', 'Lower score \u2014 expected pairing'],
      ['First disagreement (same-wing)', '70', 'SCOTUSgami if same-wing'],
      ['First disagreement (cross-wing)', '25', 'Lower score \u2014 expected pairing'],
      ['Sole dissenter pair (cross-wing)', '85', 'Always SCOTUSgami'],
      ['Sole dissenter pair (same-wing)', '50', '\u2014'],
      ['Sole dissenter', '35\u201370', 'Higher if first time for that justice'],
      ['Unusual coalition (3+ cross-wing dissent)', '80', 'SCOTUSgami if novel grouping'],
      ['Agreement streak (5+/10/15/20+)', '55\u201395', 'Cross-wing pairs fire at 5; same-wing at 10'],
      ['Disagreement streak (3/5/8/10)', '50\u201385', 'Scales with streak length'],
      ['Streak broken', '30\u201375', 'Higher for longer streaks that ended'],
      ['Rate milestone (90%/75%/60%/50%)', '30\u201375', 'Multiple thresholds tracked'],
      ['Rate reversal', '35\u201365', 'Fires when trend direction flips after 3%+ swing'],
      ['Unanimous (9-0)', '5\u201360', 'First of term scores 45\u201360; subsequent 5\u201315']
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
  addBoldLine(sec4, 'Same Side (outcome-based):', 'Justices are on the same side if they reach the same outcome. Majority and all forms of concurrence are treated as one side; only dissent is the opposite side.');
  addParagraph(sec4, 'This outcome-based approach means a justice who concurs in the judgment only is counted as agreeing with a justice who joined the full majority opinion. This prioritizes agreement on outcome over agreement on reasoning.');
  addParagraph(sec4, 'A stricter "Agreed" metric \u2014 requiring an exact vote-type match (e.g., both must be majority joiners, not one majority and one concurrence) \u2014 is computed and stored in the database but is not currently displayed in the dashboard.');
  addParagraph(sec4, 'Because of the outcome-based approach, agreement rates may be slightly inflated for pairs where one justice frequently concurs in judgment only rather than joining the majority opinion outright.');
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
