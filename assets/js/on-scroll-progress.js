(function () {
  var ticking = false;

  function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  function updateProgress() {
    ticking = false;

    var progressBar = document.querySelector('#progress-bar');
    if (!progressBar) return;

    var docElem = document.documentElement;
    var docBody = document.body;
    var scrollTop = (docBody.scrollTop || docElem.scrollTop || 0);
    var height = docElem.scrollHeight - docElem.clientHeight;

    var progress = height > 0 ? (scrollTop / height) * 100 : 0;
    progress = clamp(progress, 0, 100);

    progressBar.style.setProperty('--progress', progress.toFixed(2) + '%');
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateProgress);
  }

  document.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('DOMContentLoaded', updateProgress);
})();

