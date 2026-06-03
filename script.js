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
        // ロードバー開始
        gsap.to('#loaderBar', { width: '30%', duration: 0.5 });
        
        const loc = await getLocation();
        gsap.to('#loaderBar', { width: '60%', duration: 0.5 });

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
        
        gsap.to('#loaderBar', { 
            width: '100%', 
            duration: 0.3, 
            onComplete: () => {
                const loader = document.getElementById('loader');
                if (loader) {
                    gsap.to(loader, {
                        opacity: 0,
                        duration: 0.5,
                        onComplete: () => loader.style.visibility = 'hidden'
                    });
                }
            }
        });
    } catch (err) {
        console.error(err);
        document.getElementById("result").textContent = "天気取得失敗";
        const loader = document.getElementById('loader');
        if (loader) {
            gsap.to(loader, {
                opacity: 0,
                duration: 0.5,
                onComplete: () => loader.style.visibility = 'hidden'
            });
        }
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

    let w = weatherCodes[code] || { name: "不明", icon: "❓" };
    
    // 台風判定 (風速 17.2m/s 以上)
    if (windSpeed >= 17.2) {
        w = { name: "暴風", icon: "🌀" };
    }

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
        if (arrow) {
            gsap.to(arrow, { rotation: windDeg, duration: 1, ease: "back.out(1.7)" });
        }
        const windNeedleEl = document.getElementById("windNeedle");
        if (windNeedleEl) {
            gsap.to(windNeedleEl, { rotation: windDeg, duration: 1, ease: "back.out(1.7)" });
        }
    }
}

function updateResult(temp, humidity, windSpeed, gusts, code) {
    let result = "🙂 プレイ可能";
    let sub = "";

    const isBadWeather = (code >= 51 && code <= 67) || (code >= 71 && code <= 82) || code >= 95;
    const maxWind = (gusts !== null && gusts > windSpeed) ? gusts : windSpeed;

    // 台風判定 (最大風速 17.2m/s 以上)
    if (maxWind >= 17.2) {
        result = "🌀 暴風";
        sub = "外でのプレイは不可能です屋内を強く推奨します。";
    } else if (isBadWeather) {
        result = "☔ プレイ困難 (荒天)";
        sub = "雨や雪が降っています。屋内を推奨します。";
    } else if (windSpeed <= 1.0 && (gusts === null || gusts <= 2.0)) {
        result = "🏸 最高のコンディション";
        sub = "風も穏やかで、絶好 of バドミントン日和です！";
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
        gsap.fromTo(resultEl, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.2)" });
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
    
    if (navPill) {
        gsap.to(navPill, {
            xPercent: idx * 100,
            x: idx * 8,
            duration: 0.3,
            ease: "power2.out"
        });
    }
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
            el.classList.remove('active');
            gsap.set(el, { x: 0, opacity: 1, display: (id === nextId ? 'block' : 'none') });
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

    // 次の要素の初期化、他を隠す
    pageOrder.forEach(id => {
        if (id !== currentPageId && id !== nextId) {
            gsap.set(document.getElementById(id), { display: 'none' });
        }
    });
    gsap.set(nextEl, { x: direction * 100 + "%", display: 'block', opacity: 1 });

    const tl = gsap.timeline({
        onComplete: () => {
            showPage(nextId, true);
        }
    });

    tl.to(currentEl, {
        x: -direction * 100 + "%",
        duration: 0.3,
        ease: "power2.inOut"
    }, 0);

    tl.to(nextEl, {
        x: "0%",
        duration: 0.3,
        ease: "power2.inOut"
    }, 0);

    if (nextId !== currentPageId) {
        gsap.to(window, { scrollTo: 0, duration: 0.3, ease: "power2.out" });
    }
}

/* =========================
   スワイプ操作 (GSAP併用)
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
        
        gsap.set(currentEl, { x: diffX });
        
        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            if (Math.abs(idx - currentIdx) <= 1) {
                const offset = (idx - currentIdx) * width;
                gsap.set(el, { x: offset + diffX, display: 'block' });
            } else {
                gsap.set(el, { display: 'none' });
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

    isTransitioning = true;

    const tl = gsap.timeline({
        onComplete: () => {
            showPage(nextId, true);
            document.body.classList.remove('lock-scroll'); 
            isSwiping = false;
            isScrollingIntent = false;
        }
    });

    if (nextId !== currentPageId) {
        const direction = nextIdx > currentIdx ? 1 : -1;
        const nextEl = document.getElementById(nextId);
        
        tl.to(currentEl, { x: -direction * 100 + "%", duration: 0.25, ease: "power2.out" }, 0);
        tl.to(nextEl, { x: "0%", duration: 0.25, ease: "power2.out" }, 0);
        
        gsap.to(window, { scrollTo: 0, duration: 0.25, ease: "power2.out" });
    } else {
        tl.to(currentEl, { x: "0%", duration: 0.2, ease: "power2.out" }, 0);
        pageOrder.forEach((id, idx) => {
            if (id === currentPageId) return;
            const el = document.getElementById(id);
            if (Math.abs(idx - currentIdx) <= 1) {
                tl.to(el, { x: (idx - currentIdx) * 100 + "%", duration: 0.2, ease: "power2.out" }, 0);
            }
        });
    }

    updateMenuUI(nextId);
}, { passive: true });

const compassRose = document.getElementById("compassRose");
const deviceHeadingTextEl = document.getElementById("deviceHeading");

/* =========================
   地図の2本指操作
========================= */
const mapOverlay = document.getElementById('mapOverlay');
const mapBox = mapOverlay ? mapOverlay.parentElement : null;

if (mapBox) {
    mapBox.addEventListener('touchstart', e => {
        if (e.touches.length >= 2) {
            mapBox.classList.add('interact');
        } else {
            mapBox.classList.add('touching');
        }
    }, { passive: true });

    mapBox.addEventListener('touchend', e => {
        if (e.touches.length === 0) {
            mapBox.classList.remove('interact', 'touching');
        }
    }, { passive: true });

    // パソコン向け: Ctrlキーを押している間は操作可能にする
    window.addEventListener('keydown', e => {
        if (e.key === 'Control') {
            mapBox.classList.add('interact');
        }
    });

    window.addEventListener('keyup', e => {
        if (e.key === 'Control') {
            mapBox.classList.remove('interact');
        }
    });
}

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
