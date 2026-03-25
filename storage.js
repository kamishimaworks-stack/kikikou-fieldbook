"use strict";

const STORAGE_KEY = "kikikou_fieldbook_data";

/**
 * Load all files from LocalStorage.
 * @returns {{ files: Object.<string, Object> }} Data object with files map
 */
function loadAllFiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { files: {} };
    }
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || typeof parsed.files !== "object") {
      return { files: {} };
    }
    return parsed;
  } catch (e) {
    console.error("loadAllFiles: failed to parse storage data", e);
    return { files: {} };
  }
}

/**
 * Save entire data object to LocalStorage.
 * Shows alert on failure (e.g. storage full).
 * @param {{ files: Object.<string, Object> }} data
 */
function saveAllFiles(data) {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error("saveAllFiles: failed to save", e);
    alert("データの保存に失敗しました。ストレージの容量が不足している可能性があります。");
  }
}

/**
 * Get sorted file list (newest updatedAt first).
 * @returns {Array<Object>} Sorted array of file objects
 */
function getFileList() {
  const data = loadAllFiles();
  const files = Object.values(data.files);
  files.sort(function (a, b) {
    const dateA = new Date(a.updatedAt || a.createdAt || 0);
    const dateB = new Date(b.updatedAt || b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });
  return files;
}

/**
 * Create a new file with name and displayMode, save to storage, return it.
 * Starts with empty rows array (app.js fills rows to fit screen).
 * @param {string} name - File name (e.g. "現場名A")
 * @param {string} displayMode - "m" or "mm"
 * @returns {Object} The newly created file object
 */
function createFile(name, displayMode) {
  const now = new Date().toISOString();
  const file = {
    id: (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: name,
    displayMode: displayMode,
    createdAt: now,
    updatedAt: now,
    rows: []
  };

  const data = loadAllFiles();
  data.files[file.id] = file;
  saveAllFiles(data);
  return file;
}

/**
 * Load a single file by ID.
 * @param {string} fileId
 * @returns {Object|null} The file object or null if not found
 */
function loadFile(fileId) {
  const data = loadAllFiles();
  return data.files[fileId] || null;
}

/**
 * Save a single file (update updatedAt, save to storage).
 * @param {Object} file - The file object to save
 */
function saveFile(file) {
  const data = loadAllFiles();
  const updated = Object.assign({}, file, {
    updatedAt: new Date().toISOString()
  });
  data.files[updated.id] = updated;
  saveAllFiles(data);
}

/**
 * Delete a file by ID.
 * @param {string} fileId
 */
function deleteFile(fileId) {
  const data = loadAllFiles();
  delete data.files[fileId];
  saveAllFiles(data);
}

/**
 * Rename a file.
 * @param {string} fileId
 * @param {string} newName
 */
function renameFile(fileId, newName) {
  const data = loadAllFiles();
  const file = data.files[fileId];
  if (!file) {
    console.error("renameFile: file not found", fileId);
    return;
  }
  const updated = Object.assign({}, file, {
    name: newName,
    updatedAt: new Date().toISOString()
  });
  data.files[fileId] = updated;
  saveAllFiles(data);
}
