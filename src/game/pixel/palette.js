// One shared palette for every texture, sprite and graded surface.
// Ramps run dark -> light and are hue-shifted the way a pixel artist paints:
// shadows drift cool and saturated (blue/violet), highlights drift warm and soft.
// Hand-picked values (original to this project); the shared ramps are what make
// plaster, stone, foliage and the traveller read as one world.
export const OUTLINE = "#140f17"; // plum-black, never pure black

export const PALETTE = Object.freeze({
  grass:    Object.freeze(["#14322f","#1d4535","#2b5b38","#3d7239","#518a3d","#6a9f44","#88b552","#a9c876"]),
  grassDry: Object.freeze(["#2b3a2e","#41503a","#5f6a40","#7f8447","#a09a54","#bdb065","#d8c780","#efdfa3"]),
  foliage:  Object.freeze(["#0d2420","#143a2d","#1f5333","#2f6c38","#44853f","#62a049","#88ba57","#b3d377"]),
  pine:     Object.freeze(["#0a1f27","#10322f","#194a36","#26623a","#387b3f","#4f9546","#73ad52","#9ec675"]),
  stone:    Object.freeze(["#2a3040","#394254","#4b5766","#606d77","#778289","#8f958f","#a8aa9d","#c2bfab"]),
  birchbark: Object.freeze(["#222226","#4a4a50","#7c7b79","#b2afa6","#d3d0c3","#ebe8dc"]),
  bark:     Object.freeze(["#150f13","#241a1b","#38271f","#4f3828","#664c36","#80644a","#9a7e61"]),
  rock:     Object.freeze(["#2b3243","#3a4456","#4d5968","#62707a","#7a858b","#929991","#abaca0","#c4c1ae"]),
  cliff:    Object.freeze(["#272e3d","#353f4d","#475562","#5c6b75","#74818a","#8c9794","#a4aaa2","#bfc1b0"]),
  plaster:  Object.freeze(["#46394a","#695a5d","#8d7a6c","#b09b83","#cab698","#ddcdaa","#ecdfbc","#f8eed2"]),
  wood:     Object.freeze(["#2a1b22","#3d2629","#57342f","#6d4535","#825740","#966b4a","#aa7f58","#be9a6c"]),
  timber:   Object.freeze(["#1a1318","#271b21","#38252b","#4b343a","#5f453f","#745a4c","#8a7060","#a08874"]),
  roofRed:  Object.freeze(["#26142a","#46202d","#6a2d32","#8f4139","#b05944","#cf7a52","#e59d65","#f4c383"]),
  roofBlue: Object.freeze(["#141d2c","#212f42","#314959","#456577","#5d8493","#7ea3ac","#a2c3c1","#c9dfce"]),
  thatch:   Object.freeze(["#33292d","#554336","#7a6143","#9d8151","#bda065","#d8bf82","#ebd9a3","#f8efc7"]),
  sand:     Object.freeze(["#7e7078","#a6948d","#cbb9a6","#e4d6bf","#f0e6d0","#f7efdc","#fcf7ea","#ffffff"]),
  water:    Object.freeze(["#0c2a44","#103f5c","#17566f","#216f80","#2f8a90","#49a59d","#78c1ac","#b3dcc0"]),
  canvas:   Object.freeze(["#4a3a3a","#7c5f55","#a98368","#cba883","#e2c99d","#f0dfb8","#f9efd0","#fffbea"]),
  brick:    Object.freeze(["#2a1626","#4a2230","#6e3036","#92473f","#b3624c","#cf8259","#e5a56e","#f4cc90"]),
  gold:     Object.freeze(["#3b2a22","#6d4a2c","#a2713a","#cf9a46","#eac45f","#f8de88","#fff0b4","#fffbe0"]),
  fire:     Object.freeze(["#5a1d1d","#9c3520","#d4581f","#f08a22","#ffb53a","#ffd868","#fff0a8","#ffffe0"]),
  // Angler outfit (reference photo): olive utility vest, grey-green base layer, bucket hat, trail shoes.
  olive:    Object.freeze(["#161b14","#232b1e","#34402a","#4a5836","#617046","#7c8b5a","#9aa974"]),
  shirt:    Object.freeze(["#1b2224","#2a3537","#3e4e4f","#556867","#6e8380","#8aa09a"]),
  hat:      Object.freeze(["#22251d","#363a2d","#4d5240","#686d57","#858a6f","#a3a78a"]),
  shorts:   Object.freeze(["#191c15","#272b1f","#383d2a","#4c523a","#636a4a"]),
  shoe:     Object.freeze(["#171815","#2a2c27","#40433b","#595c52","#76796d"]),
  black:    Object.freeze(["#0b0a10","#16141d","#242230","#363444"]),
  skin:     Object.freeze(["#5a3040","#8a4c4c","#b8715c","#d99a76","#efbc92","#f9d8b0"]),
  hair:     Object.freeze(["#1a1220","#2e1e26","#4a3029","#6b4630","#8d6338","#b0864a"]),
});

export function parseHex(hex) {
  const value = parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
export const rampRgb = ramp => ramp.map(parseHex);
export function rampAt(ramp, index) {
  return ramp[Math.min(ramp.length - 1, Math.max(0, index | 0))];
}
