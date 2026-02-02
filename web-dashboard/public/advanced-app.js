// Advanced Smart Home Dashboard - AI & Analytics

class AdvancedDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.data = {
            analytics: null,
            predictions: null,
            insights: []
        };
        
        this.init();
    }

    async init() {
        await this.loadAnalytics();
        this.setupEventListeners();
        this.connectSocket();
        this.renderAll();
        this.startAutoRefresh();
    }

    // ============================================
    // DATA LOADING
    // ============================================

    async loadAnalytics() {
        try {
            const [analytics, predictions, insights] = await Promise.all([
                fetch('/api/dashboard/advanced').then(r => r.json()),
                fetch('/api/analytics/predictions').then(r => r.json()),
                fetch('/api/analytics/insights').then(r => r.json())
            ]);

            this.data.analytics = analytics;
            this.data.predictions = predictions;
            this.data.insights = insights;
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.showToast('Kunde inte ladda analysdata', 'error');
        }
    }

    // ============================================
    // RENDERING
    // ============================================

    renderAll() {
        this.renderInsights();
        this.renderEnergyAnalytics();
        this.renderCharts();
        this.renderPredictions();
        this.renderPeakHours();
        this.renderSavingsOpportunities();
        this.renderOptimizationScore();
    }

    renderInsights() {
        const container = document.getElementById('insights-cards');
        if (!container || !this.data.insights) return;

        container.innerHTML = this.data.insights.map(insight => `
            <div class="insight-card ${insight.priority}">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.message}</p>
                    ${insight.savings ? `
                        <div class="insight-savings">
                            Potentiell besparing: ${insight.savings[0]?.savingPotential.toFixed(0)} kr/mån
                        </div>
                    ` : ''}
                    ${insight.action ? `
                        <button class="btn btn-sm btn-primary" onclick="advancedDashboard.handleInsightAction('${insight.action}', ${JSON.stringify(insight).replace(/"/g, '&quot;')})">
                            Ta åtgärd
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderEnergyAnalytics() {
        const analytics = this.data.analytics?.analytics?.energy;
        if (!analytics) return;

        // Current consumption
        const currentEl = document.getElementById('current-consumption');
        if (currentEl) {
            currentEl.textContent = Math.round(analytics.current.watts);
        }

        // Trend
        const trendEl = document.getElementById('consumption-trend');
        if (trendEl) {
            const trend = analytics.trend;
            const icon = trend.direction === 'increasing' ? '📈' : 
                        trend.direction === 'decreasing' ? '📉' : '➡️';
            trendEl.innerHTML = `
                <span class="trend-icon">${icon}</span>
                <span class="trend-text">${Math.abs(trend.change).toFixed(1)}%</span>
            `;
            trendEl.className = `metric-trend ${trend.direction}`;
        }

        // Efficiency score
        const efficiencyScore = analytics.efficiency.score;
        const efficiencyEl = document.getElementById('efficiency-score');
        if (efficiencyEl) {
            efficiencyEl.textContent = efficiencyScore;
        }

        const efficiencyCircle = document.getElementById('efficiency-circle');
        if (efficiencyCircle) {
            const color = efficiencyScore > 80 ? '#4CAF50' : 
                         efficiencyScore > 60 ? '#FF9800' : '#F44336';
            efficiencyCircle.style.setProperty('--score-color', color);
            efficiencyCircle.style.setProperty('--score-percent', `${efficiencyScore}%`);
        }

        const ratingEl = document.getElementById('efficiency-rating');
        if (ratingEl) {
            ratingEl.textContent = this.getRatingText(analytics.efficiency.rating);
        }

        // Monthly consumption
        const monthlyEl = document.getElementById('monthly-consumption');
        if (monthlyEl) {
            monthlyEl.textContent = analytics.monthly.toFixed(1);
        }

        const costEl = document.getElementById('monthly-cost');
        if (costEl) {
            costEl.textContent = analytics.costs.perMonth.toFixed(0);
        }

        // Forecast
        const forecastEl = document.getElementById('forecast-consumption');
        if (forecastEl) {
            forecastEl.textContent = analytics.forecast.nextMonth.toFixed(1);
        }

        const confidenceEl = document.getElementById('forecast-confidence');
        if (confidenceEl) {
            confidenceEl.textContent = Math.round(analytics.forecast.confidence * 100);
        }
    }

    renderCharts() {
        this.renderEnergyChart();
    }

    renderEnergyChart() {
        const canvas = document.getElementById('energyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Generate sample data (would come from real data)
        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
        const historicalData = this.generateSampleEnergyData();
        const predictedData = this.generatePredictedData(historicalData);

        if (this.charts.energy) {
            this.charts.energy.destroy();
        }

        this.charts.energy = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    {
                        label: 'Faktisk förbrukning',
                        data: historicalData,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Prognos',
                        data: predictedData,
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} kWh`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Energi (kWh)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Tid'
                        }
                    }
                }
            }
        });
    }

    renderPredictions() {
        const predictions = this.data.predictions;
        if (!predictions) return;

        // Next hour
        const nextHourEl = document.getElementById('pred-next-hour');
        if (nextHourEl && predictions.energy) {
            nextHourEl.textContent = predictions.energy.prediction.toFixed(2);
        }

        // Today
        const todayEl = document.getElementById('pred-today');
        if (todayEl && predictions.todayForecast) {
            todayEl.textContent = predictions.todayForecast.prediction.toFixed(1);
        }

        // This month
        const monthEl = document.getElementById('pred-month');
        if (monthEl && predictions.monthForecast) {
            monthEl.textContent = predictions.monthForecast.prediction.toFixed(0);
        }
    }

    renderPeakHours() {
        const analytics = this.data.analytics?.analytics?.energy;
        if (!analytics || !analytics.peakHours) return;

        const container = document.getElementById('peak-hours-list');
        if (!container) return;

        container.innerHTML = analytics.peakHours.slice(0, 5).map(peak => `
            <div class="peak-hour-card">
                <div class="peak-time">${peak.hour}:00 - ${peak.hour + 1}:00</div>
                <div class="peak-consumption">${peak.consumption.toFixed(0)} W</div>
                <div class="peak-percentage">+${peak.percentage.toFixed(0)}% över genomsnitt</div>
                <button class="btn btn-sm" onclick="advancedDashboard.optimizePeakHour(${peak.hour})">
                    Optimera
                </button>
            </div>
        `).join('');
    }

    renderSavingsOpportunities() {
        const analytics = this.data.analytics?.analytics?.energy;
        if (!analytics || !analytics.savings) return;

        const container = document.getElementById('savings-opportunities');
        if (!container) return;

        container.innerHTML = analytics.savings.map(saving => `
            <div class="opportunity-card priority-${saving.priority}">
                <div class="opportunity-header">
                    <h4>${this.getSavingTypeIcon(saving.type)} ${saving.device || 'Allmän optimering'}</h4>
                    <span class="priority-badge">${this.getPriorityText(saving.priority)}</span>
                </div>
                <p class="opportunity-description">${this.getSavingDescription(saving)}</p>
                <div class="opportunity-savings">
                    <span class="savings-amount">💰 ${Math.round(saving.savingPotential)} kr/mån</span>
                    <span class="current-cost">Nuvarande: ${Math.round(saving.currentCost)} kr/mån</span>
                </div>
                <div class="opportunity-actions">
                    <button class="btn btn-primary" onclick="advancedDashboard.applySavingRecommendation('${saving.deviceId}', '${saving.type}')">
                        Tillämpa
                    </button>
                    <button class="btn btn-secondary" onclick="advancedDashboard.ignoreSaving('${saving.type}')">
                        Ignorera
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderOptimizationScore() {
        const analytics = this.data.analytics?.analytics;
        if (!analytics) return;

        const energyScore = analytics.energy?.efficiency?.score || 75;
        const climateScore = analytics.climate?.comfort?.score || 85;
        
        // Calculate automation score (simplified)
        const automationScore = 72;
        
        const overallScore = Math.round((energyScore + climateScore + automationScore) / 3);
        
        const scoreEl = document.getElementById('overall-score');
        if (scoreEl) {
            scoreEl.textContent = overallScore;
        }

        // Render recommendations
        this.renderOptimizationRecommendations();
    }

    renderOptimizationRecommendations() {
        const container = document.getElementById('optimization-recommendations');
        if (!container) return;

        const recommendations = [
            {
                title: 'Automatisera morgonrutinen',
                description: 'Skapa en intelligent morgonrutin baserad på dina vanor',
                impact: 'Hög',
                effort: 'Låg',
                savings: '45 kr/mån'
            },
            {
                title: 'Optimera värmeinställningar',
                description: 'Justera termostater baserat på närvaromönster',
                impact: 'Medel',
                effort: 'Låg',
                savings: '85 kr/mån'
            },
            {
                title: 'Implementera smart belysning',
                description: 'Använd rörelsesensorer och scheman för belysning',
                impact: 'Medel',
                effort: 'Medel',
                savings: '35 kr/mån'
            }
        ];

        container.innerHTML = recommendations.map((rec, index) => `
            <div class="recommendation-card">
                <div class="recommendation-header">
                    <h4>${rec.title}</h4>
                    <span class="impact-badge impact-${rec.impact.toLowerCase()}">${rec.impact} påverkan</span>
                </div>
                <p>${rec.description}</p>
                <div class="recommendation-meta">
                    <span>💪 Insats: ${rec.effort}</span>
                    <span>💰 Besparing: ${rec.savings}</span>
                </div>
                <button class="btn btn-primary" onclick="advancedDashboard.applyRecommendation(${index})">
                    Implementera
                </button>
            </div>
        `).join('');
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });

        // Refresh button
        document.getElementById('refresh-analytics')?.addEventListener('click', async () => {
            await this.loadAnalytics();
            this.renderAll();
            this.showToast('Analysdata uppdaterad', 'success');
        });
    }

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
            analytics: 'AI & Analytics',
            predictions: 'Prediktioner',
            insights: 'Insikter',
            automations: 'Automationer',
            optimization: 'Optimering'
        };
        
        const titleEl = document.getElementById('page-title');
        if (titleEl) {
            titleEl.textContent = titles[page] || 'Dashboard';
        }
    }

    // ============================================
    // ACTIONS
    // ============================================

    async handleInsightAction(action, insight) {
        console.log('Handling action:', action, insight);
        
        switch (action) {
            case 'review_devices':
                this.navigateTo('optimization');
                break;
            case 'adjust_climate':
                this.showClimateAdjustment();
                break;
            case 'view_recommendations':
                this.navigateTo('insights');
                break;
            case 'create_automation':
                this.showAutomationWizard();
                break;
            default:
                this.showToast('Åtgärd inte implementerad än', 'info');
        }
    }

    async optimizePeakHour(hour) {
        this.showToast(`Optimerar förbrukning för klockan ${hour}:00`, 'info');
        // Would implement actual optimization logic
    }

    async applySavingRecommendation(deviceId, type) {
        this.showToast('Tillämpar besparingsrekommendation...', 'info');
        // Would implement actual device control
    }

    async ignoreSaving(type) {
        this.showToast('Rekommendation ignorerad', 'info');
    }

    async applyRecommendation(index) {
        this.showToast('Implementerar rekommendation...', 'success');
        // Would implement actual recommendation
    }

    showClimateAdjustment() {
        const modalBody = document.getElementById('modal-body');
        const modal = document.getElementById('modal');
        
        if (!modalBody || !modal) return;
        
        modalBody.innerHTML = `
            <h3>Justera Klimatinställningar</h3>
            <div class="climate-adjustment">
                <p>Vill du justera temperaturen i de berörda rummen automatiskt?</p>
                <button class="btn btn-primary" onclick="advancedDashboard.applyClimateAdjustment()">
                    Ja, justera automatiskt
                </button>
                <button class="btn btn-secondary" onclick="advancedDashboard.closeModal()">
                    Avbryt
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
    }

    showAutomationWizard() {
        this.navigateTo('automations');
        this.showToast('Öppnar automationsassistent...', 'info');
    }

    async applyClimateAdjustment() {
        this.closeModal();
        this.showToast('Justerar klimatinställningar...', 'success');
    }

    closeModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ============================================
    // WEBSOCKET
    // ============================================

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

        this.socket.on('analytics-updated', async (data) => {
            await this.loadAnalytics();
            this.renderAll();
        });
    }

    updateConnectionStatus(connected) {
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            indicator.classList.toggle('online', connected);
            indicator.querySelector('span:last-child').textContent = 
                connected ? 'Homey Ansluten' : 'Ej ansluten';
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    generateSampleEnergyData() {
        const currentHour = new Date().getHours();
        const pattern = [0.5, 0.4, 0.4, 0.4, 0.4, 0.5, 0.7, 0.9, 0.8, 0.7, 0.7, 0.7,
                        0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.1, 1.0, 0.9, 0.7, 0.6];
        
        return pattern.map((factor, hour) => {
            if (hour > currentHour) return null;
            return (150 * factor) + (Math.random() * 20 - 10);
        });
    }

    generatePredictedData(historical) {
        const currentHour = new Date().getHours();
        const avgPattern = [0.5, 0.4, 0.4, 0.4, 0.4, 0.5, 0.7, 0.9, 0.8, 0.7, 0.7, 0.7,
                           0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.1, 1.0, 0.9, 0.7, 0.6];
        
        return avgPattern.map((factor, hour) => {
            if (hour <= currentHour) return null;
            return 150 * factor;
        });
    }

    getRatingText(rating) {
        const ratings = {
            excellent: 'Utmärkt',
            good: 'Bra',
            fair: 'Godkänt',
            poor: 'Behöver förbättras'
        };
        return ratings[rating] || rating;
    }

    getSavingTypeIcon(type) {
        const icons = {
            standby: '🔌',
            temperature: '🌡️',
            lighting: '💡',
            general: '⚡'
        };
        return icons[type] || '💡';
    }

    getPriorityText(priority) {
        const texts = {
            high: 'Hög prioritet',
            medium: 'Medel prioritet',
            low: 'Låg prioritet'
        };
        return texts[priority] || priority;
    }

    getSavingDescription(saving) {
        if (saving.type === 'standby') {
            return `${saving.device} är påslagen även när den inte används`;
        } else if (saving.type === 'temperature') {
            return `Sänk temperaturen från ${saving.currentTemp}° till ${saving.suggestedTemp}°`;
        }
        return 'Optimeringsmöjlighet upptäckt';
    }

    showToast(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Would implement actual toast notification
    }

    startAutoRefresh() {
        // Refresh analytics every 5 minutes
        setInterval(async () => {
            await this.loadAnalytics();
            this.renderAll();
        }, 5 * 60 * 1000);
    }
}

// Initialize dashboard
const advancedDashboard = new AdvancedDashboard();
