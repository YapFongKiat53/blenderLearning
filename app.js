const STORAGE_KEY = "blenderPlanProgress.v1";
const TOTAL_DAYS = CURRICULUM.reduce((n, w) => n + w.days.length, 0);

const ALL_DAYS = CURRICULUM.flatMap((w) =>
  w.days.map((d) => ({ ...d, week: w.week, weekTitle: w.title }))
);

const BADGES = [
  { id: "first", icon: "🌱", label: "第一步", test: (s) => s.completed[1] },
  { id: "week1", icon: "🧭", label: "熟悉导航", test: (s) => s.completed[5] },
  { id: "modeler", icon: "🛠️", label: "建模入门", test: (s) => s.completed[10] },
  { id: "streak7", icon: "🔥", label: "连续7天", test: (s) => s.bestStreak >= 7 },
  { id: "shader", icon: "🎨", label: "材质大师", test: (s) => s.completed[20] },
  { id: "animator", icon: "🎬", label: "动画初体验", test: (s) => s.completed[25] },
  { id: "graduate", icon: "🏆", label: "毕业作品", test: (s) => s.completed[30] },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { completed: {}, notes: {}, bestStreak: 0, unlockedBadges: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

let state = loadState();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function computeStreak() {
  const doneDates = Object.values(state.completed)
    .map((c) => c && c.date)
    .filter(Boolean)
    .sort();
  if (!doneDates.length) return 0;
  const uniqueDates = [...new Set(doneDates)];
  let streak = 1;
  for (let i = uniqueDates.length - 1; i > 0; i--) {
    const cur = new Date(uniqueDates[i]);
    const prev = new Date(uniqueDates[i - 1]);
    const diff = Math.round((cur - prev) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  const lastDate = uniqueDates[uniqueDates.length - 1];
  const isRecent = (new Date(todayISO()) - new Date(lastDate)) / 86400000 <= 1;
  return isRecent ? streak : 0;
}

function currentDayNumber() {
  for (const d of ALL_DAYS) {
    if (!state.completed[d.day]) return d.day;
  }
  return TOTAL_DAYS;
}

let selectedDay = currentDayNumber();

function render() {
  renderDashboard();
  renderToday();
  renderRoadmap();
  renderBadges();
}

function renderDashboard() {
  const doneCount = Object.keys(state.completed).length;
  const pct = Math.round((doneCount / TOTAL_DAYS) * 100);
  const circumference = 2 * Math.PI * 46;
  const ringFg = document.getElementById("ringFg");
  ringFg.setAttribute("stroke-dasharray", circumference.toFixed(1));
  ringFg.setAttribute("stroke-dashoffset", (circumference * (1 - pct / 100)).toFixed(1));
  document.getElementById("ringPct").textContent = pct + "%";
  document.getElementById("statDone").textContent = `${doneCount}/${TOTAL_DAYS}`;
  const totalMinutes = ALL_DAYS.filter((d) => state.completed[d.day]).reduce((n, d) => n + d.time, 0);
  document.getElementById("statMinutes").textContent = totalMinutes;

  const streak = computeStreak();
  state.bestStreak = Math.max(state.bestStreak || 0, streak);
  document.getElementById("statBest").textContent = state.bestStreak;
  document.getElementById("streakText").textContent = `连续 ${streak} 天`;

  const heatmap = document.getElementById("heatmap");
  heatmap.innerHTML = "";
  const curDay = currentDayNumber();
  ALL_DAYS.forEach((d) => {
    const cell = document.createElement("div");
    cell.className = "heat-cell" + (state.completed[d.day] ? " done" : "") + (d.day === curDay ? " today" : "");
    cell.dataset.day = d.day;
    cell.title = `Day ${d.day}: ${d.title}`;
    heatmap.appendChild(cell);
  });
}

function renderToday() {
  const day = ALL_DAYS.find((d) => d.day === selectedDay) || ALL_DAYS[0];
  const isDone = !!state.completed[day.day];
  const card = document.getElementById("todayCard");
  const checkedTasks = (state.notes[day.day] && state.notes[day.day].checks) || [];

  card.innerHTML = `
    <div class="eyebrow">Week ${day.week} · ${day.weekTitle} — Day ${day.day} / ${TOTAL_DAYS}</div>
    <h2>${day.title}</h2>
    <div class="goal">${day.goal}</div>
    <div class="meta">
      <span>⏱ 预计 ${day.time} 分钟</span>
      <span>📚 ${day.resource}</span>
    </div>
    <ul class="task-list">
      ${day.tasks
        .map(
          (t, i) => `
        <li>
          <input type="checkbox" data-idx="${i}" ${checkedTasks.includes(i) ? "checked" : ""}/>
          <span>${t}</span>
        </li>`
        )
        .join("")}
    </ul>
    <textarea class="notes" placeholder="写点笔记 / 遇到的问题 / 今天的心得...">${(state.notes[day.day] && state.notes[day.day].text) || ""}</textarea>
    <div class="actions" style="margin-top:14px;">
      ${
        isDone
          ? `<span class="done-flag">✅ 已完成 · ${state.completed[day.day].date}</span>
             <button class="btn-ghost btn-small" id="undoBtn">取消完成</button>`
          : `<button class="btn-primary" id="completeBtn">完成今天</button>`
      }
    </div>
  `;

  card.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = Number(cb.dataset.idx);
      const noteEntry = state.notes[day.day] || { text: "", checks: [] };
      const checks = new Set(noteEntry.checks || []);
      if (cb.checked) checks.add(idx);
      else checks.delete(idx);
      noteEntry.checks = [...checks];
      state.notes[day.day] = noteEntry;
      saveState();
    });
  });

  const textarea = card.querySelector("textarea.notes");
  textarea.addEventListener("input", () => {
    const noteEntry = state.notes[day.day] || { text: "", checks: [] };
    noteEntry.text = textarea.value;
    state.notes[day.day] = noteEntry;
    saveState();
  });

  const completeBtn = card.querySelector("#completeBtn");
  if (completeBtn) completeBtn.addEventListener("click", () => completeDay(day.day));

  const undoBtn = card.querySelector("#undoBtn");
  if (undoBtn)
    undoBtn.addEventListener("click", () => {
      delete state.completed[day.day];
      saveState();
      render();
    });
}

