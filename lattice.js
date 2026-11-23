// Rotated surface code of distance 5, as a decoding game.
// Data qubits sit on a 5x5 grid. Faces are checks: Z-type where (row + col) is even, X-type otherwise.
// An X error flips the Z checks around it, a Z error flips the X checks.
// A few errors are hidden. The lit checks show the syndrome of (hidden errors) times (the player's corrections).
// When every check is off, that product is either a stabilizer (corrected) or a logical operator (failed).
(function () {
  const D = 5, S = 64, NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("lattice");
  if (!svg) return;
  const status = document.getElementById("status");
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

  const N = D * D;
  let hidden = new Array(N).fill("");        // the errors to be found: "", "X" or "Z"
  const guess = new Array(N).fill("");       // the player's corrections
  const next = { "": "X", X: "Z", Z: "" };
  let over = false;                          // true once the round has ended
  const qubits = [], badges = [];
  let logical = new Set();                   // qubits of the logical operator left over, if any

  // residual = hidden errors times corrections, split into its X part and its Z part
  const xPart = i => (hidden[i] === "X") !== (guess[i] === "X");
  const zPart = i => (hidden[i] === "Z") !== (guess[i] === "Z");
  const lit = f => f.qubits.filter(f.type === "z" ? xPart : zPart).length % 2 === 1;

  // Fewest errors of one kind that give each syndrome on the checks they flip (12 checks, 4096 syndromes),
  // found separately for the two logical classes: the top bit of a state records whether the errors
  // anticommute with the logical operator of the other kind (the same test as in judge()).
  // X errors flip the Z checks and Z errors flip the X checks, so the two kinds are searched separately.
  function fewestTable(type) {
    const mine = faces.filter(f => f.type === type);
    const masks = new Array(N).fill(0), flip = 1 << mine.length;
    mine.forEach((f, k) => f.qubits.forEach(i => { masks[i] |= 1 << k; }));
    for (let k = 0; k < D; k++) masks[type === "z" ? k : k * D] |= flip;
    const dist = new Int8Array(2 * flip).fill(-1);
    let frontier = [0];
    dist[0] = 0;
    while (frontier.length) {
      const nextFrontier = [];
      for (const a of frontier) for (const m of masks) {
        if (dist[a ^ m] < 0) { dist[a ^ m] = dist[a] + 1; nextFrontier.push(a ^ m); }
      }
      frontier = nextFrontier;
    }
    return { masks, dist, flip };
  }
  const tables = { X: fewestTable("z"), Z: fewestTable("x") };
  // for each kind, the fewest marks that undo the hidden errors and the fewest that leave a logical error
  function weights() {
    return ["X", "Z"].map(e => {
      const { masks, dist, flip } = tables[e];
      let state = 0;
      hidden.forEach((h, i) => { if (h === e) state ^= masks[i]; });
      return [dist[state], dist[state ^ flip]];
    });
  }
  // fewest marks that reproduce the syndrome of the hidden errors
  const fewest = () => weights().reduce((sum, [good, bad]) => sum + Math.min(good, bad), 0);
  // true when every smallest set of marks corrects the hidden errors
  const fair = () => weights().every(([good, bad]) => good < bad);
  const marks = n => n + (n === 1 ? " mark" : " marks");

  function render() {
    qubits.forEach((q, i) => {
      q.g.classList.toggle("err", guess[i] !== "");
      q.g.classList.toggle("ex", guess[i] === "X");
      q.g.classList.toggle("ez", guess[i] === "Z");
      q.g.classList.toggle("logical", logical.has(i));
      q.t.textContent = guess[i];
      q.g.setAttribute("aria-label", `Qubit ${i + 1}, ${guess[i] ? guess[i] + " correction" : "no correction"}`);
    });
    badges.forEach((b, i) => {
      b.g.classList.toggle("show", over && hidden[i] !== "");
      b.g.classList.toggle("ex", hidden[i] === "X");
      b.g.classList.toggle("ez", hidden[i] === "Z");
      b.t.textContent = hidden[i];
    });
    for (const f of faces) f.node.classList.toggle("on", lit(f));
    svg.classList.toggle("over", over);
  }

  function finish(message) { over = true; status.textContent = message; render(); }

  function judge() {
    if (faces.some(lit)) return;
    // With every check off, the X part is a logical X exactly when it anticommutes with logical Z
    // (Z along the top row), and the Z part is a logical Z exactly when it anticommutes with
    // logical X (X along the left column).
    let lx = 0, lz = 0;
    for (let k = 0; k < D; k++) { if (xPart(k)) lx ^= 1; if (zPart(k * D)) lz ^= 1; }
    const used = guess.filter(Boolean).length, best = fewest();
    if (lx || lz) {
      // the operator left over is errors times marks: ring its X part, its Z part, or both
      for (let i = 0; i < N; i++) if ((lx && xPart(i)) || (lz && zPart(i))) logical.add(i);
      finish(`A logical error is left over, ringed in red. The syndrome can be reproduced with ${marks(best)}.`);
    } else {
      finish(used === best
        ? `Corrected, with the fewest marks possible (${best}).`
        : `Corrected with ${marks(used)}. The syndrome can be reproduced with ${best}.`);
    }
  }

  function newRound() {
    do {
      hidden = new Array(N).fill("");
      const count = 2 + Math.floor(Math.random() * 5);   // 2 to 6 errors
      while (hidden.filter(Boolean).length < count) {
        hidden[Math.floor(Math.random() * N)] = Math.random() < 0.5 ? "X" : "Z";
      }
      guess.fill("");
    } while (!faces.some(lit) || !fair());   // keep only rounds where a smallest set of marks always succeeds
    over = false;
    logical = new Set();
    status.textContent = "";
    render();
  }

  for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) {
    const i = r * D + c;
    const g = el("g", { class: "qubit", tabindex: 0, role: "button", transform: `translate(${c * S} ${r * S})` });
    el("circle", { r: 26, fill: "transparent", stroke: "none", style: "fill:transparent;stroke:none" }, g); // larger hit area
    el("circle", { r: 13 }, g);
    const t = el("text", {}, g);
    const flip = () => { if (over) return; guess[i] = next[guess[i]]; render(); judge(); };
    g.addEventListener("click", flip);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    qubits.push({ g, t });
  }
  // the true errors, drawn on top of the qubits once the round is over
  for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) {
    const g = el("g", { class: "truth", transform: `translate(${c * S + 14} ${r * S - 14})` });
    el("circle", { r: 9 }, g);
    badges.push({ g, t: el("text", {}, g) });
  }

  document.getElementById("new").addEventListener("click", newRound);
  document.getElementById("reveal").addEventListener("click", () => {
    if (!over) finish(`The syndrome can be reproduced with ${marks(fewest())}.`);
  });

  newRound();
})();
