// The map data is a large JSON file; we only hand it to `buildWorld`, so it is typed loosely
// (this also keeps the type checker from analysing the whole file).
declare module "world-atlas/countries-110m.json" {
  const topology: unknown;
  export default topology;
}
