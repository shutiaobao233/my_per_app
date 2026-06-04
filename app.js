const STORAGE_KEY = "my-period-tracker-v1";
const MONTH_WINDOW = 24;
const cnMonths = [
  "\u4e00\u6708",
  "\u4e8c\u6708",
  "\u4e09\u6708",
  "\u56db\u6708",
  "\u4e94\u6708",
  "\u516d\u6708",
  "\u4e03\u6708",
  "\u516b\u6708",
  "\u4e5d\u6708",
  "\u5341\u6708",
  "\u5341\u4e00\u6708",
  "\u5341\u4e8c\u6708",
];

const els = {
  scroller: document.querySelector("#monthScroller"),
  nextPeriod: document.querySelector("#nextPeriodLabel"),
  cycleLabel: document.querySelector("#cycleLabel"),
  periodLengthLabel: document.querySelector("#periodLengthLabel"),
  exportBackup: document.querySelector("#exportBackup"),
  importBackup: document.querySelector("#importBackup"),
  backupStatus: document.querySelector("#backupStatus"),
  backupFloat: document.querySelector("#backupFloat"),
  backupBubble: document.querySelector("#backupBubble"),
  backupMenu: document.querySelector("#backupMenu"),
  importPanel: document.querySelector("#importPanel"),
  backupText: document.querySelector("#backupText"),
  confirmImport: document.querySelector("#confirmImport"),
  cancelImport: document.querySelector("#cancelImport"),
};

let state = loadState();
let visibleDate = startOfMonth(new Date());
let scrollFrame = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.periodDays)) {
      return {
        periodDays: saved.periodDays,
      };
    }
  } catch {
    // Ignore invalid saved data and start fresh.
  }
  return { periodDays: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromKey(value);
  return toKey(date) === value;
}

function normalizePeriodDays(days) {
  if (!Array.isArray(days)) return null;
  const validDays = days.filter((day) => typeof day === "string" && isDateKey(day));
  return [...new Set(validDays)].sort();
}

function setBackupStatus(message) {
  els.backupStatus.textContent = message;
  window.clearTimeout(setBackupStatus.timer);
  setBackupStatus.timer = window.setTimeout(() => {
    els.backupStatus.textContent = "";
  }, 3500);
}

function getBackupText() {
  return JSON.stringify({
    app: "period-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    periodDays: state.periodDays,
  }, null, 2);
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Try the selection fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2px";
  textarea.style.height = "2px";
  textarea.style.padding = "0";
  textarea.style.border = "0";
  textarea.style.opacity = "0.01";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand && document.execCommand("copy");
  textarea.remove();
  return Boolean(copied);
}

function setImportPanelOpen(isOpen, text = "") {
  els.importPanel.hidden = !isOpen;
  if (isOpen) {
    els.backupText.value = text;
    window.setTimeout(() => els.backupText.focus(), 0);
  }
}

function setBackupMenuOpen(isOpen) {
  els.backupMenu.hidden = !isOpen;
  els.backupBubble.setAttribute("aria-expanded", String(isOpen));
}

function toggleBackupMenu() {
  setBackupMenuOpen(els.backupMenu.hidden);
}

function parseBackupText(text) {
  const parsed = JSON.parse(text);
  const periodDays = normalizePeriodDays(Array.isArray(parsed) ? parsed : parsed.periodDays);
  if (!periodDays) throw new Error("Invalid backup");
  return periodDays;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a, b) {
  return toKey(a) === toKey(b);
}

function formatDate(date) {
  return `${date.getMonth() + 1}\u6708${date.getDate()}\u65e5`;
}

function getCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  const totalDays = Math.ceil((mondayOffset + last.getDate()) / 7) * 7;
  const start = addDays(first, -mondayOffset);
  return Array.from({ length: totalDays }, (_, index) => addDays(start, index));
}

function getPeriodGroups() {
  const sorted = [...state.periodDays].sort();
  const groups = [];

  sorted.forEach((key, index) => {
    const previous = sorted[index - 1];
    if (!previous) {
      groups.push([key]);
      return;
    }

    const gap = (fromKey(key) - fromKey(previous)) / 86400000;
    if (gap > 1) {
      groups.push([key]);
    } else {
      groups[groups.length - 1].push(key);
    }
  });

  return groups;
}

