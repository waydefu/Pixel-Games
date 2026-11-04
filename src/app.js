import { listGames } from "./platform/registry.js";

const games = listGames();
const count = document.getElementById("game-count");
const list = document.getElementById("games");
const empty = document.getElementById("games-empty");
count.textContent = String(games.length).padStart(2, "0") + " PROJECTS";
if (games.length > 0) {
  empty.hidden = true;
  for (const game of games) {
    const link = document.createElement("a");
    link.className = "game-link";
    link.href = game.entry;
    const item = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.title;
    const summary = document.createElement("p");
    summary.textContent = game.summary;
    item.append(title, summary);
    link.append(item);
    list.append(link);
  }
}
