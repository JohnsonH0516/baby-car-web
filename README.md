# 婴儿车手机端 HTTP 平台

该目录提供符合课设通信分层要求的最小完整实现：

```text
STM32 + ESP-01S <--MQTT--> Node.js 云端服务 <--HTTP--> 手机网页
```

STM32 主题保持不变：

- 上行：`baby_car/001/up`
- 下行：`baby_car/001/down`

## 本地启动

```powershell
cd mobile-web
npm.cmd install
npm.cmd start
```

浏览器访问 `http://localhost:3000`。同一局域网内的手机可以访问电脑的局域网 IP，例如 `http://192.168.1.10:3000`。

## HTTP API

```text
GET /api/status
GET /api/history
PUT /api/threshold  JSON: {"value": 40}
GET /healthz
```

## 可选环境变量

```text
PORT=3000
MQTT_URL=mqtt://47.109.89.8:1883
MQTT_UP_TOPIC=baby_car/001/up
MQTT_DOWN_TOPIC=baby_car/001/down
MQTT_CLIENT_ID=baby_car_web_server
MQTT_USERNAME=
MQTT_PASSWORD=
```

正式使用时将该服务部署到云服务器，并通过 Nginx 配置 HTTPS。网页通知需要 HTTPS；iPhone 上的后台系统推送还需要独立的 Web Push/APNs 服务，当前版本提供前台页面报警和浏览器通知。
