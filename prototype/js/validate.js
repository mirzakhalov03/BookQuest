/* ============================================================
   Validation
   The rule of the house: never tell someone their input is
   "invalid". Tell them what a good answer looks like.
   ============================================================ */

window.BQ = window.BQ || {};

BQ.validate = (function () {

  var VOWELS = /[aeiouyаеёиоуыэюяàáâãäåèéêëìíîïòóôõöùúûüýÿœæ]/i;
  var LETTER = /[\p{L}]/u;
  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

  /* Four or more keys typed straight along one keyboard row. */
  function isKeyboardRun(word) {
    var w = word.toLowerCase();
    for (var r = 0; r < ROWS.length; r++) {
      var row = ROWS[r];
      var back = row.split('').reverse().join('');
      for (var i = 0; i + 4 <= w.length; i++) {
        var chunk = w.slice(i, i + 4);
        if (row.indexOf(chunk) !== -1 || back.indexOf(chunk) !== -1) return true;
      }
    }
    return false;
  }

  function looksLikeMashing(word) {
    var w = word.toLowerCase();
    if (!VOWELS.test(w)) return true;                 // no vowel at all
    if (/([\p{L}])\1{2,}/u.test(w)) return true;      // aaa, ooo
    if (isKeyboardRun(w)) return true;                // asdf, qwer

    var consonantRun = 0, vowelRun = 0, i, ch;
    for (i = 0; i < w.length; i++) {
      ch = w[i];
      if (!LETTER.test(ch)) continue;
      if (VOWELS.test(ch)) { vowelRun++; consonantRun = 0; }
      else { consonantRun++; vowelRun = 0; }
      if (consonantRun >= 5 || vowelRun >= 4) return true;
    }

    /* Almost no vowels across a long word reads as noise.
       Counted with the full vowel set so Cyrillic names pass. */
    var vowelCount = 0;
    for (i = 0; i < w.length; i++) if (VOWELS.test(w[i])) vowelCount++;
    if (w.length >= 5 && vowelCount / w.length < 0.18) return true;

    return false;
  }

  /* "sofia   karimova" → "Sofia Karimova", "o'brien" → "O'Brien" */
  function titleCase(word) {
    return word
      .toLowerCase()
      .replace(/(^|[-'’])(\p{L})/gu, function (_, sep, ch) { return sep + ch.toUpperCase(); })
      .replace(/^Mc(\p{L})/u, function (_, ch) { return 'Mc' + ch.toUpperCase(); });
  }

  function fullName(raw) {
    var value = (raw || '').replace(/\s+/g, ' ').trim();

    if (!value) {
      return bad('Your name goes on the certificate — add it here.');
    }
    if (/\d/.test(value)) {
      return bad('Names don’t have numbers in them.');
    }
    if (/[^\p{L}\s'’-]/u.test(value)) {
      return bad('Letters, hyphens and apostrophes only.');
    }

    var words = value.split(' ').filter(Boolean);

    if (words.length < 2) {
      return bad('Please enter your first and last name.');
    }
    if (words.length > 2) {
      return bad('First and last name is enough — two words.');
    }
    if (words.some(function (w) { return w.replace(/[^\p{L}]/gu, '').length < 2; })) {
      return bad('Both names need at least two letters.');
    }
    if (words.some(looksLikeMashing)) {
      return bad('That doesn’t look like a name yet. Try your real one.');
    }

    return good(words.map(titleCase).join(' '), 'Looks good.');
  }

  var TELEGRAM = /^[a-z][a-z0-9_]{3,30}[a-z0-9]$/i;

  function telegram(raw) {
    var value = (raw || '').trim().replace(/^@+/, '');

    if (!value) return bad('Add the username people find you by on Telegram.');
    if (value.length < 5)  return bad('Telegram usernames are at least 5 characters.');
    if (value.length > 32) return bad('That’s longer than a Telegram username can be.');
    if (!TELEGRAM.test(value)) {
      return bad('Usernames use letters, numbers and underscores, starting with a letter.');
    }
    return good('@' + value, 'We’ll message you here when the quiz opens.');
  }

  function phone(raw) {
    var digits = (raw || '').replace(/\D/g, '');

    if (!digits) return bad('Add a number we can reach you on.');
    if (digits.length < 9)  return bad('That number looks a few digits short.');
    if (digits.length > 15) return bad('That number has a few digits too many.');

    return good(prettyPhone(digits), 'We’ll text you when the quiz opens.');
  }

  /* Uzbek numbers get proper grouping. Every other country keeps the
     digits exactly as given — inventing groups for an unknown format
     is worse than showing none. */
  function prettyPhone(digits) {
    var d = digits;
    if (d.length === 9 && /^[1-9]/.test(d)) d = '998' + d;          // local, no country code
    return groupUz(d) || ('+' + d);
  }

  function groupUz(d) {
    if (d.indexOf('998') !== 0) return null;
    var rest = d.slice(3, 12);
    var cuts = [2, 5, 7, 9];
    var out = '+998', prev = 0;
    for (var i = 0; i < cuts.length && prev < rest.length; i++) {
      out += ' ' + rest.slice(prev, cuts[i]);
      prev = cuts[i];
    }
    return out.trim();
  }

  /* Formatting while typing only where the format is known, so the
     field never rewrites a number it does not understand. */
  function livePhone(raw) {
    var digits = (raw || '').replace(/\D/g, '');
    if (digits.indexOf('998') !== 0) return raw;
    return groupUz(digits);
  }

  function bad(message)         { return { ok: false, message: message }; }
  function good(value, message) { return { ok: true, value: value, message: message }; }

  return {
    fullName: fullName,
    telegram: telegram,
    phone: phone,
    livePhone: livePhone
  };
})();
