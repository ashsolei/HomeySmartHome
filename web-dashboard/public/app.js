// Smart Home Pro Dashboard - Main Application

// Sanitize strings before inserting into innerHTML to prevent XSS
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Dark mode toggle — persists preference in localStorage
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');

    const btn = document.getElementById('dark-mode-toggle');
    if (btn) {
        btn.setAttribute('aria-pressed', String(isDark));
        btn.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

// Apply saved dark mode preference on page load
function initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') {
        document.body.classList.add('dark-mode');
    }
    // Sync button state to whatever was just applied
    const isDark = document.body.classList.contains('dark-mode');
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) {
        btn.setAttribute('aria-pressed', String(isDark));
        btn.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

class SmartHomeDashboard {
    constructor() {
        this.socket = null;
        this.data = {
            devices: {},
            zones: {},
            scenes: {},
            energy: {},
            security: { mode: 'home' }
        };
        
        this.init();
    }

    async init() {
        initDarkMode();
        await this.loadData();
        this.connectSocket();
        this.setupEventListeners();
        this.startClock();
        this.renderAll();
    }

    // Data Loading
    async loadData() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            this.data = { ...this.data, ...data };
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showToast('Kunde inte ladda data', 'error');
        }
    }

    // WebSocket Connection
    connectSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('device-updated', (data) => {
            this.handleDeviceUpdate(data);
        });

        this.socket.on('scene-activated', (data) => {
            this.handleSceneActivated(data);
        });

        this.socket.on('energy-update', (data) => {
            this.updateEnergyDisplay(data);
        });

        this.socket.on('security-mode-changed', (data) => {
            this.handleSecurityModeChanged(data);
        });
    }

    updateConnectionStatus(connected) {
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            indicator.classList.toggle('online', connected);
            indicator.querySelector('span').textContent = connected ? 'Homey Ansluten' : 'Ej ansluten';
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // Mobile menu toggle
        document.querySelector('.menu-toggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });

        // Scene buttons
        document.querySelectorAll('.scene-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = btn.dataset.scene;
                this.activateScene(sceneId);
            });
        });

        // Device filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterDevices(btn.dataset.filter);
            });
        });

        // Security mode buttons
        document.querySelectorAll('.security-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setSecurityMode(btn.dataset.mode);
            });
        });

        // Modal close
        document.querySelector('.modal-close')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.querySelector('.modal-cancel')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Click outside modal
        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });
    }

    // Navigation
    navigateTo(page) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `${page}-page`);
        });

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            devices: 'Enheter',
            scenes: 'Scener',
            automations: 'Automationer',
            energy: 'Energi',
            security: 'Säkerhet',
            climate: 'Klimat'
        };
        document.getElementById('page-title').textContent = titles[page] || page;

        // Close mobile menu
        document.querySelector('.sidebar').classList.remove('open');
    }

    // Rendering
    renderAll() {
        this.renderZones();
        this.renderDevices();
        this.renderSecuritySensors();
        this.renderClimateZones();
        this.renderEnergyConsumers();
        this.initEnergyChart();
    }

    renderZones() {
        const container = document.getElementById('zones-overview');
        if (!container) return;

        const zones = this.data.zones;
        const devices = this.data.devices;

        container.innerHTML = Object.values(zones).map(zone => {
            const zoneDevices = Object.values(devices).filter(d => d.zone === zone.id);
            const activeCount = zoneDevices.filter(d => d.capabilitiesObj?.onoff?.value).length;
            const tempDevice = zoneDevices.find(d => d.capabilitiesObj?.measure_temperature);
            const temp = tempDevice?.capabilitiesObj?.measure_temperature?.value;

            return `
                <div class="zone-card" data-zone="${escapeHtml(zone.id)}">
                    <div class="zone-header">
                        <div class="zone-name">
                            <span class="zone-icon">${escapeHtml(zone.icon || '🏠')}</span>
                            <span>${escapeHtml(zone.name)}</span>
                        </div>
                        ${temp ? `<span class="zone-temp">${temp.toFixed(1)}°C</span>` : ''}
                    </div>
                    <div class="zone-devices">
                        ${zoneDevices.map(d => `
                            <div class="zone-device-indicator ${d.capabilitiesObj?.onoff?.value ? '' : 'off'}"
                                 title="${escapeHtml(d.name)}"></div>
                        `).join('')}
                    </div>
                    <div class="zone-stats">
                        <small>${activeCount}/${zoneDevices.length} aktiva</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDevices() {
        const container = document.getElementById('devices-grid');
        if (!container) return;

        const devices = Object.values(this.data.devices);

        container.innerHTML = devices.map(device => {
            const isOn = device.capabilitiesObj?.onoff?.value;
            const dimValue = device.capabilitiesObj?.dim?.value;
            const hasDim = device.capabilities?.includes('dim');
            const zone = this.data.zones[device.zone];

            return `
                <div class="device-card ${isOn ? 'active' : ''}" data-device="${escapeHtml(device.id)}" data-class="${escapeHtml(device.class)}">
                    <div class="device-header">
                        <div class="device-info">
                            <div class="device-icon">
                                <i class="fas ${this.getDeviceIcon(device.class)}"></i>
                            </div>
                            <div>
                                <div class="device-name">${escapeHtml(device.name)}</div>
                                <div class="device-zone">${escapeHtml(zone?.name || 'Okänt rum')}</div>
                            </div>
                        </div>
                        ${device.capabilities?.includes('onoff') ? `
                            <button class="device-toggle ${isOn ? 'active' : ''}"
                                    onclick="dashboard.toggleDevice('${escapeHtml(device.id)}')"></button>
                        ` : ''}
                    </div>
                    ${hasDim ? `
                        <div class="device-controls">
                            <div class="slider-control">
                                <label>Ljusstyrka</label>
                                <input type="range" min="0" max="100" value="${Math.round((dimValue || 0) * 100)}"
                                       onchange="dashboard.setDeviceDim('${escapeHtml(device.id)}', this.value)">
                                <span class="slider-value">${Math.round((dimValue || 0) * 100)}%</span>
                            </div>
                        </div>
                    ` : ''}
                    ${device.capabilitiesObj?.measure_power ? `
                        <div class="device-power">
                            <i class="fas fa-bolt"></i>
                            <span>${device.capabilitiesObj.measure_power.value} W</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderSecuritySensors() {
        const container = document.getElementById('security-sensors');
        if (!container) return;

        const securityDevices = Object.values(this.data.devices).filter(d =>
            d.capabilities?.includes('alarm_contact') ||
            d.capabilities?.includes('alarm_motion') ||
            d.capabilities?.includes('alarm_tamper')
        );

        container.innerHTML = securityDevices.map(device => {
            const isAlert = device.capabilitiesObj?.alarm_contact?.value ||
                           device.capabilitiesObj?.alarm_motion?.value ||
                           device.capabilitiesObj?.alarm_tamper?.value;
            const zone = this.data.zones[device.zone];

            return `
                <div class="sensor-card">
                    <div class="sensor-status ${isAlert ? 'alert' : ''}"></div>
                    <div class="sensor-info">
                        <div class="sensor-name">${escapeHtml(device.name)}</div>
                        <div class="sensor-location">${escapeHtml(zone?.name || 'Okänt rum')}</div>
                    </div>
                    <i class="fas ${device.capabilities?.includes('alarm_contact') ? 'fa-door-open' : 'fa-walking'}"></i>
                </div>
            `;
        }).join('');

        // Also render security log
        this.renderSecurityLog();
    }

    renderSecurityLog() {
        const container = document.getElementById('security-log');
        if (!container) return;

        const logs = [
            { time: '12:45', message: 'Säkerhetsläge ändrat till Hemma' },
            { time: '08:30', message: 'Rörelse upptäckt i Hallen' },
            { time: '08:15', message: 'Ytterdörren öppnades' },
            { time: '07:00', message: 'Säkerhetsläge ändrat från Natt' },
        ];

        container.innerHTML = logs.map(log => `
            <div class="log-item">
                <span class="log-time">${escapeHtml(log.time)}</span>
                <span class="log-message">${escapeHtml(log.message)}</span>
            </div>
        `).join('');
    }

    renderClimateZones() {
        const container = document.getElementById('climate-zones');
        if (!container) return;

        const zones = Object.values(this.data.zones);

        container.innerHTML = zones.map(zone => {
            const tempDevice = Object.values(this.data.devices).find(d =>
                d.zone === zone.id && d.capabilitiesObj?.measure_temperature
            );
            const humidityDevice = Object.values(this.data.devices).find(d =>
                d.zone === zone.id && d.capabilitiesObj?.measure_humidity
            );
            const thermostat = Object.values(this.data.devices).find(d =>
                d.zone === zone.id && d.capabilitiesObj?.target_temperature
            );

            const temp = tempDevice?.capabilitiesObj?.measure_temperature?.value;
            const humidity = humidityDevice?.capabilitiesObj?.measure_humidity?.value;
            const targetTemp = thermostat?.capabilitiesObj?.target_temperature?.value || 21;

            if (!temp) return '';

            return `
                <div class="climate-card" data-zone="${escapeHtml(zone.id)}">
                    <div class="climate-header">
                        <div class="climate-zone-name">${escapeHtml(zone.name)}</div>
                        <div class="climate-current-temp">${temp.toFixed(1)}°</div>
                    </div>
                    <div class="climate-controls">
                        <div class="temp-control">
                            <label>Måltemperatur</label>
                            <div class="temp-adjust">
                                <button class="temp-btn" onclick="dashboard.adjustTemp('${escapeHtml(zone.id)}', -0.5)">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span class="temp-value" id="target-${escapeHtml(zone.id)}">${targetTemp}°</span>
                                <button class="temp-btn" onclick="dashboard.adjustTemp('${escapeHtml(zone.id)}', 0.5)">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        ${humidity ? `
                            <div class="humidity-display">
                                <i class="fas fa-tint"></i>
                                <span>${humidity}% luftfuktighet</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEnergyConsumers() {
        const container = document.getElementById('consumer-list');
        if (!container) return;

        const powerDevices = Object.values(this.data.devices)
            .filter(d => d.capabilitiesObj?.measure_power?.value > 0)
            .sort((a, b) => b.capabilitiesObj.measure_power.value - a.capabilitiesObj.measure_power.value)
            .slice(0, 5);

        const maxPower = Math.max(...powerDevices.map(d => d.capabilitiesObj.measure_power.value));

        container.innerHTML = powerDevices.map(device => {
            const power = device.capabilitiesObj.measure_power.value;
            const percentage = (power / maxPower) * 100;

            return `
                <div class="consumer-item">
                    <div class="consumer-info">
                        <div class="consumer-name">${escapeHtml(device.name)}</div>
                        <div class="consumer-bar">
                            <div class="consumer-bar-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    <div class="consumer-value">${power} W</div>
                </div>
            `;
        }).join('');
    }

    initEnergyChart() {
        const canvas = document.getElementById('energy-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Sample data for 24 hours
        const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
        const data = [650, 580, 520, 490, 480, 510, 720, 890, 1050, 980, 920, 870,
                     850, 830, 780, 820, 910, 1020, 1150, 1080, 950, 880, 780, 700];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Energiförbrukning (W)',
                    data: data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
    }

    // Device Controls
    async toggleDevice(deviceId) {
        const device = this.data.devices[deviceId];
        if (!device) return;

        const currentValue = device.capabilitiesObj?.onoff?.value || false;
        const newValue = !currentValue;

        try {
            await fetch(`/api/device/${deviceId}/capability/onoff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newValue })
            });

            // Update local state
            device.capabilitiesObj.onoff.value = newValue;
            this.renderDevices();
            this.renderZones();
            
            this.showToast(`${device.name} ${newValue ? 'på' : 'av'}`, 'success');
        } catch (error) {
            this.showToast('Kunde inte styra enheten', 'error');
        }
    }

    async setDeviceDim(deviceId, value) {
        const device = this.data.devices[deviceId];
        if (!device) return;

        const dimValue = parseInt(value) / 100;

        try {
            await fetch(`/api/device/${deviceId}/capability/dim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: dimValue })
            });

            device.capabilitiesObj.dim.value = dimValue;
        } catch (error) {
            this.showToast('Kunde inte dimra enheten', 'error');
        }
    }

    // Scenes
    async activateScene(sceneId) {
        try {
            await fetch(`/api/scene/${sceneId}`, {
                method: 'POST'
            });

            // Update UI
            document.querySelectorAll('.scene-button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.scene === sceneId);
            });

            const sceneName = this.data.scenes[sceneId]?.name || sceneId;
            this.showToast(`Scen "${sceneName}" aktiverad`, 'success');
            this.addActivity('scene', `Scen "${sceneName}" aktiverades`);
        } catch (error) {
            this.showToast('Kunde inte aktivera scen', 'error');
        }
    }

    // Security
    async setSecurityMode(mode) {
        try {
            await fetch('/api/security/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });

            // Update UI
            document.querySelectorAll('.security-mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            const modeNames = {
                disarmed: 'Avlarmat',
                home: 'Hemma',
                away: 'Borta',
                night: 'Natt'
            };

            document.getElementById('security-status').textContent = modeNames[mode];
            this.showToast(`Säkerhetsläge: ${modeNames[mode]}`, 'success');
        } catch (error) {
            this.showToast('Kunde inte ändra säkerhetsläge', 'error');
        }
    }

    // Climate
    adjustTemp(zoneId, delta) {
        const display = document.getElementById(`target-${zoneId}`);
        if (!display) return;

        let current = parseFloat(display.textContent);
        current += delta;
        current = Math.max(10, Math.min(30, current));
        display.textContent = `${current}°`;

        // Debounced API call would go here
        this.showToast(`Måltemperatur: ${current}°C`, 'info');
    }

    // Filtering
    filterDevices(filter) {
        const cards = document.querySelectorAll('.device-card');
        cards.forEach(card => {
            if (filter === 'all' || card.dataset.class === filter) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Event Handlers
    handleDeviceUpdate(data) {
        const { deviceId, capability, value } = data;
        const device = this.data.devices[deviceId];
        if (device && device.capabilitiesObj?.[capability]) {
            device.capabilitiesObj[capability].value = value;
            this.renderDevices();
            this.renderZones();
        }
    }

    handleSceneActivated(data) {
        document.querySelectorAll('.scene-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scene === data.sceneId);
        });
    }

    handleSecurityModeChanged(data) {
        document.querySelectorAll('.security-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === data.mode);
        });
    }

    updateEnergyDisplay(data) {
        const currentPower = document.getElementById('current-power');
        const energyCurrent = document.getElementById('energy-current');
        
        if (currentPower) currentPower.textContent = `${data.current} W`;
        if (energyCurrent) energyCurrent.textContent = data.current;
    }

    // Utilities
    getDeviceIcon(deviceClass) {
        const icons = {
            light: 'fa-lightbulb',
            thermostat: 'fa-thermometer-half',
            sensor: 'fa-broadcast-tower',
            socket: 'fa-plug',
            lock: 'fa-lock',
            speaker: 'fa-volume-up',
            tv: 'fa-tv',
            camera: 'fa-video',
            default: 'fa-cube'
        };
        return icons[deviceClass] || icons.default;
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeEl = document.getElementById('current-time');
            const dateEl = document.getElementById('current-date');
            
            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString('sv-SE', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            }
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }

    addActivity(type, text) {
        const list = document.getElementById('activity-list');
        if (!list) return;

        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-icon ${escapeHtml(type)}">
                <i class="fas ${type === 'scene' ? 'fa-magic' : type === 'light' ? 'fa-lightbulb' : 'fa-walking'}"></i>
            </div>
            <div class="activity-info">
                <span class="activity-text">${escapeHtml(text)}</span>
                <span class="activity-time">just nu</span>
            </div>
        `;
        
        list.insertBefore(item, list.firstChild);
        
        // Keep only last 10 items
        while (list.children.length > 10) {
            list.removeChild(list.lastChild);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${this.getToastIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        `;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    showModal(title, content, onConfirm, isHtml = false) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const confirmBtn = document.querySelector('.modal-confirm');

        modalTitle.textContent = title;

        // Use textContent by default to prevent XSS.
        // Pass isHtml=true only when content has been pre-sanitized by the caller.
        if (isHtml) {
            modalBody.innerHTML = content;
        } else {
            modalBody.textContent = content;
        }

        confirmBtn.onclick = () => {
            if (onConfirm) onConfirm();
            this.closeModal();
        };

        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('modal')?.classList.remove('active');
    }
}

// Initialize dashboard
const dashboard = new SmartHomeDashboard();
