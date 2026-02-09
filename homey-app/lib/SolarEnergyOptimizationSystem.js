'use strict';

const EventEmitter = require('events');

class SolarEnergyOptimizationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // Panel arrays configuration
    this.panelArrays = {
      'south-roof': {
        name: 'South Roof Array',
        panelCount: 20,
        panelWattage: 400,
        totalCapacityKW: 8.0,
        azimuth: 180,
        tilt: 35,
        installDate: '2023-06-15',
        degradationRate: 0.005,
        currentEfficiency: 1.0,
        temperatureCoefficient: -0.004,
        snowCoverage: 0,
        shadePercentage: 0,
        panels: []
      },
      'east-roof': {
        name: 'East Roof Array',
        panelCount: 12,
        panelWattage: 400,
        totalCapacityKW: 4.8,
        azimuth: 90,
        tilt: 30,
        installDate: '2023-06-15',
        degradationRate: 0.005,
        currentEfficiency: 1.0,
        temperatureCoefficient: -0.004,
        snowCoverage: 0,
        shadePercentage: 0,
        panels: []
      },
      'west-roof': {
        name: 'West Roof Array',
        panelCount: 8,
        panelWattage: 400,
        totalCapacityKW: 3.2,
        azimuth: 270,
        tilt: 30,
        installDate: '2023-06-15',
        degradationRate: 0.005,
        currentEfficiency: 1.0,
        temperatureCoefficient: -0.004,
        snowCoverage: 0,
        shadePercentage: 0,
        panels: []
      }
    };

    // Battery storage
    this.batteries = {
      main: {
        name: 'Main Battery',
        capacityKWh: 13.5,
        chargeLevel: 0.65,
        maxChargeRateKW: 5.0,
        maxDischargeRateKW: 7.0,
        cycleCount: 342,
        healthPercentage: 97.2,
        temperature: 22.5,
        mode: 'standby',
        minChargeLevel: 0.10,
        maxChargeLevel: 0.95
      },
      auxiliary: {
        name: 'Auxiliary Battery',
        capacityKWh: 5.0,
        chargeLevel: 0.40,
        maxChargeRateKW: 3.3,
        maxDischargeRateKW: 3.3,
        cycleCount: 187,
        healthPercentage: 98.5,
        temperature: 21.8,
        mode: 'standby',
        minChargeLevel: 0.10,
        maxChargeLevel: 0.95
      }
    };

    // Inverters
    this.inverters = {
      primary: {
        model: 'Fronius Symo GEN24 10.0 Plus',
        capacityKW: 10.0,
        currentOutputKW: 0,
        efficiency: 0.976,
        temperature: 35.2,
        totalEnergyProducedKWh: 24580.5,
        status: 'active',
        firmwareVersion: '1.30.7-1',
        maxTemperature: 65,
        connectedArrays: ['south-roof', 'east-roof']
      },
      secondary: {
        model: 'Fronius Primo GEN24 5.0',
        capacityKW: 5.0,
        currentOutputKW: 0,
        efficiency: 0.972,
        temperature: 32.1,
        totalEnergyProducedKWh: 8920.3,
        status: 'active',
        firmwareVersion: '1.30.7-1',
        maxTemperature: 65,
        connectedArrays: ['west-roof']
      }
    };

    // Grid management
    this.grid = {
      exportedKWh: 12450.8,
      importedKWh: 8320.4,
      netMeteringBalance: 4130.4,
      currentFlowDirection: 'neutral',
      currentFlowKW: 0,
      spotPrices: {
        peak: 1.50,
        offPeak: 0.40,
        mid: 0.90,
        current: 0.90
      },
      feedInTariff: 0.60,
      monthlyExport: [],
      monthlyImport: [],
      annualSurplus: 0
    };

    // Self-consumption
    this.selfConsumption = {
      ratio: 0.68,
      target: 0.70,
      dailyProduction: 0,
      dailySelfConsumed: 0,
      dailyExported: 0,
      dailyImported: 0,
      optimizationActive: true
    };

    // Weather and environment
    this.weather = {
      temperature: 15,
      cloudCover: 0.3,
      precipitation: 0,
      windSpeed: 5,
      humidity: 60,
      uvIndex: 4,
      snowOnGround: false,
      forecast: []
    };

    // Stockholm solar parameters (59.33N latitude)
    this.solarParams = {
      latitude: 59.33,
      longitude: 18.07,
      timezone: 'Europe/Stockholm',
      monthlySolarHours: [6, 8, 10, 13, 16, 19, 18, 15, 12, 9, 7, 5],
      sunriseHours: [8.8, 7.8, 6.5, 5.5, 4.2, 3.5, 3.8, 5.0, 6.2, 7.3, 8.2, 9.0],
      sunsetHours: [15.2, 16.3, 17.8, 19.5, 20.8, 22.0, 21.8, 20.5, 18.8, 17.2, 15.5, 14.5]
    };

    // ROI and financials
    this.financials = {
      systemCostSEK: 285000,
      installationCostSEK: 45000,
      totalInvestmentSEK: 330000,
      rotAvdragApplied: true,
      rotAvdragAmountSEK: 13500,
      netInvestmentSEK: 316500,
      cumulativeSavingsSEK: 0,
      annualSavingsSEK: 0,
      paybackYears: 0,
      irr: 0,
      lifetimeYears: 25,
      lifetimeSavingsSEK: 0,
      skattereduktion: {
        ratePerKWh: 0.60,
        maxAnnualSEK: 30000,
        claimedThisYearSEK: 0
      }
    };

    // Carbon offset - Nordic grid
    this.carbonOffset = {
      kgCO2PerKWh: 0.045,
      monthlyCarbonSavedKg: 0,
      yearlyCarbonSavedKg: 0,
      lifetimeCarbonSavedKg: 0,
      equivalentTreesPlanted: 0,
      equivalentCarKmAvoided: 0
    };

    // Energy independence
    this.energyIndependence = {
      score: 0,
      dailySolarContribution: 0,
      dailyBatteryContribution: 0,
      dailyGridDependency: 0
    };

    // Historical data - 365 day rolling window
    this.historicalData = {
      dailyRecords: [],
      monthlyTotals: [],
      hourlyGranularity: [],
      seasonalComparison: {}
    };

    // Maintenance
    this.maintenance = {
      schedule: [],
      lastPanelCleaning: null,
      lastInverterService: null,
      lastBatteryCheck: null,
      nextPanelCleaning: null,
      nextInverterService: null,
      nextBatteryCheck: null,
      alerts: []
    };

    // Peak shaving
    this.peakShaving = {
      enabled: true,
      gridPeakThresholdKW: 5.0,
      currentGridDemandKW: 0,
      peaksDetectedToday: 0,
      peaksShavedToday: 0,
      energySavedByShavingKWh: 0
    };

    // System health
    this.systemHealth = {
      overallScore: 100,
      panelHealthScore: 100,
      inverterHealthScore: 100,
      batteryHealthScore: 100,
      lastCalculated: null
    };

    // Shade analysis
    this.shadeAnalysis = {
      hourlyShadeMap: {},
      criticalShadeHours: [],
      annualShadeLoss: 0
    };

    // Production forecast
    this.forecast = {
      todayExpectedKWh: 0,
      tomorrowExpectedKWh: 0,
      weeklyExpectedKWh: 0,
      hourlyForecast: [],
      accuracy: 0.85
    };
  }

  async initialize() {
    try {
      this.homey.log('[Solar] Initializing Solar Energy Optimization System...');

      this._initializePanels();
      this._initializeHistoricalData();
      this._initializeMaintenanceSchedule();
      this._calculateShadeAnalysis();
      this._updateProductionForecast();
      this._calculateROI();
      this._updateCarbonOffset();
      this._calculateSystemHealth();
      this._updateSelfConsumptionRatio();
      this._simulateDailyProduction();

      // Start monitoring intervals
      this._startProductionMonitoring();
      this._startBatteryManagement();
      this._startGridManagement();
      this._startWeatherMonitoring();
      this._startPeakShavingMonitor();
      this._startMaintenanceChecker();
      this._startForecastUpdater();
      this._startHealthMonitor();

      this.initialized = true;
      this.homey.log('[Solar] Solar Energy Optimization System initialized successfully');
      this.homey.log('[Solar] Total system capacity: ' + this._getTotalCapacityKW().toFixed(1) + ' kW');
      this.homey.log('[Solar] Battery storage: ' + this._getTotalBatteryCapacity().toFixed(1) + ' kWh');
      this.homey.emit('solar-system-initialized', {
        totalCapacityKW: this._getTotalCapacityKW(),
        totalBatteryKWh: this._getTotalBatteryCapacity(),
        arrays: Object.keys(this.panelArrays).length,
        panels: this._getTotalPanelCount()
      });
    } catch (error) {
      this.homey.error('[Solar] Failed to initialize:', error.message);
      this.initialized = false;
    }
  }

  _initializePanels() {
    var arrayEntries = Object.entries(this.panelArrays);
    for (var ae = 0; ae < arrayEntries.length; ae++) {
      var arrayId = arrayEntries[ae][0];
      var array = arrayEntries[ae][1];
      array.panels = [];
      var yearsSinceInstall = this._yearsSinceInstall(array.installDate);
      var degradation = 1 - (array.degradationRate * yearsSinceInstall);
      array.currentEfficiency = Math.max(0.70, degradation);

      for (var i = 0; i < array.panelCount; i++) {
        var panelVariation = 0.97 + Math.random() * 0.06;
        array.panels.push({
          id: arrayId + '-panel-' + (i + 1),
          wattage: array.panelWattage,
          currentEfficiency: array.currentEfficiency * panelVariation,
          currentOutputW: 0,
          temperature: 25,
          soiling: Math.random() * 0.03,
          microCracks: Math.random() < 0.05,
          hotSpot: false,
          totalEnergyKWh: (array.panelWattage * yearsSinceInstall * 1100 * panelVariation) / 1000,
          lastInspection: array.installDate
        });
      }
      this.homey.log('[Solar] Initialized ' + array.panelCount + ' panels for ' + array.name + ' (efficiency: ' + (array.currentEfficiency * 100).toFixed(1) + '%)');
    }
  }

  _initializeHistoricalData() {
    var now = new Date();
    this.historicalData.dailyRecords = [];
    this.historicalData.monthlyTotals = [];

    for (var d = 364; d >= 0; d--) {
      var date = new Date(now);
      date.setDate(date.getDate() - d);
      var month = date.getMonth();
      var solarHours = this.solarParams.monthlySolarHours[month];
      var capacityKW = this._getTotalCapacityKW();
      var seasonFactor = solarHours / 19;
      var weatherVariation = 0.5 + Math.random() * 0.5;
      var dailyProduction = capacityKW * solarHours * 0.18 * seasonFactor * weatherVariation;
      var dailyConsumption = 15 + Math.random() * 20;
      var selfConsumed = Math.min(dailyProduction, dailyConsumption * (0.4 + Math.random() * 0.3));
      var exported = Math.max(0, dailyProduction - selfConsumed);
      var imported = Math.max(0, dailyConsumption - selfConsumed);
      var hourlyData = this._generateHourlyData(month, capacityKW, weatherVariation);

      this.historicalData.dailyRecords.push({
        date: date.toISOString().split('T')[0],
        productionKWh: Math.round(dailyProduction * 100) / 100,
        consumptionKWh: Math.round(dailyConsumption * 100) / 100,
        selfConsumedKWh: Math.round(selfConsumed * 100) / 100,
        exportedKWh: Math.round(exported * 100) / 100,
        importedKWh: Math.round(imported * 100) / 100,
        peakOutputKW: Math.round(capacityKW * seasonFactor * weatherVariation * 0.85 * 100) / 100,
        avgTemperature: Math.round((5 + 15 * Math.sin((month - 3) * Math.PI / 6)) * 10) / 10,
        cloudCover: Math.round((1 - weatherVariation) * 100) / 100,
        hourlyData: hourlyData
      });
    }

    // Calculate monthly totals
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (var m = 0; m < 12; m++) {
      var currentMonth = m;
      var monthRecords = this.historicalData.dailyRecords.filter(function(r) {
        return new Date(r.date).getMonth() === currentMonth;
      });
      if (monthRecords.length > 0) {
        this.historicalData.monthlyTotals.push({
          month: m,
          monthName: monthNames[m],
          totalProductionKWh: Math.round(monthRecords.reduce(function(s, r) { return s + r.productionKWh; }, 0) * 100) / 100,
          totalConsumptionKWh: Math.round(monthRecords.reduce(function(s, r) { return s + r.consumptionKWh; }, 0) * 100) / 100,
          totalExportedKWh: Math.round(monthRecords.reduce(function(s, r) { return s + r.exportedKWh; }, 0) * 100) / 100,
          totalImportedKWh: Math.round(monthRecords.reduce(function(s, r) { return s + r.importedKWh; }, 0) * 100) / 100,
          avgDailyProductionKWh: Math.round((monthRecords.reduce(function(s, r) { return s + r.productionKWh; }, 0) / monthRecords.length) * 100) / 100,
          daysRecorded: monthRecords.length
        });
      }
    }

    // Seasonal comparison
    this.historicalData.seasonalComparison = {
      winter: this._getSeasonalAverage([11, 0, 1]),
      spring: this._getSeasonalAverage([2, 3, 4]),
      summer: this._getSeasonalAverage([5, 6, 7]),
      autumn: this._getSeasonalAverage([8, 9, 10])
    };

    this.homey.log('[Solar] Loaded ' + this.historicalData.dailyRecords.length + ' days of historical data');
  }

  _generateHourlyData(month, capacityKW, weatherFactor) {
    var hourly = [];
    var sunrise = this.solarParams.sunriseHours[month];
    var sunset = this.solarParams.sunsetHours[month];
    var solarNoon = (sunrise + sunset) / 2;
    var maxHalfDay = (sunset - sunrise) / 2;

    for (var h = 0; h < 24; h++) {
      var production = 0;
      if (h >= Math.floor(sunrise) && h <= Math.ceil(sunset)) {
        var hourAngle = Math.abs(h + 0.5 - solarNoon) / maxHalfDay;
        var solarFactor = Math.max(0, Math.cos(hourAngle * Math.PI / 2));
        production = capacityKW * solarFactor * weatherFactor * 0.85;
        production = Math.max(0, production * (0.9 + Math.random() * 0.2));
      }
      hourly.push({
        hour: h,
        productionKW: Math.round(production * 1000) / 1000,
        consumptionKW: Math.round((0.5 + Math.random() * 2.5) * 1000) / 1000
      });
    }
    return hourly;
  }

  _getSeasonalAverage(months) {
    var records = this.historicalData.dailyRecords.filter(function(r) {
      return months.indexOf(new Date(r.date).getMonth()) !== -1;
    });
    if (records.length === 0) return { avgProductionKWh: 0, avgConsumptionKWh: 0, days: 0 };
    return {
      avgProductionKWh: Math.round((records.reduce(function(s, r) { return s + r.productionKWh; }, 0) / records.length) * 100) / 100,
      avgConsumptionKWh: Math.round((records.reduce(function(s, r) { return s + r.consumptionKWh; }, 0) / records.length) * 100) / 100,
      totalProductionKWh: Math.round(records.reduce(function(s, r) { return s + r.productionKWh; }, 0) * 100) / 100,
      days: records.length
    };
  }

  _initializeMaintenanceSchedule() {
    var now = new Date();
    this.maintenance.lastPanelCleaning = new Date(now.getTime() - 45 * 24 * 3600000).toISOString();
    this.maintenance.lastInverterService = new Date(now.getTime() - 180 * 24 * 3600000).toISOString();
    this.maintenance.lastBatteryCheck = new Date(now.getTime() - 60 * 24 * 3600000).toISOString();

    this.maintenance.nextPanelCleaning = new Date(now.getTime() + 45 * 24 * 3600000).toISOString();
    this.maintenance.nextInverterService = new Date(now.getTime() + 185 * 24 * 3600000).toISOString();
    this.maintenance.nextBatteryCheck = new Date(now.getTime() + 120 * 24 * 3600000).toISOString();

    this.maintenance.schedule = [
      { task: 'Panel Cleaning', interval: 'Every 3 months', nextDue: this.maintenance.nextPanelCleaning, priority: 'medium' },
      { task: 'Inverter Service', interval: 'Annually', nextDue: this.maintenance.nextInverterService, priority: 'high' },
      { task: 'Battery Health Check', interval: 'Every 6 months', nextDue: this.maintenance.nextBatteryCheck, priority: 'high' },
      { task: 'Wiring Inspection', interval: 'Annually', nextDue: new Date(now.getTime() + 200 * 24 * 3600000).toISOString(), priority: 'medium' },
      { task: 'Mounting Structure Check', interval: 'Every 2 years', nextDue: new Date(now.getTime() + 400 * 24 * 3600000).toISOString(), priority: 'low' },
      { task: 'Performance Audit', interval: 'Annually', nextDue: new Date(now.getTime() + 150 * 24 * 3600000).toISOString(), priority: 'medium' }
    ];
    this.homey.log('[Solar] Maintenance schedule initialized');
  }

  _calculateShadeAnalysis() {
    this.shadeAnalysis.hourlyShadeMap = {};
    var arrays = Object.keys(this.panelArrays);

    for (var a = 0; a < arrays.length; a++) {
      var arrayId = arrays[a];
      this.shadeAnalysis.hourlyShadeMap[arrayId] = {};
      for (var h = 5; h <= 21; h++) {
        var shade = 0;
        if (arrayId === 'east-roof') {
          shade = h >= 14 ? Math.min(0.4, (h - 14) * 0.08) : 0;
        } else if (arrayId === 'west-roof') {
          shade = h <= 10 ? Math.min(0.35, (10 - h) * 0.07) : 0;
        } else {
          shade = (h <= 8 || h >= 18) ? 0.05 : 0;
        }
        this.shadeAnalysis.hourlyShadeMap[arrayId][h] = Math.round(shade * 1000) / 1000;
      }
    }

    this.shadeAnalysis.criticalShadeHours = [
      { array: 'east-roof', hours: [16, 17, 18, 19], avgShade: 0.24 },
      { array: 'west-roof', hours: [6, 7, 8, 9], avgShade: 0.21 }
    ];

    var totalShadeLoss = 0;
    for (var b = 0; b < arrays.length; b++) {
      var arrId = arrays[b];
      var shadeMap = this.shadeAnalysis.hourlyShadeMap[arrId];
      var shadeValues = Object.values(shadeMap);
      var avgShade = shadeValues.reduce(function(s, v) { return s + v; }, 0) / shadeValues.length;
      totalShadeLoss += avgShade * (this.panelArrays[arrId].totalCapacityKW / this._getTotalCapacityKW());
    }
    this.shadeAnalysis.annualShadeLoss = Math.round(totalShadeLoss * 10000) / 100;
    this.homey.log('[Solar] Shade analysis complete - annual shade loss: ' + this.shadeAnalysis.annualShadeLoss + '%');
  }

  _updateProductionForecast() {
    var now = new Date();
    var month = now.getMonth();
    var capacityKW = this._getTotalCapacityKW();
    var weatherFactor = 1 - this.weather.cloudCover;
    var tempFactor = this._getTemperatureEfficiencyFactor(this.weather.temperature);
    var snowFactor = this._getSnowFactor();

    this.forecast.hourlyForecast = [];
    var sunrise = this.solarParams.sunriseHours[month];
    var sunset = this.solarParams.sunsetHours[month];
    var solarNoon = (sunrise + sunset) / 2;
    var maxHalfDay = (sunset - sunrise) / 2;
    var todayTotal = 0;

    for (var h = 0; h < 24; h++) {
      var expectedKW = 0;
      if (h >= Math.floor(sunrise) && h <= Math.ceil(sunset)) {
        var hourAngle = Math.abs(h + 0.5 - solarNoon) / maxHalfDay;
        var solarFactor = Math.max(0, Math.cos(hourAngle * Math.PI / 2));
        expectedKW = capacityKW * solarFactor * weatherFactor * tempFactor * snowFactor * 0.85;

        // Apply per-array shade
        var shadedOutput = 0;
        var arrayEntries = Object.entries(this.panelArrays);
        for (var ai = 0; ai < arrayEntries.length; ai++) {
          var arrId = arrayEntries[ai][0];
          var arr = arrayEntries[ai][1];
          var shadeMap = this.shadeAnalysis.hourlyShadeMap[arrId] || {};
          var shadeVal = shadeMap[h] || 0;
          var arrayShare = arr.totalCapacityKW / capacityKW;
          shadedOutput += expectedKW * arrayShare * (1 - shadeVal);
        }
        expectedKW = shadedOutput;
      }
      expectedKW = Math.max(0, expectedKW);
      todayTotal += expectedKW;
      this.forecast.hourlyForecast.push({
        hour: h,
        expectedKW: Math.round(expectedKW * 1000) / 1000,
        confidence: (h >= Math.floor(sunrise) && h <= Math.ceil(sunset)) ? 0.8 + Math.random() * 0.15 : 1.0
      });
    }

    this.forecast.todayExpectedKWh = Math.round(todayTotal * 100) / 100;
    this.forecast.tomorrowExpectedKWh = Math.round(todayTotal * (0.85 + Math.random() * 0.3) * 100) / 100;
    this.forecast.weeklyExpectedKWh = Math.round(todayTotal * 7 * (0.8 + Math.random() * 0.3) * 100) / 100;
    this.homey.log('[Solar] Forecast updated - today: ' + this.forecast.todayExpectedKWh + ' kWh, tomorrow: ' + this.forecast.tomorrowExpectedKWh + ' kWh');
  }

  _calculateROI() {
    var annualProductionKWh = this.historicalData.monthlyTotals.reduce(function(s, m) { return s + m.totalProductionKWh; }, 0);
    var annualExportedKWh = this.historicalData.monthlyTotals.reduce(function(s, m) { return s + m.totalExportedKWh; }, 0);
    var annualSelfConsumedKWh = annualProductionKWh - annualExportedKWh;

    // Savings from self-consumption (avoided import at retail price)
    var avgRetailPrice = 1.20;
    var selfConsumptionSavings = annualSelfConsumedKWh * avgRetailPrice;

    // Revenue from export (skattereduktion)
    var skattereduktionRevenue = Math.min(
      annualExportedKWh * this.financials.skattereduktion.ratePerKWh,
      this.financials.skattereduktion.maxAnnualSEK
    );
    this.financials.skattereduktion.claimedThisYearSEK = Math.round(skattereduktionRevenue);

    // Feed-in revenue from spot price
    var feedInRevenue = annualExportedKWh * this.grid.spotPrices.mid * 0.5;

    this.financials.annualSavingsSEK = Math.round(selfConsumptionSavings + skattereduktionRevenue + feedInRevenue);

    // Calculate cumulative savings over system life
    var yearsSinceInstall = this._yearsSinceInstall(this.panelArrays['south-roof'].installDate);
    this.financials.cumulativeSavingsSEK = Math.round(this.financials.annualSavingsSEK * yearsSinceInstall);

    // Payback period
    if (this.financials.annualSavingsSEK > 0) {
      this.financials.paybackYears = Math.round((this.financials.netInvestmentSEK / this.financials.annualSavingsSEK) * 10) / 10;
    }

    // Lifetime savings (25 years with degradation)
    var lifetimeSavings = 0;
    for (var y = 0; y < this.financials.lifetimeYears; y++) {
      var yearDegradation = Math.pow(1 - 0.005, y);
      lifetimeSavings += this.financials.annualSavingsSEK * yearDegradation;
    }
    this.financials.lifetimeSavingsSEK = Math.round(lifetimeSavings);

    // IRR calculation
    this.financials.irr = this._calculateIRR();

    this.homey.log('[Solar] ROI calculated - annual savings: ' + this.financials.annualSavingsSEK + ' SEK, payback: ' + this.financials.paybackYears + ' years');
    this.homey.log('[Solar] Lifetime savings (25y): ' + this.financials.lifetimeSavingsSEK + ' SEK, IRR: ' + (this.financials.irr * 100).toFixed(1) + '%');
  }

  _calculateIRR() {
    var investment = -this.financials.netInvestmentSEK;
    var cashFlows = [investment];
    for (var y = 0; y < this.financials.lifetimeYears; y++) {
      var yearDeg = Math.pow(1 - 0.005, y);
      cashFlows.push(this.financials.annualSavingsSEK * yearDeg);
    }

    var rate = 0.05;
    for (var iter = 0; iter < 100; iter++) {
      var npv = 0;
      var dnpv = 0;
      for (var i = 0; i < cashFlows.length; i++) {
        var factor = Math.pow(1 + rate, i);
        npv += cashFlows[i] / factor;
        if (i > 0) { dnpv -= i * cashFlows[i] / Math.pow(1 + rate, i + 1); }
      }
      if (Math.abs(npv) < 0.01) break;
      if (dnpv === 0) break;
      rate = rate - npv / dnpv;
      if (rate < -0.5) { rate = 0; break; }
      if (rate > 1.0) { rate = 1.0; break; }
    }
    return Math.round(rate * 1000) / 1000;
  }

  _updateCarbonOffset() {
    var totalProduction = this.historicalData.dailyRecords.reduce(function(s, r) { return s + r.productionKWh; }, 0);
    var last30Days = this.historicalData.dailyRecords.slice(-30);
    var monthlyProduction = last30Days.reduce(function(s, r) { return s + r.productionKWh; }, 0);

    this.carbonOffset.monthlyCarbonSavedKg = Math.round(monthlyProduction * this.carbonOffset.kgCO2PerKWh * 100) / 100;
    this.carbonOffset.yearlyCarbonSavedKg = Math.round(totalProduction * this.carbonOffset.kgCO2PerKWh * 100) / 100;
    this.carbonOffset.lifetimeCarbonSavedKg = Math.round(this.carbonOffset.yearlyCarbonSavedKg * this.financials.lifetimeYears * 0.6 * 100) / 100;
    this.carbonOffset.equivalentTreesPlanted = Math.round(this.carbonOffset.yearlyCarbonSavedKg / 21.77 * 10) / 10;
    this.carbonOffset.equivalentCarKmAvoided = Math.round(this.carbonOffset.yearlyCarbonSavedKg / 0.12);

    this.homey.log('[Solar] Carbon offset - yearly: ' + this.carbonOffset.yearlyCarbonSavedKg + ' kgCO2, equiv. ' + this.carbonOffset.equivalentTreesPlanted + ' trees');
  }

  _calculateSystemHealth() {
    var panelScore = 100;
    var panelArrayValues = Object.values(this.panelArrays);
    var arrayCount = Object.keys(this.panelArrays).length;
    for (var pa = 0; pa < panelArrayValues.length; pa++) {
      var arr = panelArrayValues[pa];
      var degradationPenalty = (1 - arr.currentEfficiency) * 100;
      var snowPenalty = arr.snowCoverage * 20;
      var shadePenalty = arr.shadePercentage * 15;
      panelScore -= (degradationPenalty + snowPenalty + shadePenalty) / arrayCount;
      for (var pi = 0; pi < arr.panels.length; pi++) {
        if (arr.panels[pi].microCracks) panelScore -= 0.5;
        if (arr.panels[pi].hotSpot) panelScore -= 1.0;
      }
    }

    var inverterScore = 100;
    var inverterValues = Object.values(this.inverters);
    for (var iv = 0; iv < inverterValues.length; iv++) {
      var inv = inverterValues[iv];
      if (inv.temperature > 55) inverterScore -= 10;
      else if (inv.temperature > 45) inverterScore -= 3;
      if (inv.efficiency < 0.95) inverterScore -= (0.95 - inv.efficiency) * 200;
      if (inv.status !== 'active') inverterScore -= 20;
    }

    var batteryScore = 0;
    var batteryCount = 0;
    var batteryValues = Object.values(this.batteries);
    for (var bv = 0; bv < batteryValues.length; bv++) {
      var bat = batteryValues[bv];
      batteryScore += bat.healthPercentage;
      if (bat.temperature > 35) batteryScore -= 5;
      if (bat.cycleCount > 3000) batteryScore -= 10;
      batteryCount++;
    }
    batteryScore = batteryScore / batteryCount;

    this.systemHealth.panelHealthScore = Math.round(Math.max(0, Math.min(100, panelScore)) * 10) / 10;
    this.systemHealth.inverterHealthScore = Math.round(Math.max(0, Math.min(100, inverterScore)) * 10) / 10;
    this.systemHealth.batteryHealthScore = Math.round(Math.max(0, Math.min(100, batteryScore)) * 10) / 10;
    this.systemHealth.overallScore = Math.round(
      (this.systemHealth.panelHealthScore * 0.4 +
       this.systemHealth.inverterHealthScore * 0.3 +
       this.systemHealth.batteryHealthScore * 0.3) * 10
    ) / 10;
    this.systemHealth.lastCalculated = new Date().toISOString();
    this.homey.log('[Solar] System health score: ' + this.systemHealth.overallScore + '/100');
  }

  _updateSelfConsumptionRatio() {
    var last7Days = this.historicalData.dailyRecords.slice(-7);
    if (last7Days.length === 0) return;

    var totalProd = last7Days.reduce(function(s, r) { return s + r.productionKWh; }, 0);
    var totalSelf = last7Days.reduce(function(s, r) { return s + r.selfConsumedKWh; }, 0);

    if (totalProd > 0) {
      this.selfConsumption.ratio = Math.round((totalSelf / totalProd) * 1000) / 1000;
    }

    this.selfConsumption.dailyProduction = last7Days.length > 0
      ? Math.round(last7Days[last7Days.length - 1].productionKWh * 100) / 100
      : 0;

    if (this.selfConsumption.ratio < this.selfConsumption.target) {
      this.homey.log('[Solar] Self-consumption ratio ' + (this.selfConsumption.ratio * 100).toFixed(1) + '% below target ' + (this.selfConsumption.target * 100).toFixed(1) + '%');
      this._optimizeSelfConsumption();
    }
  }

  _optimizeSelfConsumption() {
    var batteryEntries = Object.entries(this.batteries);
    for (var be = 0; be < batteryEntries.length; be++) {
      var battery = batteryEntries[be][1];
      if (battery.chargeLevel < battery.maxChargeLevel) {
        battery.mode = 'charge';
        this.homey.log('[Solar] Optimizing: setting ' + battery.name + ' to charge mode');
      }
    }

    var recommendations = [];
    if (this.selfConsumption.ratio < 0.50) {
      recommendations.push('Schedule high-power appliances during peak solar hours (10:00-15:00)');
      recommendations.push('Enable EV charging during solar peak');
      recommendations.push('Pre-heat water tank during solar peak');
    } else if (this.selfConsumption.ratio < 0.70) {
      recommendations.push('Shift dishwasher/washing machine to midday');
      recommendations.push('Increase battery charge target');
    }

    if (recommendations.length > 0) {
      this.homey.emit('solar-optimization-recommendations', { recommendations: recommendations });
    }
  }

  _simulateDailyProduction() {
    var now = new Date();
    var month = now.getMonth();
    var hour = now.getHours();
    var sunrise = this.solarParams.sunriseHours[month];
    var sunset = this.solarParams.sunsetHours[month];
    var solarNoon = (sunrise + sunset) / 2;
    var maxHalfDay = (sunset - sunrise) / 2;
    var totalOutput = 0;
    var arrayEntries = Object.entries(this.panelArrays);

    for (var ae = 0; ae < arrayEntries.length; ae++) {
      var arrayId = arrayEntries[ae][0];
      var array = arrayEntries[ae][1];
      var arrayOutput = 0;

      if (hour >= Math.floor(sunrise) && hour <= Math.ceil(sunset)) {
        var hourAngle = Math.abs(hour + 0.5 - solarNoon) / maxHalfDay;
        var solarFactor = Math.max(0, Math.cos(hourAngle * Math.PI / 2));
        var orientationFactor = this._getOrientationFactor(array.azimuth, hour, solarNoon);
        var tempFactor = this._getTemperatureEfficiencyFactor(this.weather.temperature);
        var cloudFactor = 1 - (this.weather.cloudCover * 0.75);
        var snowFactor = 1 - array.snowCoverage;
        var shadeMap = this.shadeAnalysis.hourlyShadeMap[arrayId] || {};
        var shadeFactor = 1 - (shadeMap[hour] || 0);

        for (var pi = 0; pi < array.panels.length; pi++) {
          var panel = array.panels[pi];
          var panelOutput = panel.wattage * solarFactor * orientationFactor *
            panel.currentEfficiency * tempFactor * cloudFactor *
            snowFactor * shadeFactor * (1 - panel.soiling);
          panel.currentOutputW = Math.round(Math.max(0, panelOutput) * 100) / 100;
          panel.temperature = this.weather.temperature + 25 * solarFactor * (1 - this.weather.cloudCover * 0.5);
          arrayOutput += panel.currentOutputW;
        }
      } else {
        for (var pj = 0; pj < array.panels.length; pj++) {
          array.panels[pj].currentOutputW = 0;
          array.panels[pj].temperature = this.weather.temperature;
        }
      }
      totalOutput += arrayOutput;
    }

    var totalOutputKW = totalOutput / 1000;
    var primaryShare = (this.panelArrays['south-roof'].totalCapacityKW + this.panelArrays['east-roof'].totalCapacityKW) / this._getTotalCapacityKW();
    this.inverters.primary.currentOutputKW = Math.round(totalOutputKW * primaryShare * this.inverters.primary.efficiency * 1000) / 1000;
    this.inverters.secondary.currentOutputKW = Math.round(totalOutputKW * (1 - primaryShare) * this.inverters.secondary.efficiency * 1000) / 1000;
    this.homey.log('[Solar] Current production: ' + totalOutputKW.toFixed(2) + ' kW');
  }

  _getOrientationFactor(azimuth, hour, solarNoon) {
    var hourAngle = (hour - solarNoon) * 15;
    var azimuthDiff = Math.abs(azimuth - 180 + hourAngle);
    var factor = Math.max(0.3, Math.cos(azimuthDiff * Math.PI / 180));
    return Math.min(1.0, factor);
  }

  _getTemperatureEfficiencyFactor(temperature) {
    if (temperature <= 25) return 1.0 + Math.max(0, (25 - temperature) * 0.001);
    var tempAbove25 = temperature - 25;
    return Math.max(0.70, 1.0 - (tempAbove25 * 0.004));
  }

  _getSnowFactor() {
    var totalSnow = 0;
    var count = 0;
    var arrayValues = Object.values(this.panelArrays);
    for (var av = 0; av < arrayValues.length; av++) {
      totalSnow += arrayValues[av].snowCoverage;
      count++;
    }
    return 1 - (totalSnow / count);
  }

  // --- Monitoring Intervals ---

  _startProductionMonitoring() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._simulateDailyProduction();
        self._updateEnergyFlows();
        self._checkPanelTemperatures();
        self._checkSnowCoverage();
        self._updateEnergyIndependence();

        var totalOutputKW = self.inverters.primary.currentOutputKW + self.inverters.secondary.currentOutputKW;
        self.homey.emit('solar-production-update', {
          totalOutputKW: totalOutputKW,
          arrayOutputs: self._getArrayOutputs(),
          inverterOutputs: self._getInverterOutputs(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        self.homey.error('[Solar] Production monitoring error:', error.message);
      }
    }, 60000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Production monitoring started (60s interval)');
  }

  _startBatteryManagement() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._manageBatteryCharging();
        self._monitorBatteryHealth();

        self.homey.emit('solar-battery-update', {
          batteries: self._getBatteryStatus(),
          totalStoredKWh: self._getTotalStoredEnergy(),
          totalCapacityKWh: self._getTotalBatteryCapacity(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        self.homey.error('[Solar] Battery management error:', error.message);
      }
    }, 120000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Battery management started (120s interval)');
  }

  _startGridManagement() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._updateSpotPrices();
        self._manageGridFeedIn();
        self._updateNetMetering();

        self.homey.emit('solar-grid-update', {
          flowDirection: self.grid.currentFlowDirection,
          flowKW: self.grid.currentFlowKW,
          spotPrice: self.grid.spotPrices.current,
          netBalance: self.grid.netMeteringBalance,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        self.homey.error('[Solar] Grid management error:', error.message);
      }
    }, 180000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Grid management started (180s interval)');
  }

  _startWeatherMonitoring() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._updateWeatherConditions();
        self._updateProductionForecast();
        self._analyzeWeatherImpact();
      } catch (error) {
        self.homey.error('[Solar] Weather monitoring error:', error.message);
      }
    }, 300000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Weather monitoring started (300s interval)');
  }

  _startPeakShavingMonitor() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._monitorPeakShaving();
      } catch (error) {
        self.homey.error('[Solar] Peak shaving error:', error.message);
      }
    }, 30000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Peak shaving monitor started (30s interval)');
  }

  _startMaintenanceChecker() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._checkMaintenanceSchedule();
      } catch (error) {
        self.homey.error('[Solar] Maintenance checker error:', error.message);
      }
    }, 3600000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Maintenance checker started (1h interval)');
  }

  _startForecastUpdater() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._updateProductionForecast();
        self._calculateROI();
        self._updateCarbonOffset();
        self._updateSelfConsumptionRatio();
      } catch (error) {
        self.homey.error('[Solar] Forecast updater error:', error.message);
      }
    }, 900000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Forecast updater started (15min interval)');
  }

  _startHealthMonitor() {
    var self = this;
    var interval = setInterval(function() {
      try {
        self._calculateSystemHealth();
        if (self.systemHealth.overallScore < 80) {
          self.homey.emit('solar-health-warning', {
            overallScore: self.systemHealth.overallScore,
            panelHealth: self.systemHealth.panelHealthScore,
            inverterHealth: self.systemHealth.inverterHealthScore,
            batteryHealth: self.systemHealth.batteryHealthScore
          });
          self.homey.log('[Solar] Health warning - score: ' + self.systemHealth.overallScore + '/100');
        }
      } catch (error) {
        self.homey.error('[Solar] Health monitor error:', error.message);
      }
    }, 600000);
    this.intervals.push(interval);
    this.homey.log('[Solar] Health monitor started (10min interval)');
  }

  // --- Energy Flow and Grid ---

  _updateEnergyFlows() {
    var totalSolarKW = this.inverters.primary.currentOutputKW + this.inverters.secondary.currentOutputKW;
    var homeConsumptionKW = 1.5 + Math.random() * 3.5;
    var surplus = totalSolarKW - homeConsumptionKW;

    if (surplus > 0) {
      var batteryCapacity = this._getAvailableBatteryChargeCapacity();
      if (batteryCapacity > 0) {
        var chargeAmount = Math.min(surplus, batteryCapacity);
        this._chargeBatteries(chargeAmount);
        var toGrid = surplus - chargeAmount;
        if (toGrid > 0) {
          this.grid.currentFlowDirection = 'export';
          this.grid.currentFlowKW = Math.round(toGrid * 1000) / 1000;
        } else {
          this.grid.currentFlowDirection = 'neutral';
          this.grid.currentFlowKW = 0;
        }
      } else {
        this.grid.currentFlowDirection = 'export';
        this.grid.currentFlowKW = Math.round(surplus * 1000) / 1000;
      }
    } else if (surplus < 0) {
      var deficit = Math.abs(surplus);
      var batteryAvailable = this._getAvailableBatteryDischargeCapacity();
      if (batteryAvailable > 0 && this._shouldDischargeBattery()) {
        var dischargeAmount = Math.min(deficit, batteryAvailable);
        this._dischargeBatteries(dischargeAmount);
        var fromGrid = deficit - dischargeAmount;
        if (fromGrid > 0) {
          this.grid.currentFlowDirection = 'import';
          this.grid.currentFlowKW = Math.round(fromGrid * 1000) / 1000;
        } else {
          this.grid.currentFlowDirection = 'neutral';
          this.grid.currentFlowKW = 0;
        }
      } else {
        this.grid.currentFlowDirection = 'import';
        this.grid.currentFlowKW = Math.round(deficit * 1000) / 1000;
      }
    } else {
      this.grid.currentFlowDirection = 'neutral';
      this.grid.currentFlowKW = 0;
    }

    var intervalHours = 1 / 60;
    if (this.grid.currentFlowDirection === 'export') {
      this.grid.exportedKWh += this.grid.currentFlowKW * intervalHours;
      this.selfConsumption.dailyExported += this.grid.currentFlowKW * intervalHours;
    } else if (this.grid.currentFlowDirection === 'import') {
      this.grid.importedKWh += this.grid.currentFlowKW * intervalHours;
      this.selfConsumption.dailyImported += this.grid.currentFlowKW * intervalHours;
    }
    this.selfConsumption.dailyProduction += totalSolarKW * intervalHours;
    this.selfConsumption.dailySelfConsumed += Math.min(totalSolarKW, homeConsumptionKW) * intervalHours;
  }

  _updateSpotPrices() {
    var hour = new Date().getHours();
    if (hour >= 7 && hour <= 9) {
      this.grid.spotPrices.current = this.grid.spotPrices.peak;
    } else if (hour >= 17 && hour <= 20) {
      this.grid.spotPrices.current = this.grid.spotPrices.peak;
    } else if (hour >= 10 && hour <= 16) {
      this.grid.spotPrices.current = this.grid.spotPrices.mid;
    } else {
      this.grid.spotPrices.current = this.grid.spotPrices.offPeak;
    }
    this.grid.spotPrices.current *= (0.9 + Math.random() * 0.2);
    this.grid.spotPrices.current = Math.round(this.grid.spotPrices.current * 100) / 100;
  }

  _manageGridFeedIn() {
    var currentPrice = this.grid.spotPrices.current;
    var totalStoredKWh = this._getTotalStoredEnergy();
    var totalCapacityKWh = this._getTotalBatteryCapacity();
    var chargeRatio = totalStoredKWh / totalCapacityKWh;

    if (currentPrice >= this.grid.spotPrices.peak * 0.9 && chargeRatio > 0.4) {
      this.homey.log('[Solar] High spot price (' + currentPrice + ' SEK/kWh) - enabling grid export from battery');
      var batteryValues = Object.values(this.batteries);
      for (var bv = 0; bv < batteryValues.length; bv++) {
        if (batteryValues[bv].chargeLevel > batteryValues[bv].minChargeLevel + 0.1) {
          batteryValues[bv].mode = 'discharge';
        }
      }
    } else if (currentPrice <= this.grid.spotPrices.offPeak * 1.1 && chargeRatio < 0.7) {
      this.homey.log('[Solar] Low spot price (' + currentPrice + ' SEK/kWh) - charging battery from grid');
      var batValues = Object.values(this.batteries);
      for (var bw = 0; bw < batValues.length; bw++) {
        if (batValues[bw].chargeLevel < batValues[bw].maxChargeLevel) {
          batValues[bw].mode = 'charge';
        }
      }
    }
  }

  _updateNetMetering() {
    this.grid.netMeteringBalance = Math.round((this.grid.exportedKWh - this.grid.importedKWh) * 100) / 100;
    var annualExport = this.historicalData.monthlyTotals.reduce(function(s, m) { return s + m.totalExportedKWh; }, 0);
    var annualImport = this.historicalData.monthlyTotals.reduce(function(s, m) { return s + m.totalImportedKWh; }, 0);
    this.grid.annualSurplus = Math.round((annualExport - annualImport) * 100) / 100;
  }

  // --- Battery Management ---

  _manageBatteryCharging() {
    var solarOutput = this.inverters.primary.currentOutputKW + this.inverters.secondary.currentOutputKW;
    var batteryEntries = Object.entries(this.batteries);

    for (var be = 0; be < batteryEntries.length; be++) {
      var battery = batteryEntries[be][1];
      if (battery.mode === 'charge') {
        var chargeRate = Math.min(battery.maxChargeRateKW, solarOutput * 0.5) / 60;
        var newCharge = battery.chargeLevel + (chargeRate / battery.capacityKWh);
        battery.chargeLevel = Math.min(battery.maxChargeLevel, newCharge);
        if (battery.chargeLevel >= battery.maxChargeLevel) {
          battery.mode = 'standby';
          this.homey.log('[Solar] ' + battery.name + ' fully charged');
        }
      } else if (battery.mode === 'discharge') {
        var dischargeRate = battery.maxDischargeRateKW / 60;
        var newChargeLevel = battery.chargeLevel - (dischargeRate / battery.capacityKWh);
        battery.chargeLevel = Math.max(battery.minChargeLevel, newChargeLevel);
        if (battery.chargeLevel <= battery.minChargeLevel) {
          battery.mode = 'standby';
          this.homey.log('[Solar] ' + battery.name + ' at minimum charge - switching to standby');
        }
      }
      battery.temperature = 20 + (battery.mode !== 'standby' ? 5 + Math.random() * 3 : Math.random() * 2);
      if (battery.mode !== 'standby' && Math.random() < 0.01) {
        battery.cycleCount++;
      }
    }
  }

  _monitorBatteryHealth() {
    var batteryEntries = Object.entries(this.batteries);
    for (var be = 0; be < batteryEntries.length; be++) {
      var batId = batteryEntries[be][0];
      var battery = batteryEntries[be][1];

      if (battery.cycleCount > 500) {
        battery.healthPercentage = Math.max(70, 100 - (battery.cycleCount - 500) * 0.005);
      }

      if (battery.temperature > 40) {
        this.homey.emit('solar-battery-warning', {
          battery: batId,
          issue: 'high_temperature',
          temperature: battery.temperature,
          threshold: 40
        });
        this.homey.log('[Solar] Battery ' + battery.name + ' temperature warning: ' + battery.temperature + ' C');
      }

      if (battery.chargeLevel < 0.15) {
        this.homey.emit('solar-battery-warning', {
          battery: batId,
          issue: 'low_charge',
          chargeLevel: battery.chargeLevel,
          threshold: 0.15
        });
      }
    }
  }

  _chargeBatteries(amountKW) {
    var batteryValues = Object.values(this.batteries);
    for (var bv = 0; bv < batteryValues.length; bv++) {
      var battery = batteryValues[bv];
      if (battery.chargeLevel < battery.maxChargeLevel) {
        var canCharge = Math.min(amountKW, battery.maxChargeRateKW);
        battery.chargeLevel = Math.min(battery.maxChargeLevel, battery.chargeLevel + canCharge / battery.capacityKWh / 60);
        battery.mode = 'charge';
        amountKW -= canCharge;
        if (amountKW <= 0) break;
      }
    }
  }

  _dischargeBatteries(amountKW) {
    var batteryValues = Object.values(this.batteries);
    for (var bv = 0; bv < batteryValues.length; bv++) {
      var battery = batteryValues[bv];
      if (battery.chargeLevel > battery.minChargeLevel) {
        var canDischarge = Math.min(amountKW, battery.maxDischargeRateKW);
        battery.chargeLevel = Math.max(battery.minChargeLevel, battery.chargeLevel - canDischarge / battery.capacityKWh / 60);
        battery.mode = 'discharge';
        amountKW -= canDischarge;
        if (amountKW <= 0) break;
      }
    }
  }

  _shouldDischargeBattery() {
    return this.grid.spotPrices.current >= this.grid.spotPrices.mid * 0.8;
  }

  _getAvailableBatteryChargeCapacity() {
    var total = 0;
    var batteryValues = Object.values(this.batteries);
    for (var bv = 0; bv < batteryValues.length; bv++) {
      var battery = batteryValues[bv];
      if (battery.chargeLevel < battery.maxChargeLevel) {
        total += Math.min(battery.maxChargeRateKW, (battery.maxChargeLevel - battery.chargeLevel) * battery.capacityKWh);
      }
    }
    return total;
  }

  _getAvailableBatteryDischargeCapacity() {
    var total = 0;
    var batteryValues = Object.values(this.batteries);
    for (var bv = 0; bv < batteryValues.length; bv++) {
      var battery = batteryValues[bv];
      if (battery.chargeLevel > battery.minChargeLevel) {
        total += Math.min(battery.maxDischargeRateKW, (battery.chargeLevel - battery.minChargeLevel) * battery.capacityKWh);
      }
    }
    return total;
  }

  // --- Weather ---

  _updateWeatherConditions() {
    var month = new Date().getMonth();
    var hour = new Date().getHours();
    var seasonalTemp = 5 + 15 * Math.sin((month - 3) * Math.PI / 6);
    var diurnalVariation = -3 + 6 * Math.sin((hour - 6) * Math.PI / 12);
    this.weather.temperature = Math.round((seasonalTemp + diurnalVariation + (Math.random() - 0.5) * 4) * 10) / 10;

    this.weather.cloudCover = Math.max(0, Math.min(1, this.weather.cloudCover + (Math.random() - 0.5) * 0.2));
    this.weather.cloudCover = Math.round(this.weather.cloudCover * 100) / 100;
    this.weather.precipitation = this.weather.cloudCover > 0.7 ? Math.round(Math.random() * 5 * 10) / 10 : 0;

    this.weather.snowOnGround = this.weather.temperature < 2 && this.weather.precipitation > 0;
    if (this.weather.snowOnGround) {
      this._updateSnowCoverage();
    } else if (this.weather.temperature > 5) {
      this._clearSnowCoverage();
    }

    this.weather.windSpeed = Math.round((3 + Math.random() * 12) * 10) / 10;
    this.weather.humidity = Math.round((40 + Math.random() * 40) * 10) / 10;
    this.weather.uvIndex = Math.max(0, Math.round(this._calculateUVIndex(month, hour, this.weather.cloudCover) * 10) / 10);
  }

  _calculateUVIndex(month, hour, cloudCover) {
    var sunrise = this.solarParams.sunriseHours[month];
    var sunset = this.solarParams.sunsetHours[month];
    if (hour < sunrise || hour > sunset) return 0;

    var solarNoon = (sunrise + sunset) / 2;
    var hourAngle = Math.abs(hour - solarNoon);
    var maxHalfDay = (sunset - sunrise) / 2;
    var solarElevation = Math.max(0, Math.cos(hourAngle / maxHalfDay * Math.PI / 2));
    var seasonalMax = [1, 2, 3, 5, 7, 8, 8, 6, 4, 2, 1, 1][month];
    return seasonalMax * solarElevation * (1 - cloudCover * 0.6);
  }

  _updateSnowCoverage() {
    var arrayValues = Object.values(this.panelArrays);
    for (var av = 0; av < arrayValues.length; av++) {
      var arr = arrayValues[av];
      var meltRate = arr.tilt > 30 ? 0.05 : 0.02;
      arr.snowCoverage = Math.min(1, arr.snowCoverage + 0.1 - meltRate);
      arr.snowCoverage = Math.round(arr.snowCoverage * 100) / 100;
    }
    this.homey.log('[Solar] Snow detected on panels - production may be reduced');
    var snowArrays = [];
    var arrayEntries = Object.entries(this.panelArrays);
    for (var ae = 0; ae < arrayEntries.length; ae++) {
      snowArrays.push({ id: arrayEntries[ae][0], snowCoverage: arrayEntries[ae][1].snowCoverage });
    }
    this.homey.emit('solar-snow-alert', { message: 'Snow detected on solar panels', arrays: snowArrays });

    var hasCleaningAlert = this.maintenance.alerts.some(function(a) { return a.type === 'snow_cleaning'; });
    if (!hasCleaningAlert) {
      this.maintenance.alerts.push({
        type: 'snow_cleaning',
        message: 'Snow removal recommended for solar panels',
        priority: 'high',
        createdAt: new Date().toISOString()
      });
    }
  }

  _clearSnowCoverage() {
    var arrayValues = Object.values(this.panelArrays);
    for (var av = 0; av < arrayValues.length; av++) {
      if (arrayValues[av].snowCoverage > 0) {
        arrayValues[av].snowCoverage = Math.max(0, arrayValues[av].snowCoverage - 0.05);
        arrayValues[av].snowCoverage = Math.round(arrayValues[av].snowCoverage * 100) / 100;
      }
    }
    this.maintenance.alerts = this.maintenance.alerts.filter(function(a) { return a.type !== 'snow_cleaning'; });
  }

  _checkSnowCoverage() {
    var arrayEntries = Object.entries(this.panelArrays);
    for (var ae = 0; ae < arrayEntries.length; ae++) {
      var arr = arrayEntries[ae][1];
      if (arr.snowCoverage > 0.5) {
        this.homey.log('[Solar] ' + arr.name + ' has ' + (arr.snowCoverage * 100).toFixed(0) + '% snow coverage');
      }
    }
  }

  _analyzeWeatherImpact() {
    var impact = {
      temperatureImpact: this._getTemperatureEfficiencyFactor(this.weather.temperature),
      cloudImpact: 1 - (this.weather.cloudCover * 0.75),
      snowImpact: this._getSnowFactor(),
      overallFactor: 0
    };
    impact.overallFactor = Math.round(impact.temperatureImpact * impact.cloudImpact * impact.snowImpact * 1000) / 1000;

    if (impact.overallFactor < 0.5) {
      this.homey.emit('solar-weather-impact', {
        message: 'Significant weather impact on solar production',
        factor: impact.overallFactor,
        details: impact
      });
    }
  }

  // --- Panel Temperature ---

  _checkPanelTemperatures() {
    var arrayEntries = Object.entries(this.panelArrays);
    for (var ae = 0; ae < arrayEntries.length; ae++) {
      var arr = arrayEntries[ae][1];
      for (var pi = 0; pi < arr.panels.length; pi++) {
        var panel = arr.panels[pi];
        if (panel.temperature > 65) {
          this.homey.emit('solar-panel-overheat', {
            panelId: panel.id,
            temperature: panel.temperature,
            threshold: 65
          });
          panel.hotSpot = true;
        } else {
          panel.hotSpot = false;
        }
        if (panel.temperature > 45) {
          var efficiencyLoss = (panel.temperature - 25) * 0.4;
          if (efficiencyLoss > 5) {
            this.homey.log('[Solar] Panel ' + panel.id + ' temp: ' + panel.temperature.toFixed(1) + ' C, efficiency loss: ' + efficiencyLoss.toFixed(1) + '%');
          }
        }
      }
    }
  }

  // --- Peak Shaving ---

  _monitorPeakShaving() {
    if (!this.peakShaving.enabled) return;

    var hour = new Date().getHours();
    var baseDemand = (hour >= 7 && hour <= 20) ? 3.0 + Math.random() * 4.0 : 1.0 + Math.random() * 2.0;
    this.peakShaving.currentGridDemandKW = Math.round(baseDemand * 100) / 100;

    if (this.peakShaving.currentGridDemandKW > this.peakShaving.gridPeakThresholdKW) {
      this.peakShaving.peaksDetectedToday++;
      var batteryAvailable = this._getAvailableBatteryDischargeCapacity();

      if (batteryAvailable > 0) {
        var shaveAmount = Math.min(
          this.peakShaving.currentGridDemandKW - this.peakShaving.gridPeakThresholdKW,
          batteryAvailable
        );
        this._dischargeBatteries(shaveAmount);
        this.peakShaving.peaksShavedToday++;
        this.peakShaving.energySavedByShavingKWh += shaveAmount / 60;

        this.homey.log('[Solar] Peak shaving: reduced grid demand by ' + shaveAmount.toFixed(2) + ' kW using battery');
        this.homey.emit('solar-peak-shaved', {
          gridDemandKW: this.peakShaving.currentGridDemandKW,
          shavedKW: shaveAmount,
          remainingBattery: this._getTotalStoredEnergy()
        });
      }
    }
  }

  // --- Energy Independence ---

  _updateEnergyIndependence() {
    var solarOutput = this.inverters.primary.currentOutputKW + this.inverters.secondary.currentOutputKW;
    var batteryDischarge = 0;
    var batteryValues = Object.values(this.batteries);
    for (var bv = 0; bv < batteryValues.length; bv++) {
      if (batteryValues[bv].mode === 'discharge') {
        batteryDischarge += batteryValues[bv].maxDischargeRateKW * 0.3;
      }
    }
    var homeConsumption = 1.5 + Math.random() * 3.5;

    if (homeConsumption > 0) {
      this.energyIndependence.dailySolarContribution = Math.min(1, solarOutput / homeConsumption);
      this.energyIndependence.dailyBatteryContribution = Math.min(1 - this.energyIndependence.dailySolarContribution, batteryDischarge / homeConsumption);
      this.energyIndependence.dailyGridDependency = Math.max(0, 1 - this.energyIndependence.dailySolarContribution - this.energyIndependence.dailyBatteryContribution);
      this.energyIndependence.score = Math.round((1 - this.energyIndependence.dailyGridDependency) * 100);
    }
  }

  // --- Maintenance ---

  _checkMaintenanceSchedule() {
    var now = new Date();
    for (var ti = 0; ti < this.maintenance.schedule.length; ti++) {
      var task = this.maintenance.schedule[ti];
      var dueDate = new Date(task.nextDue);
      var daysUntilDue = (dueDate.getTime() - now.getTime()) / (24 * 3600000);

      if (daysUntilDue <= 7 && daysUntilDue > 0) {
        var alertType = 'maintenance_' + task.task;
        var alertExists = this.maintenance.alerts.some(function(a) { return a.type === alertType; });
        if (!alertExists) {
          this.maintenance.alerts.push({
            type: alertType,
            message: task.task + ' due in ' + Math.ceil(daysUntilDue) + ' days',
            priority: task.priority,
            createdAt: now.toISOString(),
            dueDate: task.nextDue
          });
          this.homey.emit('solar-maintenance-due', { task: task.task, dueDate: task.nextDue, priority: task.priority });
          this.homey.log('[Solar] Maintenance alert: ' + task.task + ' due in ' + Math.ceil(daysUntilDue) + ' days');
        }
      } else if (daysUntilDue <= 0) {
        var overdueType = 'overdue_' + task.task;
        var overdueExists = this.maintenance.alerts.some(function(a) { return a.type === overdueType; });
        if (!overdueExists) {
          var overdueDays = Math.abs(Math.floor(daysUntilDue));
          this.maintenance.alerts.push({
            type: overdueType,
            message: task.task + ' is OVERDUE by ' + overdueDays + ' days',
            priority: 'critical',
            createdAt: now.toISOString(),
            dueDate: task.nextDue
          });
          this.homey.emit('solar-maintenance-overdue', { task: task.task, overdueByDays: overdueDays });
          this.homey.log('[Solar] OVERDUE: ' + task.task + ' overdue by ' + overdueDays + ' days');
        }
      }
    }
  }

  // --- Helper Methods ---

  _yearsSinceInstall(installDate) {
    var install = new Date(installDate);
    var now = new Date();
    return (now.getTime() - install.getTime()) / (365.25 * 24 * 3600000);
  }

  _getTotalCapacityKW() {
    return Object.values(this.panelArrays).reduce(function(sum, a) { return sum + a.totalCapacityKW; }, 0);
  }

  _getTotalPanelCount() {
    return Object.values(this.panelArrays).reduce(function(sum, a) { return sum + a.panelCount; }, 0);
  }

  _getTotalBatteryCapacity() {
    return Object.values(this.batteries).reduce(function(sum, b) { return sum + b.capacityKWh; }, 0);
  }

  _getTotalStoredEnergy() {
    return Object.values(this.batteries).reduce(function(sum, b) { return sum + b.capacityKWh * b.chargeLevel; }, 0);
  }

  _getArrayOutputs() {
    var outputs = {};
    var entries = Object.entries(this.panelArrays);
    for (var i = 0; i < entries.length; i++) {
      var id = entries[i][0];
      var array = entries[i][1];
      outputs[id] = {
        name: array.name,
        outputKW: Math.round(array.panels.reduce(function(s, p) { return s + p.currentOutputW; }, 0) / 1000 * 1000) / 1000,
        efficiency: array.currentEfficiency,
        snowCoverage: array.snowCoverage,
        shadePercentage: array.shadePercentage,
        panelCount: array.panelCount
      };
    }
    return outputs;
  }

  _getInverterOutputs() {
    var outputs = {};
    var entries = Object.entries(this.inverters);
    for (var i = 0; i < entries.length; i++) {
      var id = entries[i][0];
      var inv = entries[i][1];
      outputs[id] = {
        model: inv.model,
        outputKW: inv.currentOutputKW,
        efficiency: inv.efficiency,
        temperature: inv.temperature,
        status: inv.status
      };
    }
    return outputs;
  }

  _getBatteryStatus() {
    var status = {};
    var entries = Object.entries(this.batteries);
    for (var i = 0; i < entries.length; i++) {
      var id = entries[i][0];
      var bat = entries[i][1];
      status[id] = {
        name: bat.name,
        chargeLevel: Math.round(bat.chargeLevel * 1000) / 1000,
        chargePercentage: Math.round(bat.chargeLevel * 100),
        storedKWh: Math.round(bat.capacityKWh * bat.chargeLevel * 100) / 100,
        capacityKWh: bat.capacityKWh,
        mode: bat.mode,
        healthPercentage: bat.healthPercentage,
        temperature: bat.temperature,
        cycleCount: bat.cycleCount
      };
    }
    return status;
  }

  // --- Public API Methods ---

  getArrayDetails(arrayId) {
    var array = this.panelArrays[arrayId];
    if (!array) return null;
    return {
      name: array.name,
      panelCount: array.panelCount,
      panelWattage: array.panelWattage,
      totalCapacityKW: array.totalCapacityKW,
      azimuth: array.azimuth,
      tilt: array.tilt,
      installDate: array.installDate,
      currentEfficiency: array.currentEfficiency,
      snowCoverage: array.snowCoverage,
      shadePercentage: array.shadePercentage,
      currentOutputKW: Math.round(array.panels.reduce(function(s, p) { return s + p.currentOutputW; }, 0) / 1000 * 1000) / 1000,
      avgPanelTemp: Math.round(array.panels.reduce(function(s, p) { return s + p.temperature; }, 0) / array.panels.length * 10) / 10,
      panelsWithIssues: array.panels.filter(function(p) { return p.microCracks || p.hotSpot; }).length
    };
  }

  getPanelDetails(panelId) {
    var arrayValues = Object.values(this.panelArrays);
    for (var av = 0; av < arrayValues.length; av++) {
      var panel = arrayValues[av].panels.find(function(p) { return p.id === panelId; });
      if (panel) return Object.assign({}, panel);
    }
    return null;
  }

  getBatteryDetails(batteryId) {
    var battery = this.batteries[batteryId];
    if (!battery) return null;
    return this._getBatteryStatus()[batteryId];
  }

  getInverterDetails(inverterId) {
    var inverter = this.inverters[inverterId];
    if (!inverter) return null;
    return Object.assign({}, inverter);
  }

  getProductionForecast() {
    return {
      today: this.forecast.todayExpectedKWh,
      tomorrow: this.forecast.tomorrowExpectedKWh,
      weekly: this.forecast.weeklyExpectedKWh,
      hourly: this.forecast.hourlyForecast,
      accuracy: this.forecast.accuracy,
      weatherFactors: {
        temperature: this.weather.temperature,
        cloudCover: this.weather.cloudCover,
        snowOnGround: this.weather.snowOnGround
      }
    };
  }

  getFinancialSummary() {
    return {
      totalInvestmentSEK: this.financials.netInvestmentSEK,
      annualSavingsSEK: this.financials.annualSavingsSEK,
      cumulativeSavingsSEK: this.financials.cumulativeSavingsSEK,
      paybackYears: this.financials.paybackYears,
      irr: this.financials.irr,
      lifetimeSavingsSEK: this.financials.lifetimeSavingsSEK,
      skattereduktion: this.financials.skattereduktion,
      rotAvdrag: {
        applied: this.financials.rotAvdragApplied,
        amountSEK: this.financials.rotAvdragAmountSEK
      }
    };
  }

  getCarbonOffsetSummary() {
    return Object.assign({}, this.carbonOffset);
  }

  getEnergyIndependenceScore() {
    return Object.assign({}, this.energyIndependence);
  }

  getGridStatus() {
    return {
      flowDirection: this.grid.currentFlowDirection,
      flowKW: this.grid.currentFlowKW,
      spotPrice: this.grid.spotPrices.current,
      totalExportedKWh: Math.round(this.grid.exportedKWh * 100) / 100,
      totalImportedKWh: Math.round(this.grid.importedKWh * 100) / 100,
      netMeteringBalance: this.grid.netMeteringBalance,
      annualSurplus: this.grid.annualSurplus
    };
  }

  getSelfConsumptionData() {
    return {
      ratio: this.selfConsumption.ratio,
      ratioPercentage: Math.round(this.selfConsumption.ratio * 100),
      target: this.selfConsumption.target,
      targetPercentage: Math.round(this.selfConsumption.target * 100),
      meetsTarget: this.selfConsumption.ratio >= this.selfConsumption.target,
      dailyProduction: this.selfConsumption.dailyProduction,
      dailySelfConsumed: this.selfConsumption.dailySelfConsumed,
      dailyExported: this.selfConsumption.dailyExported,
      dailyImported: this.selfConsumption.dailyImported
    };
  }

  getHistoricalData(days) {
    var records = days
      ? this.historicalData.dailyRecords.slice(-days)
      : this.historicalData.dailyRecords;
    return {
      records: records,
      monthlyTotals: this.historicalData.monthlyTotals,
      seasonalComparison: this.historicalData.seasonalComparison,
      totalDays: records.length
    };
  }

  getMaintenanceStatus() {
    return {
      schedule: this.maintenance.schedule,
      alerts: this.maintenance.alerts,
      lastPanelCleaning: this.maintenance.lastPanelCleaning,
      lastInverterService: this.maintenance.lastInverterService,
      lastBatteryCheck: this.maintenance.lastBatteryCheck,
      nextPanelCleaning: this.maintenance.nextPanelCleaning,
      nextInverterService: this.maintenance.nextInverterService,
      nextBatteryCheck: this.maintenance.nextBatteryCheck
    };
  }

  getPeakShavingStatus() {
    return {
      enabled: this.peakShaving.enabled,
      thresholdKW: this.peakShaving.gridPeakThresholdKW,
      currentDemandKW: this.peakShaving.currentGridDemandKW,
      peaksDetectedToday: this.peakShaving.peaksDetectedToday,
      peaksShavedToday: this.peakShaving.peaksShavedToday,
      energySavedKWh: Math.round(this.peakShaving.energySavedByShavingKWh * 100) / 100
    };
  }

  getSystemHealthReport() {
    return {
      overall: this.systemHealth.overallScore,
      panels: this.systemHealth.panelHealthScore,
      inverters: this.systemHealth.inverterHealthScore,
      batteries: this.systemHealth.batteryHealthScore,
      lastCalculated: this.systemHealth.lastCalculated,
      issues: this._getSystemIssues()
    };
  }

  _getSystemIssues() {
    var issues = [];
    var arrayEntries = Object.entries(this.panelArrays);
    for (var ae = 0; ae < arrayEntries.length; ae++) {
      var arrayId = arrayEntries[ae][0];
      var array = arrayEntries[ae][1];
      if (array.currentEfficiency < 0.85) {
        issues.push({ component: 'panel', array: arrayId, issue: 'High degradation', severity: 'warning', detail: 'Efficiency: ' + (array.currentEfficiency * 100).toFixed(1) + '%' });
      }
      if (array.snowCoverage > 0.3) {
        issues.push({ component: 'panel', array: arrayId, issue: 'Snow coverage', severity: 'info', detail: 'Coverage: ' + (array.snowCoverage * 100).toFixed(0) + '%' });
      }
      var hotSpots = array.panels.filter(function(p) { return p.hotSpot; }).length;
      if (hotSpots > 0) {
        issues.push({ component: 'panel', array: arrayId, issue: 'Hot spots detected', severity: 'critical', detail: hotSpots + ' panel(s)' });
      }
      var microCracks = array.panels.filter(function(p) { return p.microCracks; }).length;
      if (microCracks > 0) {
        issues.push({ component: 'panel', array: arrayId, issue: 'Micro-cracks detected', severity: 'warning', detail: microCracks + ' panel(s)' });
      }
    }

    var inverterEntries = Object.entries(this.inverters);
    for (var ie = 0; ie < inverterEntries.length; ie++) {
      var invId = inverterEntries[ie][0];
      var inv = inverterEntries[ie][1];
      if (inv.temperature > 55) {
        issues.push({ component: 'inverter', id: invId, issue: 'High temperature', severity: 'warning', detail: inv.temperature + ' C' });
      }
      if (inv.status !== 'active') {
        issues.push({ component: 'inverter', id: invId, issue: 'Status: ' + inv.status, severity: 'critical' });
      }
      if (inv.efficiency < 0.95) {
        issues.push({ component: 'inverter', id: invId, issue: 'Reduced efficiency', severity: 'warning', detail: (inv.efficiency * 100).toFixed(1) + '%' });
      }
    }

    var batteryEntries = Object.entries(this.batteries);
    for (var be = 0; be < batteryEntries.length; be++) {
      var batId = batteryEntries[be][0];
      var bat = batteryEntries[be][1];
      if (bat.healthPercentage < 85) {
        issues.push({ component: 'battery', id: batId, issue: 'Degraded health', severity: 'warning', detail: bat.healthPercentage + '%' });
      }
      if (bat.temperature > 35) {
        issues.push({ component: 'battery', id: batId, issue: 'High temperature', severity: 'warning', detail: bat.temperature + ' C' });
      }
    }
    return issues;
  }

  getShadeAnalysis() {
    return {
      hourlyShadeMap: this.shadeAnalysis.hourlyShadeMap,
      criticalHours: this.shadeAnalysis.criticalShadeHours,
      annualShadeLossPercentage: this.shadeAnalysis.annualShadeLoss
    };
  }

  getWeatherStatus() {
    return {
      temperature: this.weather.temperature,
      cloudCover: this.weather.cloudCover,
      precipitation: this.weather.precipitation,
      windSpeed: this.weather.windSpeed,
      humidity: this.weather.humidity,
      uvIndex: this.weather.uvIndex,
      snowOnGround: this.weather.snowOnGround,
      temperatureEfficiencyFactor: this._getTemperatureEfficiencyFactor(this.weather.temperature),
      optimalTempRange: { min: 15, max: 25 }
    };
  }

  getSwedishIncentives() {
    return {
      skattereduktion: {
        rate: this.financials.skattereduktion.ratePerKWh + ' SEK/kWh',
        maxAnnual: this.financials.skattereduktion.maxAnnualSEK + ' SEK',
        claimedThisYear: this.financials.skattereduktion.claimedThisYearSEK + ' SEK',
        description: 'Tax reduction for surplus solar electricity fed to the grid'
      },
      rotAvdrag: {
        applied: this.financials.rotAvdragApplied,
        amount: this.financials.rotAvdragAmountSEK + ' SEK',
        description: 'ROT-avdrag for installation labor costs (30% of labor, max 50000 SEK/year)'
      },
      netMetering: {
        balance: this.grid.netMeteringBalance + ' kWh',
        description: 'Monthly netting of production against consumption'
      }
    };
  }

  // --- Statistics ---

  getStatistics() {
    var totalOutputKW = this.inverters.primary.currentOutputKW + this.inverters.secondary.currentOutputKW;
    return {
      initialized: this.initialized,
      systemCapacityKW: this._getTotalCapacityKW(),
      totalPanels: this._getTotalPanelCount(),
      arrays: Object.keys(this.panelArrays).length,
      currentOutputKW: Math.round(totalOutputKW * 1000) / 1000,
      batteryStorageKWh: this._getTotalBatteryCapacity(),
      currentStoredKWh: Math.round(this._getTotalStoredEnergy() * 100) / 100,
      gridFlowDirection: this.grid.currentFlowDirection,
      gridFlowKW: this.grid.currentFlowKW,
      selfConsumptionRatio: this.selfConsumption.ratio,
      energyIndependenceScore: this.energyIndependence.score,
      systemHealthScore: this.systemHealth.overallScore,
      todayForecastKWh: this.forecast.todayExpectedKWh,
      annualSavingsSEK: this.financials.annualSavingsSEK,
      paybackYears: this.financials.paybackYears,
      carbonSavedKgYear: this.carbonOffset.yearlyCarbonSavedKg,
      spotPriceSEK: this.grid.spotPrices.current,
      weatherTemp: this.weather.temperature,
      weatherCloud: this.weather.cloudCover,
      maintenanceAlerts: this.maintenance.alerts.length,
      peakShavingActive: this.peakShaving.enabled,
      historicalDays: this.historicalData.dailyRecords.length,
      intervals: this.intervals.length
    };
  }

  destroy() {
    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];
    this.homey.log('[Solar] Solar Energy Optimization System destroyed');
  }
}

module.exports = SolarEnergyOptimizationSystem;
