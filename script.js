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
   風向き → 方角名 (16方位)
========================= */
function dirName(deg) {
    const dirs = [
        "北", "北北東", "北東", "東北東",
        "東", "東南東", "南東", "南南東",
        "南", "南南西", "南西", "西南西",
        "西", "西北西", "北西", "北北西"
    ];
    return dirs[Math.round(deg / 22.5) % 16];
}

/* =========================
   現在位置取得（GPS → IP1 → IP2 → DEFAULT）
========================= */
async function getLocation() {
    console.log("位置情報を取得中...");

    // ① GPS（最優先）
    const gpsPromise = new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn("このブラウザはGPSをサポートしていません");
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                console.log("GPS位置取得成功");
                resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    name: "現在位置(GPS)"
                });
            },
            (err) => {
                console.warn("GPS取得失敗:", err.message);
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 6000, // 少し長めに待機
                maximumAge: 0
            }
        );
    });

    const gps = await gpsPromise;
    if (gps) return gps;

    // ② IP 位置情報1 (ipapi.co)
    try {
        console.log("IP位置情報を試行中 (ipapi.co)...");
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
        console.warn("IP位置情報1 失敗", e);
    }

    // ③ IP 位置情報2 (freeipapi.com)
    try {
        console.log("IP位置情報を試行中 (freeipapi.com)...");
        const res = await fetch("https://freeipapi.com/api/json");
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
            return {
                lat: data.latitude,
                lon: data.longitude,
                name: data.cityName || "現在位置(IP)"
            };
        }
    } catch (e) {
        console.warn("IP位置情報2 失敗", e);
    }

    // ④ DEFAULT（最終手段）
    console.log("すべての取得に失敗しました。デフォルト位置を使用します。");
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

        // 気象モデルを「Best Available（自動選定）」に戻し、より確実にデータを取得
        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
            `&wind_speed_unit=ms&timezone=auto`;

        const res = await fetch(url);
        const data = await res.json();
        const current = data.current;
        console.log("現在の気象データ:", current);

        const temp = current.temperature_2m;
        const humidity = current.relative_humidity_2m;
        windSpeed = current.wind_speed_10m;
        windDeg = current.wind_direction_10m;
        // 突風データがない場合は平均風速を代用せず、明確に存在する場合のみ使用
        const gusts = current.wind_gusts_10m !== undefined ? current.wind_gusts_10m : null;

        updateWeatherUI(temp, humidity, windSpeed, windDeg, gusts);
        updateResult(temp, humidity, windSpeed, gusts);
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
function updateWeatherUI(temp, humidity, windSpeed, windDeg, gusts) {
    const tempEl = document.getElementById("temp");
    const humidityEl = document.getElementById("humidity");
    const windEl = document.getElementById("wind");
    const winddirEl = document.getElementById("winddir");

    if (tempEl) {
        tempEl.textContent = (temp !== null && temp !== undefined) ? temp.toFixed(1) + "°C" : "--";
    }
    if (humidityEl) {
        humidityEl.textContent = (humidity !== null && humidity !== undefined) ? Math.round(humidity) + "%" : "--";
    }

    // 風速と突風を表示 (m/s)
    if (windEl) {
        const speedStr = (windSpeed !== null && windSpeed !== undefined) ? windSpeed.toFixed(1) : "--";
        const gustStr = (gusts !== null && gusts !== undefined) ? gusts.toFixed(1) : "--";
        windEl.innerHTML = `
            <div style="font-size: 1.1em; color: #fff;">${speedStr} <small>m/s</small></div>
            <div style="font-size: 0.6em; opacity: 0.8; margin-top: 4px;">(最大: ${gustStr} m/s)</div>
        `;
    }

    if (winddirEl) {
        const dirStr = (windDeg !== null && windDeg !== undefined) ? dirName(windDeg) : "--";
        const degStr = (windDeg !== null && windDeg !== undefined) ? `(${Math.round(windDeg)}°)` : "";
        winddirEl.innerHTML = `
            <div style="font-size: 0.9em;">${dirStr}</div>
            <div style="font-size: 0.5em; opacity: 0.6;">${degStr}</div>
        `;
    }

    if (windDeg !== null && windDeg !== undefined) {
        const arrow = document.getElementById("arrow");
        if (arrow) arrow.style.transform = `rotate(${windDeg}deg)`;

        const windNeedleEl = document.getElementById("windNeedle");
        if (windNeedleEl) windNeedleEl.style.transform = `rotate(${windDeg}deg)`;
    }
}

