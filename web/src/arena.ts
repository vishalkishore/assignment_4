// Anime auction arena. Vector canvas on a 640x360 logical stage.

export const W = 640;
export const H = 360;
export const C = {
  paper: "#FFFDF8", ink: "#16161D", orange: "#FF6B1A", blue: "#2D6BFF", red: "#E8344E",
  yellow: "#FFD23F", green: "#19B37A", violet: "#8A5CF6", mist: "#6B6F80", ray: "#FFF1DC",
  // aliases used by charts and the route map
  amber: "#FF6B1A", rope: "#E8344E", coin: "#FFD23F", sea: "#2D6BFF",
};
const FLOOR = 292;
export const yOfBid = (b: number) => FLOOR - Math.max(0, Math.min(1.2, b)) * 210;

export type Fighter = {
  color: string; hair: string; name: string; bid: number; isYou?: boolean; chained?: boolean;
  style: "spiky" | "bob" | "long" | "cap";
};
export type Tableau = {
  ships: Fighter[];
  progress: number;
  winner: number | null;
  priceFrom: number | null;
  ropeV: number | null;
  gap: [number, number] | null;
  caption?: string;
  fast: boolean;
};

// the original cast
export const YOU = { color: "#FF6B1A", hair: "#2B1B14", style: "spiky" as const };
export const CAST = [
  { color: "#2D6BFF", hair: "#1F2A55", style: "bob" as const },
  { color: "#19B37A", hair: "#6B2D5C", style: "long" as const },
  { color: "#8A5CF6", hair: "#D9A441", style: "cap" as const },
];

type Particle = { x: number; y: number; vx: number; vy: number; life: number; kind: "gain" | "loss" | "gull" };

export const shipX = (i: number, n: number) => (n === 1 ? 400 : 200 + (i * 360) / (n - 1));
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const DISPLAY = '"Dela Gothic One", "Arial Black", sans-serif';
const NUM = '"IBM Plex Sans", system-ui, sans-serif';

export class Harbor {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private scale = 2;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize() {
    this.scale = (this.canvas.clientWidth * (window.devicePixelRatio || 1)) / W;
    this.canvas.width = Math.round(W * this.scale);
    this.canvas.height = Math.round(H * this.scale);
  }

