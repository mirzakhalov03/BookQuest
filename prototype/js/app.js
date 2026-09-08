/* ============================================================
   App — view routing, registration flow, home state
   ============================================================ */

(function () {
  'use strict';

  var body = document.body;
  var views = {
    register: document.getElementById('view-register'),
    success:  document.getElementById('view-success'),
    home:     document.getElementById('view-home')
  };
  var current = null;

  /* ── View routing ─────────────────────────────────────────── */

  function setView(name) {
    if (current === name) return;
    var leaving = current ? views[current] : null;
    current = name;
    body.dataset.view = name;

    function enter() {
      var el = views[name];
      el.classList.add('is-on', 'is-entering');
      window.scrollTo(0, 0);
      setTimeout(function () { el.classList.remove('is-entering'); }, 500);
      if (name === 'success') revealParticipantId();
    }

    if (leaving) {
      leaving.classList.add('is-leaving');
      setTimeout(function () {
        leaving.classList.remove('is-on', 'is-leaving');
        enter();
      }, 220);
    } else {
      enter();
    }
    syncProto();
  }

  /* ── Home state ───────────────────────────────────────────── */

  var quest = BQ.data.quest;
  var ctaLabel = document.getElementById('cta-label');
  var ctaSub   = document.getElementById('cta-sub');
  var ctaBtn   = document.getElementById('cta');
  var clockLbl = document.getElementById('clock-label');
  var clockDate = document.getElementById('clock-date');

  function setState(name) {
    var s = BQ.states[name];
    if (!s) return;
    body.dataset.state = name;

    ctaLabel.textContent = s.cta;
    ctaBtn.classList.toggle('btn--gold', !!s.gold);

    clockLbl.textContent = s.clockLabel;
    BQ.countdown.setTarget(s.target ? quest[s.target] : null);

    if (name === 'finished') {
      clockDate.textContent = 'Results published ' + BQ.format.longDate(quest.resultsAt);
    } else if (name === 'quiz') {
      clockDate.textContent = BQ.format.longDate(quest.quizCloses);
    } else {
      clockDate.textContent = BQ.format.longDate(quest.readingDeadline);
    }

    ctaSub.textContent = s.sub || ('You’re participant ' + BQ.data.participant.id);
    syncProto();
  }

  /* ── Registration ─────────────────────────────────────────── */

  var form       = document.getElementById('register-form');
  var nameField  = form.querySelector('[data-field="name"]');
  var nameInput  = document.getElementById('fullname');
  var contactField = form.querySelector('[data-field="contact"]');
  var contactInput = document.getElementById('contact');
  var modeButtons  = form.querySelectorAll('.switch__opt');
  var mode = 'telegram';

  var PLACEHOLDER = { telegram: '@your_username', phone: '+998 90 123 45 67' };

  function mark(field, result, showSuccess) {
    field.classList.remove('is-bad', 'is-good', 'is-shaking');
    var msg = field.querySelector('.field__msg');
    if (result.ok) {
      msg.textContent = showSuccess ? result.message : '';
      if (showSuccess) field.classList.add('is-good');
    } else {
      msg.textContent = result.message;
      field.classList.add('is-bad');
    }
  }

  function shake(field) {
    field.classList.remove('is-shaking');
    void field.offsetWidth;
    field.classList.add('is-shaking');
  }

  function checkName(showSuccess) {
    var result = BQ.validate.fullName(nameInput.value);
    mark(nameField, result, showSuccess);
    if (result.ok && result.value) nameInput.value = result.value;   // normalise on the way out
    return result;
  }

  function checkContact(showSuccess) {
    var result = mode === 'telegram'
      ? BQ.validate.telegram(contactInput.value)
      : BQ.validate.phone(contactInput.value);
    mark(contactField, result, showSuccess);
    if (result.ok && result.value) contactInput.value = result.value;
    return result;
  }

  nameInput.addEventListener('blur', function () { if (nameInput.value.trim()) checkName(true); });
  nameInput.addEventListener('input', function () {
    if (nameField.classList.contains('is-bad')) mark(nameField, { ok: true }, false);
  });

  contactInput.addEventListener('blur', function () { if (contactInput.value.trim()) checkContact(true); });
  contactInput.addEventListener('input', function () {
    if (contactField.classList.contains('is-bad')) mark(contactField, { ok: true }, false);
    if (mode === 'phone') {
      var atEnd = contactInput.selectionStart === contactInput.value.length;
      var next = BQ.validate.livePhone(contactInput.value);
      if (atEnd && next !== contactInput.value) contactInput.value = next;
    }
  });

  Array.prototype.forEach.call(modeButtons, function (btn) {
    btn.addEventListener('click', function () {
      mode = btn.dataset.mode;
      Array.prototype.forEach.call(modeButtons, function (b) {
        var on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
      });
      contactInput.placeholder = PLACEHOLDER[mode];
      contactInput.inputMode = mode === 'phone' ? 'tel' : 'text';
      contactInput.value = '';
      mark(contactField, { ok: true }, false);
      contactInput.focus();
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = checkName(true);
    var contact = checkContact(true);

    if (!name.ok) { shake(nameField); nameInput.focus(); return; }
    if (!contact.ok) { shake(contactField); contactInput.focus(); return; }

    setView('success');
  });

  /* ── Participant number reveal ────────────────────────────── */

  var idEl = document.getElementById('participant-id');

  function revealParticipantId() {
    var digits = String(BQ.data.participant.id).split('');
    idEl.textContent = '';
    digits.forEach(function (d, i) {
      var span = document.createElement('span');
      span.textContent = d;
      span.style.animationDelay = (620 + i * 130) + 'ms';
      idEl.appendChild(span);
    });
  }

  document.getElementById('to-home').addEventListener('click', function () {
    setState('reading');
    setView('home');
  });

  /* ── Dust motes ───────────────────────────────────────────── */

  function seedMotes() {
    var box = document.querySelector('.motes');
    if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (var i = 0; i < 14; i++) {
      var m = document.createElement('span');
      m.className = 'mote';
      m.style.left = (8 + Math.random() * 84) + '%';
      m.style.top = (30 + Math.random() * 65) + '%';
      m.style.animationDuration = (9 + Math.random() * 9) + 's';
      m.style.animationDelay = (-Math.random() * 12) + 's';
      m.style.opacity = String(0.2 + Math.random() * 0.5);
      box.appendChild(m);
    }
  }

  /* ── Toast ────────────────────────────────────────────────── */

  var toast = document.getElementById('toast');
  var toastTimer;

  function say(message) {
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2200);
  }

  document.querySelectorAll('[data-locked]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      say(tab.textContent.trim() + ' arrives with the full app');
    });
  });

  document.querySelectorAll('[data-noop]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      say('The web version opens outside Telegram');
    });
  });

  ctaBtn.addEventListener('click', function () {
    if (body.dataset.state === 'unregistered') { setView('register'); return; }
    say(ctaLabel.textContent + ' — not part of this prototype');
  });

  /* ── Prototype controls ───────────────────────────────────── */

  var proto = document.getElementById('proto');
  var pin = document.getElementById('proto-pin');
  var panel = document.getElementById('proto-panel');

  function togglePanel(open) {
    var next = typeof open === 'boolean' ? open : panel.hidden;
    panel.hidden = !next;
    pin.setAttribute('aria-expanded', String(next));
  }

  pin.addEventListener('click', function () { togglePanel(); });

  panel.querySelectorAll('[data-view-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.viewGo;
      if (v === 'register') {
        form.reset();
        mark(nameField, { ok: true }, false);
        mark(contactField, { ok: true }, false);
      }
      setView(v);
    });
  });

  panel.querySelectorAll('[data-state-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      setState(b.dataset.stateGo);
      setView('home');
    });
  });

  function syncProto() {
    panel.querySelectorAll('[data-view-go]').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.viewGo === current);
    });
    panel.querySelectorAll('[data-state-go]').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.stateGo === body.dataset.state);
    });
  }

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { togglePanel(false); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 's' || e.key === 'S') togglePanel();
  });

  document.addEventListener('click', function (e) {
    if (!panel.hidden && !proto.contains(e.target)) togglePanel(false);
  });

  /* ── Boot ─────────────────────────────────────────────────── */

  BQ.countdown.mount(document.getElementById('clock-row'));
  document.getElementById('book-title').textContent = BQ.data.book.title;
  document.getElementById('book-author').textContent = BQ.data.book.author;
  seedMotes();

  /* ?view=home&state=quiz — lets a specific screen be linked or reviewed directly */
  var params = new URLSearchParams(window.location.search);
  var startState = params.get('state');
  setState(BQ.states[startState] ? startState : 'reading');
  var startView = params.get('view');
  setView(views[startView] ? startView : 'register');
})();
