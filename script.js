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
let isTransitioning = false;

/* =========================
   WMO Weather Codes (日本語 & アイコン)
========================= */
const weatherCodes = {
    0: { name: "快晴", icon: "☀️" },
    1: { name: "晴れ", icon: "🌤️" },
    2: { name: "晴れ時々曇り", icon: "⛅" },
    3: { name: "くもり", icon: "☁️" },
    45: { name: "霧", icon: "🌫️" },
    48: { name: "霧（着氷性）", icon: "🌫️" },
    51: { name: "小雨", icon: "🌦️" },
    53: { name: "雨", icon: "🌧️" },
    55: { name: "強い雨", icon: "🌧️" },
    56: { name: "小雨（氷結性）", icon: "❄️" },
    57: { name: "雨（氷結性）", icon: "❄️" },
    61: { name: "弱い雨", icon: "🌧️" },
    63: { name: "雨", icon: "🌧️" },
    65: { name: "激しい雨", icon: "🌧️" },
    66: { name: "雨（氷結性）", icon: "❄️" },
    67: { name: "激しい雨（氷結性）", icon: "❄️" },
    71: { name: "小雪", icon: "🌨️" },
    73: { name: "雪", icon: "🌨️" },
    75: { name: "激しい雪", icon: "🌨️" },
    77: { name: "霧雪", icon: "🌨️" },
    80: { name: "にわか雨", icon: "🌦️" },
    81: { name: "強いにわか雨", icon: "🌦️" },
    82: { name: "激しいにわか雨", icon: "🌦️" },
    85: { name: "にわか雪", icon: "🌨️" },
    86: { name: "激しいにわか雪", icon: "🌨️" },
    95: { name: "雷雨", icon: "⛈️" },
    96: { name: "雷雨（雹）", icon: "⛈️" },
    99: { name: "激しい雷雨（雹）", icon: "⛈️" }
};

function dirName(deg) {
    const dirs = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];
    return dirs[Math.round(deg / 22.5) % 16];
}

async function getLocation() {
    const gpsPromise = new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
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

async function loadWeather() {
    try {
        const loc = await getLocation();
        const locationEl = document.querySelector(".location");
        if (locationEl) locationEl.textContent = `${loc.name} (${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)})`;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&wind_speed_unit=ms&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        const current = data.current;

        windSpeed = current.wind_speed_10m;
        windDeg = current.wind_direction_10m;
        const gusts = current.wind_gusts_10m !== undefined ? current.wind_gusts_10m : null;
        const code = current.weather_code;

        updateWeatherUI(current.temperature_2m, current.relative_humidity_2m, windSpeed, windDeg, gusts, code);
        updateResult(current.temperature_2m, current.relative_humidity_2m, windSpeed, gusts, code);
        updateMap(loc.lat, loc.lon);
    } catch (err) {
        console.error(err);
        document.getElementById("result").textContent = "天気取得失敗";
    }
}

function updateWeatherUI(temp, humidity, windSpeed, windDeg, gusts, code) {
    const tempEl = document.getElementById("temp");
    const humidityEl = document.getElementById("humidity");
    const windEl = document.getElementById("wind");
    const winddirEl = document.getElementById("winddir");
    const weatherEl = document.getElementById("weather-desc");
    const iconEl = document.getElementById("weather-icon");
    const windDirTextEl = document.getElementById("windDirection");

    const w = weatherCodes[code] || { name: "不明", icon: "❓" };
    if (weatherEl) weatherEl.textContent = w.name;
    if (iconEl) iconEl.textContent = w.icon;

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
        if (windDirTextEl) windDirTextEl.textContent = `${d} (${Math.round(windDeg)}°)`;
    }

    if (windDeg !== null) {
        const arrow = document.getElementById("arrow");
        if (arrow) arrow.style.transform = `rotate(${windDeg}deg)`;
        const windNeedleEl = document.getElementById("windNeedle");
        if (windNeedleEl) windNeedleEl.style.transform = `rotate(${windDeg}deg)`;
    }
}

function updateResult(temp, humidity, windSpeed, gusts, code) {
    let result = "🙂 プレイ可能";
    let sub = "";

    const isBadWeather = (code >= 51 && code <= 67) || (code >= 71 && code <= 82) || code >= 95;
    
    if (isBadWeather) {
        result = "☔ プレイ困難 (荒天)";
        sub = "雨や雪が降っています。屋内を推奨します。";
    } else if (windSpeed <= 1.0 && (gusts === null || gusts <= 2.0)) {
        result = "🏸 最高のコンディション";
        sub = "風も穏やかで、絶好のバドミントン日和です！";
    } else if (windSpeed > 4.5 || (gusts !== null && gusts > 7.0)) {
        result = "🌪 プレイ困難 (強風)";
        sub = "シャトルが激しく流されます。";
    } else if (windSpeed > 2.5) {
        result = "😅 風の影響あり";
        sub = "狙った場所に飛ばすのが難しいかもしれません。";
    }

    const resultEl = document.getElementById("result");
    if (resultEl) {
        resultEl.innerHTML = `<div style="font-size: 1.2em; margin-bottom: 4px;">${result}</div><div style="font-size: 0.6em; font-weight: normal; opacity: 0.8;">${sub}</div>`;
    }
}

function updateMap(lat, lon) {
    const iframe = document.querySelector("iframe");
    if (iframe) iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
}

function updateMenuUI(id) {
    const idx = pageOrder.indexOf(id);
    const navPill = document.getElementById('navPill');
    const buttons = document.querySelectorAll('.topbar button');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${id}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (navPill) navPill.style.transform = `translateX(calc(${idx * 100}% + ${idx * 8}px))`;
}

const pageOrder = ['weather', 'map', 'sensor'];
let currentPageId = 'weather';

