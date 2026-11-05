/** The API lives on port 8443 of whichever host served this page. */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8443`;
