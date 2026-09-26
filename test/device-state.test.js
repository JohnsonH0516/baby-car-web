import test from "node:test";
import assert from "node:assert/strict";
import { createDeviceStore, parseThreshold } from "../src/device-state.js";

test("converts the STM32 payload into mobile-friendly state", () => {
  const store = createDeviceStore();
  store.update({
    temperature_x10: 256,
    temperature_valid: 1,
    threshold: 32,
    person: 1,
    alarm: 0
  }, 1000);

  assert.deepEqual(store.snapshot(2000), {
    deviceOnline: true,
    data: {
      temperature: 25.6,
      temperatureX10: 256,
      temperatureValid: true,
      threshold: 32,
      person: true,
      alarm: false,
      receivedAt: 1000
    }
  });
});

test("marks stale device data offline", () => {
  const store = createDeviceStore();
  store.update({ temperature_x10: 200, temperature_valid: 1, threshold: 32 }, 1000);
  assert.equal(store.snapshot(8001).deviceOnline, false);
});

test("validates the same threshold range as the STM32", () => {
  assert.equal(parseThreshold("40"), 40);
  assert.throws(() => parseThreshold(14), RangeError);
  assert.throws(() => parseThreshold(61), RangeError);
  assert.throws(() => parseThreshold(20.5), RangeError);
});
