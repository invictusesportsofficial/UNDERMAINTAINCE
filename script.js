let seconds = 7200;
const timer = document.getElementById("timer");

setInterval(() => {
  if (seconds <= 0) return;
  seconds--;

  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  timer.textContent = `${h}:${m}:${s}`;
}, 1000);