function getPeriodStarts() {
  return getPeriodGroups().map((group) => group[0]);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getCycleStats() {
  const groups = getPeriodGroups();
  const starts = groups.map((group) => group[0]);
  const cycleGaps = starts.slice(1).map((key, index) => {
    return (fromKey(key) - fromKey(starts[index])) / 86400000;
  });
  const periodLengths = groups.map((group) => group.length);

  return {
    cycleLength: clamp(Math.round(average(cycleGaps) || 28), 18, 60),
    periodLength: clamp(Math.round(average(periodLengths) || 5), 1, 12),
    cycleSamples: cycleGaps.length,
    periodSamples: periodLengths.length,
  };
}

function formatStat(value) {
  return `${value} \u5929`;
}

function getPredictedKeys() {
  const starts = getPeriodStarts();
  if (!starts.length) return new Set();
  const stats = getCycleStats();

  let predictedStart = addDays(fromKey(starts[starts.length - 1]), stats.cycleLength);
  const lowerBound = addMonths(visibleDate, -MONTH_WINDOW);
  while (predictedStart < lowerBound) {
    predictedStart = addDays(predictedStart, stats.cycleLength);
  }

  const keys = new Set();
  for (let cycle = 0; cycle < MONTH_WINDOW * 3; cycle += 1) {
    const cycleStart = addDays(predictedStart, cycle * stats.cycleLength);
    if (cycleStart > addMonths(visibleDate, MONTH_WINDOW + 2)) break;
    for (let day = 0; day < stats.periodLength; day += 1) {
      keys.add(toKey(addDays(cycleStart, day)));
    }
  }
  return keys;
}

function updateSummary() {
  const stats = getCycleStats();
  els.cycleLabel.textContent = formatStat(stats.cycleLength);
  els.periodLengthLabel.textContent = formatStat(stats.periodLength);

  const starts = getPeriodStarts();
  if (!starts.length) {
    els.nextPeriod.textContent = "\u6807\u6ce8\u540e\u9884\u6d4b";
    return;
  }

  let next = addDays(fromKey(starts[starts.length - 1]), stats.cycleLength);
  const today = new Date();
  while (next < today) next = addDays(next, stats.cycleLength);
  els.nextPeriod.textContent = formatDate(next);
}

function buildDay(date, ownerMonth, predicted) {
  const key = toKey(date);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "day";
  button.textContent = date.getDate();
  button.dataset.date = key;
  button.setAttribute("aria-label", `${date.getFullYear()}\u5e74${date.getMonth() + 1}\u6708${date.getDate()}\u65e5`);

  if (date.getMonth() !== ownerMonth.getMonth()) button.classList.add("is-muted");
  if (state.periodDays.includes(key)) button.classList.add("is-period");
  if (predicted.has(key)) button.classList.add("is-predicted");
  if (sameDay(date, new Date())) button.classList.add("is-today");

  button.addEventListener("click", () => togglePeriodDay(key));
  return button;
}

function refreshCalendarMarks() {
  const predicted = getPredictedKeys();
  const periodDays = new Set(state.periodDays);

  els.scroller.querySelectorAll(".day").forEach((button) => {
    const key = button.dataset.date;
    button.classList.toggle("is-period", periodDays.has(key));
    button.classList.toggle("is-predicted", predicted.has(key));
  });
}

function buildMonthPanel(monthDate, predicted) {
  const panel = document.createElement("section");
  panel.className = "month-panel";
  panel.dataset.month = monthKey(monthDate);
  panel.setAttribute("aria-label", `${monthDate.getFullYear()}\u5e74${monthDate.getMonth() + 1}\u6708`);

  const heading = document.createElement("header");
  heading.className = "month-panel-heading";
  heading.innerHTML = `<strong>${cnMonths[monthDate.getMonth()]}</strong><span>${monthDate.getFullYear()}\u5e74</span>`;
  panel.appendChild(heading);

  const weekdays = document.createElement("div");
  weekdays.className = "month-weekdays";
  ["\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u65e5"].forEach((dayName) => {
    const item = document.createElement("span");
    item.textContent = dayName;
    weekdays.appendChild(item);
  });
  panel.appendChild(weekdays);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  getCalendarDays(monthDate).forEach((date) => {
    grid.appendChild(buildDay(date, monthDate, predicted));
  });
  panel.appendChild(grid);
  return panel;
}

function getClosestPanel() {
  const panels = [...els.scroller.querySelectorAll(".month-panel")];
  if (!panels.length) return null;

  const targetTop = els.scroller.scrollTop;
  let closest = panels[0];
  let closestDistance = Infinity;
  panels.forEach((panel) => {
    const distance = Math.abs(panel.offsetTop - targetTop);
    if (distance < closestDistance) {
      closest = panel;
      closestDistance = distance;
    }
  });

  return closest;
}

function getScrollAnchor() {
  const panel = getClosestPanel();
  if (!panel) return null;

  return {
    month: panel.dataset.month,
    offset: els.scroller.scrollTop - panel.offsetTop,
  };
}

function updateVisibleFromScroll() {
  const closest = getClosestPanel();
  if (!closest) return;

  const [year, month] = closest.dataset.month.split("-").map(Number);
  const nextVisible = new Date(year, month - 1, 1);
  if (monthKey(nextVisible) !== monthKey(visibleDate)) {
    visibleDate = nextVisible;
  }
}

function scheduleVisibleUpdate() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(updateVisibleFromScroll);
}