/* =========================
   判定 (バドミントン専用に再調整)
========================= */
function updateResult(temp, humidity, windSpeed, gusts) {
    let result = "";
    let sub = "";

    // ① メイン評価
    if (windSpeed <= 1.0 && (gusts === undefined || gusts <= 2.0)) {
        result = "🏸 最高のコンディション";
    } else if (windSpeed <= 2.5 && (gusts === undefined || gusts <= 4.0)) {
        result = "🙂 プレイ可能";
    } else if (windSpeed <= 4.5 || (gusts !== undefined && gusts <= 7.0)) {
        result = "😅 風の影響あり";
    } else {
        result = "🌪 プレイ困難";
    }

    // ② 詳細補足
    if (gusts !== undefined && gusts >= 8.0) {
        sub = "【警告】強烈な突風に注意！";
    } else if (windSpeed >= 5.0) {
        sub = "【注意】シャトルが流されます";
    } else if (gusts !== undefined && gusts >= 4.5) {
        sub = "時折吹く風に注意";
    } else if (windSpeed <= 0.5) {
        sub = "ほぼ無風で快適です";
    }

    // ③ 温度・湿度補足
    if (temp >= 30) {
        sub += (sub ? " / " : "") + "熱中症に警戒";
    } else if (temp <= 10) {
        sub += (sub ? " / " : "") + "寒さ対策を";
    }

    const resultEl = document.getElementById("result");
    if (resultEl) {
        resultEl.innerHTML = `
            <div style="font-size: 1.2em; margin-bottom: 8px;">${result}</div>
            <div style="font-size: 0.7em; font-weight: normal; opacity: 0.9;">${sub}</div>
        `;
    }
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

function showPage(nextId, skipAnimation = false) {
    const container = document.querySelector('.container');
    const currentEl = document.getElementById(currentPageId);
    const nextEl = document.getElementById(nextId);
    const nextIdx = pageOrder.indexOf(nextId);
    const currentIdx = pageOrder.indexOf(currentPageId);

    // ナビゲーションの更新
    const navPill = document.getElementById('navPill');
    const buttons = document.querySelectorAll('.topbar button');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${nextId}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (navPill) {
        const movePercent = nextIdx * 100;
        const gapOffset = nextIdx * 8;
        navPill.style.transform = `translateX(calc(${movePercent}% + ${gapOffset}px))`;
    }

    if (nextId === currentPageId && !skipAnimation) return;

    if (skipAnimation) {
        // レイアウトを確定
        pageOrder.forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'no-transition');
            el.style.transform = '';
            el.style.display = '';
        });
        nextEl.classList.add('active');
        currentPageId = nextId;
        container.classList.remove('swiping');
        return;
    }

    // 通常のクリック切り替えアニメーション
    const direction = nextIdx > currentIdx ? 1 : -1;
    container.classList.add('swiping');

    pageOrder.forEach(id => {
        const el = document.getElementById(id);
        if (id !== currentPageId) {
            el.style.display = 'none';
            el.style.transform = '';
        }
    });

    nextEl.style.transition = 'none';
    nextEl.style.transform = `translateX(${direction * 100}%)`;
    nextEl.style.display = 'block';

    setTimeout(() => {
        nextEl.style.transition = '';
        currentEl.style.transform = `translateX(${-direction * 100}%)`;
        nextEl.style.transform = 'translateX(0)';

        setTimeout(() => {
            showPage(nextId, true);
        }, 400);
    }, 20);

    if (nextId !== currentPageId) window.scrollTo(0, 0);
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
   スワイプ操作 (リアルタイム)
========================= */
let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;

document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    isSwiping = false;
}, { passive: true });

document.addEventListener('touchmove', e => {
    touchCurrentX = e.changedTouches[0].clientX;
    const diffX = touchCurrentX - touchStartX;
    const container = document.querySelector('.container');
    const width = container.offsetWidth;

    if (!isSwiping && Math.abs(diffX) > 10) {
        isSwiping = true;
        container.classList.add('swiping');
    }

    if (isSwiping) {
        const currentIdx = pageOrder.indexOf(currentPageId);
        const currentEl = document.getElementById(currentPageId);

        currentEl.style.transform = `translateX(${diffX}px)`;
        currentEl.classList.add('no-transition');

        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            const offset = (idx - currentIdx) * width;

            if (Math.abs(idx - currentIdx) <= 1) {
                el.style.transform = `translateX(${offset + diffX}px)`;
                el.style.display = 'block';
                el.classList.add('no-transition');
            } else {
                el.style.display = 'none';
            }
        });
    }
}, { passive: false });

document.addEventListener('touchend', e => {
    if (!isSwiping) return;

    const diffX = e.changedTouches[0].clientX - touchStartX;
    const container = document.querySelector('.container');
    const width = container.offsetWidth;
    const threshold = width * 0.2; // 20%以上動かしたら切り替え

    const currentIdx = pageOrder.indexOf(currentPageId);
    let nextIdx = currentIdx;

    if (diffX < -threshold && currentIdx < pageOrder.length - 1) {
        nextIdx++;
    } else if (diffX > threshold && currentIdx > 0) {
        nextIdx--;
    }

    const nextId = pageOrder[nextIdx];
    const currentEl = document.getElementById(currentPageId);

    // 【最適化】ナビゲーションの見た目だけを即座に更新して、指を離した瞬間に反応させる
    const navPill = document.getElementById('navPill');
    const buttons = document.querySelectorAll('.topbar button');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${nextId}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (navPill) {
        const movePercent = nextIdx * 100;
        const gapOffset = nextIdx * 8;
        navPill.style.transform = `translateX(calc(${movePercent}% + ${gapOffset}px))`;
    }

    // トランジションを再有効化
    pageOrder.forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('no-transition');
    });

    // 最終目的地へアニメーション
    if (nextId !== currentPageId) {
        const direction = nextIdx > currentIdx ? 1 : -1;
        currentEl.style.transform = `translateX(${-direction * 100}%)`;
        document.getElementById(nextId).style.transform = 'translateX(0)';
    } else {
        currentEl.style.transform = 'translateX(0)';
        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            const offset = (idx - currentIdx) * width;
            el.style.transform = `translateX(${offset}px)`;
        });
    }

    // アニメーション完了後にDOMの状態を整理
    setTimeout(() => {
        showPage(nextId, true);
    }, 400);

    isSwiping = false;
}, { passive: true });

/* =========================
    開始
========================= */

let weatherInterval;

function startWeatherTimer() {
    loadWeather();
    // 既存のタイマーがあればクリアして重複を防ぐ
    if (weatherInterval) {
        clearInterval(weatherInterval);
    }

    // 1分(60000ms)ごとに実行
    weatherInterval = setInterval(loadWeather, 360000);
}
window.addEventListener('pagehide', (event) => {
    if (event.persisted === false) {
        clearInterval(weatherInterval);
    }
});

startWeatherTimer();
