// No game is selected or registered yet.
// Entries must be local, reviewed pages. Never inject untrusted HTML.
const catalog = Object.freeze([]);

export function validateGame(game) {
  if (!game || typeof game !== "object") throw new TypeError("game must be an object");
  if (typeof game.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id)) throw new TypeError("invalid game id");
  if (typeof game.title !== "string" || !game.title.trim()) throw new TypeError("missing game title");
  if (typeof game.summary !== "string" || !game.summary.trim()) throw new TypeError("missing game summary");
  if (typeof game.entry !== "string" || !/^\.\/games\/[a-z0-9-]+\/index\.html$/.test(game.entry)) throw new TypeError("entry must be a local game page");
  return true;
}

export function listGames() {
  const ids = new Set();
  for (const game of catalog) {
    validateGame(game);
    if (ids.has(game.id)) throw new Error("duplicate game id: " + game.id);
    ids.add(game.id);
  }
  return catalog.slice();
}