  burst(x: number, y: number, kind: Particle["kind"], count: number) {
    for (let i = 0; i < Math.min(count, 24); i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 10,
        vx: kind === "gull" ? 120 + Math.random() * 90 : (Math.random() - 0.5) * 60,
        vy: kind === "gull" ? -60 - Math.random() * 60 : kind === "gain" ? -70 - Math.random() * 50 : 40 + Math.random() * 30,
        life: 1, kind,
      });
    }
  }

  draw(t: number, dt: number, tab: Tableau) {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const n = tab.ships.length;
    const revealed = tab.fast || tab.progress > 0.42;
    const focus = revealed && tab.winner !== null ? shipX(tab.winner, n) : W / 2;
    this.background(t, focus, revealed);
    if (tab.ropeV !== null) this.limit(tab.ropeV);
    tab.ships.forEach((f, i) => this.aura(f, i, n, tab, revealed));
    this.priceLine(tab, revealed);
    tab.ships.forEach((f, i) => this.bust(f, shipX(i, n), t, i, tab, revealed));
    this.flash(tab, focus);
    this.updateParticles(dt);
    if (revealed && tab.caption) this.captionBox(tab.caption);
  }

  // sunburst speed lines, pointing at whoever just won
  private background(t: number, fx: number, revealed: boolean) {
    const { ctx } = this;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    const cx = fx, cy = 150, rays = 36, spin = t * 0.04;
    ctx.fillStyle = revealed ? "#FFE6C4" : C.ray;
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2 + spin, a1 = a0 + Math.PI / rays * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * 900, cy + Math.sin(a0) * 900);
      ctx.lineTo(cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900);
      ctx.fill();
    }
    // halftone corners
    ctx.fillStyle = "rgba(22,22,29,0.10)";
    for (let y = 6; y < H; y += 9) for (let x = 6; x < W; x += 9) {
      const d = Math.min(Math.hypot(x, y), Math.hypot(W - x, y)) / 260;
      const r = Math.max(0, 1.9 - d * 2.2);
      if (r > 0.15) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    }
    // floor
    ctx.fillStyle = "#F3EEE4";
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, FLOOR, W, 3);
    // bid scale on the left
    ctx.font = `600 10px ${NUM}`;
    ctx.textAlign = "right";
    for (const b of [0.25, 0.5, 0.75, 1]) {
      const y = yOfBid(b);
      ctx.fillStyle = C.mist;
      ctx.fillText(b.toFixed(2), 36, y + 3);
      ctx.fillRect(40, y, 8, 1);
    }
  }

  private limit(v: number) {
    const { ctx } = this;
    const y = yOfBid(v);
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 14, y); ctx.stroke();
    ctx.setLineDash([]);
    // short tag in the left margin, clear of the first fighter's bar (which starts at x = 171)
    this.tag(`VALUE ${v.toFixed(2)}`, 52, y - 24, C.red, "#fff");
  }

  private aura(f: Fighter, i: number, n: number, tab: Tableau, revealed: boolean) {
    const { ctx } = this;
    const x = shipX(i, n);
    const rise = f.chained || tab.fast ? 1 : ease(tab.progress / 0.4 - i * 0.08);
    const top = FLOOR + (yOfBid(f.bid) - FLOOR) * rise;
    const win = revealed && tab.winner === i;
    const dim = revealed && !win && tab.priceFrom !== i;
    const w = n > 3 ? 46 : 58;
    ctx.globalAlpha = dim ? 0.35 : 1;
    // flame-topped power bar
    const g = ctx.createLinearGradient(0, top, 0, FLOOR);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.15, f.color);
    g.addColorStop(1, f.color);
    ctx.fillStyle = g;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, FLOOR);
    ctx.lineTo(x - w / 2, top + 10);
    const flick = Math.sin(performance.now() / 120 + i) * 3;
    ctx.lineTo(x - w / 4, top - 4 + flick);
    ctx.lineTo(x - w / 10, top + 6);
    ctx.lineTo(x + w / 10, top - 10 - flick);
    ctx.lineTo(x + w / 4, top + 4);
    ctx.lineTo(x + w / 2 - 6, top - 2 + flick);
    ctx.lineTo(x + w / 2, top + 10);
    ctx.lineTo(x + w / 2, FLOOR);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (f.chained) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      for (let y = top + 18; y < FLOOR - 30; y += 22) {
        ctx.beginPath(); ctx.ellipse(x + w / 2 + 6, y, 4, 7, 0, 0, 7); ctx.stroke();
      }
    }
    // bid number
    if (rise > 0.6) {
      ctx.font = `italic 800 ${win ? 30 : 24}px ${NUM}`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(f.bid.toFixed(2), x, top - 18);
      ctx.fillStyle = win ? C.yellow : "#fff";
      ctx.fillText(f.bid.toFixed(2), x, top - 18);
    }
    ctx.globalAlpha = 1;
  }

  private priceLine(tab: Tableau, revealed: boolean) {
    if (!revealed || tab.winner === null || tab.priceFrom === null) return;
    const { ctx } = this;
    const n = tab.ships.length;
    const wx = shipX(tab.winner, n);
    const p = tab.fast ? 1 : Math.min(1, (tab.progress - 0.42) / 0.18);
    if (tab.gap) {
      // first price: the winner pays its own bid; hatch what it could have saved
      const [hi, lo] = tab.gap;
      const y0 = yOfBid(hi), y1 = yOfBid(lo);
      // draw the box on whichever side of the winner has room
      const right = wx < W / 2;
      const bx = right ? wx + 34 : wx - 74;
      ctx.save();
      ctx.beginPath(); ctx.rect(bx, y0, 40, (y1 - y0) * p); ctx.clip();
      ctx.fillStyle = "rgba(232,52,78,0.15)";
      ctx.fillRect(bx, y0, 40, y1 - y0);
      ctx.strokeStyle = C.red; ctx.lineWidth = 2;
      for (let k = -60; k < Math.max(80, y1 - y0); k += 8) { ctx.beginPath(); ctx.moveTo(bx + k, y0); ctx.lineTo(bx + k + 300, y0 + 300); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.strokeRect(bx, y0, 40, Math.max(2, (y1 - y0) * p));
      if (p >= 1 && y1 - y0 > 4) {
        const label = `OVERPAID ${(hi - lo).toFixed(2)}`;
        // under the box, so it never covers a neighbour's bid number
        this.tag(label, right ? bx : bx - 70, y1 + 6, C.red, "#fff");
      }
      return;
    }
    const px = shipX(tab.priceFrom, n);
    const y = yOfBid(tab.ships[tab.priceFrom].bid);
    const end = px + (wx - px) * p;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(end, y); ctx.stroke();
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 3; ctx.setLineDash([10, 5]);
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(end, y); ctx.stroke();
    ctx.setLineDash([]);
    if (p >= 1) this.tag(`PRICE ${tab.ships[tab.priceFrom].bid.toFixed(2)}`, (px + wx) / 2 - 34, y - 26, C.ink, C.yellow);
  }

  // original cel-shaded bust: shoulders, head, hair, big eyes
  private bust(f: Fighter, x: number, t: number, i: number, tab: Tableau, revealed: boolean) {
    const { ctx } = this;
    const win = revealed && tab.winner === i;
    const lose = revealed && tab.winner !== i;
    const by = FLOOR + 8 + (win && !tab.fast ? -Math.abs(Math.sin(t * 8)) * 4 : 0);
    const s = tab.ships.length > 3 ? 0.82 : 1;
    ctx.save();
    ctx.translate(x, by);
    ctx.scale(s, s);
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.lineJoin = "round";
    // shoulders / jacket
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.moveTo(-40, 70); ctx.quadraticCurveTo(-36, 34, 0, 30); ctx.quadraticCurveTo(36, 34, 40, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-9, 31); ctx.lineTo(0, 46); ctx.lineTo(9, 31); ctx.closePath(); ctx.fill(); ctx.stroke();
    // head
    ctx.fillStyle = "#FFE1C7";
    ctx.beginPath(); ctx.ellipse(0, 4, 23, 26, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#F7C9A8"; // cel shadow
    ctx.beginPath(); ctx.ellipse(9, 10, 12, 18, 0.2, -1.2, 1.6); ctx.fill();
    // hair
    ctx.fillStyle = f.hair;
    ctx.beginPath();
    if (f.style === "spiky") {
      ctx.moveTo(-25, 6); ctx.lineTo(-34, -14); ctx.lineTo(-20, -12); ctx.lineTo(-26, -34); ctx.lineTo(-8, -22);
      ctx.lineTo(-4, -42); ctx.lineTo(8, -24); ctx.lineTo(22, -38); ctx.lineTo(20, -18); ctx.lineTo(36, -16); ctx.lineTo(25, 4);
      ctx.lineTo(14, -8); ctx.lineTo(6, 0); ctx.lineTo(-2, -10); ctx.lineTo(-12, 0); ctx.lineTo(-16, -8); ctx.closePath();
    } else if (f.style === "bob") {
      ctx.moveTo(-27, 18); ctx.quadraticCurveTo(-32, -30, 0, -26); ctx.quadraticCurveTo(32, -30, 27, 18);
      ctx.lineTo(20, 18); ctx.lineTo(18, -6); ctx.lineTo(-4, -4); ctx.lineTo(-14, -12); ctx.lineTo(-20, 18); ctx.closePath();
    } else if (f.style === "long") {
      ctx.moveTo(-26, 40); ctx.quadraticCurveTo(-34, -30, 0, -27); ctx.quadraticCurveTo(34, -30, 26, 40);
      ctx.lineTo(18, 34); ctx.lineTo(19, -4); ctx.lineTo(4, -12); ctx.lineTo(-10, -2); ctx.lineTo(-19, -6); ctx.lineTo(-18, 34); ctx.closePath();
    } else {
      ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-26, -30, 0, -28); ctx.quadraticCurveTo(26, -30, 26, 0);
      ctx.lineTo(38, 2); ctx.lineTo(36, -4); ctx.lineTo(24, -8); ctx.lineTo(-24, -6); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    // eyes
    for (const ex of [-9, 9]) {
      if (win) {
        ctx.beginPath(); ctx.moveTo(ex - 6, 8); ctx.quadraticCurveTo(ex, 0, ex + 6, 8); ctx.stroke();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(ex, 6, 5.5, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = f.hair;
        ctx.beginPath(); ctx.ellipse(ex + (f.isYou ? 1 : -1), 8, 3.6, 5.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.ellipse(ex + (f.isYou ? 1 : -1), 9, 1.8, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(ex - 1, 5, 1.6, 0, 7); ctx.fill();
      }
    }
    // mouth
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (win) { ctx.fillStyle = "#B8323F"; ctx.moveTo(-7, 17); ctx.quadraticCurveTo(0, 28, 7, 17); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (lose) { ctx.moveTo(-5, 21); ctx.quadraticCurveTo(0, 17, 5, 21); ctx.stroke(); }
    else { ctx.moveTo(-4, 19); ctx.lineTo(4, 19); ctx.stroke(); }
    if (lose && !tab.fast) {
      ctx.fillStyle = "#9CD3FF"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(24, -8); ctx.quadraticCurveTo(30, 2, 24, 6); ctx.quadraticCurveTo(18, 2, 24, -8); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // name plate
    ctx.font = `14px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "#fff";
    ctx.strokeText(f.name, x, H - 6);
    ctx.fillStyle = f.isYou ? C.red : C.ink;
    ctx.fillText(f.name, x, H - 6);
  }

  // the impact frame: a brief flash and radial lines on the winner as the result lands
  private flash(tab: Tableau, fx: number) {
    if (tab.fast || tab.winner === null) return;
    const k = (tab.progress - 0.42) / 0.1;
    if (k < 0 || k > 1) return;
    const { ctx } = this;
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(22,22,29,${0.7 * (1 - k)})`;
    ctx.lineWidth = 2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 22) {
      const r0 = 90 + 40 * k, r1 = 420;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * r0, 150 + Math.sin(a) * r0);
      ctx.lineTo(fx + Math.cos(a) * r1, 150 + Math.sin(a) * r1);
      ctx.stroke();
    }
  }

  private updateParticles(dt: number) {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => (p.life -= dt * 0.8) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      if (p.kind === "gain") this.star(p.x, p.y, 7, C.yellow);
      else if (p.kind === "gull") {
        ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.ink; ctx.font = `700 8px ${NUM}`; ctx.textAlign = "center"; ctx.fillText("¥", p.x, p.y + 3);
      } else {
        ctx.fillStyle = "#9CD3FF";
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 7); ctx.quadraticCurveTo(p.x + 6, p.y + 2, p.x, p.y + 5);
        ctx.quadraticCurveTo(p.x - 6, p.y + 2, p.x, p.y - 7); ctx.fill(); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private star(x: number, y: number, r: number, fill: string) {
    const { ctx } = this;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  private captionBox(text: string) {
    const { ctx } = this;
    // narration box, top right, wrapped to at most ~300px so it never meets the rule card
    ctx.font = `600 13px ${NUM}`;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 290 && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24, h = lines.length * 18 + 12;
    const x = W - w - 14, y = 14;
    ctx.fillStyle = C.ink; ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = C.ink; ctx.textAlign = "left";
    lines.forEach((l, k) => ctx.fillText(l, x + 12, y + 20 + k * 18));
  }

  private tag(s: string, x: number, y: number, bg: string, fg: string) {
    const { ctx } = this;
    ctx.font = `12px ${DISPLAY}`;
    const w = ctx.measureText(s).width + 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.03);
    ctx.fillStyle = C.ink; ctx.fillRect(3, 3, w, 20);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, 20);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, 20);
    ctx.fillStyle = fg; ctx.textAlign = "left"; ctx.fillText(s, 7, 15);
    ctx.restore();
  }
}
