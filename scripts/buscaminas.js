const boardEl = document.getElementById('board');
const mineCountEl = document.getElementById('mineCount');
const timerEl = document.getElementById('timer');
const resetBtn = document.getElementById('resetBtn');

const levels = {
  beginner: { rows: 9, cols: 9, mines: 10 }
};

let state = null;
let timerId = null;
let startTime = null;

function pad(num) {
  return String(num).padStart(3, '0');
}

function getLevel() {
  return levels.beginner;
}

function createState(level) {
  const { rows, cols, mines } = level;
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      count: 0
    }))
  );

  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!cells[r][c].mine) {
      cells[r][c].mine = true;
      placed++;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr][nc].mine) {
            count++;
          }
        }
      }
      cells[r][c].count = count;
    }
  }

  return {
    rows,
    cols,
    mines,
    flagsLeft: mines,
    revealedCount: 0,
    over: false,
    cells
  };
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 24px)`;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('click', onReveal);
      cell.addEventListener('contextmenu', onFlag);
      boardEl.appendChild(cell);
    }
  }

  updateCounters();
}

function updateCounters() {
  mineCountEl.textContent = pad(Math.max(0, state.flagsLeft));
  timerEl.textContent = pad(getElapsedSeconds());
}

function getElapsedSeconds() {
  if (!startTime) return 0;
  return Math.min(999, Math.floor((Date.now() - startTime) / 1000));
}

function startTimer() {
  if (timerId) return;
  startTime = Date.now();
  timerId = setInterval(() => {
    timerEl.textContent = pad(getElapsedSeconds());
  }, 250);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function revealCell(r, c) {
  const cell = state.cells[r][c];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  state.revealedCount++;

  const cellEl = getCellEl(r, c);
  cellEl.classList.add('revealed');

  if (cell.mine) {
    cellEl.classList.add('mine');
    endGame(false);
    return;
  }

  if (cell.count > 0) {
    cellEl.textContent = cell.count;
    cellEl.classList.add(`num${cell.count}`);
  } else {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
          revealCell(nr, nc);
        }
      }
    }
  }

  checkWin();
}

function checkWin() {
  const totalCells = state.rows * state.cols;
  if (state.revealedCount === totalCells - state.mines) {
    endGame(true);
  }
}

function endGame(win) {
  state.over = true;
  stopTimer();
  resetBtn.textContent = win ? '😎' : '☹️';
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.cells[r][c];
      const el = getCellEl(r, c);
      if (cell.mine) {
        // Show flag on all mines (where they should have been flagged)
        el.classList.add('revealed', 'flagged');
      } else if (cell.flagged) {
        // Wrong flag - show X on incorrectly flagged cells
        el.classList.add('revealed', 'wrong-flag');
      }
    }
  }
}

function onReveal(e) {
  if (state.over) return;
  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);
  startTimer();
  revealCell(r, c);
}

function onFlag(e) {
  e.preventDefault();
  if (state.over) return;
  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);
  const cell = state.cells[r][c];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  const el = getCellEl(r, c);
  el.classList.toggle('flagged', cell.flagged);
  state.flagsLeft += cell.flagged ? -1 : 1;
  updateCounters();
}

function getCellEl(r, c) {
  return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function resetGame() {
  stopTimer();
  startTime = null;
  resetBtn.textContent = '🙂';
  state = createState(getLevel());
  renderBoard();
}

resetBtn.addEventListener('click', resetGame);

resetGame();
