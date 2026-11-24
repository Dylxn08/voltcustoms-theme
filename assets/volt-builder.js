/* Build Your Setup (sections/volt-build-your-setup.liquid). No dependencies. */
(function () {
  'use strict';

  function VoltBuilder(root) {
    this.root = root;
    this.data = root.dataset;
    this.bike = null;
    this.busy = false;
    this.form = root.querySelector('[data-vb-form]');
    this.bikeStep = root.querySelector('.vb-step');
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
      return {
        el: el,
        kind: el.dataset.kind,
        title: el.dataset.title,
        fits: (el.dataset.fits || '').split(',').filter(Boolean),
        input: el.querySelector('[data-vb-input]'),
        select: el.querySelector('[data-vb-variant]'),
        img: el.querySelector('.vb-item__img'),
        price: el.querySelector('[data-vb-price]'),
        stock: el.querySelector('[data-vb-stock]'),
        variants: variants
      };
    });

    this.bind();
    this.syncLayout();
    this.render();
  }

  VoltBuilder.prototype.format = function (cents) {
    var amount = (Number(cents) || 0) / 100;
    return this.money ? this.money.format(amount) : amount.toFixed(2);
  };

  VoltBuilder.prototype.variantFor = function (item) {
    var id = Number(item.input.value);
    for (var i = 0; i < item.variants.length; i++) {
      if (item.variants[i].id === id) return item.variants[i];
    }
    return null;
  };

  // A product can be picked only if its current variant is in stock.
  VoltBuilder.prototype.isSelected = function (item) {
    if (!item.input.checked || item.input.disabled || item.el.hidden) return false;
    var v = this.variantFor(item);
    return !!(v && v.available);
  };

  VoltBuilder.prototype.bind = function () {
    var self = this;

    this.root.querySelectorAll('[data-vb-bike]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        self.bike = { key: radio.value, title: radio.dataset.title };
        self.applyFit();
        self.clearStatus();
        self.render();
      });
    });

    this.items.forEach(function (item) {
      if (!item.input) return;
      item.input.addEventListener('change', function () {
        self.clearStatus();
        self.render();
      });
      if (item.select) {
        item.select.addEventListener('change', function () {
          self.setVariant(item, Number(item.select.value));
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

  VoltBuilder.prototype.setVariant = function (item, id) {
    var v = null;
    for (var i = 0; i < item.variants.length; i++) {
      if (item.variants[i].id === id) v = item.variants[i];
    }
    if (!v || !v.available) return;

    item.input.value = String(v.id);
    var html = '<span>' + this.format(v.price) + '</span>';
    if (v.compare > v.price) html += '<s class="vb-item__was">' + this.format(v.compare) + '</s>';
    item.price.innerHTML = html;
    item.stock.textContent = v.low ? (this.data.msgLow || '').replace('[count]', v.low) : '';
    if (item.img && v.img) {
      item.img.src = v.img;
      item.img.srcset = v.img + ' 200w, ' + v.img2x + ' 400w';
    }
    // Choosing an option means you want that product.
    if (!item.input.checked && !item.el.hidden) item.input.checked = true;
    this.clearStatus();
    this.render();
  };

  VoltBuilder.prototype.applyFit = function () {
    var key = this.bike && this.bike.key;
    this.items.forEach(function (item) {
      var fits = !key || item.fits.length === 0 || item.fits.indexOf(key) !== -1;
      item.el.hidden = !fits;
      if (!fits && item.input) item.input.checked = false;
    });
    this.root.querySelectorAll('[data-vb-step]').forEach(function (step) {
      var empty = step.querySelector('[data-vb-empty]');
      var visible = step.querySelectorAll('[data-vb-item]:not([hidden])').length;
      if (empty) empty.hidden = visible > 0;
    });
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
