// In-game menu: quality tier + auto adjust, save slots (save / load / export / import / reset), controls.
import { TIERS, TIER_ORDER, saveSettings } from "./settings.js";
// what each quality tier changes (shown in the menu)
const TIER_NOTES = {
  low: "低：陰影 2 級、無泛光、無環境光遮蔽、植被不投影、海洋 1 級波、草 90 叢。解析度 720–1080p。",
  med: "中：MSAA ×2、陰影 3 級、泛光、植被只在近處投影、海洋 2 級波、草 120 叢。解析度 1080–1440p。",
  high: "高：MSAA ×4、陰影 3 級、泛光與環境光遮蔽、植被全部投影、海洋 2 級波、草 170 叢。",
  ultra: "極高：MSAA ×4、陰影 4 級、泛光與環境光遮蔽、平面反射、海洋 3 級波（含 chop）、草 200 叢、植被密度 ×1.4。",
};
import { exportSave, importSave, writeSave, readSave, clearSave } from "./save.js";
import { FISH_PRICE } from "./inventory.js";

export function createMenu({ settings, tierName, game, collect, restore, getRes, onToast }) {
  const root = document.getElementById("menu"), btn = document.getElementById("menuBtn");
  let open = false;
  let tab = "gfx";
  const ago = t => { if (!t) return "尚無存檔"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "剛剛" : m < 60 ? m + " 分鐘前" : new Date(t).toLocaleString(); };
  const pageGfx = () => `
    <div class="seg" id="tiers">${TIER_ORDER.map(t => `<button data-t="${t}" class="${t === tierName ? "on" : ""}">${TIERS[t].label}</button>`).join("")}</div>
    <label class="row"><input type="checkbox" id="auto" ${settings.auto ? "checked" : ""}> 自動調整解析度（${TIERS[tierName].minSide}p～${TIERS[tierName].maxSide}p）</label>
    <p class="dim" id="res">${getRes()}</p>
    <p class="dim">${TIER_NOTES[tierName]}</p>
    <p class="dim">切換畫質會先自動存檔，再重新載入並回到原處。</p>`;
  const pageSave = () => { const sv = readSave(); return `
    <p class="dim">上次存檔：<b>${ago(sv && sv.savedAt)}</b>（每 30 秒自動存檔）</p>
    <div class="grid"><button id="sv">立即儲存</button><button id="ld2">讀取存檔</button><button id="ex">匯出檔案</button><label class="fbtn">匯入檔案<input id="im" type="file" accept="application/json,.json" hidden></label></div>
    <p class="dim">換裝置或清除瀏覽器資料前，請先「匯出檔案」備份。</p>
    <button id="rs" class="warn">清除存檔並重新開始</button>
    <h4>魚圖鑑</h4>
    <div class="dex">${Object.keys(FISH_PRICE).map(id => { const d = (game.G.dex || {})[id]; return `<div class="ir"><span>${FISH_PRICE[id].n}</span><span class="dim">${d ? "已釣 " + d.count + " 條・最大 " + Math.round(d.max) + " cm" : "尚未釣到"}</span></div>`; }).join("")}</div>`; };
  const pageHelp = () => `
    <h4>電腦</h4>
    <p class="dim">WASD 移動・Shift 疾跑・滑鼠轉視角・E 上下船／互動・F 拿出釣竿・左鍵蓄力拋竿・I 背包・G 切換種子・1–4 切換農具・T 切換時段・R 切換天氣・M 靜音・Esc 選單</p>
    <h4>手機</h4>
    <p class="dim">左下按住拖曳＝移動（搖桿會出現在拇指下）・右側滑動＝轉視角・「釣魚」鈕＝拿竿／蓄力・「互動」鈕＝使用手上工具（長按切換工具）</p>
    <h4>玩法</h4>
    <p class="dim">釣魚賣錢；農地依序翻土、播種、澆水、收成，作物按季節生長；背包可賣出與買種子。一年 32 天、四季各 8 天，現實 24 分鐘＝遊戲 1 天。</p>`;
  const html = () => `
   <div class="mcard"><div class="mh"><b>選單</b><span id="mx" role="button" aria-label="關閉">✕</span></div>
    <div class="seg tabs" id="tabs">${[["gfx", "畫質"], ["save", "存檔"], ["help", "說明"]].map(([k, n]) => `<button data-k="${k}" class="${k === tab ? "on" : ""}">${n}</button>`).join("")}</div>
    ${tab === "gfx" ? pageGfx() : tab === "save" ? pageSave() : pageHelp()}
   </div>`;
  const render = () => { root.innerHTML = html(); wire(); };
  const wire = () => {
    const on = (sel, ev, fn) => { const n = root.querySelector(sel); if (n) n[ev] = fn; };
    root.querySelector("#mx").onclick = close;
    root.querySelectorAll("#tabs button").forEach(b => b.onclick = () => { tab = b.dataset.k; render(); });
    root.querySelectorAll("#tiers button").forEach(b => b.onclick = () => { if (b.dataset.t === tierName) return; settings.tier = b.dataset.t; saveSettings(settings); writeSave(collect()); try { sessionStorage.setItem("aldric.resume", "1"); } catch (e) { /* ignore */ } location.reload(); });
    on("#auto", "onchange", e => { settings.auto = e.target.checked; saveSettings(settings); });
    on("#sv", "onclick", () => onToast(writeSave(collect()) ? "已儲存" : "儲存失敗（瀏覽器可能封鎖了本機儲存，請改用匯出檔案）"));
    on("#ld2", "onclick", () => { const s = readSave(); if (!s) return onToast("沒有可讀取的存檔"); restore(s); onToast("已讀取"); close(); });
    on("#ex", "onclick", () => exportSave(collect()));
    on("#im", "onchange", async e => { try { const s = await importSave(e.target.files[0]); writeSave(s); restore(s); onToast("已匯入並讀取"); close(); } catch (err) { onToast(err.message); } });
    on("#rs", "onclick", () => { if (confirm("確定要清除存檔並重新開始？")) { clearSave(); try { sessionStorage.removeItem("aldric.resume"); } catch (e) { /* ignore */ } location.reload(); } });
  };
  function show() { open = true; render(); root.classList.add("on"); game.G.paused = true; document.exitPointerLock?.(); }
  function close() { open = false; root.classList.remove("on"); game.G.paused = false; }
  btn.onclick = () => (open ? close() : show());
  addEventListener("keydown", e => { if (e.key === "Escape" && game.G.started) (open ? close() : show()); });
  root.addEventListener("pointerdown", e => e.stopPropagation());
  return { show, close, isOpen: () => open, refresh: () => { if (open) render(); } };
}
