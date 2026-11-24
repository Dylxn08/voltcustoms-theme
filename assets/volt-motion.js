/* Volt motion — scroll reveals, word-mask headings, count-ups, hero parallax, marquee lean.
   Runs only when <html> has .vm (set in the header for visitors who allow motion). */
(function () {
  var root = document.documentElement;
  if (!root.classList.contains('vm')) return;
  window.voltMotion = true;

  var UP = '.vs-eyebrow,.vr__eyebrow,.vs-best__eyebrow,.vs-cmp__sub,.vs-best__all,.vs-ess__card,.vs-prod,.vs-builds__item,.vs-why__card,.vr__slide,.vr__summary,.vr__item,.vr__total,.vs-cmp__cta,.vs-sign__txt,.vs-sign__in';
  var LEFT = '.vs-cmp__row';
  var TITLES = '.vs-h2,.vs-cmp__title,.vs-why__title,.vr__title,.vs-sign__title';
  var COUNT = '.vr__avg,.vr__total strong,.vr__bar-n';

  function splitWords(el) {
    if (el.classList.contains('vm-split')) return;
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var w = document.createElement('span'); w.className = 'vm-w';
            var s = document.createElement('span'); s.textContent = p;
            s.style.setProperty('--vm-d', Math.min(i++ * 70, 700) + 'ms');
            w.appendChild(s); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && n.tagName !== 'SVG') {
          walk(n);
        }
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.classList.add('vm-split');
  }

  function countUp(el) {
    if (el.dataset.vmCounted) return; el.dataset.vmCounted = '1';
    var text = el.textContent.trim();
    var m = text.match(/^(\D*)([\d,]*\.?\d+)(\D*)$/);
    if (!m) return;
    var target = parseFloat(m[2].replace(/,/g, ''));
    var dec = (m[2].split('.')[1] || '').length;
    var t0 = null, dur = 1200;
    function fmt(v) { var s = v.toFixed(dec); return m[2].indexOf(',') > -1 ? Number(s).toLocaleString('en-US', { minimumFractionDigits: dec }) : s; }
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = m[1] + fmt(target * e) + m[3];
      if (p < 1) requestAnimationFrame(step); else el.textContent = text;
    }
    requestAnimationFrame(step);
  }

  var io = new IntersectionObserver(function (entries) {
    var batch = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
    batch.sort(function (a, b) { return a.compareDocumentPosition(b) & 2 ? 1 : -1; });
    /* cards inside a sideways-scrolling row (review strip, mobile sliders) reveal together,
       so cards you swipe to later aren't still invisible */
    batch.slice().forEach(function (el) {
      var p = el.parentElement;
      if (!p || !el.classList.contains('vm-up') || p.scrollWidth <= p.clientWidth + 4) return;
      Array.prototype.forEach.call(p.children, function (c) {
        if (c !== el && c.classList.contains('vm-up') && !c.classList.contains('vm-in') && batch.indexOf(c) < 0) batch.push(c);
      });
    });
    batch.forEach(function (el, i) {
      if (!el.classList.contains('vm-title')) el.style.setProperty('--vm-d', Math.min(i * 90, 540) + 'ms');
      el.classList.add('vm-in');
      if (el.matches(COUNT)) countUp(el);
      if (el.classList.contains('vr__bars')) el.querySelectorAll('.vr__bar-n').forEach(countUp);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  function arm(scope) {
    scope.querySelectorAll(TITLES).forEach(function (el) {
      if (el.dataset.vmArmed) return; el.dataset.vmArmed = '1';
      el.classList.add('vm-title'); splitWords(el); io.observe(el);
    });
    scope.querySelectorAll(UP).forEach(function (el) {
      if (el.dataset.vmArmed) return; el.dataset.vmArmed = '1';
      el.classList.add('vm-up'); io.observe(el);
    });
    scope.querySelectorAll(LEFT).forEach(function (el) {
      if (el.dataset.vmArmed) return; el.dataset.vmArmed = '1';
      el.classList.add('vm-left'); io.observe(el);
    });
    scope.querySelectorAll('.vr__bars,' + COUNT).forEach(function (el) {
      if (el.dataset.vmArmed) return; el.dataset.vmArmed = '1'; io.observe(el);
    });
  }

  /* hero parallax + marquee lean, one rAF loop driven by scroll */
  var hero = document.querySelector('.vs-hero'), heroImg = hero && hero.querySelector('.vs-hero__img');
  var marqs = Array.prototype.slice.call(document.querySelectorAll('.vs-marq'));
  var lastY = window.scrollY, skew = 0, ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY, v = y - lastY; lastY = y;
    if (heroImg) {
      var h = hero.offsetHeight;
      if (y < h) heroImg.style.translate = '0 ' + Math.round(y * 0.28) + 'px';
    }
    if (marqs.length) {
      skew += (Math.max(-9, Math.min(9, -v * 0.35)) - skew) * 0.35;
      marqs.forEach(function (m) { m.style.setProperty('--vm-skew', skew.toFixed(2) + 'deg'); });
      if (Math.abs(skew) > 0.05) { ticking = true; requestAnimationFrame(frame); }
      else marqs.forEach(function (m) { m.style.setProperty('--vm-skew', '0deg'); });
    }
  }
  /* after a fast jump (menu link, flick), anything we skipped past is revealed so it isn't blank when scrolling back up */
  var sweepT;
  function sweep() {
    document.querySelectorAll('.vm-up:not(.vm-in),.vm-left:not(.vm-in),.vm-title:not(.vm-in),.vr__bars:not(.vm-in)').forEach(function (el) {
      if (el.getBoundingClientRect().bottom < 0) { el.classList.add('vm-in'); io.unobserve(el); }
    });
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    clearTimeout(sweepT); sweepT = setTimeout(sweep, 150);
  }, { passive: true });

  function start() {
    arm(document);
    setTimeout(sweep, 300); /* page opened part-way down (back button, #link) */
    /* re-arm when the theme editor or "Show more" adds content */
    document.addEventListener('shopify:section:load', function (e) { arm(e.target); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
