import { calculateRenderSize } from "../src/rendering/quality.js";

const cases = [
  { label: "desktop 1920x1080 @1", width: 1920, height: 1080, dpr: 1 },
  { label: "mobile 844x390 @3", width: 844, height: 390, dpr: 3 },
  { label: "mobile 390x844 @3", width: 390, height: 844, dpr: 3 },
];
console.log("Planning simulation only — NOT an FPS/GPU performance test.");
console.log("scene / quality / buffer / approximate pixel count");
for (const sample of cases) {
  for (const quality of ["basic", "balanced", "high"]) {
    const size = calculateRenderSize({ cssWidth: sample.width, cssHeight: sample.height, devicePixelRatio: sample.dpr, quality });
    console.log(sample.label + " / " + quality + " / " + size.width + "x" + size.height + " / " + (size.width * size.height));
  }
}
