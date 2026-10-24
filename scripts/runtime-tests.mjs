import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const guard = new URL("./check-runtime.mjs", import.meta.url).href;

for (const [name, versions, accepted] of [
  ["rejects Node before the security patch", { node: "24.22.0" }, false],
  ["rejects older Node release lines", { node: "22.23.4" }, false],
  ["accepts the patched Node version", { node: "24.22.1" }, true],
  ["accepts subsequent Node 24 patches", { node: "24.23.0" }, true],
  ["rejects unsupported Node release lines", { node: "26.12.1" }, false],
  ["rejects Bun before the security patch", { bun: "1.4.3" }, false],
  ["accepts the patched Bun version", { bun: "1.4.4" }, true],
  ["accepts subsequent Bun releases", { bun: "1.5.0" }, true],
]) {
  test(name, () => {
    const source = `
      delete process.versions.bun;
      for (const [name, value] of Object.entries(${JSON.stringify(versions)})) {
        Object.defineProperty(process.versions, name, { value, configurable: true });
      }
      await import(${JSON.stringify(guard)});
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      encoding: "utf8",
    });
    assert.ifError(result.error);
    assert.equal(result.status, accepted ? 0 : 1, result.stderr);
    if (!accepted) assert.match(result.stderr, /vulnerable|unsupported/);
  });
}
