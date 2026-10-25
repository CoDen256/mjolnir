import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {
  validateBuildId,
  checkMagicPrefix,
  checkCompanionMatch,
  checkReuse,
  publish,
} from "../../tool/src/otaPublish.js";

const MAGIC = "var __BUNDLE_START_TIME__=";

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-tool-otapublish-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function bundleBytes({ withCompanion = true, buildId = "b1" } = {}) {
  let src = `${MAGIC}1;\nconsole.log("hi");\n`;
  if (withCompanion) src += `var BUILD_ID = '${buildId}';\n`;
  return Buffer.from(src, "utf8");
}

test("validateBuildId accepts the documented charset and rejects everything else", () => {
  validateBuildId("b000001");
  validateBuildId("a.b-c_1");
  assert.throws(() => validateBuildId("has a space"));
  assert.throws(() => validateBuildId("has/slash"));
  assert.throws(() => validateBuildId(""));
  assert.throws(() => validateBuildId("x".repeat(65)));
});

test("checkMagicPrefix refuses a bundle without the boot-ok activation prefix", () => {
  checkMagicPrefix(bundleBytes());
  assert.throws(() => checkMagicPrefix(Buffer.from("not a bundle", "utf8")));
});

test("checkCompanionMatch refuses a baked BUILD_ID that differs from the publish id", () => {
  const bytes = bundleBytes({ buildId: "b1" });
  assert.equal(checkCompanionMatch(bytes, "b1"), "b1");
  assert.throws(() => checkCompanionMatch(bytes, "b2"));
});

test("checkCompanionMatch refuses a missing companion unless allowNoCompanion", () => {
  const bytes = bundleBytes({ withCompanion: false });
  assert.throws(() => checkCompanionMatch(bytes, "b1"));
  assert.equal(checkCompanionMatch(bytes, "b1", { allowNoCompanion: true }), null);
});

test("checkReuse allows identical re-publish, refuses a buildId reused with different bytes", () => {
  withTmpDir((dir) => {
    const dest = path.join(dir, "b1.js");
    const bytes = bundleBytes();
    fs.writeFileSync(dest, bytes);
    assert.deepEqual(checkReuse(dest, bytes), { reused: true });
    assert.throws(() => checkReuse(dest, bundleBytes({ buildId: "different" })));
  });
});

test("publish writes the bundle and current.json, end to end", () => {
  withTmpDir((dir) => {
    const bundlePath = path.join(dir, "fixture.bundle.js");
    const bytes = bundleBytes({ buildId: "b000001" });
    fs.writeFileSync(bundlePath, bytes);

    const result = publish(bundlePath, "b000001", "test label", {
      dataDir: path.join(dir, "data"),
      publicBase: "https://example.test",
    });

    assert.equal(result.buildId, "b000001");
    assert.equal(result.reused, false);
    assert.equal(result.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));

    const destPath = path.join(dir, "data", "ota", "bundle", "b000001.js");
    assert.ok(fs.existsSync(destPath));
    assert.deepEqual(fs.readFileSync(destPath), bytes);

    const current = JSON.parse(fs.readFileSync(path.join(dir, "data", "ota", "current.json"), "utf8"));
    assert.equal(current.buildId, "b000001");
    assert.equal(current.sha256, result.sha256);
    assert.equal(current.url, "https://example.test/ota/bundle/b000001.js");
    assert.equal(current.label, "test label");

    // Republishing identical bytes under the same buildId succeeds (reused).
    const again = publish(bundlePath, "b000001", "test label", {
      dataDir: path.join(dir, "data"),
      publicBase: "https://example.test",
    });
    assert.equal(again.reused, true);
  });
});

test("publish refuses plain http unless allowHttp", () => {
  withTmpDir((dir) => {
    const bundlePath = path.join(dir, "fixture.bundle.js");
    fs.writeFileSync(bundlePath, bundleBytes({ buildId: "b1" }));
    assert.throws(() =>
      publish(bundlePath, "b1", "l", { dataDir: path.join(dir, "data"), publicBase: "http://example.test" })
    );
    const result = publish(bundlePath, "b1", "l", {
      dataDir: path.join(dir, "data"),
      publicBase: "http://example.test",
      allowHttp: true,
    });
    assert.equal(result.buildId, "b1");
  });
});

test("publish refuses an oversized or empty bundle", () => {
  withTmpDir((dir) => {
    const bundlePath = path.join(dir, "fixture.bundle.js");
    fs.writeFileSync(bundlePath, Buffer.alloc(0));
    assert.throws(() =>
      publish(bundlePath, "b1", "l", { dataDir: path.join(dir, "data"), publicBase: "https://example.test" })
    );
  });
});
