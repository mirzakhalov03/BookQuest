/* ============================================================
   Countdown
   Digits are individual spans so only the ones that actually
   change animate — the seconds move, the days stay still.
   ============================================================ */

window.BQ = window.BQ || {};

BQ.countdown = (function () {

  var slots = {};
  var target = null;
  var timer = null;

  function mount(rowEl) {
    var units = rowEl.querySelectorAll('[data-unit]');
    for (var i = 0; i < units.length; i++) {
      slots[units[i].dataset.unit] = units[i].querySelector('[data-slot]');
    }
  }

  function setTarget(date) {
    target = date || null;
    render();
    if (timer) clearInterval(timer);
    if (target) timer = setInterval(render, 1000);
  }

  function remaining() {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    var ms = Math.max(0, target.getTime() - Date.now());
    return {
      days:    Math.floor(ms / 86400000),
      hours:   Math.floor(ms / 3600000) % 24,
      minutes: Math.floor(ms / 60000) % 60,
      seconds: Math.floor(ms / 1000) % 60
    };
  }

  function render() {
    var t = remaining();
    paint(slots.days,    pad(t.days));
    paint(slots.hours,   pad(t.hours));
    paint(slots.minutes, pad(t.minutes));
    paint(slots.seconds, pad(t.seconds));
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function paint(slot, text) {
    if (!slot) return;

    if (slot.childElementCount !== text.length) {
      slot.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var span = document.createElement('span');
        span.className = 'digit';
        span.textContent = text[i];
        slot.appendChild(span);
      }
      return;
    }

    for (var j = 0; j < text.length; j++) {
      var el = slot.children[j];
      if (el.textContent === text[j]) continue;
      el.textContent = text[j];
      el.classList.remove('is-tick');
      void el.offsetWidth;                 // restart the animation
      el.classList.add('is-tick');
    }
  }

  return { mount: mount, setTarget: setTarget };
})();
