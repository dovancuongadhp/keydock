(function initTheme() {
  try {
    var theme = localStorage.getItem('keydock-theme');
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  } catch (error) {
    document.documentElement.dataset.theme = 'dark';
  }
}());
