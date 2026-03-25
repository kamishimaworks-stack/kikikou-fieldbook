// app.js — Main application controller for 器高式野帳
"use strict";

var App = (function () {
  // --- Module state ---
  var _currentFile = null;
  var _deletedRow = null;
  var _deletedRowIndex = -1;
  var _toastTimer = null;
  var _showIH = true;

  // ===== Utility =====

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    if (str === null || str === undefined) { return ""; }
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ===== Init =====

  function init() {
    Keypad.init();
    _bindFileListEvents();
    _bindEditorEvents();
    _bindAutoSave();
    showFileList();
  }

  // ===== View Switching =====

  function showFileList() {
    _currentFile = null;
    document.getElementById("view-file-list").classList.remove("hidden");
    document.getElementById("view-editor").classList.add("hidden");
    _renderFileList();
  }

  function showEditor(fileId) {
    var file = loadFile(fileId);
    if (!file) { return; }
    var isNewFile = file.rows.length === 0;
    _currentFile = file;

    // Change 2: Fill empty (newly created) file with enough rows for one screen
    if (isNewFile) {
      var rowCount = Math.max(5, Math.floor((window.innerHeight - 200) / 44));
      for (var r = 0; r < rowCount; r++) {
        _currentFile.rows.push(createRow());
      }
    }

    document.getElementById("view-file-list").classList.add("hidden");
    document.getElementById("view-editor").classList.remove("hidden");
    document.getElementById("editor-title").textContent = _currentFile.name;
    _updateIHButton();
    _recalcAndRender();

    // Change 3: Scroll to bottom for existing files with data
    if (!isNewFile) {
      var hasData = _currentFile.rows.some(function (row) {
        return row.point !== "" || isNum(row.bs) || isNum(row.fs) ||
               isNum(row.gh) || isNum(row.fh);
      });
      if (hasData) {
        var wrapper = document.querySelector('.table-wrapper');
        if (wrapper) {
          wrapper.scrollTop = wrapper.scrollHeight;
        }
      }
    }
  }

  // ===== File List Rendering =====

  function _renderFileList() {
    var container = document.getElementById("file-list-container");
    var files = getFileList();

    if (files.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">&#128203;</div>' +
          '<p>ファイルがありません</p>' +
          '<p>「＋ 新規作成」で始めましょう</p>' +
        '</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var date = new Date(f.updatedAt || f.createdAt).toLocaleDateString("ja-JP");
      var mode = f.displayMode === "mm" ? "プラマイ(mm)" : "地盤高(m)";
      var rowCount = Array.isArray(f.rows) ? f.rows.length : 0;

      html +=
        '<div class="file-card" data-id="' + _escapeHtml(f.id) + '">' +
          '<div class="file-card-info">' +
            '<h3>' + _escapeHtml(f.name) + '</h3>' +
            '<p>' + _escapeHtml(date) + ' ・ ' + mode + ' ・ ' + rowCount + '行</p>' +
          '</div>' +
          '<div class="file-actions">' +
            '<button class="btn-rename" data-id="' + _escapeHtml(f.id) + '">名前変更</button>' +
            '<button class="btn-delete" data-id="' + _escapeHtml(f.id) + '">削除</button>' +
          '</div>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  // ===== File List Events =====

  function _bindFileListEvents() {
    // Delegate clicks on file list container
    document.getElementById("file-list-container").addEventListener("click", function (e) {
      var card = e.target.closest(".file-card");
      if (!card) { return; }

      // Check if an action button was clicked
      if (e.target.closest(".file-actions")) {
        var btn = e.target.closest("button");
        if (!btn) { return; }
        var id = btn.dataset.id;

        if (btn.classList.contains("btn-rename")) {
          var currentFile = loadFile(id);
          var currentName = currentFile ? currentFile.name : "";
          var newName = prompt("新しい現場名を入力してください", currentName);
          if (newName !== null && newName.trim() !== "") {
            renameFile(id, newName.trim());
            _renderFileList();
          }
        } else if (btn.classList.contains("btn-delete")) {
          var fileToDelete = loadFile(id);
          if (fileToDelete && confirm("「" + fileToDelete.name + "」を削除しますか？")) {
            deleteFile(id);
            _renderFileList();
          }
        }
        return;
      }

      // Open file in editor
      showEditor(card.dataset.id);
    });

    // New file dialog: open
    document.getElementById("btn-new-file").addEventListener("click", function () {
      document.getElementById("input-file-name").value = "";
      // Reset radio to default (m)
      var defaultRadio = document.querySelector('input[name="unit"][value="m"]');
      if (defaultRadio) { defaultRadio.checked = true; }
      document.getElementById("dialog-new-file").classList.remove("hidden");
    });

    // New file dialog: cancel
    document.getElementById("btn-dialog-cancel").addEventListener("click", function () {
      document.getElementById("dialog-new-file").classList.add("hidden");
    });

    // New file dialog: confirm
    document.getElementById("btn-dialog-confirm").addEventListener("click", function () {
      var nameInput = document.getElementById("input-file-name");
      var name = nameInput.value.trim();
      if (!name) {
        alert("現場名を入力してください");
        return;
      }
      var selectedRadio = document.querySelector('input[name="unit"]:checked');
      var mode = selectedRadio ? selectedRadio.value : "m";
      var file = createFile(name, mode);
      document.getElementById("dialog-new-file").classList.add("hidden");
      showEditor(file.id);
    });
  }

  // ===== Editor Events =====

  function _bindEditorEvents() {
    // Back button: save and return to file list
    document.getElementById("btn-back").addEventListener("click", function () {
      _saveCurrentFile();
      showFileList();
    });

    // Save button: save and show toast
    document.getElementById("btn-save").addEventListener("click", function () {
      _saveCurrentFile();
      _showToast("保存しました");
    });

    // Clear button: confirm, reset to one empty row
    document.getElementById("btn-clear").addEventListener("click", function () {
      if (!_currentFile) { return; }
      if (confirm("すべてのデータをクリアしますか？")) {
        _currentFile.rows = [createRow()];
        _recalcAndRender();
        _saveCurrentFile();
      }
    });

    // Add row button
    document.getElementById("btn-add-row").addEventListener("click", function () {
      if (!_currentFile) { return; }
      _currentFile.rows.push(createRow());
      _recalcAndRender();
      _saveCurrentFile();
    });

    // IH column toggle
    document.getElementById("btn-toggle-ih").addEventListener("click", function () {
      _showIH = !_showIH;
      _updateIHButton();
      _recalcAndRender();
    });
  }

  function _updateIHButton() {
    document.getElementById("btn-toggle-ih").classList.toggle("active", _showIH);
  }

  // ===== Table Rendering =====

  function _recalcAndRender() {
    if (!_currentFile) { return; }
    _currentFile.rows = recalculate(_currentFile.rows);
    _renderTable();
  }

  function _renderTable() {
    var tbody = document.getElementById("table-body");
    var mode = _currentFile.displayMode;
    var rows = _currentFile.rows;
    var html = "";
    // Update thead IH column visibility
    var thIH = document.getElementById("th-ih");
    if (thIH) {
      thIH.style.display = _showIH ? "" : "none";
    }

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var manual = Array.isArray(row.manualFields) ? row.manualFields : [];

      html += '<tr data-row-id="' + _escapeHtml(row.id) + '" data-row-index="' + i + '">';

      // Column 1: Point (text input, native keyboard)
      html +=
        '<td class="sticky-col">' +
          '<input class="cell-input" type="text"' +
          ' data-field="point" data-row="' + i + '"' +
          ' value="' + _escapeHtml(row.point) + '">' +
        '</td>';

      // Column 2: BS (keypad)
      html += _renderKeypadCell(row, i, "bs", manual, mode);

      // Column 3: IH (computed, readonly) — conditionally shown
      if (_showIH) {
        html += '<td class="computed">' + formatValue(row.ih, mode) + '</td>';
      }

      // Column 4: FS (keypad)
      html += _renderKeypadCell(row, i, "fs", manual, mode);

      // Column 5: GH (keypad, can be manual or computed)
      html += _renderKeypadCell(row, i, "gh", manual, mode);

      // Column 6: FH (keypad)
      html += _renderKeypadCell(row, i, "fh", manual, mode);

      // Column 7: Diff (computed, readonly)
      var diffStr = formatValue(row.diff, mode);
      var diffClass = "computed";
      if (row.diff !== null && row.diff !== undefined) {
        if (row.diff > 0) {
          diffClass += " diff-plus";
        } else if (row.diff < 0) {
          diffClass += " diff-minus";
        }
      }
      html += '<td class="' + diffClass + '">' + diffStr + '</td>';

      html += '</tr>';
    }

    tbody.innerHTML = html;
    _bindCellEvents();
  }

  /**
   * Render a single keypad-activated cell (div, not input).
   */
  function _renderKeypadCell(row, rowIndex, field, manual, mode) {
    var value = row[field];
    var display = formatValue(value, mode);
    var isManual = manual.indexOf(field) !== -1;
    var cls = "cell-input" + (isManual ? " manual" : "");
    return (
      '<td>' +
        '<div class="' + cls + '"' +
        ' data-field="' + field + '"' +
        ' data-row="' + rowIndex + '"' +
        ' tabindex="0">' +
          display +
        '</div>' +
      '</td>'
    );
  }

  // ===== Cell Events =====

  function _bindCellEvents() {
    _bindKeypadCells();
    _bindPointInputs();
    _bindRowGestures();
  }

  /**
   * Numeric cells (div elements) open the custom keypad on click.
   */
  function _bindKeypadCells() {
    var cells = document.querySelectorAll("#table-body div.cell-input[data-field]");
    for (var c = 0; c < cells.length; c++) {
      cells[c].addEventListener("click", _onKeypadCellClick);
    }
  }

  function _onKeypadCellClick() {
    var el = this;
    var rowIndex = parseInt(el.dataset.row, 10);
    var field = el.dataset.field;
    if (!_currentFile || rowIndex < 0 || rowIndex >= _currentFile.rows.length) { return; }

    var row = _currentFile.rows[rowIndex];
    var mode = _currentFile.displayMode;
    var currentDisplay = formatValue(row[field], mode);

    // Scroll cell into view above keypad
    el.scrollIntoView({ block: "center", behavior: "smooth" });

    Keypad.show(currentDisplay, function (resultStr) {
      var parsed = parseInput(resultStr, mode);
      row[field] = parsed;

      // Update manualFields: add if value entered, remove if cleared
      var mf = Array.isArray(row.manualFields) ? row.manualFields.slice() : [];
      var idx = mf.indexOf(field);
      if (parsed !== null) {
        if (idx === -1) { mf.push(field); }
      } else {
        if (idx !== -1) { mf.splice(idx, 1); }
      }
      row.manualFields = mf;

      _recalcAndRender();
      _saveCurrentFile();
    });
  }

  /**
   * Point cells use native text input with change event.
   */
  function _bindPointInputs() {
    var inputs = document.querySelectorAll('#table-body input[data-field="point"]');
    for (var p = 0; p < inputs.length; p++) {
      inputs[p].addEventListener("change", _onPointChange);
    }
  }

  function _onPointChange() {
    var rowIndex = parseInt(this.dataset.row, 10);
    if (_currentFile && rowIndex >= 0 && rowIndex < _currentFile.rows.length) {
      _currentFile.rows[rowIndex].point = this.value;
      _saveCurrentFile();
    }
  }

  // ===== Row Long Press: Context Menu (add above/below, delete) =====

  function _bindRowGestures() {
    var dataRows = document.querySelectorAll("#table-body tr[data-row-id]");
    for (var r = 0; r < dataRows.length; r++) {
      _attachRowGesture(dataRows[r]);
    }
  }

  function _attachRowGesture(el) {
    var timer = null;
    var moved = false;

    el.addEventListener("touchstart", function (e) {
      moved = false;
      timer = setTimeout(function () {
        if (!moved) {
          _showRowMenu(el);
        }
      }, 500);
    }, { passive: true });

    el.addEventListener("touchmove", function () {
      moved = true;
      clearTimeout(timer);
    }, { passive: true });

    el.addEventListener("touchend", function () {
      clearTimeout(timer);
    }, { passive: true });
  }

  function _showRowMenu(rowEl) {
    var rowId = rowEl.dataset.rowId;
    var rowIndex = parseInt(rowEl.dataset.rowIndex, 10);
    if (!_currentFile) { return; }

    // Remove existing menu
    var old = document.getElementById("row-context-menu");
    if (old) { old.remove(); }

    var menu = document.createElement("div");
    menu.id = "row-context-menu";
    menu.className = "insert-menu";

    var btnAbove = document.createElement("button");
    btnAbove.textContent = "↑ 上に行を追加";
    btnAbove.addEventListener("click", function () {
      menu.remove();
      _currentFile.rows.splice(rowIndex, 0, createRow());
      _recalcAndRender();
      _saveCurrentFile();
    });

    var btnBelow = document.createElement("button");
    btnBelow.textContent = "↓ 下に行を追加";
    btnBelow.addEventListener("click", function () {
      menu.remove();
      _currentFile.rows.splice(rowIndex + 1, 0, createRow());
      _recalcAndRender();
      _saveCurrentFile();
    });

    var btnDelete = document.createElement("button");
    btnDelete.textContent = "この行を削除";
    btnDelete.style.color = "var(--color-diff-minus)";
    btnDelete.addEventListener("click", function () {
      menu.remove();
      _deleteRowById(rowId);
    });

    menu.appendChild(btnAbove);
    menu.appendChild(btnBelow);
    menu.appendChild(btnDelete);

    // Position near the row
    var rect = rowEl.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = Math.max(10, (rect.left + rect.right) / 2 - 80) + "px";
    menu.style.top = Math.min(rect.bottom, window.innerHeight - 160) + "px";
    document.body.appendChild(menu);

    // Close on tap outside
    setTimeout(function () {
      document.addEventListener("click", function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 10);
  }

  /**
   * Delete a row by ID with undo support.
   * Minimum 1 row enforced.
   */
  function _deleteRowById(rowId) {
    if (!_currentFile) { return; }
    var rows = _currentFile.rows;
    var index = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === rowId) { index = i; break; }
    }
    if (index === -1) { return; }
    if (rows.length <= 1) {
      _showToast("最後の行は削除できません");
      return;
    }

    // Deep-copy the deleted row for undo
    var removed = rows[index];
    _deletedRow = {
      id: removed.id,
      point: removed.point,
      bs: removed.bs,
      fs: removed.fs,
      gh: removed.gh,
      fh: removed.fh,
      ih: removed.ih,
      diff: removed.diff,
      manualFields: Array.isArray(removed.manualFields) ? removed.manualFields.slice() : []
    };
    _deletedRowIndex = index;

    rows.splice(index, 1);
    _recalcAndRender();
    _saveCurrentFile();

    _showToast("行を削除しました", _undoDeleteRow);
  }

  function _undoDeleteRow() {
    if (!_currentFile || !_deletedRow) { return; }
    _currentFile.rows.splice(_deletedRowIndex, 0, _deletedRow);
    _deletedRow = null;
    _deletedRowIndex = -1;
    _recalcAndRender();
    _saveCurrentFile();
  }

  // ===== Auto-save =====

  function _bindAutoSave() {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        _saveCurrentFile();
      }
    });
  }

  function _saveCurrentFile() {
    if (_currentFile) {
      saveFile(_currentFile);
    }
  }

  // ===== Toast =====

  /**
   * Show a toast notification.
   * @param {string} message - Toast message text
   * @param {Function} [onUndo] - If provided, shows an undo button
   */
  function _showToast(message, onUndo) {
    var toast = document.getElementById("toast");
    if (_toastTimer) {
      clearTimeout(_toastTimer);
      _toastTimer = null;
    }

    var html = _escapeHtml(message);
    if (typeof onUndo === "function") {
      html += '<button class="toast-undo" id="toast-undo-btn">元に戻す</button>';
    }
    toast.innerHTML = html;
    toast.classList.remove("hidden");

    if (typeof onUndo === "function") {
      var undoBtn = document.getElementById("toast-undo-btn");
      if (undoBtn) {
        undoBtn.addEventListener("click", function () {
          onUndo();
          toast.classList.add("hidden");
          if (_toastTimer) {
            clearTimeout(_toastTimer);
            _toastTimer = null;
          }
        });
      }
    }

    _toastTimer = setTimeout(function () {
      toast.classList.add("hidden");
      _deletedRow = null;
      _deletedRowIndex = -1;
      _toastTimer = null;
    }, 5000);
  }

  // ===== Public API =====
  return { init: init };
})();

document.addEventListener("DOMContentLoaded", App.init);
