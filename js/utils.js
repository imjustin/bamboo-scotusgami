// ============================================
// SHARED UTILITIES
// ============================================

// Parse M/DD/YY date strings used in dashboard data
window.parseDate = function(dateStr) {
  var parts = dateStr.split('/');
  var month = parseInt(parts[0], 10);
  var day = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  year += year < 50 ? 2000 : 1900;
  return new Date(year, month - 1, day);
};

// Sorted pair key for justice pairs
window.pairKey = function(a, b) {
  return [a, b].sort().join('-');
};

// Switch to a tab by name, with optional callback after activation
window.switchToTab = function(tabName, afterFn) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); });
  var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (btn) btn.classList.add('active');
  var tab = document.getElementById('tab-' + tabName);
  if (tab) tab.classList.add('active');
  if (afterFn) afterFn();
};
