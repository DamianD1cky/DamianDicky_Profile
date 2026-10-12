// Placement happens on the CPU through instance matrices; the vertex shader only
// curls each page along its normal while the ribbon is moving.
export const vertexShader = /* glsl */ `
  uniform float uCurl;
  uniform float uPageHeight;

  attribute vec4 aCell;

  varying vec2 vUv;
  varying vec4 vCell;

  void main() {
    vec3 p = position;
    float heightRatio = (p.y + uPageHeight * 0.5) / uPageHeight;
    p.z += sin(heightRatio * 2.0) * 0.4 * uCurl;

    vUv = uv;
    vCell = aCell;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uPageAspect;
  uniform float uCellAspect;

  varying vec2 vUv;
  varying vec4 vCell;

  void main() {
    vec2 uv = vUv;
    if (!gl_FrontFacing) uv.x = 1.0 - uv.x;

    // Cover-fit the atlas cell onto the page.
    if (uPageAspect > uCellAspect) {
      uv.y = 0.5 + (uv.y - 0.5) * (uCellAspect / uPageAspect);
    } else {
      uv.x = 0.5 + (uv.x - 0.5) * (uPageAspect / uCellAspect);
    }

    gl_FragColor = texture2D(uAtlas, mix(vCell.xy, vCell.zw, uv));
  }
`;
