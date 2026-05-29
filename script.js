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
let isTransitioning = false; // アニメーション中のガードフラグ

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
   現在位置取得
========================= */
async function getLocation() {
    console.log("位置情報を取得中...");
    const gpsPromise = new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "現在位置(GPS)" }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
    });

    const gps = await gpsPromise;
    if (gps) return gps;

    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data && data.latitude) return { lat: data.latitude, lon: data.longitude, name: data.city || "現在位置(IP)" };
    } catch (e) { console.warn("IP取得失敗", e); }

    return DEFAULT_LOCATION;
}

/* =========================
   天気取得
========================= */
async function loadWeather() {
    try {
        const loc = await getLocation();
        const locationEl = document.querySelector(".location");
        if (locationEl) locationEl.textContent = `${loc.name} (${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)})`;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        const current = data.current;

        const gusts = current.wind_gusts_10m !== undefined ? current.wind_gusts_10m : null;
        updateWeatherUI(current.temperature_2m, current.relative_humidity_2m, current.wind_speed_10m, current.wind_direction_10m, gusts);
        updateResult(current.temperature_2m, current.relative_humidity_2m, current.wind_speed_10m, gusts);
        updateMap(loc.lat, loc.lon);
    } catch (err) {
        console.error(err);
        document.getElementById("result").textContent = "天気取得失敗";
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

    if (tempEl) tempEl.textContent = (temp !== null) ? temp.toFixed(1) + "°C" : "--";
    if (humidityEl) humidityEl.textContent = (humidity !== null) ? Math.round(humidity) + "%" : "--";
    
    if (windEl) {
        const s = (windSpeed !== null) ? windSpeed.toFixed(1) : "--";
        const g = (gusts !== null) ? gusts.toFixed(1) : "--";
        windEl.innerHTML = `<div style="font-size: 1.1em; color: #fff;">${s} <small>m/s</small></div><div style="font-size: 0.6em; opacity: 0.8; margin-top: 4px;">(最大: ${g} m/s)</div>`;
    }
    
    if (winddirEl) {
        const d = (windDeg !== null) ? dirName(windDeg) : "--";
        const a = (windDeg !== null) ? `(${Math.round(windDeg)}°)` : "";
        winddirEl.innerHTML = `<div style="font-size: 0.9em;">${d}</div><div style="font-size: 0.5em; opacity: 0.6;">${a}</div>`;
    }

    if (windDeg !== null) {
        const arrow = document.getElementById("arrow");
        if (arrow) arrow.style.transform = `rotate(${windDeg}deg)`;
        const windNeedleEl = document.getElementById("windNeedle");
        if (windNeedleEl) windNeedleEl.style.transform = `rotate(${windDeg}deg)`;
    }
}

function updateResult(temp, humidity, windSpeed, gusts) {
    let result = "🙂 プレイ可能";
    let sub = "";
    if (windSpeed <= 1.0 && (gusts === null || gusts <= 2.0)) result = "🏸 最高のコンディション";
    else if (windSpeed > 4.5 || (gusts !== null && gusts > 7.0)) result = "🌪 プレイ困難";

    const resultEl = document.getElementById("result");
    if (resultEl) resultEl.innerHTML = `<div style="font-size: 1.2em;">${result}</div>`;
}

function updateMap(lat, lon) {
    const iframe = document.querySelector("iframe");
    if (iframe) iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
}

/* =========================
   ナビゲーション同期（メニューバー更新）
========================= */
function updateMenuUI(id) {
    const idx = pageOrder.indexOf(id);
    const navPill = document.getElementById('navPill');
    const buttons = document.querySelectorAll('.topbar button');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${id}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (navPill) {
        const movePercent = idx * 100;
        const gapOffset = idx * 8;
        navPill.style.transform = `translateX(calc(${movePercent}% + ${gapOffset}px))`;
    }
}

/* =========================
   ページ切り替え
========================= */
const pageOrder = ['weather', 'map', 'sensor'];
let currentPageId = 'weather';

function showPage(nextId, skipAnimation = false) {
    if (isTransitioning && !skipAnimation) return; // アニメーション中は操作不可
    if (nextId === currentPageId && !skipAnimation) return;

    const container = document.querySelector('.container');
    const currentEl = document.getElementById(currentPageId);
    const nextEl = document.getElementById(nextId);
    const nextIdx = pageOrder.indexOf(nextId);
    const currentIdx = pageOrder.indexOf(currentPageId);

    // メニューを即座に更新
    updateMenuUI(nextId);

    if (skipAnimation) {
        // 状態を完全に確定（クリーンアップ）
        pageOrder.forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'no-transition');
            el.style.transform = '';
            el.style.display = '';
        });
        nextEl.classList.add('active');
        currentPageId = nextId;
        container.classList.remove('swiping');
        isTransitioning = false; // ガード解除
        return;
    }

    isTransitioning = true; // ガード開始
    const direction = nextIdx > currentIdx ? 1 : -1;
    container.classList.add('swiping');
    
    // 他のページを隠す
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
            showPage(nextId, true); // 確定処理へ
        }, 400);
    }, 20);

    if (nextId !== currentPageId) window.scrollTo(0, 0);
}

