// Rotated surface code of distance 5.
// Data qubits sit on a 5x5 grid. Faces are checks: Z-type where (row + col) is even, X-type otherwise.
// An X error flips the Z checks around it, a Z error flips the X checks.
(function () {
  const D = 5, S = 64, NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("lattice");
  if (!svg) return;
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(n);
    return n;
  };

  // faces: top-left corner (r, c), with r, c from -1 to D-1
  const faces = [];
  for (let r = -1; r < D; r++) for (let c = -1; c < D; c++) {
    const type = (((r + c) % 2) + 2) % 2 === 0 ? "z" : "x";
    const edgeR = r === -1 || r === D - 1, edgeC = c === -1 || c === D - 1;
    if (edgeR && edgeC) continue;
    if (edgeR && type !== "x") continue;   // top and bottom boundaries carry X checks
    if (edgeC && type !== "z") continue;   // left and right boundaries carry Z checks
    const qubits = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]
      .filter(([a, b]) => a >= 0 && a < D && b >= 0 && b < D)
      .map(([a, b]) => a * D + b);
    let d;
    const x = c * S, y = r * S;
    if (!edgeR && !edgeC) d = `M${x} ${y}h${S}v${S}h${-S}z`;
    else if (r === -1) d = `M${x} 0A${S / 2} ${S / 2} 0 0 1 ${x + S} 0z`;
    else if (r === D - 1) d = `M${x} ${y}A${S / 2} ${S / 2} 0 0 0 ${x + S} ${y}z`;
    else if (c === -1) d = `M0 ${y}A${S / 2} ${S / 2} 0 0 0 0 ${y + S}z`;
    else d = `M${x} ${y}A${S / 2} ${S / 2} 0 0 1 ${x} ${y + S}z`;
    faces.push({ type, qubits, node: el("path", { d, class: "face " + type }) });
  }

  for (let i = 0; i < D; i++) {
    el("line", { x1: 0, y1: i * S, x2: (D - 1) * S, y2: i * S, class: "edge" });
    el("line", { x1: i * S, y1: 0, x2: i * S, y2: (D - 1) * S, class: "edge" });
  }

  const state = new Array(D * D).fill("");   // "", "X" or "Z"
  const next = { "": "X", X: "Z", Z: "" };
  const qubits = [];

  function render() {
    qubits.forEach((q, i) => {
      q.g.classList.toggle("err", state[i] !== "");
      q.t.textContent = state[i];
      q.g.setAttribute("aria-label", `Qubit ${i + 1}, ${state[i] ? state[i] + " error" : "no error"}`);
    });
    for (const f of faces) {
      const trigger = f.type === "z" ? "X" : "Z";
      const odd = f.qubits.filter(i => state[i] === trigger).length % 2 === 1;
      f.node.classList.toggle("on", odd);
    }
  }

  for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) {
    const i = r * D + c;
    const g = el("g", { class: "qubit", tabindex: 0, role: "button", transform: `translate(${c * S} ${r * S})` });
    el("circle", { r: 26, fill: "transparent", stroke: "none", style: "fill:transparent;stroke:none" }, g); // larger hit area
    el("circle", { r: 13 }, g);
    const t = el("text", {}, g);
    const flip = () => { state[i] = next[state[i]]; render(); };
    g.addEventListener("click", flip);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    qubits.push({ g, t });
  }

  document.getElementById("clear").addEventListener("click", () => { state.fill(""); render(); });

  // Opening: three errors arrive one by one, so the page shows what the picture does.
  const demo = [[7, "X"], [8, "X"], [16, "Z"]];
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) { demo.forEach(([i, e]) => state[i] = e); render(); }
  else { render(); demo.forEach(([i, e], k) => setTimeout(() => { if (state[i] === "") { state[i] = e; render(); } }, 700 + 650 * k)); }
})();