function renderRoadmap() {
  const list = document.getElementById("roadmapList");
  const curDay = currentDayNumber();
  list.innerHTML = CURRICULUM.map((w) => {
    const doneInWeek = w.days.filter((d) => state.completed[d.day]).length;
    const isOpen = w.days.some((d) => d.day === selectedDay) || w.days.some((d) => d.day === curDay);
    return `
    <div class="week-block ${isOpen ? "open" : ""}" data-week="${w.week}">
      <div class="week-header">
        <div><span class="w-title">Week ${w.week} · ${w.title}</span><span class="w-sub">${w.subtitle}</span></div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="w-progress">${doneInWeek}/${w.days.length}</span>
          <span class="chevron">▶</span>
        </div>
      </div>
      <div class="week-days">
        ${w.days
          .map((d) => {
            const done = !!state.completed[d.day];
            const locked = d.day > curDay;
            return `
          <div class="day-row ${done ? "done" : ""} ${locked ? "locked" : ""} ${d.day === selectedDay ? "active" : ""}" data-day="${d.day}">
            <div class="day-dot">${done ? "✓" : d.day}</div>
            <div class="d-title">${d.title}</div>
            <div class="d-time">${d.time}min</div>
          </div>`;
          })
          .join("")}
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".week-header").forEach((h) => {
    h.addEventListener("click", () => {
      h.parentElement.classList.toggle("open");
    });
  });

  list.querySelectorAll(".day-row").forEach((row) => {
    row.addEventListener("click", () => {
      const day = Number(row.dataset.day);
      if (day > curDay) {
        showToast("先完成前面的内容，才能解锁这一天哦～");
        return;
      }
      selectedDay = day;
      render();
      document.getElementById("todayCard").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderBadges() {
  const row = document.getElementById("badgesRow");
  row.innerHTML = BADGES.map((b) => {
    const unlocked = b.test(state);
    return `<div class="badge ${unlocked ? "unlocked" : ""}"><span class="icon">${b.icon}</span><span class="label">${b.label}</span></div>`;
  }).join("");
}

function completeDay(dayNum) {
  state.completed[dayNum] = { date: todayISO() };
  const newStreak = computeStreak();
  state.bestStreak = Math.max(state.bestStreak || 0, newStreak);

  const previouslyUnlocked = new Set(state.unlockedBadges || []);
  const nowUnlocked = BADGES.filter((b) => b.test(state)).map((b) => b.id);
  const newlyUnlocked = nowUnlocked.filter((id) => !previouslyUnlocked.has(id));
  state.unlockedBadges = nowUnlocked;

  saveState();

  const nextDay = ALL_DAYS.find((d) => !state.completed[d.day]);
  selectedDay = nextDay ? nextDay.day : dayNum;

  render();
  popMascot();
  launchConfetti();

  if (newlyUnlocked.length) {
    const b = BADGES.find((x) => x.id === newlyUnlocked[0]);
    showToast(`🎉 解锁新徽章：${b.icon} ${b.label}`);
  } else {
    showToast(`太棒了！Day ${dayNum} 完成，继续保持 🔥`);
  }
}

function popMascot() {
  const cube = document.getElementById("mascotCube");
  cube.classList.remove("pop");
  void cube.offsetWidth;
  cube.classList.add("pop");
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function launchConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const colors = ["#ea7600", "#f5a623", "#4caf7d", "#e8e6e3"];
  const particles = Array.from({ length: 90 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 120,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 8,
    vy: Math.random() * -8 - 4,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 12,
  }));
  let frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    if (frame < 90) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("确定要清空全部学习进度吗？此操作无法撤销。")) {
    state = { completed: {}, notes: {}, bestStreak: 0, unlockedBadges: [] };
    saveState();
    selectedDay = 1;
    render();
  }
});

render();