/* =========================
   スワイプ操作 (リアルタイム)
========================= */
let touchStartX = 0;
let isSwiping = false;

document.addEventListener('touchstart', e => {
    if (isTransitioning) return; // 移動中はスワイプ開始不可
    touchStartX = e.changedTouches[0].clientX;
    isSwiping = false;
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (isTransitioning) return;
    
    const touchX = e.changedTouches[0].clientX;
    const diffX = touchX - touchStartX;
    const container = document.querySelector('.container');
    const width = container.offsetWidth;

    if (!isSwiping && Math.abs(diffX) > 10) {
        isSwiping = true;
        container.classList.add('swiping');
    }

    if (isSwiping) {
        const currentIdx = pageOrder.indexOf(currentPageId);
        const currentEl = document.getElementById(currentPageId);
        
        // 現在のページと隣のページを移動
        currentEl.style.transform = `translateX(${diffX}px)`;
        currentEl.classList.add('no-transition');

        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            if (Math.abs(idx - currentIdx) <= 1) {
                const offset = (idx - currentIdx) * width;
                el.style.transform = `translateX(${offset + diffX}px)`;
                el.style.display = 'block';
                el.classList.add('no-transition');
            }else {
                el.style.display = 'none';
            }
        });

        // 【新機能】半分(50%)を超えたらメニューの見た目だけ更新
        let projectedId = currentPageId;
        if (diffX < -width * 0.5 && currentIdx < pageOrder.length - 1) projectedId = pageOrder[currentIdx + 1];
        else if (diffX > width * 0.5 && currentIdx > 0) projectedId = pageOrder[currentIdx - 1];
        updateMenuUI(projectedId);
    }
}, { passive: false });

document.addEventListener('touchend', e => {
    if (!isSwiping || isTransitioning) return;
    
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const width = document.querySelector('.container').offsetWidth;
    const currentIdx = pageOrder.indexOf(currentPageId);
    let nextIdx = currentIdx;

    // 20%以上動かしていたらページ切り替え、そうでなければ戻る
    if (diffX < -width * 0.2 && currentIdx < pageOrder.length - 1) nextIdx++;
    else if (diffX > width * 0.2 && currentIdx > 0) nextIdx--;

    const nextId = pageOrder[nextIdx];
    const currentEl = document.getElementById(currentPageId);

    // アニメーションを再有効化
    pageOrder.forEach(id => document.getElementById(id).classList.remove('no-transition'));

    isTransitioning = true; // 最終アニメーション中は操作ガード

    if (nextId !== currentPageId) {
        const direction = nextIdx > currentIdx ? 1 : -1;
        currentEl.style.transform = `translateX(${-direction * 100}%)`;
        document.getElementById(nextId).style.transform = 'translateX(0)';
    } else {
        currentEl.style.transform = 'translateX(0)';
        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            if (Math.abs(idx - currentIdx) <= 1) {
                const offset = (idx - currentIdx) * width;
                el.style.transform = `translateX(${offset}px)`;
            }
        });
    }

    updateMenuUI(nextId);
    setTimeout(() => {
        showPage(nextId, true);
    }, 400);

    isSwiping = false;
}, { passive: true });

/* =========================
   方向センサー
========================= */
const compassRose = document.getElementById("compassRose");
function handleOrientation(e) {
    let heading = 0;
    if (e.webkitCompassHeading) heading = e.webkitCompassHeading;
    else if (e.absolute && e.alpha !== null) heading = (360 - e.alpha) % 360;
    else heading = e.alpha || 0;

    if (compassRose) compassRose.style.transform = `rotate(${-heading}deg)`;
}

async function enableOrientation() {
    try {
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            const p = await DeviceOrientationEvent.requestPermission();
            if (p !== "granted") return;
        }
        if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        else window.addEventListener("deviceorientation", handleOrientation, true);
        document.getElementById("orientation-btn").style.display = "none";
    } catch (e) { console.error(e); }
}

/* =========================
    開始
========================= */
function startWeatherTimer() {
    loadWeather();
    setInterval(loadWeather, 300000);
}
startWeatherTimer();
