// ===== Configuration =====
const CONFIG = {
    destination: {
        lat: 37.5448,
        lng: 127.0568,
        name: '연무장길 81-1, 2층',
        fullAddress: '서울 성동구 연무장길 81-1, 2층'
    },
    defaultLocation: {
        lat: 37.5462,
        lng: 127.0553
    },
    mapStyle: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    arrivalBuffer: 30
};

const PRICE_TABLE = {
    'S': { 4: 4000, 8: 7000 },
    'M': { 4: 4000, 8: 7000 },
    'L': { 4: 5000, 8: 8000 }
};

// ===== State =====
let state = {
    selectedSize: 'M',
    selectedHours: 4,
    selectedPrice: 4000,
    selectedDate: null,  // 선택된 날짜
    selectedTime: null,  // 선택된 시간
    userLocation: null,
    map: null,
    currentMarker: null,
    routeLayer: null,
    routeGlow: null,
    reserveClickCount: 0,
    sessionId: generateSessionId(),
    pageLoadTime: Date.now()
};

// ===== Analytics Tracker =====
const Analytics = {
    events: [],
    
    track(eventName, properties = {}) {
        const event = {
            event: eventName,
            timestamp: new Date().toISOString(),
            sessionId: state.sessionId,
            timeOnPage: Math.round((Date.now() - state.pageLoadTime) / 1000),
            ...properties
        };
        
        this.events.push(event);
        
        // Google Analytics 4 전송
        if (typeof gtag === 'function') {
            gtag('event', eventName, properties);
        }
        
        // 서버로 전송 (프로덕션에서 활성화)
        // this.sendToServer(event);
    },
    
    sendToServer(event) {
        // 실제 서버 엔드포인트로 변경
        fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        }).catch(() => {});
    },
    
    getEvents() {
        return this.events;
    }
};

function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    // 페이지 로드 트래킹
    Analytics.track('page_view', {
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        language: navigator.language
    });
    
    initMap();
    initGeolocation();
    initSizeSelection();
    initTimeSelection();
    initDateTimePicker();
    initReserveButton();
    initErrorModal();
    initTimeDisplay();
    initCopyAddress();
    initScrollTracking();
    updatePrice();
});

// ===== Scroll Tracking =====
function initScrollTracking() {
    let maxScroll = 0;
    let scrollMilestones = [25, 50, 75, 100];
    let trackedMilestones = new Set();
    
    window.addEventListener('scroll', () => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);
        
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            
            scrollMilestones.forEach(milestone => {
                if (scrollPercent >= milestone && !trackedMilestones.has(milestone)) {
                    trackedMilestones.add(milestone);
                    Analytics.track('scroll_depth', { depth: milestone });
                }
            });
        }
    });
    
    // 페이지 이탈 시 최종 스크롤 깊이 기록
    window.addEventListener('beforeunload', () => {
        Analytics.track('session_end', {
            maxScrollDepth: maxScroll,
            totalTimeOnPage: Math.round((Date.now() - state.pageLoadTime) / 1000),
            selectedSize: state.selectedSize,
            selectedHours: state.selectedHours,
            reserveAttempts: state.reserveClickCount
        });
    });
}

// ===== Geolocation =====
function initGeolocation() {
    if (!navigator.geolocation) {
        console.log('[Hands Free] Geolocation not supported');
        Analytics.track('geolocation_error', { reason: 'not_supported' });
        useDefaultLocation();
        return;
    }
    
    console.log('[Hands Free] Requesting geolocation...');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            state.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            console.log('[Hands Free] Location received:', state.userLocation);
            console.log('[Hands Free] Accuracy:', position.coords.accuracy, 'm');
            
            Analytics.track('geolocation_success', {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
            
            updateMapWithUserLocation();
            fetchWalkingRoute();
        },
        (error) => {
            console.log('[Hands Free] Geolocation error:', error.message);
            Analytics.track('geolocation_error', { 
                reason: error.message,
                code: error.code 
            });
            useDefaultLocation();
        },
        { 
            enableHighAccuracy: true, 
            timeout: 15000, 
            maximumAge: 0
        }
    );
}

function useDefaultLocation() {
    state.userLocation = {
        lat: CONFIG.defaultLocation.lat,
        lng: CONFIG.defaultLocation.lng
    };
    updateMapWithUserLocation();
    fetchWalkingRoute();
}

