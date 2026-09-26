const MAX_HISTORY = 60;

export function createDeviceStore() {
  let current = null;
  const history = [];

  function update(payload, receivedAt = Date.now()) {
    if (typeof payload !== "object" || payload === null) {
      throw new TypeError("MQTT payload must be a JSON object");
    }

    const temperatureX10 = Number(payload.temperature_x10);
    const threshold = Number(payload.threshold);
    const temperatureValid = Number(payload.temperature_valid) === 1;
    const person = Number(payload.person) === 1;
    const alarm = Number(payload.alarm) === 1;

    if (!Number.isInteger(temperatureX10) || !Number.isInteger(threshold)) {
      throw new TypeError("MQTT payload is missing numeric temperature or threshold");
    }

    current = {
      temperature: temperatureValid ? temperatureX10 / 10 : null,
      temperatureX10,
      temperatureValid,
      threshold,
      person,
      alarm,
      receivedAt
    };

    history.push({
      temperature: current.temperature,
      threshold,
      alarm,
      receivedAt
    });
    if (history.length > MAX_HISTORY) history.shift();
    return current;
  }

  function snapshot(now = Date.now()) {
    return {
      deviceOnline: current !== null && now - current.receivedAt < 7000,
      data: current
    };
  }

  function getHistory() {
    return history.slice();
  }

  return { update, snapshot, getHistory };
}

export function parseThreshold(value) {
  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < 15 || threshold > 60) {
    throw new RangeError("Threshold must be an integer from 15 to 60");
  }
  return threshold;
}
