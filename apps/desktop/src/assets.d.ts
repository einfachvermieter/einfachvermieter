/**
 * Vom Bundler eingebettete Dateien: SVG als Text, Schriften als data-URL
 */
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.woff2" {
  const dataUrl: string;
  export default dataUrl;
}
