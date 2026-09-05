function svgPlaceholder(from: string, to: string, accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset=".58" stop-color="${to}"/><stop offset="1" stop-color="${accent}"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs><path fill="url(#g)" d="M0 0h32v20H0z"/><circle cx="22" cy="7" r="8" fill="${accent}" opacity=".28" filter="url(#b)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const AUTH_WORK_PLACEHOLDER = svgPlaceholder(
  "#8994a7",
  "#746f68",
  "#d0a45b",
);

export const AUTH_TEAM_PLACEHOLDER = svgPlaceholder(
  "#52647c",
  "#263b5c",
  "#8ba2c7",
);
