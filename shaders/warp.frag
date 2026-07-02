precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uIntensity;
uniform vec3 uAccentColor1; // deep orange-red #FF4D00 — limb edges
uniform vec3 uAccentColor2; // orange #FF914D — mid-limb / atmosphere
uniform vec3 uAccentColor3; // gold   #FFD700 — crest rim light
uniform vec3 uBgColor;      // void   #04050B

// NOTE: every smoothstep below keeps edge0 < edge1 (reversed edges are
// undefined per the GLSL spec). Falloffs use 1.0 - smoothstep(...) or exp().

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

// ── Starfield ─────────────────────────────────────────────────────────
// Drawn in aspect-corrected p-space so stars stay round on any aspect.
// `scale` sets density, `bright` the layer weight, `glint` enables
// plus-shaped diffraction spikes on the brightest stars.

vec3 starLayer(vec2 p, float scale, float bright, float glint) {
    vec2 gp = p * scale;
    vec2 id = floor(gp);
    vec2 gv = fract(gp) - 0.5;

    float n = hash21(id);
    // Only the top ~10% of cells hold a star.
    if (n < 0.90) return vec3(0.0);

    // Jitter the star within its cell.
    vec2 offset = (vec2(hash21(id + 1.7), hash21(id + 4.3)) - 0.5) * 0.7;
    vec2 d = gv - offset;
    float dist = length(d);

    // Soft round core.
    float core = 1.0 - smoothstep(0.0, 0.07, dist);
    core *= core;

    // Gentle per-star twinkle.
    float tw = 0.65 + 0.35 * sin(uTime * (0.7 + n * 2.0) + n * 30.0);

    vec3 col = vec3(core * tw) * vec3(0.9, 0.95, 1.0); // cool-white

    // Diffraction glints on the very brightest stars only.
    if (glint > 0.5 && n > 0.985) {
        float gx = (1.0 - smoothstep(0.0, 0.45, abs(d.x))) * (1.0 - smoothstep(0.0, 0.02, abs(d.y)));
        float gy = (1.0 - smoothstep(0.0, 0.45, abs(d.y))) * (1.0 - smoothstep(0.0, 0.02, abs(d.x)));
        float spike = (gx + gy) * 0.5 * tw;
        col += spike * vec3(1.0, 0.96, 0.9); // warm-white flare
    }

    return col * bright;
}

