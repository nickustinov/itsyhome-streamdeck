import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/plugin.ts",
  output: {
    file: "com.nickustinov.itsyhome.sdPlugin/bin/plugin.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: true,
    }),
  ],
  external: ["@elgato/streamdeck"],
};