function showPage(nextId, skipAnimation = false) {
    if (isTransitioning && !skipAnimation) return;
    if (nextId === currentPageId && !skipAnimation) return;
    const container = document.querySelector('.container');
    const currentEl = document.getElementById(currentPageId);
    const nextEl = document.getElementById(nextId);
    const nextIdx = pageOrder.indexOf(nextId);
    const currentIdx = pageOrder.indexOf(currentPageId);

    updateMenuUI(nextId);

    if (skipAnimation) {
        pageOrder.forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'no-transition');
            el.style.transform = '';
            el.style.display = '';
        });
        nextEl.classList.add('active');
        currentPageId = nextId;
        container.classList.remove('swiping');
        isTransitioning = false;
        return;
    }

    isTransitioning = true;
    const direction = nextIdx > currentIdx ? 1 : -1;
    container.classList.add('swiping');
    pageOrder.forEach(id => {
        const el = document.getElementById(id);
        if (id !== currentPageId) { el.style.display = 'none'; el.style.transform = ''; }
    });
    nextEl.style.transition = 'none';
    nextEl.style.transform = `translateX(${direction * 100}%)`;
    nextEl.style.display = 'block';
    setTimeout(() => {
        nextEl.style.transition = '';
        currentEl.style.transform = `translateX(${-direction * 100}%)`;
        nextEl.style.transform = 'translateX(0)';
        setTimeout(() => { showPage(nextId, true); }, 400);
    }, 20);
    if (nextId !== currentPageId) window.scrollTo(0, 0);
}

/* =========================
   スワイプ操作 (リアルタイム)
========================= */
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
let isScrollingIntent = false;

document.addEventListener('touchstart', e => {
    if (isTransitioning) return;
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    isSwiping = false;
    isScrollingIntent = false;
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (isTransitioning || isScrollingIntent) return;
    
    const touchX = e.changedTouches[0].clientX;
    const touchY = e.changedTouches[0].clientY;
    const diffX = touchX - touchStartX;
    const diffY = touchY - touchStartY;
    const container = document.querySelector('.container');
    const width = container.offsetWidth;

    if (!isSwiping && !isScrollingIntent) {
        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 5) {
            isScrollingIntent = true;
            return;
        }
        if (Math.abs(diffX) > 10) {
            isSwiping = true;
            container.classList.add('swiping');
            document.body.classList.add('lock-scroll');
        }
    }

    if (isSwiping) {
        e.preventDefault(); 
        const currentIdx = pageOrder.indexOf(currentPageId);
        const currentEl = document.getElementById(currentPageId);
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
        let projectedId = currentPageId;
        if (diffX < -width * 0.5 && currentIdx < pageOrder.length - 1) projectedId = pageOrder[currentIdx + 1];
        else if (diffX > width * 0.5 && currentIdx > 0) projectedId = pageOrder[currentIdx - 1];
        updateMenuUI(projectedId);
    }
}, { passive: false });

document.addEventListener('touchend', e => {
    if (isScrollingIntent) {
        isScrollingIntent = false;
        return;
    }
    if (!isSwiping || isTransitioning) return;
    
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const width = document.querySelector('.container').offsetWidth;
    const currentIdx = pageOrder.indexOf(currentPageId);
    let nextIdx = currentIdx;

    if (diffX < -width * 0.2 && currentIdx < pageOrder.length - 1) nextIdx++;
    else if (diffX > width * 0.2 && currentIdx > 0) nextIdx--;

    const nextId = pageOrder[nextIdx];
    const currentEl = document.getElementById(currentPageId);

    pageOrder.forEach(id => document.getElementById(id).classList.remove('no-transition'));
    isTransitioning = true;

    if (nextId !== currentPageId) {
        const direction = nextIdx > currentIdx ? 1 : -1;
        currentEl.style.transform = `translateX(${-direction * 100}%)`;
        document.getElementById(nextId).style.transform = 'translateX(0)';
    } else {
        currentEl.style.transform = 'translateX(0)';
        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            if (Math.abs(idx - currentIdx) <= 1) el.style.transform = `translateX(${(idx - currentIdx) * width}px)`;
        });
    }

    updateMenuUI(nextId);
    setTimeout(() => {
        showPage(nextId, true);
    }, 400);

    document.body.classList.remove('lock-scroll'); 
    isSwiping = false;
    isScrollingIntent = false;
    }, { passive: true });

const compassRose = document.getElementById("compassRose");
const deviceHeadingTextEl = document.getElementById("deviceHeading");

function handleOrientation(e) {
    let heading = 0;
    if (e.webkitCompassHeading) heading = e.webkitCompassHeading;
    else if (e.absolute && e.alpha !== null) heading = (360 - e.alpha) % 360;
    else heading = e.alpha || 0;

    if (compassRose) compassRose.style.transform = `rotate(${-heading}deg)`;
    if (deviceHeadingTextEl) deviceHeadingTextEl.textContent = `${dirName(heading)} (${Math.round(heading)}°)`;
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

function updateBackgroundTheme() {
    const hour = new Date().getHours();
    const body = document.body;
    body.classList.remove('theme-morning', 'theme-day', 'theme-evening', 'theme-night');
    if (hour >= 5 && hour < 9) body.classList.add('theme-morning');
    else if (hour >= 9 && hour < 17) body.classList.add('theme-day');
    else if (hour >= 17 && hour < 19) body.classList.add('theme-evening');
    else body.classList.add('theme-night');
}

function startWeatherTimer() {
    loadWeather();
    updateBackgroundTheme();

    // 安全に呼び出し
    if (typeof logBrowserInfo === 'function') {
        logBrowserInfo();
    }

    setInterval(() => {
        loadWeather();
        updateBackgroundTheme();
    }, 300000);
}
startWeatherTimer();
