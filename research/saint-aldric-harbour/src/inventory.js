// Inventory and market: coins + items in G.inv (saved), the bag panel (I key / touch button) and the market stall panel (E at the stall).
// Items: seed_<crop>, crop_<crop>, fish_<fishId>. Stacks are capped per item.
export const CROPS = {   // medieval crops only (no potato, tomato, maize). days = game days to ripen; seasons = sowing seasons (0 spring,1 summer,2 autumn)
  barley: { n: "大麥", seasons: [0], days: 6, yield: 4, price: 3, color: 0xd8b44a },
  oat: { n: "燕麥", seasons: [0], days: 5, yield: 4, price: 2, color: 0xc9a86a },
  rye: { n: "黑麥", seasons: [2], days: 8, yield: 4, price: 3, winter: true, color: 0xb89a4a },   // sown in autumn, slow growth through winter
  flax: { n: "亞麻", seasons: [0], days: 6, yield: 2, price: 5, color: 0x6f8fd0 },
  pea: { n: "豌豆", seasons: [0, 1], days: 4, yield: 3, price: 4, color: 0xc7d86a },
  turnip: { n: "蕪菁", seasons: [1, 2], days: 3, yield: 2, price: 3, color: 0xb9a0c8 },
  cabbage: { n: "甘藍", seasons: [0, 1], days: 5, yield: 2, price: 5, color: 0x9fc96a },
  leek: { n: "韭蔥", seasons: [0, 1], days: 5, yield: 2, price: 4, color: 0xe6f0c8 },
};
export const CROP_IDS = Object.keys(CROPS);
export const FISH_PRICE = { herring: { n: "鯡魚", price: 3 }, mackerel: { n: "鯖魚", price: 4 }, plaice: { n: "比目魚", price: 5 }, bass: { n: "海鱸", price: 7 }, cod: { n: "鱈魚", price: 6 }, eel: { n: "鰻魚", price: 9 }, salmon: { n: "鮭魚", price: 12 }, tuna: { n: "黑鮪魚", price: 20 } };
export const SEASON_NAMES = ["春", "夏", "秋", "冬"];
const CAP = 200;
const seedCost = c => Math.max(1, CROPS[c].price - 1);
const itemName = id => { const [k, v] = [id.split("_")[0], id.slice(id.indexOf("_") + 1)]; if (k === "seed") return CROPS[v].n + "種子"; if (k === "crop") return CROPS[v].n; return FISH_PRICE[v].n; };

export function createInventory({ G, toast, onChange }) {
  const I = () => G.inv;                       // read through G each time: restore() replaces G.inv
  const count = id => I().items[id] || 0;
  const add = (id, n = 1) => { I().items[id] = Math.min(CAP, count(id) + n); onChange?.(); };
  const take = (id, n = 1) => { if (count(id) < n) return false; I().items[id] -= n; if (!I().items[id]) delete I().items[id]; onChange?.(); return true; };
  const itemPrice = id => { const [k, v] = [id.split("_")[0], id.slice(id.indexOf("_") + 1)]; return k === "crop" ? CROPS[v].price : k === "fish" ? FISH_PRICE[v].price : 0; };
  const sellAll = () => {
    let gain = 0, n = 0;
    for (const id of Object.keys(I().items)) if (id.startsWith("crop_") || id.startsWith("fish_")) { gain += itemPrice(id) * I().items[id]; n += I().items[id]; delete I().items[id]; }
    if (!n) { toast("沒有可賣的作物或魚"); return; }
    I().coins += gain; onChange?.(); toast("賣出 " + n + " 件，得 " + gain + " 金幣"); render();
  };
  const buySeed = c => {
    const cost = seedCost(c); if (I().coins < cost) { toast("金幣不足（需要 " + cost + "）"); return; }
    I().coins -= cost; add("seed_" + c, 1); toast("買了一包" + CROPS[c].n + "種子（-" + cost + "）"); render();
  };
  // ---------------------------------------------------------------- panel
  const el = document.getElementById("inv");
  let open = false, mode = "bag";
  el?.addEventListener("pointerdown", e => e.stopPropagation());
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function render() {
    if (!el) return;
    const items = I().items, seedRows = CROP_IDS.filter(c => items["seed_" + c]).map(c => `<div class="ir"><span>${esc(itemName("seed_" + c))}</span><b>×${items["seed_" + c]}</b></div>`).join("") || '<p class="dim">沒有種子</p>';
    const cropRows = Object.keys(items).filter(k => k.startsWith("crop_")).map(k => `<div class="ir"><span>${esc(itemName(k))}</span><b>×${items[k]}</b></div>`).join("") || '<p class="dim">沒有作物</p>';
    const fishRows = Object.keys(items).filter(k => k.startsWith("fish_")).map(k => `<div class="ir"><span>${esc(itemName(k))}</span><b>×${items[k]}</b></div>`).join("") || '<p class="dim">沒有魚</p>';
    const sel = G.farm.seedSel;
    const bag = `<h4>種子　<small class="dim">按 G 切換選取${sel ? "：" + esc(CROPS[sel].n) : ""}</small></h4>${seedRows}<h4>作物</h4>${cropRows}<h4>魚</h4>${fishRows}`;
    const market = `<h4>購買種子</h4><div class="grid2">${CROP_IDS.map(c => `<button data-buy="${c}">${esc(CROPS[c].n)} (${seedCost(c)} 金)</button>`).join("")}</div>
      <h4>賣出</h4><p class="dim">作物與魚都以固定單價收購，一鍵全部賣出。</p><button id="invSell" class="wide">全部賣出</button>`;
    el.innerHTML = `<div class="mcard"><div class="mh"><b>${mode === "market" ? "市集攤位" : "背包"}</b><span id="invX">✕</span></div>
      <p class="coins">金幣 <b>${I().coins}</b></p>${mode === "market" ? market : bag}
      ${mode === "bag" ? '<p class="dim">I 開關背包・E 農地互動・G 切換種子・F 釣竿</p>' : ""}</div>`;
    el.querySelector("#invX").onclick = close;
    el.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => buySeed(b.dataset.buy));
    const s = el.querySelector("#invSell"); if (s) s.onclick = sellAll;
  }
  function show(m) { if (!el) return; mode = m; open = true; render(); el.classList.add("on"); G.paused = true; document.exitPointerLock?.(); }
  function close() { if (!open) return; open = false; el?.classList.remove("on"); G.paused = false; }
  return {
    add, take, count, sellAll, buySeed,
    toggle: () => { if (open) close(); else if (!G.paused) show("bag"); },
    openMarket: () => show("market"),
    isOpen: () => open, close, refresh: () => { if (open) render(); },
    coins: () => I().coins,
  };
}
