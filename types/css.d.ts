// Ambient declaration so TypeScript 6 accepts side-effect CSS imports
// (e.g. `import "./globals.css"`), which it no longer allows without one.
declare module "*.css";
