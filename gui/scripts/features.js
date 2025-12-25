function initFeaturesNavigation() {
  const helpBtn = document.querySelector('.help-btn');
  if (!helpBtn) return;

  helpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'features.html';
  });
}
