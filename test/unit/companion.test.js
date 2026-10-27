import test from "node:test";
import assert from "node:assert/strict";
import { appendCompanion } from "../../src/commands/companion.js";

const PLACEHOLDER_COMPANION = "(function(){ var id='__MJOLNIR_BUILD_ID__'; })();";
const PLAIN_COMPANION = "(function(){ /* no buildId */ })();";

// A bundle whose trailer mirrors the real one: entry calls then sourcemap comments.
function bundleWithMap() {
  return Buffer.from(
    "var __BUNDLE_START_TIME__=0;\n__d(function(){},0,[]);\n__r(160);\n__r(0);\n//# sourceMappingURL=x.map\n//# debugId=abc\n",
    "utf8"
  );
}
// A bundle with no sourcemap comment (like the test fixture: entry call, then EOF).
function bundleNoMap() {
  return Buffer.from("var __BUNDLE_START_TIME__=0;\n__d(function(){},0,[]);\n__r(824);\n", "utf8");
}

test("inserts the companion before the sourcemap comments, after the entry call", () => {
  const out = appendCompanion(bundleWithMap(), PLACEHOLDER_COMPANION, {
    buildId: "b000002",
    name: "boot-ok",
  }).toString("utf8");
  const entryIdx = out.indexOf("__r(0);");
  const bodyIdx = out.indexOf("b000002");
  const mapIdx = out.indexOf("//# sourceMappingURL");
  assert.ok(entryIdx < bodyIdx, "companion runs after the entry call");
  assert.ok(bodyIdx < mapIdx, "companion sits before the sourcemap comments");
  assert.ok(out.endsWith("//# debugId=abc\n"), "sourcemap comments stay last");
});

test("substitutes the buildId placeholder", () => {
  const out = appendCompanion(bundleWithMap(), PLACEHOLDER_COMPANION, {
    buildId: "b000002",
    name: "boot-ok",
  }).toString("utf8");
  assert.ok(out.includes("id='b000002'"));
  assert.ok(!out.includes("__MJOLNIR_BUILD_ID__"));
});

test("leaves the 26-byte activation prefix untouched (D51)", () => {
  const out = appendCompanion(bundleWithMap(), PLACEHOLDER_COMPANION, {
    buildId: "b000002",
    name: "boot-ok",
  });
  assert.equal(out.subarray(0, 26).toString("utf8"), "var __BUNDLE_START_TIME__=");
});

test("appends at EOF when there is no sourcemap comment", () => {
  const out = appendCompanion(bundleNoMap(), PLACEHOLDER_COMPANION, {
    buildId: "b000002",
    name: "boot-ok",
  }).toString("utf8");
  assert.ok(out.indexOf("__r(824);") < out.indexOf("b000002"));
});

test("requires a buildId only when the companion uses the placeholder", () => {
  assert.throws(
    () => appendCompanion(bundleWithMap(), PLACEHOLDER_COMPANION, { name: "boot-ok" }),
    /no buildId was given/
  );
  // A companion without the placeholder needs no buildId.
  const out = appendCompanion(bundleWithMap(), PLAIN_COMPANION, { name: "debug" }).toString("utf8");
  assert.ok(out.includes("/* no buildId */"));
});

test("rejects a buildId outside the D48 charset", () => {
  assert.throws(
    () => appendCompanion(bundleWithMap(), PLACEHOLDER_COMPANION, { buildId: "bad id!", name: "boot-ok" }),
    /buildId must match/
  );
});

test("substitutes baseVersion and patchRev placeholders alongside buildId with no interaction", () => {
  const companion = "(function(){ var b='__MJOLNIR_BUILD_ID__'; var v='__MJOLNIR_BASE_VERSION__'; var p=__MJOLNIR_PATCH_REV__; })();";
  const out = appendCompanion(bundleWithMap(), companion, {
    buildId: "b000002",
    baseVersion: "1.5.12",
    patchRev: 3,
    name: "boot-ok",
  }).toString("utf8");
  assert.ok(out.includes("b='b000002'"));
  assert.ok(out.includes("v='1.5.12'"));
  assert.ok(out.includes("p=3"));
  assert.ok(!out.includes("__MJOLNIR_"));
});

test("requires baseVersion/patchRev only when their own placeholder is present", () => {
  assert.throws(
    () => appendCompanion(bundleWithMap(), "var v='__MJOLNIR_BASE_VERSION__';", { name: "boot-ok" }),
    /no baseVersion was given/
  );
  assert.throws(
    () => appendCompanion(bundleWithMap(), "var p=__MJOLNIR_PATCH_REV__;", { name: "boot-ok" }),
    /no patchRev was given/
  );
  // Neither placeholder present — neither option is required.
  const out = appendCompanion(bundleWithMap(), PLAIN_COMPANION, { name: "debug" }).toString("utf8");
  assert.ok(out.includes("/* no buildId */"));
});

test("rejects a patchRev that isn't a non-negative integer", () => {
  assert.throws(
    () => appendCompanion(bundleWithMap(), "var p=__MJOLNIR_PATCH_REV__;", { patchRev: -1, name: "boot-ok" }),
    /patchRev must be/
  );
  assert.throws(
    () => appendCompanion(bundleWithMap(), "var p=__MJOLNIR_PATCH_REV__;", { patchRev: 1.5, name: "boot-ok" }),
    /patchRev must be/
  );
});

test("refuses to append the same companion twice", () => {
  const once = appendCompanion(bundleWithMap(), PLACEHOLDER_COMPANION, { buildId: "b000002", name: "boot-ok" });
  assert.throws(
    () => appendCompanion(once, PLACEHOLDER_COMPANION, { buildId: "b000002", name: "boot-ok" }),
    /already present/
  );
});
