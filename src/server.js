import express from "express";
import mqtt from "mqtt";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDeviceStore, parseThreshold } from "./device-state.js";

const PORT = Number(process.env.PORT || 3000);
const MQTT_URL = process.env.MQTT_URL || "mqtt://47.109.89.8:1883";
const MQTT_UP_TOPIC = process.env.MQTT_UP_TOPIC || "baby_car/001/up";
const MQTT_DOWN_TOPIC = process.env.MQTT_DOWN_TOPIC || "baby_car/001/down";
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID ||
  `baby_car_web_${crypto.randomBytes(4).toString("hex")}`;

const app = express();
const store = createDeviceStore();
let mqttConnected = false;

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
app.use(express.json({ limit: "8kb" }));
app.use(express.static(publicDir));

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: MQTT_CLIENT_ID,
  clean: true,
  connectTimeout: 10000,
  reconnectPeriod: 3000,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined
});

mqttClient.on("connect", () => {
  mqttConnected = true;
  console.log(`MQTT connected: ${MQTT_URL}`);
  mqttClient.subscribe(MQTT_UP_TOPIC, { qos: 0 }, (error) => {
    if (error) console.error("MQTT subscribe failed:", error.message);
    else console.log(`MQTT subscribed: ${MQTT_UP_TOPIC}`);
  });
});

mqttClient.on("reconnect", () => {
  mqttConnected = false;
});
mqttClient.on("close", () => {
  mqttConnected = false;
});
mqttClient.on("error", (error) => {
  mqttConnected = false;
  console.error("MQTT error:", error.message);
});
mqttClient.on("message", (topic, buffer) => {
  if (topic !== MQTT_UP_TOPIC) return;
  try {
    store.update(JSON.parse(buffer.toString("utf8")));
  } catch (error) {
    console.warn("Ignored invalid device message:", error.message);
  }
});

app.get("/api/status", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({ mqttConnected, ...store.snapshot() });
});

app.get("/api/history", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({ points: store.getHistory() });
});

app.put("/api/threshold", (request, response) => {
  if (!mqttConnected) {
    return response.status(503).json({ error: "Cloud service is not connected to MQTT" });
  }

  let threshold;
  try {
    threshold = parseThreshold(request.body?.value);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }

  mqttClient.publish(MQTT_DOWN_TOPIC, `TEMP=${threshold}`, { qos: 0 }, (error) => {
    if (error) return response.status(502).json({ error: "MQTT publish failed" });
    response.json({ accepted: true, threshold });
  });
});

app.get("/healthz", (_request, response) => {
  response.status(mqttConnected ? 200 : 503).json({ mqttConnected });
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "API endpoint not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Baby Car web: http://localhost:${PORT}`);
});
