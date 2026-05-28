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
    enableOrientation();
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

    const windNeedleEl = document.getElementById("windNeedle");
    if (windNeedleEl) windNeedleEl.style.transform = `rotate(${windDeg}deg)`;
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
   ページ切り替え（スライド）
========================= */
const pageOrder = ['weather', 'map', 'sensor'];
let currentPageId = 'weather';

function showPage(nextId) {
    if (nextId === currentPageId) return;

    const currentIdx = pageOrder.indexOf(currentPageId);
    const nextIdx = pageOrder.indexOf(nextId);
    const direction = nextIdx > currentIdx ? 'next' : 'back';

    const currentEl = document.getElementById(currentPageId);
    const nextEl = document.getElementById(nextId);

    // アニメーションクラスをリセット
    currentEl.classList.remove('active', 'slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
    nextEl.classList.remove('active', 'slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');

    if (direction === 'next') {
        // 次のページへ：現在のページが左へ消え、次のページが右から来る
        currentEl.classList.add('active', 'slide-out-left');
        nextEl.classList.add('active', 'slide-in-right');
    } else {
        // 前のページへ：現在のページが右へ消え、前のページが左から来る
        currentEl.classList.add('active', 'slide-out-right');
        nextEl.classList.add('active', 'slide-in-left');
    }

    // アニメーション終了後に状態を確定
    setTimeout(() => {
        currentEl.classList.remove('active', 'slide-out-left', 'slide-out-right');
        nextEl.classList.remove('slide-in-left', 'slide-in-right');
        currentPageId = nextId;
    }, 400);

    window.scrollTo(0, 0);
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
   方向センサー（iOS/Android対応）
========================= */

const compassRose = document.getElementById("compassRose");
const windNeedle = document.getElementById("windNeedle");
const deviceHeadingEl = document.getElementById("deviceHeading");
const windDirectionEl = document.getElementById("windDirection");

function handleOrientation(e) {
    let heading = 0;

    // iOS (Safari) のコンパス方向
    if (e.webkitCompassHeading) {
        heading = e.webkitCompassHeading;
    } 
    // Android (Chrome) の絶対方向
    else if (e.absolute && e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
    } 
    // フォールバック（相対的な動きのみ）
    else {
        heading = e.alpha || 0;
    }

    // コンパスの盤面を回転（北を固定するため自分の向きの逆回転）
    if (compassRose) {
        compassRose.style.transform = `rotate(${-heading}deg)`;
    }

    // テキスト表示の更新
    if (deviceHeadingEl) {
        deviceHeadingEl.textContent = dirName(heading) + ` (${Math.round(heading)}°)`;
    }
    if (windDirectionEl) {
        windDirectionEl.textContent = dirName(windDeg) + ` (${Math.round(windDeg)}°)`;
    }
}

// 許可ボタンの処理
async function enableOrientation() {

    const btn = document.getElementById("orientation-btn");

    try {
        // iOS の場合は許可が必要
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== "granted") {
                alert("方向センサーの利用が許可されませんでした");
                return;
            }
        }

        // センサーイベントの登録
        // Android/Chrome は deviceorientationabsolute を優先
        if ("ondeviceorientationabsolute" in window) {
            window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        } else {
            window.addEventListener("deviceorientation", handleOrientation, true);
        }

        if (btn) btn.style.display = "none";

    } catch (e) {
        console.error(e);
        alert("センサーの初期化に失敗しました");
    }
}

/* =========================
   開始
========================= */
function startWeatherLoop() {
    loadWeather();
    setInterval(loadWeather, 60000);
}

startWeatherLoop();
