// Browser-native asset resolution: works locally and under a GitHub Pages repo subpath.
// Vite previously treated public/ as a virtual web root; a static server does not.
const publicRoot = new URL('../public/', import.meta.url);

export function assetUrl(relativePath) {
  return new URL(relativePath, publicRoot).href;
}
