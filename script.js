let remaining = 7200;
const output = document.getElementById("countdown");

setInterval(() => {
  if (remaining <= 0) return;

  remaining--;

  const h = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");

  output.textContent = `${h}:${m}:${s}`;
}, 1000);
