'use strict';
require('dotenv').config();
const logger = require('./lib/logger');

/**
 * Smart Home Pro — Standalone Express Server
 * 
 * Boots the entire platform outside of Homey using HomeyShim for runtime emulation.
 * Auto-generates REST API routes from app.json + api.js definitions.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const HomeyShim = require('./lib/standalone/HomeyShim');
const {
  DeviceManager, SceneManager, AutomationManager, EnergyManager,
  SecurityManager, ClimateManager, PresenceManager, NotificationManager,
} = require('./lib/standalone/ManagerStubs');

// ============================================
// ALL 93 SYSTEM MODULE IMPORTS (from app.js)
// ============================================

const AdvancedAutomationEngine = require('./lib/AdvancedAutomationEngine');
const IntelligentDashboard = require('./lib/IntelligentDashboard');
const IntelligenceManager = require('./lib/IntelligenceManager');
const AdvancedAnalytics = require('./lib/AdvancedAnalytics');
const VoiceControlSystem = require('./lib/VoiceControlSystem');
const GeofencingEngine = require('./lib/GeofencingEngine');
const SceneLearningSystem = require('./lib/SceneLearningSystem');
const AdvancedNotificationManager = require('./lib/AdvancedNotificationManager');
const DeviceHealthMonitor = require('./lib/DeviceHealthMonitor');
const EnergyForecastingEngine = require('./lib/EnergyForecastingEngine');
const SmartSchedulingSystem = require('./lib/SmartSchedulingSystem');
const IntegrationHub = require('./lib/IntegrationHub');
const MultiUserPreferenceSystem = require('./lib/MultiUserPreferenceSystem');
const BackupRecoverySystem = require('./lib/BackupRecoverySystem');
const PerformanceOptimizer = require('./lib/PerformanceOptimizer');
const AmbientIntelligenceSystem = require('./lib/AmbientIntelligenceSystem');
const MoodActivityDetectionSystem = require('./lib/MoodActivityDetectionSystem');
const EnergyStorageManagementSystem = require('./lib/EnergyStorageManagementSystem');
const AdvancedSceneTemplateSystem = require('./lib/AdvancedSceneTemplateSystem');
const PredictiveMaintenanceScheduler = require('./lib/PredictiveMaintenanceScheduler');
const CrossHomeSynchronizationSystem = require('./lib/CrossHomeSynchronizationSystem');
const SmartWaterManagementSystem = require('./lib/SmartWaterManagementSystem');
const AirQualityManagementSystem = require('./lib/AirQualityManagementSystem');
const AdvancedSecuritySystem = require('./lib/AdvancedSecuritySystem');
const WellnessSleepOptimizer = require('./lib/WellnessSleepOptimizer');
const SmartApplianceController = require('./lib/SmartApplianceController');
const GardenPlantCareSystem = require('./lib/GardenPlantCareSystem');
const AIVoiceAssistantIntegration = require('./lib/AIVoiceAssistantIntegration');
const SmartLockManagementSystem = require('./lib/SmartLockManagementSystem');
const PetCareAutomationSystem = require('./lib/PetCareAutomationSystem');
const AdvancedWeatherIntegration = require('./lib/AdvancedWeatherIntegration');
const SmartWasteManagementSystem = require('./lib/SmartWasteManagementSystem');
const VehicleIntegrationSystem = require('./lib/VehicleIntegrationSystem');
const AdvancedAVAutomation = require('./lib/AdvancedAVAutomation');
const OutdoorLightingScenarios = require('./lib/OutdoorLightingScenarios');
const PoolSpaManagementSystem = require('./lib/PoolSpaManagementSystem');
const AdvancedEnergyTradingSystem = require('./lib/AdvancedEnergyTradingSystem');
const HomeGymFitnessSystem = require('./lib/HomeGymFitnessSystem');
const SmartWindowManagementSystem = require('./lib/SmartWindowManagementSystem');
const WineCellarManagementSystem = require('./lib/WineCellarManagementSystem');
const AdvancedWakeUpRoutineSystem = require('./lib/AdvancedWakeUpRoutineSystem');
const MailboxPackageTrackingSystem = require('./lib/MailboxPackageTrackingSystem');
const AdvancedAirPurificationSystem = require('./lib/AdvancedAirPurificationSystem');
const SmartFurnitureControlSystem = require('./lib/SmartFurnitureControlSystem');
const HomeOfficeOptimizationSystem = require('./lib/HomeOfficeOptimizationSystem');
// Wave 6
const SmartHomeTheaterSystem = require('./lib/SmartHomeTheaterSystem');
const AdvancedKitchenAutomationSystem = require('./lib/AdvancedKitchenAutomationSystem');
const HomeSpaAndSaunaSystem = require('./lib/HomeSpaAndSaunaSystem');
const SmartWardrobeManagementSystem = require('./lib/SmartWardrobeManagementSystem');
const HomeBarManagementSystem = require('./lib/HomeBarManagementSystem');
const AdvancedBabyAndChildCareSystem = require('./lib/AdvancedBabyAndChildCareSystem');
const HomeCleaningAutomationSystem = require('./lib/HomeCleaningAutomationSystem');
const SmartGarageManagementSystem = require('./lib/SmartGarageManagementSystem');
// Wave 7
const SmartLaundryManagementSystem = require('./lib/SmartLaundryManagementSystem');
const HomeWorkshopSafetySystem = require('./lib/HomeWorkshopSafetySystem');
const AdvancedMusicAudioSystem = require('./lib/AdvancedMusicAudioSystem');
const SmartAquariumManagementSystem = require('./lib/SmartAquariumManagementSystem');
const HomeOfficeProductivityHub = require('./lib/HomeOfficeProductivityHub');
const AdvancedIndoorPlantCareSystem = require('./lib/AdvancedIndoorPlantCareSystem');
const SmartPetDoorActivitySystem = require('./lib/SmartPetDoorActivitySystem');
const HomeLibraryManagementSystem = require('./lib/HomeLibraryManagementSystem');
// Wave 8
const SolarEnergyOptimizationSystem = require('./lib/SolarEnergyOptimizationSystem');
const HomeEmergencyResponseSystem = require('./lib/HomeEmergencyResponseSystem');
const AdvancedHomeNetworkSecuritySystem = require('./lib/AdvancedHomeNetworkSecuritySystem');
const SmartIrrigationWaterConservationSystem = require('./lib/SmartIrrigationWaterConservationSystem');
const AdvancedAirQualityVentilationControlSystem = require('./lib/AdvancedAirQualityVentilationControlSystem');
const HomeAccessibilityElderlyCareSystem = require('./lib/HomeAccessibilityElderlyCareSystem');
const AdvancedPackageDeliveryManagementSystem = require('./lib/AdvancedPackageDeliveryManagementSystem');
const SmartHomeInsuranceRiskAssessmentSystem = require('./lib/SmartHomeInsuranceRiskAssessmentSystem');
// Wave 9
const AdvancedAIPredictionEngine = require('./lib/AdvancedAIPredictionEngine');
const CrossSystemAIOrchestrationHub = require('./lib/CrossSystemAIOrchestrationHub');
// Wave 10
const DeepLearningVisionSystem = require('./lib/DeepLearningVisionSystem');
const NaturalLanguageAutomationEngine = require('./lib/NaturalLanguageAutomationEngine');
// System optimizer
const { SystemOptimizer } = require('./lib/utils/SystemOptimizer');
// Wave 11 — Infrastructure & Optimization Systems
const { CentralizedCacheManager } = require('./lib/utils/CentralizedCacheManager');
const { UnifiedEventScheduler } = require('./lib/utils/UnifiedEventScheduler');
const ErrorHandlingMiddleware = require('./lib/ErrorHandlingMiddleware');
const MemoryGuardSystem = require('./lib/MemoryGuardSystem');
const APIAuthenticationGateway = require('./lib/APIAuthenticationGateway');
const SystemHealthDashboard = require('./lib/SystemHealthDashboard');
// Wave 12
const SmartDoorbellIntercomSystem = require('./lib/SmartDoorbellIntercomSystem');
const IndoorLightingSceneEngine = require('./lib/IndoorLightingSceneEngine');
const EnergyBillingAnalyticsSystem = require('./lib/EnergyBillingAnalyticsSystem');
const VisitorGuestManagementSystem = require('./lib/VisitorGuestManagementSystem');
const RoomOccupancyMappingSystem = require('./lib/RoomOccupancyMappingSystem');
const PowerContinuityUPSSystem = require('./lib/PowerContinuityUPSSystem');
// Wave 13
const SmartFoodPantryManagementSystem = require('./lib/SmartFoodPantryManagementSystem');
const HomeSustainabilityTrackerSystem = require('./lib/HomeSustainabilityTrackerSystem');
const SmartPerimeterManagementSystem = require('./lib/SmartPerimeterManagementSystem');
const HomeRoboticsOrchestrationSystem = require('./lib/HomeRoboticsOrchestrationSystem');
const SmartHomeDigitalTwinSystem = require('./lib/SmartHomeDigitalTwinSystem');
const SmartDisasterResilienceSystem = require('./lib/SmartDisasterResilienceSystem');
// Wave 14
const SmartEVChargingManagementSystem = require('./lib/SmartEVChargingManagementSystem');
const HomeNutritionWellnessSystem = require('./lib/HomeNutritionWellnessSystem');
const SmartNoiseManagementSystem = require('./lib/SmartNoiseManagementSystem');
const HomeChildEducationSystem = require('./lib/HomeChildEducationSystem');
const SmartSeasonalAdaptationSystem = require('./lib/SmartSeasonalAdaptationSystem');
const AdvancedGuestEntertainmentSystem = require('./lib/AdvancedGuestEntertainmentSystem');

// Wave 15
const SmartMirrorDashboardSystem = require('./lib/SmartMirrorDashboardSystem');
const HomeEnergyAuditSystem = require('./lib/HomeEnergyAuditSystem');
const SmartFireplaceManagementSystem = require('./lib/SmartFireplaceManagementSystem');
const AdvancedSleepEnvironmentSystem = require('./lib/AdvancedSleepEnvironmentSystem');
const SmartHVACZoneControlSystem = require('./lib/SmartHVACZoneControlSystem');
const HomeSecurityDroneSystem = require('./lib/HomeSecurityDroneSystem');

// Wave 16
const SmartCircadianLightingSystem = require('./lib/SmartCircadianLightingSystem');
const HomeDigitalWellnessSystem = require('./lib/HomeDigitalWellnessSystem');
const SmartCompostingGardenSystem = require('./lib/SmartCompostingGardenSystem');
const AdvancedNeighborhoodIntegrationSystem = require('./lib/AdvancedNeighborhoodIntegrationSystem');
const HomeWaterLeakProtectionSystem = require('./lib/HomeWaterLeakProtectionSystem');
const SmartBlindsShutterControlSystem = require('./lib/SmartBlindsShutterControlSystem');
const SmartFloorHeatingControlSystem = require('./lib/SmartFloorHeatingControlSystem');
const SmartWeatherStationSystem = require('./lib/SmartWeatherStationSystem');
const SmartHomeVentilationHeatRecoverySystem = require('./lib/SmartHomeVentilationHeatRecoverySystem');
const SmartRoofSolarMonitoringSystem = require('./lib/SmartRoofSolarMonitoringSystem');

// Wave 17 — Audit & Backup
const AuditLogSystem = require('./lib/AuditLogSystem');

// ============================================
// BOOT SEQUENCE
// ============================================

const startTime = Date.now();
const systemStatuses = {};
// Tracks modules that failed to initialize (circuit breaker state)
const degradedModules = new Set();

// ── Process error handlers ──
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise: String(promise) }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

async function boot() {
  logger.info('╔══════════════════════════════════════════════╗');
  logger.info('║   Smart Home Pro — Standalone Server Boot    ║');
  logger.info('╚══════════════════════════════════════════════╝');
  logger.info('Boot sequence started');

  // 1. Create HomeyShim instance
  const homey = new HomeyShim();

  // 2. Create app object (mimics SmartHomeProApp without extending Homey.App)
  const app = {
    homey,
    scenes: {},
    routines: {},
    securityMode: 'disarmed',
    nightMode: false,
    energySavingMode: false,
    presenceData: {},
    log: (...args) => logger.info({ source: 'app' }, args.join(' ')),
    error: (...args) => logger.error({ source: 'app' }, args.join(' ')),

    // getDashboardData mirrors what's in app.js
    async getDashboardData() {
      return {
        presence: await this.presenceManager.getStatus(),
        energy: await this.energyManager.getCurrentConsumption(),
        climate: await this.climateManager.getAllZonesStatus(),
        security: { mode: this.securityMode, status: await this.securityManager.getStatus() },
        scenes: this.scenes,
        activeScene: this.sceneManager.getActiveScene(),
        devices: await this.deviceManager.getDevicesSummary()
      };
    }
  };

  // 3. Instantiate all systems on the app object
  // ── Inner managers (stubs) ──
  app.deviceManager = new DeviceManager(app);
  app.sceneManager = new SceneManager(app);
  app.automationManager = new AutomationManager(app);
  app.energyManager = new EnergyManager(app);
  app.securityManager = new SecurityManager(app);
  app.climateManager = new ClimateManager(app);
  app.presenceManager = new PresenceManager(app);
  app.notificationManager = new NotificationManager(app);

  // ── Waves 1-7: constructor(homey) ──
  app.automationEngine = new AdvancedAutomationEngine(homey);
  app.intelligentDashboard = new IntelligentDashboard(homey);
  app.intelligenceManager = new IntelligenceManager(homey);
  app.advancedAnalytics = new AdvancedAnalytics(homey);
  app.voiceControlSystem = new VoiceControlSystem(homey);
  app.geofencingEngine = new GeofencingEngine(homey);
  app.sceneLearningSystem = new SceneLearningSystem(homey);
  app.advancedNotificationManager = new AdvancedNotificationManager(homey);
  app.deviceHealthMonitor = new DeviceHealthMonitor(homey);
  app.energyForecastingEngine = new EnergyForecastingEngine(homey);
  app.smartSchedulingSystem = new SmartSchedulingSystem(homey);
  app.integrationHub = new IntegrationHub(homey);
  app.multiUserPreferenceSystem = new MultiUserPreferenceSystem(homey);
  // Wave 2
  app.backupRecoverySystem = new BackupRecoverySystem(homey);
  app.performanceOptimizer = new PerformanceOptimizer(homey);
  app.ambientIntelligenceSystem = new AmbientIntelligenceSystem(homey);
  app.moodActivityDetectionSystem = new MoodActivityDetectionSystem(homey);
  app.energyStorageManagementSystem = new EnergyStorageManagementSystem(homey);
  app.advancedSceneTemplateSystem = new AdvancedSceneTemplateSystem(homey);
  app.predictiveMaintenanceScheduler = new PredictiveMaintenanceScheduler(homey);
  app.crossHomeSynchronizationSystem = new CrossHomeSynchronizationSystem(homey);
  // Wave 3
  app.smartWaterManagementSystem = new SmartWaterManagementSystem(homey);
  app.airQualityManagementSystem = new AirQualityManagementSystem(homey);
  app.advancedSecuritySystem = new AdvancedSecuritySystem(homey);
  app.wellnessSleepOptimizer = new WellnessSleepOptimizer(homey);
  app.smartApplianceController = new SmartApplianceController(homey);
  app.gardenPlantCareSystem = new GardenPlantCareSystem(homey);
  app.aiVoiceAssistantIntegration = new AIVoiceAssistantIntegration(homey);
  app.smartLockManagementSystem = new SmartLockManagementSystem(homey);
  // Wave 4
  app.petCareAutomationSystem = new PetCareAutomationSystem(homey);
  app.advancedWeatherIntegration = new AdvancedWeatherIntegration(homey);
  app.smartWasteManagementSystem = new SmartWasteManagementSystem(homey);
  app.vehicleIntegrationSystem = new VehicleIntegrationSystem(homey);
  app.advancedAVAutomation = new AdvancedAVAutomation(homey);
  app.outdoorLightingScenarios = new OutdoorLightingScenarios(homey);
  app.poolSpaManagementSystem = new PoolSpaManagementSystem(homey);
  app.advancedEnergyTradingSystem = new AdvancedEnergyTradingSystem(homey);
  // Wave 5
  app.homeGymFitnessSystem = new HomeGymFitnessSystem(homey);
  app.smartWindowManagementSystem = new SmartWindowManagementSystem(homey);
  app.wineCellarManagementSystem = new WineCellarManagementSystem(homey);
  app.advancedWakeUpRoutineSystem = new AdvancedWakeUpRoutineSystem(homey);
  app.mailboxPackageTrackingSystem = new MailboxPackageTrackingSystem(homey);
  app.advancedAirPurificationSystem = new AdvancedAirPurificationSystem(homey);
  app.smartFurnitureControlSystem = new SmartFurnitureControlSystem(homey);
  app.homeOfficeOptimizationSystem = new HomeOfficeOptimizationSystem(homey);
  // Wave 6
  app.smartHomeTheaterSystem = new SmartHomeTheaterSystem(homey);
  app.advancedKitchenAutomationSystem = new AdvancedKitchenAutomationSystem(homey);
  app.homeSpaAndSaunaSystem = new HomeSpaAndSaunaSystem(homey);
  app.smartWardrobeManagementSystem = new SmartWardrobeManagementSystem(homey);
  app.homeBarManagementSystem = new HomeBarManagementSystem(homey);
  app.advancedBabyAndChildCareSystem = new AdvancedBabyAndChildCareSystem(homey);
  app.homeCleaningAutomationSystem = new HomeCleaningAutomationSystem(homey);
  app.smartGarageManagementSystem = new SmartGarageManagementSystem(homey);
  // Wave 7
  app.smartLaundryManagementSystem = new SmartLaundryManagementSystem(homey);
  app.homeWorkshopSafetySystem = new HomeWorkshopSafetySystem(homey);
  app.advancedMusicAudioSystem = new AdvancedMusicAudioSystem(homey);
  app.smartAquariumManagementSystem = new SmartAquariumManagementSystem(homey);
  app.homeOfficeProductivityHub = new HomeOfficeProductivityHub(homey);
  app.advancedIndoorPlantCareSystem = new AdvancedIndoorPlantCareSystem(homey);
  app.smartPetDoorActivitySystem = new SmartPetDoorActivitySystem(homey);
  app.homeLibraryManagementSystem = new HomeLibraryManagementSystem(homey);

  // ── Waves 8-10: constructor(homey) (fixed in Wave 14) ──
  app.solarEnergyOptimizationSystem = new SolarEnergyOptimizationSystem(homey);
  app.homeEmergencyResponseSystem = new HomeEmergencyResponseSystem(homey);
  app.advancedHomeNetworkSecuritySystem = new AdvancedHomeNetworkSecuritySystem(homey);
  app.smartIrrigationWaterConservationSystem = new SmartIrrigationWaterConservationSystem(homey);
  app.advancedAirQualityVentilationControlSystem = new AdvancedAirQualityVentilationControlSystem(homey);
  app.homeAccessibilityElderlyCareSystem = new HomeAccessibilityElderlyCareSystem(homey);
  app.advancedPackageDeliveryManagementSystem = new AdvancedPackageDeliveryManagementSystem(homey);
  app.smartHomeInsuranceRiskAssessmentSystem = new SmartHomeInsuranceRiskAssessmentSystem(homey);
  // Wave 9
  app.advancedAIPredictionEngine = new AdvancedAIPredictionEngine(homey);
  app.crossSystemAIOrchestrationHub = new CrossSystemAIOrchestrationHub(homey);
  // Wave 10
  app.deepLearningVisionSystem = new DeepLearningVisionSystem(homey);
  app.naturalLanguageAutomationEngine = new NaturalLanguageAutomationEngine(homey);

  // ── System optimizer ──
  app.systemOptimizer = new SystemOptimizer();

  // ── Wave 11: singletons / special patterns ──
  app.centralizedCacheManager = CentralizedCacheManager.getInstance({ maxGlobalSize: 10000 });
  app.unifiedEventScheduler = UnifiedEventScheduler.getInstance();
  app.errorHandlingMiddleware = ErrorHandlingMiddleware.getInstance(homey);
  app.memoryGuardSystem = MemoryGuardSystem.getInstance();
  app.apiAuthenticationGateway = APIAuthenticationGateway.getInstance();
  app.systemHealthDashboard = new SystemHealthDashboard();

  // ── Wave 12: constructor(homey) ──
  app.smartDoorbellIntercomSystem = new SmartDoorbellIntercomSystem(homey);
  app.indoorLightingSceneEngine = new IndoorLightingSceneEngine(homey);
  app.energyBillingAnalyticsSystem = new EnergyBillingAnalyticsSystem(homey);
  app.visitorGuestManagementSystem = new VisitorGuestManagementSystem(homey);
  app.roomOccupancyMappingSystem = new RoomOccupancyMappingSystem(homey);
  app.powerContinuityUPSSystem = new PowerContinuityUPSSystem(homey);

  // ── Wave 13: constructor(homey) ──
  app.smartFoodPantryManagementSystem = new SmartFoodPantryManagementSystem(homey);
  app.homeSustainabilityTrackerSystem = new HomeSustainabilityTrackerSystem(homey);
  app.smartPerimeterManagementSystem = new SmartPerimeterManagementSystem(homey);
  app.homeRoboticsOrchestrationSystem = new HomeRoboticsOrchestrationSystem(homey);
  app.smartHomeDigitalTwinSystem = new SmartHomeDigitalTwinSystem(homey);
  app.smartDisasterResilienceSystem = new SmartDisasterResilienceSystem(homey);

  // ── Wave 14: constructor(homey) ──
  app.smartEVChargingManagementSystem = new SmartEVChargingManagementSystem(homey);
  app.homeNutritionWellnessSystem = new HomeNutritionWellnessSystem(homey);
  app.smartNoiseManagementSystem = new SmartNoiseManagementSystem(homey);
  app.homeChildEducationSystem = new HomeChildEducationSystem(homey);
  app.smartSeasonalAdaptationSystem = new SmartSeasonalAdaptationSystem(homey);
  app.advancedGuestEntertainmentSystem = new AdvancedGuestEntertainmentSystem(homey);

  // ── Wave 15: constructor(homey) ──
  app.smartMirrorDashboardSystem = new SmartMirrorDashboardSystem(homey);
  app.homeEnergyAuditSystem = new HomeEnergyAuditSystem(homey);
  app.smartFireplaceManagementSystem = new SmartFireplaceManagementSystem(homey);
  app.advancedSleepEnvironmentSystem = new AdvancedSleepEnvironmentSystem(homey);
  app.smartHVACZoneControlSystem = new SmartHVACZoneControlSystem(homey);
  app.homeSecurityDroneSystem = new HomeSecurityDroneSystem(homey);

  // ── Wave 16: constructor(homey) ──
  app.smartCircadianLightingSystem = new SmartCircadianLightingSystem(homey);
  app.homeDigitalWellnessSystem = new HomeDigitalWellnessSystem(homey);
  app.smartCompostingGardenSystem = new SmartCompostingGardenSystem(homey);
  app.advancedNeighborhoodIntegrationSystem = new AdvancedNeighborhoodIntegrationSystem(homey);
  app.homeWaterLeakProtectionSystem = new HomeWaterLeakProtectionSystem(homey);
  app.smartBlindsShutterControlSystem = new SmartBlindsShutterControlSystem(homey);
  app.smartFloorHeatingControlSystem = new SmartFloorHeatingControlSystem(homey);
  app.smartWeatherStationSystem = new SmartWeatherStationSystem(homey);
  app.smartHomeVentilationHeatRecoverySystem = new SmartHomeVentilationHeatRecoverySystem(homey);
  app.smartRoofSolarMonitoringSystem = new SmartRoofSolarMonitoringSystem(homey);

  // ── Wave 17: Audit & Backup ──
  app.auditLogSystem = new AuditLogSystem(homey);

  // 4. Wire homey.app
  homey.app = app;

  // 5. Collect ALL initializable systems for Promise.allSettled
  const allSystems = [
    // Inner managers
    { name: 'DeviceManager', ref: app.deviceManager },
    { name: 'SceneManager', ref: app.sceneManager },
    { name: 'AutomationManager', ref: app.automationManager },
    { name: 'EnergyManager', ref: app.energyManager },
    { name: 'SecurityManager', ref: app.securityManager },
    { name: 'ClimateManager', ref: app.climateManager },
    { name: 'PresenceManager', ref: app.presenceManager },
    { name: 'NotificationManager', ref: app.notificationManager },
    // Wave 1
    { name: 'AdvancedAutomationEngine', ref: app.automationEngine },
    { name: 'IntelligentDashboard', ref: app.intelligentDashboard },
    { name: 'IntelligenceManager', ref: app.intelligenceManager },
    { name: 'AdvancedAnalytics', ref: app.advancedAnalytics },
    { name: 'VoiceControlSystem', ref: app.voiceControlSystem },
    { name: 'GeofencingEngine', ref: app.geofencingEngine },
    { name: 'SceneLearningSystem', ref: app.sceneLearningSystem },
    { name: 'AdvancedNotificationManager', ref: app.advancedNotificationManager },
    { name: 'DeviceHealthMonitor', ref: app.deviceHealthMonitor },
    { name: 'EnergyForecastingEngine', ref: app.energyForecastingEngine },
    { name: 'SmartSchedulingSystem', ref: app.smartSchedulingSystem },
    { name: 'IntegrationHub', ref: app.integrationHub },
    { name: 'MultiUserPreferenceSystem', ref: app.multiUserPreferenceSystem },
    // Wave 2
    { name: 'BackupRecoverySystem', ref: app.backupRecoverySystem },
    { name: 'PerformanceOptimizer', ref: app.performanceOptimizer },
    { name: 'AmbientIntelligenceSystem', ref: app.ambientIntelligenceSystem },
    { name: 'MoodActivityDetectionSystem', ref: app.moodActivityDetectionSystem },
    { name: 'EnergyStorageManagementSystem', ref: app.energyStorageManagementSystem },
    { name: 'AdvancedSceneTemplateSystem', ref: app.advancedSceneTemplateSystem },
    { name: 'PredictiveMaintenanceScheduler', ref: app.predictiveMaintenanceScheduler },
    { name: 'CrossHomeSynchronizationSystem', ref: app.crossHomeSynchronizationSystem },
    // Wave 3
    { name: 'SmartWaterManagementSystem', ref: app.smartWaterManagementSystem },
    { name: 'AirQualityManagementSystem', ref: app.airQualityManagementSystem },
    { name: 'AdvancedSecuritySystem', ref: app.advancedSecuritySystem },
    { name: 'WellnessSleepOptimizer', ref: app.wellnessSleepOptimizer },
    { name: 'SmartApplianceController', ref: app.smartApplianceController },
    { name: 'GardenPlantCareSystem', ref: app.gardenPlantCareSystem },
    { name: 'AIVoiceAssistantIntegration', ref: app.aiVoiceAssistantIntegration },
    { name: 'SmartLockManagementSystem', ref: app.smartLockManagementSystem },
    // Wave 4
    { name: 'PetCareAutomationSystem', ref: app.petCareAutomationSystem },
    { name: 'AdvancedWeatherIntegration', ref: app.advancedWeatherIntegration },
    { name: 'SmartWasteManagementSystem', ref: app.smartWasteManagementSystem },
    { name: 'VehicleIntegrationSystem', ref: app.vehicleIntegrationSystem },
    { name: 'AdvancedAVAutomation', ref: app.advancedAVAutomation },
    { name: 'OutdoorLightingScenarios', ref: app.outdoorLightingScenarios },
    { name: 'PoolSpaManagementSystem', ref: app.poolSpaManagementSystem },
    { name: 'AdvancedEnergyTradingSystem', ref: app.advancedEnergyTradingSystem },
    // Wave 5
    { name: 'HomeGymFitnessSystem', ref: app.homeGymFitnessSystem },
    { name: 'SmartWindowManagementSystem', ref: app.smartWindowManagementSystem },
    { name: 'WineCellarManagementSystem', ref: app.wineCellarManagementSystem },
    { name: 'AdvancedWakeUpRoutineSystem', ref: app.advancedWakeUpRoutineSystem },
    { name: 'MailboxPackageTrackingSystem', ref: app.mailboxPackageTrackingSystem },
    { name: 'AdvancedAirPurificationSystem', ref: app.advancedAirPurificationSystem },
    { name: 'SmartFurnitureControlSystem', ref: app.smartFurnitureControlSystem },
    { name: 'HomeOfficeOptimizationSystem', ref: app.homeOfficeOptimizationSystem },
    // Wave 6
    { name: 'SmartHomeTheaterSystem', ref: app.smartHomeTheaterSystem },
    { name: 'AdvancedKitchenAutomationSystem', ref: app.advancedKitchenAutomationSystem },
    { name: 'HomeSpaAndSaunaSystem', ref: app.homeSpaAndSaunaSystem },
    { name: 'SmartWardrobeManagementSystem', ref: app.smartWardrobeManagementSystem },
    { name: 'HomeBarManagementSystem', ref: app.homeBarManagementSystem },
    { name: 'AdvancedBabyAndChildCareSystem', ref: app.advancedBabyAndChildCareSystem },
    { name: 'HomeCleaningAutomationSystem', ref: app.homeCleaningAutomationSystem },
    { name: 'SmartGarageManagementSystem', ref: app.smartGarageManagementSystem },
    // Wave 7
    { name: 'SmartLaundryManagementSystem', ref: app.smartLaundryManagementSystem },
    { name: 'HomeWorkshopSafetySystem', ref: app.homeWorkshopSafetySystem },
    { name: 'AdvancedMusicAudioSystem', ref: app.advancedMusicAudioSystem },
    { name: 'SmartAquariumManagementSystem', ref: app.smartAquariumManagementSystem },
    { name: 'HomeOfficeProductivityHub', ref: app.homeOfficeProductivityHub },
    { name: 'AdvancedIndoorPlantCareSystem', ref: app.advancedIndoorPlantCareSystem },
    { name: 'SmartPetDoorActivitySystem', ref: app.smartPetDoorActivitySystem },
    { name: 'HomeLibraryManagementSystem', ref: app.homeLibraryManagementSystem },
    // Wave 8
    { name: 'SolarEnergyOptimizationSystem', ref: app.solarEnergyOptimizationSystem },
    { name: 'HomeEmergencyResponseSystem', ref: app.homeEmergencyResponseSystem },
    { name: 'AdvancedHomeNetworkSecuritySystem', ref: app.advancedHomeNetworkSecuritySystem },
    { name: 'SmartIrrigationWaterConservationSystem', ref: app.smartIrrigationWaterConservationSystem },
    { name: 'AdvancedAirQualityVentilationControlSystem', ref: app.advancedAirQualityVentilationControlSystem },
    { name: 'HomeAccessibilityElderlyCareSystem', ref: app.homeAccessibilityElderlyCareSystem },
    { name: 'AdvancedPackageDeliveryManagementSystem', ref: app.advancedPackageDeliveryManagementSystem },
    { name: 'SmartHomeInsuranceRiskAssessmentSystem', ref: app.smartHomeInsuranceRiskAssessmentSystem },
    // Wave 9
    { name: 'AdvancedAIPredictionEngine', ref: app.advancedAIPredictionEngine },
    { name: 'CrossSystemAIOrchestrationHub', ref: app.crossSystemAIOrchestrationHub },
    // Wave 10
    { name: 'DeepLearningVisionSystem', ref: app.deepLearningVisionSystem },
    { name: 'NaturalLanguageAutomationEngine', ref: app.naturalLanguageAutomationEngine },
    // Wave 11
    { name: 'SystemHealthDashboard', ref: app.systemHealthDashboard },
    { name: 'MemoryGuardSystem', ref: app.memoryGuardSystem },
    // Wave 12
    { name: 'SmartDoorbellIntercomSystem', ref: app.smartDoorbellIntercomSystem },
    { name: 'IndoorLightingSceneEngine', ref: app.indoorLightingSceneEngine },
    { name: 'EnergyBillingAnalyticsSystem', ref: app.energyBillingAnalyticsSystem },
    { name: 'VisitorGuestManagementSystem', ref: app.visitorGuestManagementSystem },
    { name: 'RoomOccupancyMappingSystem', ref: app.roomOccupancyMappingSystem },
    { name: 'PowerContinuityUPSSystem', ref: app.powerContinuityUPSSystem },
    // Wave 13
    { name: 'SmartFoodPantryManagementSystem', ref: app.smartFoodPantryManagementSystem },
    { name: 'HomeSustainabilityTrackerSystem', ref: app.homeSustainabilityTrackerSystem },
    { name: 'SmartPerimeterManagementSystem', ref: app.smartPerimeterManagementSystem },
    { name: 'HomeRoboticsOrchestrationSystem', ref: app.homeRoboticsOrchestrationSystem },
    { name: 'SmartHomeDigitalTwinSystem', ref: app.smartHomeDigitalTwinSystem },
    { name: 'SmartDisasterResilienceSystem', ref: app.smartDisasterResilienceSystem },
    // Wave 14
    { name: 'SmartEVChargingManagementSystem', ref: app.smartEVChargingManagementSystem },
    { name: 'HomeNutritionWellnessSystem', ref: app.homeNutritionWellnessSystem },
    { name: 'SmartNoiseManagementSystem', ref: app.smartNoiseManagementSystem },
    { name: 'HomeChildEducationSystem', ref: app.homeChildEducationSystem },
    { name: 'SmartSeasonalAdaptationSystem', ref: app.smartSeasonalAdaptationSystem },
    { name: 'AdvancedGuestEntertainmentSystem', ref: app.advancedGuestEntertainmentSystem },
    // Wave 15
    { name: 'SmartMirrorDashboardSystem', ref: app.smartMirrorDashboardSystem },
    { name: 'HomeEnergyAuditSystem', ref: app.homeEnergyAuditSystem },
    { name: 'SmartFireplaceManagementSystem', ref: app.smartFireplaceManagementSystem },
    { name: 'AdvancedSleepEnvironmentSystem', ref: app.advancedSleepEnvironmentSystem },
    { name: 'SmartHVACZoneControlSystem', ref: app.smartHVACZoneControlSystem },
    { name: 'HomeSecurityDroneSystem', ref: app.homeSecurityDroneSystem },
    // Wave 16
    { name: 'SmartCircadianLightingSystem', ref: app.smartCircadianLightingSystem },
    { name: 'HomeDigitalWellnessSystem', ref: app.homeDigitalWellnessSystem },
    { name: 'SmartCompostingGardenSystem', ref: app.smartCompostingGardenSystem },
    { name: 'AdvancedNeighborhoodIntegrationSystem', ref: app.advancedNeighborhoodIntegrationSystem },
    { name: 'HomeWaterLeakProtectionSystem', ref: app.homeWaterLeakProtectionSystem },
    { name: 'SmartBlindsShutterControlSystem', ref: app.smartBlindsShutterControlSystem },
    { name: 'SmartFloorHeatingControlSystem', ref: app.smartFloorHeatingControlSystem },
    { name: 'SmartWeatherStationSystem', ref: app.smartWeatherStationSystem },
    { name: 'SmartHomeVentilationHeatRecoverySystem', ref: app.smartHomeVentilationHeatRecoverySystem },
    { name: 'SmartRoofSolarMonitoringSystem', ref: app.smartRoofSolarMonitoringSystem },
    // Wave 17
    { name: 'AuditLogSystem', ref: app.auditLogSystem },
  ];

  // 6. Initialize all systems with Promise.allSettled for resilience
  logger.info({ systemCount: allSystems.length }, 'Initializing systems');

  const INIT_TIMEOUT = 30000; // 30 seconds per system max

  const withTimeout = (promise, name, ms) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${ms / 1000}s`));
      }, ms);
      promise
        .then((val) => { clearTimeout(timer); resolve(val); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  };

  const initPromises = allSystems.map(({ name, ref }) => {
    if (!ref || typeof ref.initialize !== 'function') {
      systemStatuses[name] = { status: 'skipped', reason: 'no initialize()' };
      return Promise.resolve();
    }
    return withTimeout(ref.initialize(), name, INIT_TIMEOUT)
      .then(() => {
        systemStatuses[name] = { status: 'ok' };
        logger.info({ module: name, status: 'ok' }, 'Module initialized');
      })
      .catch((err) => {
        systemStatuses[name] = { status: 'failed', error: err.message };
        degradedModules.add(name);
        logger.warn({ module: name, err: err.message }, 'Module failed to initialize — continuing in degraded mode');
        // Do NOT rethrow: circuit breaker pattern — one module failure must not crash boot
      });
  });

  await Promise.allSettled(initPromises);

  const succeeded = Object.values(systemStatuses).filter(s => s.status === 'ok').length;
  const failed = degradedModules.size;

  logger.info({ succeeded, failed }, 'System initialization complete');
  if (failed > 0) {
    logger.warn({ degradedModules: [...degradedModules] }, 'Some modules are degraded');
  }

  return { homey, app, systemCount: allSystems.length };
}

// ============================================
// EXPRESS SERVER
// ============================================

async function startServer() {
  const { homey, app: smartApp, systemCount } = await boot();

  // ── Environment Validation ──
  const requiredInProd = ['JWT_SECRET', 'ALLOWED_ORIGINS'];
  if (process.env.NODE_ENV === 'production') {
    for (const key of requiredInProd) {
      if (!process.env[key]) {
        logger.warn({ variable: key }, 'Required environment variable is not set — using insecure defaults');
      }
    }
  }

  const server = express();
  server.set('trust proxy', 1);

  // ── Security & Performance Middleware ──
  server.use(helmet({
    contentSecurityPolicy: false,  // Allow inline scripts for dashboard
    crossOriginEmbedderPolicy: false,
  }));
  server.use(compression());
  server.use(express.json({ limit: '1mb' }));
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost,http://localhost:80,http://smarthome-dashboard:3001').split(',').map(s => s.trim());
  server.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }));

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500
    ,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests', retryAfter: '15 minutes' },
    keyGenerator: (req) => req.ip,
  });
  server.use('/api/', apiLimiter);

  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded' },
  });
  server.use('/api/v1/stats', strictLimiter);

  // ── CSRF Protection (double-submit HMAC pattern, no external dependencies) ──
  //
  // How it works:
  //   1. Client calls GET /api/v1/csrf-token → receives { csrfToken }.
  //   2. Client sends the token back in the X-CSRF-Token header on every
  //      POST / PUT / DELETE / PATCH request.
  //   3. The middleware verifies the token using HMAC-SHA256 with the server
  //      secret.  Forged or missing tokens receive 403.
  //
  // Excluded paths: /health, /ready, /metrics (probes, no cookies involved).
  const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  const CSRF_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Generate a time-bound HMAC CSRF token.
   * Format: <expiry_ms>.<hmac_hex>
   */
  function generateCsrfToken() {
    const expiry = Date.now() + CSRF_TOKEN_TTL_MS;
    const payload = String(expiry);
    const hmac = crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');
    return `${payload}.${hmac}`;
  }

  /**
   * Validate a CSRF token.  Returns true only if the signature is correct
   * and the token has not expired.
   */
  function validateCsrfToken(token) {
    if (!token || typeof token !== 'string') return false;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return false;

    const payload = token.slice(0, dotIdx);
    const providedHmac = token.slice(dotIdx + 1);
    const expectedHmac = crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');

    // Constant-time comparison to prevent timing attacks.
    // providedHmac may contain non-hex characters, which causes Buffer.from(…, 'hex')
    // to silently truncate and produce a differently-sized buffer — crashing
    // timingSafeEqual with "Input buffers must have the same byte length".
    // We guard with a strict format check first, then wrap in try/catch.
    if (!/^[0-9a-f]{64}$/i.test(providedHmac)) return false;
    try {
      if (!crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
        return false;
      }
    } catch {
      return false;
    }
    const expiry = parseInt(payload, 10);
    return !Number.isNaN(expiry) && Date.now() < expiry;
  }

  // CSRF token issuance endpoint — must be registered BEFORE the validation middleware
  server.get('/api/v1/csrf-token', (_req, res) => {
    res.json({ csrfToken: generateCsrfToken() });
  });

  // CSRF validation middleware — applies only to mutating methods on /api/ routes
  const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  const CSRF_EXEMPT_PATHS = new Set(['/health', '/ready', '/metrics', '/health/systems']);

  server.use('/api/', (req, res, next) => {
    // Safe methods and exempted paths skip validation
    if (CSRF_SAFE_METHODS.has(req.method)) return next();
    if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

    const token = req.headers['x-csrf-token'];
    if (!validateCsrfToken(token)) {
      return res.status(403).json({
        error: 'CSRF token missing or invalid',
        message: 'Obtain a token from GET /api/v1/csrf-token and include it in the X-CSRF-Token header',
        timestamp: new Date().toISOString(),
      });
    }
    next();
  });

  // Request ID + structured logging
  server.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        requestId: req.id,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip
      }, 'request completed');
    });
    next();
  });

  // ── Health Endpoints ──
  const pkg = require('./package.json');

  /**
   * Returns a summary of module health for the circuit-breaker / graceful-degradation
   * pattern (FEAT-03).  Uses the module-scope degradedModules Set and the systemCount
   * returned from boot() so the function is pure and testable without a live server.
   */
  function getSystemHealth() {
    const total = systemCount;
    const degraded = degradedModules.size;
    const healthy = total - degraded;
    let status;
    if (degraded === 0) {
      status = 'healthy';
    } else if (degraded > total / 2) {
      status = 'critical';
    } else {
      status = 'degraded';
    }
    return {
      total,
      healthy,
      degraded,
      degradedModules: Array.from(degradedModules),
      status,
    };
  }

  server.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: pkg.version,
      uptime: process.uptime(),
      systemCount,
      degraded: degradedModules.size,
      systemHealth: getSystemHealth(),
      timestamp: new Date().toISOString()
    });
  });

  server.get('/health/systems', (_req, res) => {
    res.json(systemStatuses);
  });

  // Returns modules that failed to initialize — circuit breaker exposure (FEAT-03)
  server.get('/health/degraded', (_req, res) => {
    res.json({
      degradedCount: degradedModules.size,
      modules: [...degradedModules],
      timestamp: new Date().toISOString()
    });
  });

  // Critical modules whose failure renders the service not-ready (FEAT-10)
  const CRITICAL_MODULES = [
    'DeviceManager',
    'AutomationManager',
    'SecurityManager',
  ];

  /**
   * Ping Redis at REDIS_URL using a raw TCP connection (no redis npm package needed).
   * Returns { ok: true } on success, { ok: false, reason } on failure.
   * If REDIS_URL is unset the check is skipped and treated as passing.
   */
  async function checkRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return { ok: true, skipped: true, reason: 'REDIS_URL not configured' };
    }
    try {
      const { URL: NodeURL } = require('url');
      const net = require('net');
      const parsed = new NodeURL(redisUrl);
      const host = parsed.hostname;
      const port = parseInt(parsed.port || '6379', 10);

      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.write('*1\r\n$4\r\nPING\r\n');
        });
        socket.setTimeout(3000);
        socket.on('data', (data) => {
          socket.destroy();
          if (data.toString().includes('PONG')) {
            resolve();
          } else {
            reject(new Error(`Unexpected Redis response: ${data.toString().trim()}`));
          }
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Redis ping timed out after 3s'));
        });
        socket.on('error', reject);
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * Checks downstream dependencies and self-health for the readiness probe (FEAT-10).
   *
   * Returns:
   *   {
   *     redis: 'ok' | 'unavailable' | 'not_configured',
   *     self: 'ok',
   *     degradedPercentage: number   // 0–100, percentage of degraded modules
   *   }
   */
  async function checkDownstreamHealth() {
    const redisResult = await checkRedis();
    let redisStatus;
    if (redisResult.skipped) {
      redisStatus = 'not_configured';
    } else if (redisResult.ok) {
      redisStatus = 'ok';
    } else {
      redisStatus = 'unavailable';
    }

    const totalSystems = Object.keys(systemStatuses).length;
    const degradedPercentage = totalSystems > 0
      ? Math.round((degradedModules.size / totalSystems) * 100)
      : 0;

    return {
      redis: redisStatus,
      self: 'ok',
      degradedPercentage,
    };
  }

  // Readiness probe — cascade health check (FEAT-10)
  server.get('/ready', async (_req, res) => {
    const downstream = await checkDownstreamHealth();

    // Not ready when more than 50 % of systems are degraded
    const totalSystems = Object.keys(systemStatuses).length;
    const failedCount = degradedModules.size;
    const systemsHealthy = totalSystems > 0 && failedCount < totalSystems * 0.5;

    // Every critical module must be ok
    const criticalStatus = {};
    let criticalOk = true;
    for (const mod of CRITICAL_MODULES) {
      const info = systemStatuses[mod];
      const isOk = info && info.status === 'ok';
      criticalStatus[mod] = isOk ? 'ok' : (info ? info.status : 'missing');
      if (!isOk) criticalOk = false;
    }

    // Redis failure (when configured) blocks readiness
    const redisOk = downstream.redis !== 'unavailable';

    const isReady = systemsHealthy && criticalOk && redisOk;

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      downstream,
      criticalModules: { ok: criticalOk, modules: criticalStatus },
      systems: { ok: systemsHealthy, total: totalSystems, failed: failedCount },
      timestamp: new Date().toISOString()
    });
  });

  // API info endpoint
  server.get('/api/v1/info', (_req, res) => {
    res.json({
      name: 'Smart Home Pro API',
      version: pkg.version,
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      features: [
        'home-automation', 'energy-management', 'security',
        'climate-control', 'predictive-analytics', 'ai-orchestration',
        'voice-control', 'geofencing', 'multi-user'
      ],
      docs: '/api/v1/docs',
      timestamp: new Date().toISOString()
    });
  });

  let routeCount = 0;

  // ── Prometheus Metrics Endpoint ──
  server.get('/metrics', (_req, res) => {
    const mem = process.memoryUsage();
    const okCount = Object.values(systemStatuses).filter(s => s.status === 'ok').length;
    const failedCount = Object.values(systemStatuses).filter(s => s.status === 'failed').length;

    const lines = [
      '# HELP smarthome_uptime_seconds Process uptime in seconds',
      '# TYPE smarthome_uptime_seconds gauge',
      `smarthome_uptime_seconds ${process.uptime().toFixed(1)}`,
      '',
      '# HELP smarthome_systems_total Total number of systems',
      '# TYPE smarthome_systems_total gauge',
      `smarthome_systems_total ${systemCount}`,
      '',
      '# HELP smarthome_systems_ok Systems initialized successfully',
      '# TYPE smarthome_systems_ok gauge',
      `smarthome_systems_ok ${okCount}`,
      '',
      '# HELP smarthome_systems_failed Systems that failed to initialize',
      '# TYPE smarthome_systems_failed gauge',
      `smarthome_systems_failed ${failedCount}`,
      '',
      '# HELP smarthome_memory_rss_bytes Resident set size in bytes',
      '# TYPE smarthome_memory_rss_bytes gauge',
      `smarthome_memory_rss_bytes ${mem.rss}`,
      '',
      '# HELP smarthome_memory_heap_used_bytes Heap used in bytes',
      '# TYPE smarthome_memory_heap_used_bytes gauge',
      `smarthome_memory_heap_used_bytes ${mem.heapUsed}`,
      '',
      '# HELP smarthome_memory_heap_total_bytes Total heap in bytes',
      '# TYPE smarthome_memory_heap_total_bytes gauge',
      `smarthome_memory_heap_total_bytes ${mem.heapTotal}`,
      '',
      '# HELP smarthome_api_routes_total Number of registered API routes',
      '# TYPE smarthome_api_routes_total gauge',
      `smarthome_api_routes_total ${routeCount}`,
      ''
    ];

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n'));
  });

  server.get('/api/v1/stats', (_req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
      platform: 'Smart Home Pro (Standalone)',
      version: pkg.version,
      uptime: process.uptime(),
      bootDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      systems: {
        total: systemCount,
        ok: Object.values(systemStatuses).filter(s => s.status === 'ok').length,
        failed: Object.values(systemStatuses).filter(s => s.status === 'failed').length,
        skipped: Object.values(systemStatuses).filter(s => s.status === 'skipped').length
      },
      memory: {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`
      },
      timestamp: new Date().toISOString()
    });
  });

  // ── Auto-generate API routes from app.json + api.js ──
  const apiHandlers = require('./api.js');
  const appManifest = require('./app.json');
  const apiDefs = appManifest.api || {};

  const methodMap = { GET: 'get', POST: 'post', PUT: 'put', DELETE: 'delete', PATCH: 'patch' };

  for (const [fnName, def] of Object.entries(apiDefs)) {
    const handler = apiHandlers[fnName];
    if (!handler || typeof handler !== 'function') {
      logger.warn({ endpoint: fnName }, 'No handler found for API endpoint — skipping');
      continue;
    }

    const method = methodMap[(def.method || 'GET').toUpperCase()];
    if (!method) continue;

    const path = `/api${def.path}`;

    server[method](path, async (req, res) => {
      try {
        const result = await handler({
          homey,
          params: req.params,
          body: req.body,
          query: req.query
        });
        res.json(result);
      } catch (err) {
        // Validation errors thrown by API handlers carry a statusCode property
        if (err.statusCode >= 400 && err.statusCode < 500) {
          return res.status(err.statusCode).json({
            error: err.message,
            timestamp: new Date().toISOString(),
          });
        }
        logger.error({ endpoint: fnName, err: err.message }, 'API handler error');
        const isProduction = process.env.NODE_ENV === 'production';
        res.status(500).json({
          error: 'Internal server error',
          ...(isProduction ? {} : { endpoint: fnName, message: err.message }),
          timestamp: new Date().toISOString()
        });
      }
    });

    routeCount++;
  }

  logger.info({ routeCount }, 'API routes registered from app.json definitions');

  // ── OpenAPI / Swagger documentation ──
  const { specs, swaggerUi } = require('./lib/swagger');
  server.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));
  // Serve raw spec as JSON for external tooling
  server.get('/api/docs.json', (_req, res) => res.json(specs));
  logger.info('API docs available at /api/docs');

    // ── Error handling middleware ──
  server.use((err, _req, res, _next) => {
    logger.error({ err }, 'Unhandled middleware error');
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  // ── 404 handler ──
  server.use((_req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'The requested endpoint does not exist',
      timestamp: new Date().toISOString()
    });
  });

  // ── Graceful shutdown ──
  const gracefulShutdown = async (signal) => {
    logger.info({ signal }, 'Signal received — shutting down gracefully');

    // Collect all destroyable systems from the app object
    const destroyables = Object.entries(smartApp)
      .filter(([_, sys]) => sys && typeof sys === 'object' && typeof sys.destroy === 'function')
      .map(([name, sys]) => ({ name, sys }));

    logger.info({ count: destroyables.length }, 'Destroying systems');

    // Destroy the event scheduler first (async with timeout)
    if (smartApp.unifiedEventScheduler && smartApp.unifiedEventScheduler.destroy) {
      try {
        await smartApp.unifiedEventScheduler.destroy(5000);
      } catch (e) {
        logger.error({ err: e.message }, 'Error destroying UnifiedEventScheduler');
      }
    }

    // Destroy remaining systems (BaseSystem.destroy is async — must be awaited)
    const remainingDestroyPromises = destroyables
      .filter(({ sys }) => sys !== smartApp.unifiedEventScheduler)
      .map(({ name, sys }) =>
        Promise.resolve(sys.destroy()).catch((e) => {
          logger.error({ module: name, err: e.message }, 'Error during system destroy');
        })
      );
    await Promise.allSettled(remainingDestroyPromises);

    logger.info('Cleanup complete. Exiting.');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ── Listen ──
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    const bootSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('╔══════════════════════════════════════════════╗');
    logger.info(`Smart Home Pro v${pkg.version} listening on port ${PORT}`);
    logger.info({ port: PORT, version: pkg.version, bootSeconds, systemCount, routeCount }, 'Server started');
    logger.info(`Health:   http://localhost:${PORT}/health`);
    logger.info(`Ready:    http://localhost:${PORT}/ready`);
    logger.info(`Stats:    http://localhost:${PORT}/api/v1/stats`);
    logger.info(`Info:     http://localhost:${PORT}/api/v1/info`);
    logger.info(`Systems:  http://localhost:${PORT}/health/systems`);
    logger.info('╚══════════════════════════════════════════════╝');
  });
}

// ── Entry point ──
startServer().catch((err) => {
  logger.fatal({ err }, 'Fatal error during server boot');
  process.exit(1);
});
