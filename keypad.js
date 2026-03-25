"use strict";

// keypad.js — Custom numeric keypad for 器高式野帳
// Replaces native keyboard for touch-friendly numeric input.

// eslint-disable-next-line no-unused-vars
const Keypad = (function () {
  let _value = "";
  let _isNegative = false;
  let _onConfirm = null;
  let _displayEl = null;
  let _overlayEl = null;

  /**
   * Initialise the keypad: cache DOM refs and bind event listeners.
   * Must be called once after DOMContentLoaded.
   */
  function init() {
    _overlayEl = document.getElementById("keypad-overlay");
    _displayEl = document.getElementById("keypad-display");

    if (!_overlayEl || !_displayEl) {
      console.error("Keypad: required DOM elements not found");
      return;
    }

    // --- Digit / dot / backspace keys ---
    var keys = _overlayEl.querySelectorAll(".keypad-key");
    keys.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var key = btn.getAttribute("data-key");
        _handleKey(key);
      });
    });

    // --- Sign toggle (+/−) ---
    var signBtn = document.getElementById("btn-sign");
    if (signBtn) {
      signBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        _isNegative = !_isNegative;
        _updateDisplay();
      });
    }

    // --- Done (完了) ---
    var doneBtn = document.getElementById("btn-done");
    if (doneBtn) {
      doneBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof _onConfirm === "function") {
          _onConfirm(_getFullValue());
        }
        hide();
      });
    }

    // --- Overlay background click → cancel ---
    _overlayEl.addEventListener("click", function (e) {
      // Only cancel when clicking the overlay itself, not the keypad panel
      if (e.target === _overlayEl) {
        hide();
      }
    });
  }

  /**
   * Show the keypad overlay.
   * @param {string} currentValue — current cell value (e.g. "-12.345" or "")
   * @param {function} onConfirm  — called with the value string on Done
   */
  function show(currentValue, onConfirm) {
    _onConfirm = typeof onConfirm === "function" ? onConfirm : null;

    // Parse currentValue into sign + absolute digits
    var str = currentValue != null ? String(currentValue).trim() : "";
    if (str.startsWith("-")) {
      _isNegative = true;
      str = str.slice(1);
    } else {
      _isNegative = false;
    }
    // Remove any leading "+" if present
    if (str.startsWith("+")) {
      str = str.slice(1);
    }
    _value = str;

    // Reveal overlay
    if (_overlayEl) {
      _overlayEl.classList.remove("hidden");
    }
    _updateDisplay();
  }

  /**
   * Hide the keypad overlay and reset callback.
   */
  function hide() {
    if (_overlayEl) {
      _overlayEl.classList.add("hidden");
    }
    _onConfirm = null;
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Handle a key press from the keypad grid.
   * @param {string} key — digit, ".", or "⌫"
   */
  function _handleKey(key) {
    if (key === "⌫") {
      // Backspace: remove last character
      _value = _value.slice(0, -1);
    } else if (key === ".") {
      // Decimal point: add only if not already present
      if (_value.indexOf(".") === -1) {
        _value += ".";
      }
    } else {
      // Digit key
      _value += key;
    }
    _updateDisplay();
  }

  /**
   * Build the full value string including sign.
   * Returns "" when _value is empty.
   * @returns {string}
   */
  function _getFullValue() {
    if (_value === "" || _value === ".") {
      return "";
    }
    return (_isNegative ? "-" : "") + _value;
  }

  /**
   * Update the display element text.
   * Shows "0" when the value is empty.
   */
  function _updateDisplay() {
    if (!_displayEl) {
      return;
    }
    var display = _getFullValue();
    _displayEl.textContent = display === "" ? "0" : display;
  }

  return { init: init, show: show, hide: hide };
})();