function updateMapWithUserLocation() {
    if (!state.map || !state.userLocation) return;
    
    if (state.currentMarker) {
        state.currentMarker.setLatLng([state.userLocation.lat, state.userLocation.lng]);
    }
    
    const bounds = L.latLngBounds([
        [state.userLocation.lat, state.userLocation.lng],
        [CONFIG.destination.lat, CONFIG.destination.lng]
    ]);
    state.map.fitBounds(bounds, { padding: [50, 50] });
}

// ===== Fetch Walking Route =====
async function fetchWalkingRoute() {
    if (!state.userLocation) {
        console.log('[Hands Free] No user location available');
        return;
    }
    
    const start = state.userLocation;
    const end = CONFIG.destination;
    
    // 먼저 직선 거리 계산
    const straightDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
    console.log('[Hands Free] Straight distance:', Math.round(straightDistance), 'm');
    
    // 직선 거리가 20km 이상이면 API 호출 안 함 (너무 멀면 도보 의미 없음)
    if (straightDistance > 20000) {
        const walkingMinutes = Math.ceil(straightDistance * 1.4 / 80);
        console.log('[Hands Free] Too far, using estimate:', walkingMinutes, 'min');
        document.getElementById('walk-time').querySelector('span').textContent = `도보 ${walkingMinutes}분`;
        drawFallbackRoute();
        return;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
        const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        console.log('[Hands Free] Fetching route from OSRM...');
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Route API error: ' + response.status);
        
        const data = await response.json();
        console.log('[Hands Free] OSRM response:', data.code);
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates;
            const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
            
            drawRoute(latLngs);
            
            // 실제 도보 거리 (미터)
            const distanceM = Math.round(route.distance);
            // 도보 시간: 80m/분 기준으로 직접 계산 (OSRM duration이 부정확함)
            const durationMin = Math.ceil(distanceM / 80);
            
            console.log('[Hands Free] Route calculated:', distanceM, 'm,', durationMin, 'min (walking speed: 80m/min)');
            document.getElementById('walk-time').querySelector('span').textContent = `도보 ${durationMin}분`;
            
            Analytics.track('route_calculated', {
                durationMin,
                distanceM,
                source: 'osrm',
                userLat: start.lat,
                userLng: start.lng
            });
        } else {
            throw new Error('No routes in response');
        }
    } catch (error) {
        clearTimeout(timeoutId);
        console.log('[Hands Free] OSRM failed:', error.message, '- using fallback');
        // 폴백: 직선거리 기반 계산
        updateDistanceFallback();
    }
}

