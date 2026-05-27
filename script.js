/* =========================
   バドミントン快適チェッカー
========================= */

const DEFAULT_LOCATION = {
    lat: 35.4658,
    lon: 139.6223,
    name: "横浜駅"
};

let windSpeed = 0;
let windDeg = 0;

/* =========================
   風向き → 方角名
========================= */
function dirName(deg) {
    const dirs = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
    return dirs[Math.round(deg / 45) % 8];
}

/* =========================
   現在位置取得（GPS → IP → DEFAULT）
========================= */
async function getLocation() {
    // ① GPS（最優先）
    const gpsPromise = new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    name: "現在位置(GPS)"
                });
            },
            () => resolve(null),
            {
                enableHighAccuracy: true,
                timeout: 4000,
                maximumAge: 0
            }
        );
    });

    const gps = await gpsPromise;
    if (gps) return gps;

    // ② IP 位置情報（GPS が拒否 or 失敗した場合）
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();

        if (data && data.latitude && data.longitude) {
            return {
                lat: data.latitude,
                lon: data.longitude,
                name: data.city || "現在位置(IP)"
            };
        }
    } catch (e) {
        console.warn("IP位置情報取得失敗", e);
    }

    // ③ DEFAULT（最終手段）
    return DEFAULT_LOCATION;
}

/* =========================
   天気取得
========================= */
async function loadWeather() {
    try {
        const loc = await getLocation();

        const locationEl = document.querySelector(".location");
        if (locationEl) {
            locationEl.textContent = `${loc.name} (${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)})`;
        }

        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;

        const res = await fetch(url);
        const data = await res.json();
        const current = data.current;

        const temp = current.temperature_2m;
        const humidity = current.relative_humidity_2m;
        windSpeed = current.wind_speed_10m;
        windDeg = current.wind_direction_10m;

        updateWeatherUI(temp, humidity, windSpeed, windDeg);
        updateResult(temp, humidity, windSpeed);
        updateMap(loc.lat, loc.lon);

    } catch (err) {
        console.error(err);
        const resultEl = document.getElementById("result");
        if (resultEl) resultEl.textContent = "天気取得失敗";
    }
}

/* =========================
   UI更新
========================= */
function updateWeatherUI(temp, humidity, windSpeed, windDeg) {
    const tempEl = document.getElementById("temp");
    const humidityEl = document.getElementById("humidity");
    const windEl = document.getElementById("wind");
    const winddirEl = document.getElementById("winddir");

    if (tempEl) tempEl.textContent = temp + "°C";
    if (humidityEl) humidityEl.textContent = humidity + "%";
    if (windEl) windEl.textContent = windSpeed + " km/h";
    if (winddirEl) winddirEl.textContent = dirName(windDeg);

    const arrow = document.getElementById("arrow");
    if (arrow) arrow.style.transform = `rotate(${windDeg}deg)`;
}

/* =========================
   判定
========================= */
function updateResult(temp, humidity, windSpeed) {
    let result = "";

    if (
        temp >= 20 && temp <= 24 &&
        humidity >= 40 && humidity <= 60 &&
        windSpeed <= 4
    ) {
        result = "🏸 とても快適";

    } else if (
        (temp >= 25 && temp <= 28) ||
        (windSpeed > 4 && windSpeed <= 15)
    ) {
        result = "😅 少し暑い / 風あり";

    } else if (temp >= 29 || windSpeed > 15) {
        result = "🌪 風が強い";

    } else if (temp <= 14) {
        result = "🥶 寒い";

    } else {
        result = "🙂 普通";
    }

    if (windSpeed >= 30) {
        result += " / 非常に強風";
    } else if (windSpeed >= 20) {
        result += " / 強風";
    } else if (windSpeed >= 10) {
        result += " / シャトル注意";
    } else if (windSpeed <= 3) {
        result += " / 無風";
    }

    const resultEl = document.getElementById("result");
    if (resultEl) resultEl.textContent = result;
}

/* =========================
   マップ更新
========================= */
function updateMap(lat, lon) {
    const iframe = document.querySelector("iframe");
    if (iframe) {
        iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
    }
}

/* =========================
   スクロール
========================= */
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

/* =========================
   紙吹雪アニメーション
========================= */
const canvas = document.getElementById("canvas");

if (canvas) {
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    }

    resize();
    addEventListener("resize", resize);

    const particles = [];
    function createParticle() {
        return {
            x: Math.random() * innerWidth,
            y: Math.random() * innerHeight,
            size: Math.random() * 5 + 2,
            rotate: Math.random() * 360,
            speed: Math.random() * 1 + 0.5
        };
    }

    for (let i = 0; i < 160; i++) particles.push(createParticle());

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rad = windDeg * Math.PI / 180;
        const vx = Math.sin(rad) * windSpeed / 3;
        const vy = -Math.cos(rad) * windSpeed / 3;

        particles.forEach(p => {
            p.x += vx + p.speed;
            p.y += vy + p.speed * 0.3;
            p.rotate += 2;

            if (p.x > innerWidth + 20 || p.x < -20 || p.y > innerHeight + 20 || p.y < -20) {
                p.x = Math.random() * innerWidth;
                p.y = -10;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotate * Math.PI / 180);
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
            ctx.restore();
        });

        requestAnimationFrame(animate);
    }

    animate();
}

/* =========================
   方向センサー（iOS対応）
========================= */

const sensorArrow = document.getElementById("sensorArrow");
const sensorDeg = document.getElementById("sensorDeg");

function handleOrientation(e) {
    const deg = e.alpha || 0;

    if (sensorArrow) sensorArrow.style.transform = `rotate(${deg}deg)`;
    if (sensorDeg) sensorDeg.textContent = Math.round(deg) + "°";
}

// iOS の許可ボタンを作成
async function enableOrientation() {
    if (typeof DeviceOrientationEvent === "undefined") {
        alert("このブラウザは方向センサーに対応していません");
        return;
    }

    // iOS の場合は許可が必要
    if (DeviceOrientationEvent.requestPermission) {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
            alert("方向センサーの利用が許可されませんでした");
            return;
        }
    }

    // 許可されたらイベント開始
    window.addEventListener("deviceorientation", handleOrientation);
}

// ページにボタンを追加（自動で）
window.addEventListener("load", () => {
    const btn = document.createElement("button");
    btn.textContent = "方向センサーを有効化";
    btn.style.padding = "10px 20px";
    btn.style.margin = "10px";
    btn.style.fontSize = "16px";
    btn.onclick = enableOrientation;

    document.body.appendChild(btn);
});


/* =========================
   開始
========================= */
function startWeatherLoop() {
    loadWeather();
    setInterval(loadWeather, 60000);
}

startWeatherLoop();
