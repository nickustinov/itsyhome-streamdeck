import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "src/plugin.ts",
  output: {
    file: "com.nickustinov.itsyhome.sdPlugin/bin/plugin.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: true,
    }),
  ],
};
