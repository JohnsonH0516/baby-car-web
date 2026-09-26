const elements = {
  connection: document.querySelector("#connection"),
  connectionText: document.querySelector("#connectionText"),
  alarmBanner: document.querySelector("#alarmBanner"),
  dismissAlarm: document.querySelector("#dismissAlarm"),
  temperature: document.querySelector("#temperature"),
  temperatureState: document.querySelector("#temperatureState"),
  threshold: document.querySelector("#threshold"),
  person: document.querySelector("#person"),
  alarm: document.querySelector("#alarm"),
  updatedAt: document.querySelector("#updatedAt"),
  slider: document.querySelector("#thresholdSlider"),
  thresholdOutput: document.querySelector("#thresholdOutput"),
  saveButton: document.querySelector("#saveThreshold"),
  feedback: document.querySelector("#feedback"),
  chart: document.querySelector("#temperatureChart")
};

let lastAlarm = false;
let alarmDismissed = false;
let sliderTouched = false;

elements.slider.addEventListener("input", () => {
  sliderTouched = true;
  elements.thresholdOutput.value = `${elements.slider.value}°C`;
});

elements.dismissAlarm.addEventListener("click", () => {
  alarmDismissed = true;
  elements.alarmBanner.classList.add("hidden");
});

elements.saveButton.addEventListener("click", async () => {
  setFeedback("正在下发...", false);
  elements.saveButton.disabled = true;
  try {
    const response = await fetch("/api/threshold", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: Number(elements.slider.value) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "设置失败");
    setFeedback(`已发送 ${result.threshold}°C，等待设备确认`, false);
    sliderTouched = false;
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    elements.saveButton.disabled = false;
  }
});

function setFeedback(message, error) {
  elements.feedback.textContent = message;
  elements.feedback.classList.toggle("error", error);
}

function updateStatus(status) {
  const online = status.mqttConnected && status.deviceOnline;
  elements.connection.className = `connection ${online ? "online" : "error"}`;
  elements.connectionText.textContent = online ? "设备在线" : status.mqttConnected ? "设备离线" : "云端离线";

  if (!status.data) return;
  const data = status.data;
  elements.temperature.textContent = data.temperatureValid ? data.temperature.toFixed(1) : "--.-";
  elements.temperatureState.textContent = data.temperatureValid ? "传感器正常" : "温度数据无效";
  elements.threshold.textContent = data.threshold;
  elements.person.textContent = data.person ? "有人" : "无人";
  elements.alarm.textContent = data.alarm ? "报警" : "正常";
  elements.alarm.classList.toggle("danger", data.alarm);
  elements.updatedAt.textContent = new Date(data.receivedAt).toLocaleTimeString("zh-CN", { hour12: false });

  if (!sliderTouched) {
    elements.slider.value = data.threshold;
    elements.thresholdOutput.value = `${data.threshold}°C`;
  }

  if (!data.alarm) alarmDismissed = false;
  elements.alarmBanner.classList.toggle("hidden", !data.alarm || alarmDismissed);
  if (data.alarm && !lastAlarm) notifyAlarm(data);
  lastAlarm = data.alarm;
}

async function notifyAlarm(data) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification("婴儿车高温报警", {
      body: `检测到有人，当前温度 ${data.temperature?.toFixed(1) ?? "--"}°C，阈值 ${data.threshold}°C`
    });
  }
}

async function refresh() {
  try {
    const [statusResponse, historyResponse] = await Promise.all([
      fetch("/api/status", { cache: "no-store" }),
      fetch("/api/history", { cache: "no-store" })
    ]);
    if (!statusResponse.ok || !historyResponse.ok) throw new Error("HTTP API unavailable");
    updateStatus(await statusResponse.json());
    drawChart((await historyResponse.json()).points);
  } catch (_error) {
    elements.connection.className = "connection error";
    elements.connectionText.textContent = "服务离线";
  }
}

function drawChart(points) {
  const canvas = elements.chart;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const pad = 24;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#e3e8e5";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const y = pad + ((height - pad * 2) * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
  }

  const values = points.filter((point) => point.temperature !== null);
  if (values.length < 2) {
    ctx.fillStyle = "#7a8580";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("等待更多温度数据", width / 2, height / 2);
    return;
  }

  const temps = values.map((point) => point.temperature);
  const min = Math.min(...temps) - 1;
  const max = Math.max(...temps) + 1;
  ctx.strokeStyle = "#16875f";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  values.forEach((point, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.temperature - min) / (max - min || 1)) * (height - pad * 2);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

window.addEventListener("resize", refresh);
refresh();
setInterval(refresh, 2000);
