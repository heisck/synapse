// Empty stub aliased in place of Node built-ins (fs, path) for the BROWSER
// bundle only. Piper's wasm loader (@mintplex-labs/piper-tts-web, emscripten
// glue) contains `require("fs")` / `require("path")` inside an
// `if (ENVIRONMENT_IS_NODE)` branch that never runs in the browser — but the
// bundler still has to resolve those specifiers. Pointing them at this empty
// module lets the client build succeed; the code path is dead at runtime.
export default {};
