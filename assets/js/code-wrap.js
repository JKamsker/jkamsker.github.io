/**
 * Smart inline code wrapping
 *
 * Measures the actual available width for each inline <code> element,
 * calculates how many monospace characters fit per line, then inserts
 * <wbr> tags at reasonable break points (delimiters, camelCase boundaries).
 * Falls back to a hard break at the computed max length.
 *
 * Config via data-attributes on <body> or the script tag:
 *   data-code-wrap-max="38"   – fallback max chars when measurement fails
 */
(function () {
  "use strict";

  var FALLBACK_MAX = 38;
  var SELECTOR = ".post-content code:not(pre code)";

  // Characters after which a break is acceptable
  var BREAK_AFTER = "._-/\\,=:;!?&|({>";

  // ── Helpers ──────────────────────────────────────────────

  /** Measure the width of one monospace character inside `el`. */
  function charWidth(el) {
    var probe = document.createElement("span");
    var cs = window.getComputedStyle(el);
    probe.style.font = cs.font;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontFamily = cs.fontFamily;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.visibility = "hidden";
    probe.style.position = "absolute";
    probe.style.whiteSpace = "nowrap";
    probe.textContent = "MMMMMMMMMM"; // 10 chars – average for stability
    document.body.appendChild(probe);
    var w = probe.getBoundingClientRect().width / 10;
    document.body.removeChild(probe);
    return w;
  }

  /** Return how many characters fit in one line for this code element. */
  function maxCharsFor(el) {
    var cw = charWidth(el);
    if (!cw || cw <= 0) return FALLBACK_MAX;

    var parent = el.parentElement;
    if (!parent) return FALLBACK_MAX;

    var ps = window.getComputedStyle(parent);
    var parentWidth =
      parent.clientWidth -
      parseFloat(ps.paddingLeft) -
      parseFloat(ps.paddingRight);

    var cs = window.getComputedStyle(el);
    var codePad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    // small margin/border buffer
    var codeBorder =
      parseFloat(cs.borderLeftWidth || 0) +
      parseFloat(cs.borderRightWidth || 0) +
      parseFloat(cs.marginLeft || 0) +
      parseFloat(cs.marginRight || 0);

    var available = parentWidth - codePad - codeBorder;
    var max = Math.floor(available / cw);
    return max > 4 ? max : FALLBACK_MAX;
  }

  // ── Break-point logic ────────────────────────────────────

  /**
   * Return an array of indices in `text` where a <wbr> should be inserted.
   *
   * Strategy per chunk of `maxLen` characters:
   *   1. Scan right-to-left from the end of the chunk looking for a
   *      "nice" break point (delimiter char or camelCase boundary).
   *      Only search back to 40 % of the chunk so we don't produce
   *      extremely short first segments.
   *   2. If no nice point is found, hard-break at `maxLen`.
   */
  function breakPoints(text, maxLen) {
    var pts = [];
    var pos = 0;

    while (pos < text.length) {
      // Remaining text fits → done
      if (pos + maxLen >= text.length) break;

      var chunk = text.substring(pos, pos + maxLen);
      var bp = -1;
      var minScan = Math.floor(chunk.length * 0.4);

      for (var i = chunk.length - 1; i >= minScan; i--) {
        var ch = chunk[i];

        // Break *after* a delimiter character
        if (BREAK_AFTER.indexOf(ch) !== -1) {
          bp = i + 1;
          break;
        }

        // Break at camelCase boundary (between lower → upper)
        if (
          i > 0 &&
          chunk[i - 1] >= "a" &&
          chunk[i - 1] <= "z" &&
          chunk[i] >= "A" &&
          chunk[i] <= "Z"
        ) {
          bp = i;
          break;
        }
      }

      if (bp <= 0) bp = maxLen; // hard fallback

      var abs = pos + bp;
      if (abs < text.length) pts.push(abs);
      pos = abs;
    }

    return pts;
  }

  // ── DOM manipulation ─────────────────────────────────────

  function processElement(el) {
    var text = el.textContent;
    if (!text) return;

    var max = maxCharsFor(el);
    if (text.length <= max) return; // already fits

    var pts = breakPoints(text, max);
    if (pts.length === 0) return;

    // Build a document fragment with text nodes + <wbr> elements
    var frag = document.createDocumentFragment();
    var last = 0;

    for (var j = 0; j < pts.length; j++) {
      frag.appendChild(document.createTextNode(text.substring(last, pts[j])));
      frag.appendChild(document.createElement("wbr"));
      last = pts[j];
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.substring(last)));
    }

    el.textContent = "";
    el.appendChild(frag);
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    // Allow override via data attribute on body
    var attr = document.body.getAttribute("data-code-wrap-max");
    if (attr) FALLBACK_MAX = parseInt(attr, 10) || FALLBACK_MAX;

    var els = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < els.length; i++) {
      processElement(els[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
