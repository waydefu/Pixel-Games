// Shadow strength is a colour/lighting decision, not a cloud geometry or weather-simulation change.
// Keep cloud coverage, drift, and occluder silhouettes exactly as authored.
export const CLOUD_SHADOW_BASE=Object.freeze({basic:.24,balanced:.30,high:.36});

const clamp01=value=>Number.isFinite(value)?Math.min(1,Math.max(0,value)):0;

/** Audit query ?cloudShadow= accepts a bounded override; normal quality values are deliberately softer. */
export function cloudShadowBase(quality,override=NaN){
  if(Number.isFinite(override))return Math.max(0,Math.min(.65,override));
  return CLOUD_SHADOW_BASE[quality]??CLOUD_SHADOW_BASE.balanced;
}

/**
 * Ground colour already receives the cloud-shadow map; sunlight transmission must
 * not remove most of the *same* light a second time. Weather darkness is applied
 * independently by fog, sky, and exposure, so its light fade is moderate here.
 */
export function cloudLighting(base,daylight,weatherDark,occlusion){
  const day=clamp01(daylight),dark=clamp01(weatherDark),occ=clamp01(occlusion)*day;
  const strength=Number.isFinite(base)?Math.max(0,Math.min(.65,base)):0;
  return {
    // Keep the moving shadow silhouette; reduce black patches below overcast decks.
    groundStrength:strength*day*(1-.70*dark),
    // Preserve sunlight separation under clouds, but never erase nearly all of it.
    sunTransmission:(1-.42*occ)*(1-.58*dark),
    // Skylight fills clouds and deep shade; it should not vanish when the sky darkens.
    hemisphereScale:1-.22*dark,
  };
}