function drawRoute(latLngs) {
    if (!state.map) return;
    
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    if (state.routeGlow) state.map.removeLayer(state.routeGlow);
    
    state.routeGlow = L.polyline(latLngs, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.2,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(state.map);
    
    state.routeLayer = L.polyline(latLngs, {
        color: '#ffffff',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(state.map);
    
    state.map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
}

function updateDistanceFallback() {
    if (!state.userLocation) {
        console.log('[Hands Free] No location for fallback, using default');
        document.getElementById('walk-time').querySelector('span').textContent = '도보 약 2분';
        return;
    }
    
    const distance = calculateDistance(
        state.userLocation.lat, state.userLocation.lng,
        CONFIG.destination.lat, CONFIG.destination.lng
    );
    
    // 실제 도보 거리는 직선의 약 1.4배
    const walkingDistance = Math.round(distance * 1.4);
    // 도보 속도: 약 80m/분
    const walkingMinutes = Math.max(1, Math.ceil(walkingDistance / 80));
    
    console.log('[Hands Free] Fallback calculation:', walkingDistance, 'm,', walkingMinutes, 'min');
    document.getElementById('walk-time').querySelector('span').textContent = `도보 약 ${walkingMinutes}분`;
    
    Analytics.track('route_calculated', {
        durationMin: walkingMinutes,
        distanceM: walkingDistance,
        source: 'fallback',
        userLat: state.userLocation.lat,
        userLng: state.userLocation.lng
    });
    
    drawFallbackRoute();
}

function drawFallbackRoute() {
    if (!state.map || !state.userLocation) return;
    
    const latLngs = [
        [state.userLocation.lat, state.userLocation.lng],
        [CONFIG.destination.lat, CONFIG.destination.lng]
    ];
    
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    if (state.routeGlow) state.map.removeLayer(state.routeGlow);
    
    state.routeGlow = L.polyline(latLngs, {
        color: '#ffffff',
        weight: 6,
        opacity: 0.15,
        lineCap: 'round',
        dashArray: '8, 12'
    }).addTo(state.map);
    
    state.routeLayer = L.polyline(latLngs, {
        color: '#ffffff',
        weight: 3,
        opacity: 0.6,
        lineCap: 'round',
        dashArray: '8, 12'
    }).addTo(state.map);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ===== Map =====
function initMap() {
    const startLocation = CONFIG.defaultLocation;
    const centerLat = (startLocation.lat + CONFIG.destination.lat) / 2;
    const centerLng = (startLocation.lng + CONFIG.destination.lng) / 2;
    
    state.map = L.map('map', {
        center: [centerLat, centerLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false
    });

    L.tileLayer(CONFIG.mapStyle, { attribution: '' }).addTo(state.map);

    const currentIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-current"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    // 일본어 페이지인 경우 경로 조정
    const isJpPage = window.location.pathname.includes('/jp');
    const logoPath = isJpPage ? '../favicon.png' : 'favicon.png';
    
    const destinationIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-destination-wrap">
            <img src="${logoPath}" class="marker-logo" alt="Hands Free">
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    state.currentMarker = L.marker([startLocation.lat, startLocation.lng], {
        icon: currentIcon
    }).addTo(state.map);

    L.marker([CONFIG.destination.lat, CONFIG.destination.lng], {
        icon: destinationIcon
    }).addTo(state.map);

    const bounds = L.latLngBounds([
        [startLocation.lat, startLocation.lng],
        [CONFIG.destination.lat, CONFIG.destination.lng]
    ]);
    state.map.fitBounds(bounds, { padding: [50, 50] });
}

// ===== Copy Address =====
function initCopyAddress() {
    const copyBtn = document.getElementById('copy-address');
    
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(CONFIG.destination.fullAddress);
            showToast();
            Analytics.track('copy_address');
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = CONFIG.destination.fullAddress;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast();
            Analytics.track('copy_address');
        }
    });
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Size Selection =====
function initSizeSelection() {
    const sizeCards = document.querySelectorAll('.size-card');
    
    sizeCards.forEach(card => {
        card.addEventListener('click', () => {
            sizeCards.forEach(c => {
                c.classList.remove('selected');
                const badge = c.querySelector('.selected-badge');
                if (badge) badge.remove();
            });
            
            card.classList.add('selected');
            const badge = document.createElement('div');
            badge.className = 'selected-badge';
            badge.textContent = '선택됨';
            card.appendChild(badge);
            
            const prevSize = state.selectedSize;
            state.selectedSize = card.dataset.size;
            updatePrice();
            updateSummary();
            
            Analytics.track('size_selected', {
                size: state.selectedSize,
                previousSize: prevSize,
                price: state.selectedPrice
            });
        });
    });
}

// ===== Time Selection =====
function initTimeSelection() {
    const timeCards = document.querySelectorAll('.time-card');
    
    timeCards.forEach(card => {
        card.addEventListener('click', () => {
            timeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            const prevHours = state.selectedHours;
            state.selectedHours = parseInt(card.dataset.hours);
            updatePrice();
            updateSummary();
            
            Analytics.track('time_selected', {
                hours: state.selectedHours,
                previousHours: prevHours,
                price: state.selectedPrice
            });
        });
    });
}

// ===== Price Calculation =====
function updatePrice() {
    const prices = PRICE_TABLE[state.selectedSize];
    state.selectedPrice = prices[state.selectedHours];
    
    const timeCards = document.querySelectorAll('.time-card');
    timeCards.forEach(card => {
        const hours = parseInt(card.dataset.hours);
        const price = prices[hours];
        const priceEl = card.querySelector('.time-price');
        if (priceEl) {
            priceEl.textContent = `₩${price.toLocaleString()}`;
        }
    });
}

// ===== Date/Time Picker =====
function initDateTimePicker() {
    const datePickerBtn = document.getElementById('date-picker-btn');
    const timePickerBtn = document.getElementById('time-picker-btn');
    
    // 기본값: 현재 날짜/시간
    const now = new Date();
    state.selectedDate = formatDateValue(now);
    state.selectedTime = formatTimeValue(now);
    
    // 초기 표시 업데이트
    updateDateTimeDisplay();
    
    // 클릭 시 picker 열기
    if (datePickerBtn) {
        datePickerBtn.addEventListener('click', () => {
            openCustomDatePicker();
        });
    }
    
    if (timePickerBtn) {
        timePickerBtn.addEventListener('click', () => {
            openCustomTimePicker();
        });
    }
    
    // 커스텀 picker 초기화
    initCustomDatePicker();
    initCustomTimePicker();
}

// ===== Custom Date Picker =====
function initCustomDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    const closeBtn = document.getElementById('date-picker-close');
    const confirmBtn = document.getElementById('date-picker-confirm');
    const monthColumn = document.getElementById('month-column');
    const dayColumn = document.getElementById('day-column');
    
    if (!modal || !monthColumn || !dayColumn) return;
    
    const now = new Date();
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();
    
    // 월 옵션 생성 (현재월부터 +3개월, 총 4개월)
    for (let i = 0; i <= 3; i++) {
        const targetDate = new Date(currentYear, now.getMonth() + i, 1);
        const monthNum = targetDate.getMonth() + 1;
        const yearNum = targetDate.getFullYear();
        const option = document.createElement('div');
        option.className = 'time-option' + (i === 0 ? ' selected' : '');
        option.dataset.value = monthNum.toString();
        option.dataset.year = yearNum.toString();
        option.dataset.offset = i.toString();
        option.textContent = `${monthNum}월`;
        monthColumn.appendChild(option);
    }
    
    // 초기 일 옵션 생성
    updateDayOptions(0);
    
    // 월 클릭 이벤트
    monthColumn.addEventListener('click', (e) => {
        if (e.target.classList.contains('time-option') && !e.target.classList.contains('disabled')) {
            monthColumn.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
            // 선택한 항목을 중앙으로 스크롤
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            // 월 변경 시 일 옵션 업데이트
            const offset = parseInt(e.target.dataset.offset);
            updateDayOptions(offset);
        }
    });
    
    // 일 클릭 이벤트
    dayColumn.addEventListener('click', (e) => {
        if (e.target.classList.contains('time-option') && !e.target.classList.contains('disabled')) {
            dayColumn.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
            // 선택한 항목을 중앙으로 스크롤
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    });
    
    // 일 옵션 업데이트 함수
    function updateDayOptions(monthOffset) {
        const now = new Date();
        const currentDay = now.getDate();
        
        // 선택된 월의 마지막 날 계산
        const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
        const daysInMonth = targetMonth.getDate();
        
        // 기존 옵션 제거
        dayColumn.innerHTML = '';
        
        // 시작일과 종료일 계산
        let startDay = 1;
        let endDay = daysInMonth;
        
        if (monthOffset === 0) {
            // 현재 월: 오늘부터
            startDay = currentDay;
        } else if (monthOffset === 3) {
            // 3개월 후: 오늘 날짜까지만
            endDay = Math.min(currentDay, daysInMonth);
        }
        
        // 일 옵션 생성
        for (let i = startDay; i <= endDay; i++) {
            const option = document.createElement('div');
            option.className = 'time-option' + (i === startDay ? ' selected' : '');
            option.dataset.value = i.toString();
            option.textContent = `${i}일`;
            dayColumn.appendChild(option);
        }
        
        // 스크롤 맨 위로
        dayColumn.scrollTop = 0;
    }
    
    // 닫기
    closeBtn.addEventListener('click', closeCustomDatePicker);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCustomDatePicker();
    });
    
    // 확인
    confirmBtn.addEventListener('click', () => {
        const monthEl = document.querySelector('#month-column .time-option.selected');
        const dayEl = document.querySelector('#day-column .time-option.selected');
        
        if (monthEl && dayEl) {
            const year = parseInt(monthEl.dataset.year);
            const month = parseInt(monthEl.dataset.value) - 1; // 0-indexed
            const day = parseInt(dayEl.dataset.value);
            
            const targetDate = new Date(year, month, day);
            
            state.selectedDate = formatDateValue(targetDate);
            updateDateTimeDisplay();
            updateTimeDisplay();
            
            Analytics.track('date_selected', {
                date: state.selectedDate,
                isToday: state.selectedDate === formatDateValue(new Date())
            });
        }
        
        closeCustomDatePicker();
    });
}

function openCustomDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    if (modal) {
        // 현재 선택된 날짜로 스크롤
        if (state.selectedDate) {
            const [year, month, day] = state.selectedDate.split('-');
            const dayColumn = document.getElementById('day-column');
            const selectedDayOption = dayColumn?.querySelector(`[data-value="${parseInt(day)}"]`);
            if (selectedDayOption) {
                dayColumn.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
                selectedDayOption.classList.add('selected');
                selectedDayOption.scrollIntoView({ block: 'center', behavior: 'instant' });
            }
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCustomDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ===== Custom Time Picker =====
function initCustomTimePicker() {
    const modal = document.getElementById('time-picker-modal');
    const closeBtn = document.getElementById('time-picker-close');
    const confirmBtn = document.getElementById('time-picker-confirm');
    const hourColumn = document.getElementById('hour-column');
    const minuteColumn = document.getElementById('minute-column');
    
    if (!modal || !hourColumn || !minuteColumn) return;
    
    // 시간 옵션 생성 (1-12)
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('div');
        option.className = 'time-option' + (i === 1 ? ' selected' : '');
        option.dataset.value = i.toString();
        option.textContent = i;
        hourColumn.appendChild(option);
    }
    
    // 분 옵션 생성 (0-59, 1분 단위)
    for (let i = 0; i < 60; i++) {
        const option = document.createElement('div');
        const minStr = String(i).padStart(2, '0');
        option.className = 'time-option' + (i === 0 ? ' selected' : '');
        option.dataset.value = minStr;
        option.textContent = minStr;
        minuteColumn.appendChild(option);
    }
    
    // 옵션 클릭 이벤트
    document.querySelectorAll('#time-picker-modal .time-picker-column').forEach(column => {
        column.addEventListener('click', (e) => {
            if (e.target.classList.contains('time-option')) {
                column.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
                e.target.classList.add('selected');
                // 선택한 항목을 중앙으로 스크롤
                e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        });
    });
    
    // 닫기
    closeBtn.addEventListener('click', closeCustomTimePicker);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCustomTimePicker();
    });
    
    // 확인
    confirmBtn.addEventListener('click', () => {
        const period = document.querySelector('#period-column .time-option.selected')?.dataset.value;
        const hour = document.querySelector('#hour-column .time-option.selected')?.dataset.value;
        const minute = document.querySelector('#minute-column .time-option.selected')?.dataset.value;
        
        if (period && hour && minute) {
            let h = parseInt(hour);
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            
            state.selectedTime = `${String(h).padStart(2, '0')}:${minute}`;
            updateDateTimeDisplay();
            updateTimeDisplay();
            
            Analytics.track('time_input_selected', {
                time: state.selectedTime
            });
        }
        
        closeCustomTimePicker();
    });
}

function openCustomTimePicker() {
    const modal = document.getElementById('time-picker-modal');
    if (modal) {
        // 현재 선택된 시간으로 초기화
        if (state.selectedTime) {
            const [hours, minutes] = state.selectedTime.split(':');
            const h = parseInt(hours);
            const m = parseInt(minutes);
            const isPM = h >= 12;
            const displayHour = h % 12 || 12;
            
            // 오전/오후 선택
            document.querySelectorAll('#period-column .time-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.value === (isPM ? 'PM' : 'AM'));
            });
            
            // 시간 선택
            const hourColumn = document.getElementById('hour-column');
            hourColumn.querySelectorAll('.time-option').forEach(opt => {
                const isSelected = parseInt(opt.dataset.value) === displayHour;
                opt.classList.toggle('selected', isSelected);
                if (isSelected) opt.scrollIntoView({ block: 'center', behavior: 'instant' });
            });
            
            // 분 선택 (현재 분 그대로)
            const nearestMinute = String(m).padStart(2, '0');
            const minuteColumn = document.getElementById('minute-column');
            minuteColumn.querySelectorAll('.time-option').forEach(opt => {
                const isSelected = opt.dataset.value === nearestMinute;
                opt.classList.toggle('selected', isSelected);
                if (isSelected) opt.scrollIntoView({ block: 'center', behavior: 'instant' });
            });
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCustomTimePicker() {
    const modal = document.getElementById('time-picker-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function updateDateTimeDisplay() {
    const dateDisplay = document.getElementById('date-display');
    const timeDisplay = document.getElementById('time-display');
    
    if (dateDisplay && state.selectedDate) {
        const [year, month, day] = state.selectedDate.split('-');
        const shortYear = year.slice(2); // 2026 -> 26
        dateDisplay.textContent = `${shortYear}년 ${parseInt(month)}월 ${parseInt(day)}일`;
    }
    
    if (timeDisplay && state.selectedTime) {
        const [hours, minutes] = state.selectedTime.split(':');
        const h = parseInt(hours);
        const period = h < 12 ? '오전' : '오후';
        const displayHour = h % 12 || 12;
        timeDisplay.textContent = `${period} ${displayHour}:${minutes}`;
    }
}

function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeValue(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// ===== Time Display =====
function initTimeDisplay() {
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 60000);
}

function updateTimeDisplay() {
    // 선택된 날짜/시간이 있으면 그것을 기준으로, 없으면 현재 시간
    let startTime;
    if (state.selectedDate && state.selectedTime) {
        startTime = new Date(`${state.selectedDate}T${state.selectedTime}`);
    } else {
        startTime = new Date();
    }
    
    const currentTimeStr = formatTime(startTime);
    
    const deadline = new Date(startTime.getTime() + CONFIG.arrivalBuffer * 60000);
    const deadlineStr = formatTime(deadline);
    
    const endTime = new Date(startTime.getTime() + state.selectedHours * 60 * 60000);
    const endTimeStr = formatTime(endTime);
    
    document.getElementById('current-time').textContent = currentTimeStr;
    document.getElementById('deadline-time').textContent = deadlineStr;
    document.getElementById('end-time').textContent = endTimeStr;
}

function formatTime(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 || 12;
    return `${period} ${displayHours}:${minutes}`;
}

// ===== Update Summary =====
function updateSummary() {
    const sizeLabels = { 'S': 'S (소형)', 'M': 'M (중형)', 'L': 'L (대형)' };
    
    document.getElementById('selected-size').textContent = sizeLabels[state.selectedSize];
    document.getElementById('selected-time').textContent = `${state.selectedHours}시간`;
    document.getElementById('total-price').textContent = `₩${state.selectedPrice.toLocaleString()}`;
    
    updateTimeDisplay();
}

// ===== Reserve Button (Pretotyping) =====
function initReserveButton() {
    const reserveBtn = document.getElementById('reserve-btn');
    
    reserveBtn.addEventListener('click', () => {
        state.reserveClickCount++;
        
        Analytics.track('reserve_click', {
            attempt: state.reserveClickCount,
            size: state.selectedSize,
            hours: state.selectedHours,
            price: state.selectedPrice,
            timeOnPage: Math.round((Date.now() - state.pageLoadTime) / 1000)
        });
        
        if (state.reserveClickCount === 1) {
            showErrorModal();
        } else {
            show503Page();
        }
    });
}

// ===== Error Modal =====
function initErrorModal() {
    const errorModal = document.getElementById('error-modal');
    const retryBtn = document.getElementById('retry-btn');
    const closeBtn = document.getElementById('close-error-modal');
    
    retryBtn.addEventListener('click', () => {
        Analytics.track('retry_click');
        hideErrorModal();
        state.reserveClickCount++;
        show503Page();
    });
    
    closeBtn.addEventListener('click', () => {
        Analytics.track('modal_close');
        hideErrorModal();
    });
    
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            Analytics.track('modal_backdrop_close');
            hideErrorModal();
        }
    });
}

function showErrorModal() {
    document.getElementById('error-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    Analytics.track('error_modal_shown');
}

function hideErrorModal() {
    document.getElementById('error-modal').classList.remove('active');
    document.body.style.overflow = '';
}

function show503Page() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('error-page').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    Analytics.track('503_page_shown');
}

// ===== Scroll Effects =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(15px)';
    section.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    observer.observe(section);
});

// ===== Touch Feedback =====
document.querySelectorAll('.size-card, .time-card, .cta-button, .modal-btn, .copy-btn').forEach(el => {
    el.addEventListener('touchstart', () => el.style.transform = 'scale(0.97)');
    el.addEventListener('touchend', () => el.style.transform = '');
});

// ===== Debug Functions (개발용) =====
window.viewAnalytics = () => {
    console.table(Analytics.getEvents());
    return Analytics.getEvents();
};

window.debugLocation = () => {
    console.log('=== Hands Free Debug ===');
    console.log('User Location:', state.userLocation);
    console.log('Destination:', CONFIG.destination);
    if (state.userLocation) {
        const dist = calculateDistance(
            state.userLocation.lat, state.userLocation.lng,
            CONFIG.destination.lat, CONFIG.destination.lng
        );
        console.log('Straight Distance:', Math.round(dist), 'm');
        console.log('Est. Walking Time:', Math.ceil(dist * 1.4 / 80), 'min');
    }
    return state.userLocation;
};

window.forceRecalculate = () => {
    console.log('[Hands Free] Force recalculating route...');
    fetchWalkingRoute();
};
