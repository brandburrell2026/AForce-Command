/* Use the existing early-access capture; never confirm an unsaved signup. */
(function () {
  var form = document.querySelector('.founding form');
  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var input = form.querySelector('input');
      var button = form.querySelector('button');
      var status = form.querySelector('[role="status"]');
      if (button.disabled || !form.reportValidity()) return;
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      button.disabled = true;
      button.textContent = 'Joining…';
      status.textContent = '';
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch('/api/founding-250', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }), signal: controller.signal
        });
        var result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error('Capture failed');
        button.textContent = 'You’re on the list';
        status.textContent = 'Thank you. Your early-access request has been received.';
      } catch (_) {
        button.disabled = false;
        button.textContent = 'Join the Waitlist';
        status.textContent = 'We couldn’t save your request. Please try again, or email contact@aforceritual.com.';
      } finally { clearTimeout(timeout); }
    });
  }
  // Load the below-the-fold film only as it approaches the viewport.
  var film = document.querySelector('.universal-video');
  if (!film) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator.connection && navigator.connection.saveData)) {
    film.controls = true;
    film.addEventListener('play', loadFilm, { once: true });
    // A visible native control lets the visitor explicitly request playback.
    film.addEventListener('click', loadFilm, { once: true });
    return;
  }
  function loadFilm() {
    if (film.dataset.loaded) return;
    film.dataset.loaded = 'true';
    film.querySelectorAll('source[data-src]').forEach(function (source) {
      source.src = source.dataset.src;
    });
    film.load();
    var playback = film.play();
    if (playback) playback.catch(function () { film.controls = true; });
  }
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        loadFilm(); observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(film);
  } else { film.controls = true; film.addEventListener('click', loadFilm, { once: true }); }
})();
