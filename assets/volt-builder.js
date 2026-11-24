/* Build Your Setup (sections/volt-build-your-setup.liquid). No dependencies. */
(function () {
  'use strict';

  function parsePicks(str) {
    // "super73|3 Pin Female||ridstar|3 Pin Male||" -> { super73: '3 pin female', ... }
    var out = {};
    (str || '').split('||').forEach(function (pair) {
      var i = pair.indexOf('|');
      if (i > 0) out[pair.slice(0, i).toLowerCase()] = pair.slice(i + 1).toLowerCase();
    });
    return out;
  }

  function VoltBuilder(root) {
    var self = this;
    this.root = root;
    this.data = root.dataset;
    this.bike = null;
    this.busy = false;
    this.form = root.querySelector('[data-vb-form]');
    this.bikeStep = root.querySelector('.vb-step');
    this.prompt = root.querySelector('[data-vb-prompt]');
    this.steps = Array.prototype.slice.call(root.querySelectorAll('[data-vb-step]'));
    this.list = root.querySelector('[data-vb-list]');
    this.listEmpty = root.querySelector('[data-vb-list-empty]');
    this.toggle = root.querySelector('[data-vb-toggle]');
    this.details = root.querySelector('[data-vb-details]');
    this.total = root.querySelector('[data-vb-total]');
    this.button = root.querySelector('[data-vb-submit]');
    this.status = root.querySelector('[data-vb-status]');

    try {
      this.money = new Intl.NumberFormat(this.data.locale || undefined, { style: 'currency', currency: this.data.currency || 'USD' });
    } catch (e) {
      this.money = null;
    }

    this.items = Array.prototype.map.call(root.querySelectorAll('[data-vb-item]'), function (el) {
      var json = el.querySelector('[data-vb-variants]');
      var variants = [];
      try { variants = JSON.parse(json ? json.textContent : '[]'); } catch (e) { variants = []; }
      var input = el.querySelector('[data-vb-input]');
      return {
        el: el,
        title: el.dataset.title,
        fits: (el.dataset.fits || '').split(',').filter(Boolean),
        picks: parsePicks(el.dataset.picks),
        input: input,
        preselect: input.hasAttribute('data-vb-preselect'),
        select: el.querySelector('[data-vb-variant]'),
        img: el.querySelector('.vb-item__img'),
        imgSrc: null,
        price: el.querySelector('[data-vb-price]'),
        stock: el.querySelector('[data-vb-stock]'),
        variants: variants.filter(function (v) { return v.available; }),
        allowed: []
      };
    });
    this.items.forEach(function (item) {
      if (item.img) item.imgSrc = { src: item.img.getAttribute('src'), srcset: item.img.getAttribute('srcset') };
    });

    this.bind();
    this.bikeMeta();
    this.carousel();
    this.syncLayout();
    this.render();
    this.fromUrl();
  }

  // Coming from the homepage "Shop by bike" row: ?bike=super73 picks that bike straight away.
  VoltBuilder.prototype.fromUrl = function () {
    var key = null;
    try { key = new URLSearchParams(window.location.search).get('bike'); } catch (e) { key = null; }
    if (!key) return;
    key = key.toLowerCase();
    var radio = null;
    this.root.querySelectorAll('[data-vb-bike]').forEach(function (r) { if (r.value === key) radio = r; });
    if (!radio) return;
    radio.checked = true;
    var track = this.root.querySelector('[data-vb-bikes]');
    if (track) {
      var card = radio.closest('.vb-bike');
      track.scrollLeft += card.getBoundingClientRect().left - track.getBoundingClientRect().left - 16;
    }
    this.setBike({ key: radio.value, title: radio.dataset.title });
  };

  // Options of a product that fit a bike: none if it doesn't fit, else all (or the pick: ones).
  VoltBuilder.prototype.allowedFor = function (item, key) {
    var fits = item.fits.indexOf('all') !== -1 || (key !== 'other' && item.fits.indexOf(key) !== -1);
    if (!fits) return [];
    var pick = item.picks[key];
    return item.variants.filter(function (v) {
      return !pick || v.title.toLowerCase().indexOf(pick) !== -1;
    });
  };

  // "[count] parts fit · from [price]" under each bike name, worked out from the live products.
  VoltBuilder.prototype.bikeMeta = function () {
    var self = this;
    var template = this.data.msgBikeMeta || '';
    if (!template) return;
    this.root.querySelectorAll('[data-vb-bike]').forEach(function (radio) {
      var meta = radio.parentNode.querySelector('[data-vb-bike-meta]');
      if (!meta) return;
      var count = 0;
      var min = null;
      self.items.forEach(function (item) {
        var allowed = self.allowedFor(item, radio.value);
        if (!allowed.length) return;
        count += 1;
        allowed.forEach(function (v) { if (min === null || v.price < min) min = v.price; });
      });
      meta.textContent = count ? template.replace('[count]', count).replace('[price]', self.format(min)) : '';
    });
  };

  // Arrows and "01 / 10" counter for the bike cards.
  VoltBuilder.prototype.carousel = function () {
    var track = this.root.querySelector('[data-vb-bikes]');
    var prev = this.root.querySelector('[data-vb-bikes-prev]');
    var next = this.root.querySelector('[data-vb-bikes-next]');
    var count = this.root.querySelector('[data-vb-bikes-count]');
    if (!track) return;
    var cards = track.querySelectorAll('.vb-bike');
    var total = cards.length;
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function step() {
      var c = cards[0];
      return c ? c.getBoundingClientRect().width + 12 : track.clientWidth;
    }
    function update() {
      var i = Math.min(total, Math.round(track.scrollLeft / step()) + 1);
      if (count) count.textContent = pad(i) + ' / ' + pad(total);
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  };

  VoltBuilder.prototype.format = function (cents) {
    var amount = (Number(cents) || 0) / 100;
    return this.money ? this.money.format(amount) : amount.toFixed(2);
  };

  VoltBuilder.prototype.variantFor = function (item) {
    var id = Number(item.input.value);
    for (var i = 0; i < item.allowed.length; i++) {
      if (item.allowed[i].id === id) return item.allowed[i];
    }
    return null;
  };

  VoltBuilder.prototype.isSelected = function (item) {
    return !!(item.input.checked && !item.el.hidden && this.variantFor(item));
  };

  VoltBuilder.prototype.bind = function () {
    var self = this;

    this.root.querySelectorAll('[data-vb-bike]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        self.setBike({ key: radio.value, title: radio.dataset.title });
      });
    });

    this.items.forEach(function (item) {
      // "Pick one" steps: tapping the chosen product again unselects it.
      if (item.input.type === 'radio') {
        var wasChecked = false;
        item.el.querySelector('.vb-item__pick').addEventListener('pointerdown', function () { wasChecked = item.input.checked; });
        item.input.addEventListener('click', function () {
          if (wasChecked) {
            item.input.checked = false;
            wasChecked = false;
            self.clearStatus();
            self.render();
          }
        });
        item.input.addEventListener('keydown', function () { wasChecked = false; });
      }
      item.input.addEventListener('change', function () {
        self.clearStatus();
        self.render();
      });
      if (item.select) {
        item.select.addEventListener('change', function () {
          self.setVariant(item, Number(item.select.value), true);
        });
      }
    });

    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.submit();
    });
    this.button.addEventListener('click', function () { self.submit(); });

    if (window.matchMedia) {
      this.mq = window.matchMedia('(min-width: 990px)');
      var onChange = function () { self.syncLayout(); };
      if (this.mq.addEventListener) this.mq.addEventListener('change', onChange);
      else if (this.mq.addListener) this.mq.addListener(onChange);
    }
  };

  // Item list is always open on desktop and collapsed (behind the count) on phones.
  VoltBuilder.prototype.syncLayout = function () {
    if (this.details) this.details.open = this.mq ? this.mq.matches : true;
  };

  // Show only what fits the chosen bike, and only the options that fit it.
  VoltBuilder.prototype.setBike = function (bike) {
    var self = this;
    var key = bike.key;
    var firstChange = !this.bike;
    this.bike = bike;
    this.root.classList.add('has-bike');

    this.items.forEach(function (item) {
      item.allowed = self.allowedFor(item, key);
      var show = item.allowed.length > 0;
      item.el.hidden = !show;
      if (!show) {
        item.input.checked = false;
        return;
      }
      if (item.select) self.fillOptions(item);
      var keep = self.variantFor(item) ? Number(item.input.value) : item.allowed[0].id;
      self.setVariant(item, keep, false);
      if (firstChange && item.preselect) item.input.checked = true;
    });

    var n = 1;
    this.steps.forEach(function (step) {
      var visible = step.querySelectorAll('[data-vb-item]:not([hidden])').length > 0;
      step.hidden = !visible;
      if (!visible) return;
      n += 1;
      var num = step.querySelector('[data-vb-step-num]');
      var title = step.querySelector('[data-vb-step-title]');
      if (num) num.textContent = (num.dataset.template || '').replace('[n]', n);
      if (title) title.textContent = (title.dataset.template || '').replace('[bike]', bike.title);
    });
    if (this.prompt) this.prompt.hidden = true;

    this.clearStatus();
    this.render();
    if (firstChange && this.steps.length) {
      var firstVisible = this.steps.filter(function (s) { return !s.hidden; })[0];
      if (firstVisible && firstVisible.getBoundingClientRect().top > window.innerHeight * 0.75) {
        firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  VoltBuilder.prototype.fillOptions = function (item) {
    var current = Number(item.select.value);
    item.select.textContent = '';
    item.allowed.forEach(function (v) {
      var o = document.createElement('option');
      o.value = String(v.id);
      o.textContent = v.title;
      if (v.id === current) o.selected = true;
      item.select.appendChild(o);
    });
    // One option left: nothing to choose, so hide the dropdown.
    item.select.closest('.vb-item__variant').hidden = item.allowed.length < 2;
  };

  VoltBuilder.prototype.setVariant = function (item, id, userChose) {
    var v = null;
    for (var i = 0; i < item.allowed.length; i++) {
      if (item.allowed[i].id === id) v = item.allowed[i];
    }
    if (!v) return;

    item.input.value = String(v.id);
    if (item.select) item.select.value = String(v.id);
    var html = '<span>' + this.format(v.price) + '</span>';
    if (v.compare > v.price) html += '<s class="vb-item__was">' + this.format(v.compare) + '</s>';
    item.price.innerHTML = html;
    item.stock.textContent = v.low ? (this.data.msgLow || '').replace('[count]', v.low) : '';
    if (item.img) {
      if (v.img) {
        item.img.src = v.img;
        item.img.srcset = v.img + ' 200w, ' + v.img2x + ' 400w';
      } else if (item.imgSrc) {
        item.img.src = item.imgSrc.src;
        if (item.imgSrc.srcset) item.img.srcset = item.imgSrc.srcset;
      }
    }
    if (userChose) {
      // Choosing an option means you want that product.
      if (!item.input.checked) item.input.checked = true;
      this.clearStatus();
      this.render();
    }
  };

  VoltBuilder.prototype.selection = function () {
    var self = this;
    return this.items.filter(function (item) { return self.isSelected(item); });
  };

  VoltBuilder.prototype.render = function () {
    var self = this;
    var selected = this.selection();
    var total = 0;

    this.items.forEach(function (item) {
      item.el.classList.toggle('is-selected', selected.indexOf(item) !== -1);
    });

    this.list.textContent = '';
    if (this.bike) this.list.appendChild(this.row(this.bike.title, '', 'vb-sum__row--bike'));
    selected.forEach(function (item) {
      var v = self.variantFor(item);
      total += v.price;
      var name = item.title + (v.title && v.title !== 'Default Title' ? ' (' + v.title + ')' : '');
      self.list.appendChild(self.row(name, self.format(v.price)));
    });

    this.listEmpty.hidden = !!(this.bike || selected.length);
    this.total.textContent = this.format(total);
    if (this.toggle) this.toggle.textContent = (this.data.msgItems || '').replace('[count]', selected.length);
    this.button.setAttribute('aria-disabled', this.bike && selected.length && !this.busy ? 'false' : 'true');
  };

  VoltBuilder.prototype.row = function (label, value, extra) {
    var li = document.createElement('li');
    li.className = 'vb-sum__row' + (extra ? ' ' + extra : '');
    var a = document.createElement('span');
    a.textContent = label;
    var b = document.createElement('span');
    b.textContent = value;
    li.appendChild(a);
    li.appendChild(b);
    return li;
  };

  VoltBuilder.prototype.setStatus = function (text, isError) {
    this.status.textContent = text || '';
    this.status.classList.toggle('is-error', !!isError);
  };

  VoltBuilder.prototype.clearStatus = function () {
    if (!this.busy) this.setStatus('');
  };

  VoltBuilder.prototype.submit = function () {
    var self = this;
    if (this.busy) return;

    if (!this.bike) {
      this.setStatus(this.data.msgNeedBike, true);
      this.bikeStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.bikeStep.focus({ preventScroll: true });
      return;
    }
    var selected = this.selection();
    if (!selected.length) {
      this.setStatus(this.data.msgNeedItem, true);
      return;
    }

    var drawer = document.querySelector('cart-drawer');
    var canRender = !!(drawer && typeof drawer.renderContents === 'function' && typeof drawer.getSectionsToRender === 'function');
    var body = {
      items: selected.map(function (item) { return { id: Number(item.input.value), quantity: 1 }; })
    };
    if (canRender) {
      try {
        body.sections = drawer.getSectionsToRender().map(function (s) { return s.id; }).slice(0, 5);
        body.sections_url = window.location.pathname;
      } catch (e) {
        canRender = false;
      }
    }

    this.busy = true;
    this.button.setAttribute('aria-busy', 'true');
    this.render();
    this.setStatus(this.data.msgAdding);

    fetch(this.data.cartAddUrl + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (json) { return { ok: res.ok, json: json }; });
      })
      .then(function (r) {
        if (!r.ok || r.json.status) {
          // Shopify explains the problem (e.g. sold out) in "description".
          throw new Error(r.json.description || r.json.message || self.data.msgError);
        }
        self.setStatus(self.data.msgAdded);
        // Dawn-style themes declare these as top-level globals (a const is not on window).
        /* global publish, PUB_SUB_EVENTS */
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined' && PUB_SUB_EVENTS.cartUpdate) {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'volt-builder', cartData: r.json });
        }
        if (canRender && r.json.sections) {
          try {
            drawer.classList.remove('is-empty');
            drawer.renderContents(r.json);
            return;
          } catch (e) { /* fall through to the cart page */ }
        }
        window.location.href = self.data.cartUrl;
      })
      .catch(function (err) {
        self.setStatus(err && err.message ? err.message : self.data.msgError, true);
      })
      .then(function () {
        self.busy = false;
        self.button.removeAttribute('aria-busy');
        self.render();
      });
  };

  function init(root) {
    if (!root || root.dataset.vbReady) return;
    root.dataset.vbReady = 'true';
    new VoltBuilder(root);
  }

  document.querySelectorAll('[data-volt-builder]').forEach(init);
  document.addEventListener('shopify:section:load', function (e) {
    init(e.target.querySelector('[data-volt-builder]'));
  });
})();