function scrollToMonth(monthDate, behavior = "smooth") {
  const target = els.scroller.querySelector(`[data-month="${monthKey(monthDate)}"]`);
  if (target) {
    els.scroller.scrollTo({ top: target.offsetTop, behavior });
  }
}

function togglePeriodDay(key) {
  const days = new Set(state.periodDays);
  if (days.has(key)) {
    days.delete(key);
  } else {
    days.add(key);
  }
  state.periodDays = [...days].sort();
  saveState();
  refreshCalendarMarks();
  updateSummary();
}

async function exportBackup() {
  const text = getBackupText();
  try {
    const copied = await copyText(text);
    if (copied) {
      setBackupStatus("\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f");
      setBackupMenuOpen(false);
      return;
    }
  } catch {
    // Fall through and show a failure message.
  }

  setBackupMenuOpen(false);
  setBackupStatus("\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u5728 Safari \u4e2d\u91cd\u8bd5");
}

function openImportPanel() {
  setBackupMenuOpen(false);
  setImportPanelOpen(true);
}

function confirmImportBackup() {
  try {
    const periodDays = parseBackupText(els.backupText.value.trim());
    state = { periodDays };
    saveState();
    visibleDate = startOfMonth(new Date());
    render();
    setImportPanelOpen(false);
    setBackupStatus("\u5df2\u5bfc\u5165");
  } catch {
    setBackupStatus("\u5907\u4efd\u6570\u636e\u65e0\u6cd5\u8bc6\u522b");
  }
}

function cancelImportBackup() {
  setImportPanelOpen(false);
  setBackupStatus("");
}

function render(options = {}) {
  const keepScroll = Boolean(options.keepScroll);
  const anchor = keepScroll ? getScrollAnchor() : null;
  if (anchor) {
    const [year, month] = anchor.month.split("-").map(Number);
    visibleDate = new Date(year, month - 1, 1);
  }

  const predicted = getPredictedKeys();
  cancelAnimationFrame(scrollFrame);
  els.scroller.innerHTML = "";

  for (let offset = -MONTH_WINDOW; offset <= MONTH_WINDOW; offset += 1) {
    els.scroller.appendChild(buildMonthPanel(addMonths(visibleDate, offset), predicted));
  }

  updateSummary();

  requestAnimationFrame(() => {
    if (anchor) {
      const target = els.scroller.querySelector(`[data-month="${anchor.month}"]`);
      if (target) {
        els.scroller.scrollTop = target.offsetTop + anchor.offset;
      }
    } else {
      scrollToMonth(visibleDate, "auto");
    }
    updateVisibleFromScroll();
  });
}

els.scroller.addEventListener("scroll", scheduleVisibleUpdate, { passive: true });
els.backupBubble.addEventListener("click", toggleBackupMenu);
els.exportBackup.addEventListener("click", exportBackup);
els.importBackup.addEventListener("click", openImportPanel);
els.confirmImport.addEventListener("click", confirmImportBackup);
els.cancelImport.addEventListener("click", cancelImportBackup);

try {
  render();
} catch (error) {
  console.error(error);
  els.scroller.innerHTML = `<div class="empty-state">\u65e5\u5386\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u91cd\u8bd5</div>`;
}