void main() {
    float aspect = uResolution.x / uResolution.y;

    // Aspect-corrected, centered space for the stars + vignette.
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

    // Very subtle mouse parallax + slow drift give a sense of travel.
    vec2 par = (uMouse - 0.5);

    vec3 color = uBgColor;

    // Two dim depth layers above the horizon: near (glinted) → far dust.
    color += starLayer(p + par * 0.050 + vec2(uTime * 0.0022, 0.0), 16.0, 0.34, 1.0);
    color += starLayer(p + par * 0.025 + vec2(uTime * 0.0012, 0.0), 30.0, 0.20, 0.0);

    // ── Eclipse horizon ─────────────────────────────────────────────────
    // Height-normalized pixel space (q.y in [0,1], q.x in [0,aspect]) keeps
    // the arc geometry consistent across aspects. The arc is a PARABOLA,
    // not a circle SDF: the equivalent circle center sits ~4–16 height
    // units below the viewport and length() at that distance exceeds
    // mediump precision (the thin rim would shimmer/band). The parabola is
    // visually identical for a gentle arc and keeps every value O(1).
    vec2 q = (vUv * uResolution) / uResolution.y;
    float halfW = aspect * 0.5;

    const float CREST_Y = 0.16;   // crest height, fraction of viewport height
    const float EDGE_DROP = 0.10; // surface fall at the screen edges
    // Cap the edge slope at the 16:9 value (~13°). Without it, portrait
    // aspects squeeze the full EDGE_DROP into a narrow width and the limb
    // reads as a tight egg-shaped dome instead of a planetary horizon.
    const float MAX_EDGE_SLOPE = 0.225;

    float curv = EDGE_DROP / (halfW * halfW); // aspect-adaptive curvature
    curv = min(curv, MAX_EDGE_SLOPE / (2.0 * halfW));
    float dx = q.x - halfW;
    float surfaceY = CREST_Y - curv * dx * dx;

    // Slope-corrected signed distance (>0 above the surface) so the rim
    // keeps its thickness on steep portrait edges.
    float slope = 2.0 * curv * dx;
    float sd = (q.y - surfaceY) * inversesqrt(1.0 + slope * slope);

    // Limb color ramp: gold at the crest → orange → deep red at the edges.
    // `hot` nudges the bright spot with the mouse.
    float hot = (uMouse.x - 0.5) * 0.10;
    float tt = clamp(abs(dx / halfW - hot), 0.0, 1.0);
    vec3 rimCol = mix(uAccentColor3, uAccentColor2, smoothstep(0.10, 0.55, tt));
    rimCol = mix(rimCol, uAccentColor1, smoothstep(0.55, 0.95, tt));
    float limbFade = 1.0 - 0.6 * smoothstep(0.0, 1.0, tt);

    // Rim breathes slowly; `sunrise` makes the rim lag the global entrance
    // mix so the intro reads as a sun cresting behind the planet.
    float breathe = 1.0 + 0.05 * sin(uTime * 0.785); // ±5%, ~8 s period
    float sunrise = 0.25 + 0.75 * uIntensity;
    float rimEnergy = breathe * sunrise * limbFade;

    float above = max(sd, 0.0);
    float rim = exp(-abs(sd) * 240.0);  // thin limb line, ~4 px on 1080-tall
    float atmoT = exp(-above * 24.0);   // tight inner glow hugging the surface
    float atmoW = exp(-above * 5.0);    // soft upward bleed
    vec3 horizon = rimCol * (rim * 0.9 + atmoT * 0.30 + atmoW * 0.10) * rimEnergy;

    float aa = 1.5 / uResolution.y;

    // Planet body occludes the stars; whisper of under-limb scatter.
    float planet = 1.0 - smoothstep(-aa, aa, sd);
    vec3 bodyCol = uBgColor * 0.55 + rimCol * exp(min(sd, 0.0) * 40.0) * 0.06 * rimEnergy;

    // ── Surface grid ────────────────────────────────────────────────────
    // Perspective plane following the parabolic horizon, scrolling toward
    // the viewer. Added into bodyCol so the planet mask clips it with the
    // limb's own AA. Line widths come from the analytic derivative of the
    // grid coordinate (~1.5 px at any depth/DPR — no fwidth in ES 1.00),
    // and the fades zero it before the perspective singularity / moiré
    // zone at the horizon.
    float below = surfaceY - q.y; // >0 inside the body
    if (below > 0.012) {
        float invd = 1.0 / (below + 0.03); // max ≈ 24 → mediump-safe
        float px = 1.5 / uResolution.y;
        // 0.15 * 20 = 3.0 exactly → seamless 20 s scroll wrap.
        float scrollT = mod(uTime, 20.0) * 0.15;
        float gz = 0.45 * invd + scrollT;
        float wz = 0.45 * invd * invd * px;
        float dz = 0.5 - abs(fract(gz) - 0.5);
        float rowLine = 1.0 - smoothstep(0.0, max(wz, 1e-3), dz);
        // Columns converge at the LOCAL horizon (below is measured from
        // the curved surfaceY), so rays follow the arc.
        float gx = 0.6 * dx * invd;
        float wx = 0.6 * px * invd * (1.0 + abs(dx) * invd);
        float dc = 0.5 - abs(fract(gx) - 0.5);
        float colLine = 1.0 - smoothstep(0.0, max(wx, 1e-3), dc);
        // Fades: (a) just below the rim, (b) coverage/moiré guard — px
        // doubles at low DPR so this self-tightens, (c) bottom corners.
        float fade = smoothstep(0.012, 0.055, below);
        fade *= 1.0 - smoothstep(0.18, 0.40, max(wz, wx));
        fade *= 1.0 - smoothstep(0.45, 0.95, tt);
        vec3 gridCol = mix(uAccentColor1, uAccentColor2, 0.35);
        bodyCol += gridCol * min(rowLine + colLine, 1.0) * fade * 0.045 * breathe * sunrise;
    }

    color = mix(color, bodyCol, planet);
    color += horizon;

    // ── Film grain ──────────────────────────────────────────────────────
    // Bounded coordinate (mod) keeps the hash well within mediump precision.
    // Applied after the horizon so it dithers the atmosphere gradient.
    vec2 fragPx = vUv * uResolution;
    vec2 grainP = mod(fragPx, 256.0) + fract(uTime) * 71.0;
    float grain = (hash21(grainP) - 0.5) * 0.025;
    color += grain;

    // ── Vignette ────────────────────────────────────────────────────────
    // Relaxed on the lower half so it doesn't crush the deep-red rim ends.
    vec2 vp = p;
    vp.y *= mix(0.55, 1.0, smoothstep(-0.05, 0.15, p.y));
    float vig = 1.0 - smoothstep(0.50, 1.20, length(vp));
    color *= mix(1.0, vig, 0.6);

    // ── Entrance ────────────────────────────────────────────────────────
    color = mix(uBgColor, color, uIntensity);

    gl_FragColor = vec4(color, 1.0);
}
