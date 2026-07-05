precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uIntensity;
uniform vec3 uAccentColor1;
uniform vec3 uAccentColor2;
uniform vec3 uAccentColor3;
uniform vec3 uBgColor;

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

void main() {
    float aspect = uResolution.x / uResolution.y;

    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

    vec3 color = uBgColor;

    vec2 q = (vUv * uResolution) / uResolution.y;
    float halfW = aspect * 0.5;

    const float CREST_Y = 0.16;
    const float EDGE_DROP = 0.10;
    const float MAX_EDGE_SLOPE = 0.225;

    float curv = EDGE_DROP / (halfW * halfW);
    curv = min(curv, MAX_EDGE_SLOPE / (2.0 * halfW));
    float dx = q.x - halfW;
    float surfaceY = CREST_Y - curv * dx * dx;

    float slope = 2.0 * curv * dx;
    float sd = (q.y - surfaceY) * inversesqrt(1.0 + slope * slope);

    float hot = (uMouse.x - 0.5) * 0.10;
    float tt = clamp(abs(dx / halfW - hot), 0.0, 1.0);
    vec3 rimCol = mix(uAccentColor3, uAccentColor2, smoothstep(0.10, 0.55, tt));
    rimCol = mix(rimCol, uAccentColor1, smoothstep(0.55, 0.95, tt));
    float limbFade = 1.0 - 0.6 * smoothstep(0.0, 1.0, tt);

    float breathe = 1.0 + 0.05 * sin(uTime * 0.785);
    float sunrise = 0.25 + 0.75 * uIntensity;
    float rimEnergy = breathe * sunrise * limbFade;

    float above = max(sd, 0.0);
    float rim = exp(-abs(sd) * 240.0);
    float atmoT = exp(-above * 24.0);
    float atmoW = exp(-above * 5.0);
    vec3 horizon = rimCol * (rim * 0.9 + atmoT * 0.30 + atmoW * 0.10) * rimEnergy;

    float aa = 1.5 / uResolution.y;

    float planet = 1.0 - smoothstep(-aa, aa, sd);
    vec3 bodyCol = uBgColor * 0.55 + rimCol * exp(min(sd, 0.0) * 40.0) * 0.06 * rimEnergy;

    float below = surfaceY - q.y;
    if (below > 0.012) {
        float invd = 1.0 / (below + 0.03);
        float px = 1.5 / uResolution.y;
        float scrollT = mod(uTime, 20.0) * 0.15;
        float gz = 0.45 * invd + scrollT;
        float wz = 0.45 * invd * invd * px;
        float dz = 0.5 - abs(fract(gz) - 0.5);
        float rowLine = 1.0 - smoothstep(0.0, max(wz, 1e-3), dz);
        float gx = 0.6 * dx * invd;
        float wx = 0.6 * px * invd * (1.0 + abs(dx) * invd);
        float dc = 0.5 - abs(fract(gx) - 0.5);
        float colLine = 1.0 - smoothstep(0.0, max(wx, 1e-3), dc);
        float fade = smoothstep(0.012, 0.055, below);
        fade *= 1.0 - smoothstep(0.18, 0.40, max(wz, wx));
        fade *= 1.0 - smoothstep(0.45, 0.95, tt);
        vec3 gridCol = mix(uAccentColor1, uAccentColor2, 0.35);
        bodyCol += gridCol * min(rowLine + colLine, 1.0) * fade * 0.045 * breathe * sunrise;
    }

    color = mix(color, bodyCol, planet);
    color += horizon;

    vec2 fragPx = vUv * uResolution;
    vec2 grainP = mod(fragPx, 256.0) + fract(uTime) * 71.0;
    float grain = (hash21(grainP) - 0.5) * 0.025;
    color += grain;

    vec2 vp = p;
    vp.y *= mix(0.55, 1.0, smoothstep(-0.05, 0.15, p.y));
    float vig = 1.0 - smoothstep(0.50, 1.20, length(vp));
    color *= mix(1.0, vig, 0.6);

    color = mix(uBgColor, color, uIntensity);

    gl_FragColor = vec4(color, 1.0);
}
