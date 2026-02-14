'use strict';
require('dotenv').config();

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

// ============================================
// BOOT SEQUENCE
// ============================================

const startTime = Date.now();
const systemStatuses = {};

// ── Process error handlers ──
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

async function boot() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Smart Home Pro — Standalone Server Boot    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

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
    log: (...args) => console.log('[App]', ...args),
    error: (...args) => console.error('[App]', ...args),

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
  ];

  // 6. Initialize all systems with Promise.allSettled for resilience
  console.log(`\nInitializing ${allSystems.length} systems…`);

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
      .then(() => { systemStatuses[name] = { status: 'ok' }; })
      .catch((err) => {
        systemStatuses[name] = { status: 'failed', error: err.message };
        throw err; // rethrow so allSettled marks it as rejected
      });
  });

  const results = await Promise.allSettled(initPromises);

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`\n✅ ${succeeded} systems initialized successfully`);
  if (failed > 0) {
    console.log(`⚠️  ${failed} systems failed to initialize:`);
    for (const [name, info] of Object.entries(systemStatuses)) {
      if (info.status === 'failed') {
        console.log(`   ✗ ${name}: ${info.error}`);
      }
    }
  }
  console.log('');

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
        console.warn(`⚠ WARNING: ${key} is not set. Using insecure defaults.`);
      }
    }
  }

  const server = express();

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
    keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip,
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

  // Request ID + structured logging
  server.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: req.id,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip
      }));
    });
    next();
  });

  // ── Health Endpoints ──
  const pkg = require('./package.json');

  server.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: pkg.version,
      uptime: process.uptime(),
      systemCount,
      timestamp: new Date().toISOString()
    });
  });

  server.get('/health/systems', (_req, res) => {
    res.json(systemStatuses);
  });

  // Readiness probe for Kubernetes / Docker
  server.get('/ready', (_req, res) => {
    const failedCount = Object.values(systemStatuses).filter(s => s.status === 'failed').length;
    const totalSystems = Object.keys(systemStatuses).length;
    const isReady = totalSystems > 0 && failedCount < totalSystems * 0.5;
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      systems: { total: totalSystems, failed: failedCount },
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
      console.log(`  ⚠ No handler found for API: ${fnName}`);
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
        console.error(`[API Error] ${fnName}:`, err.message);
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

  console.log(`📡 ${routeCount} API routes registered from app.json definitions`);

  // ── Error handling middleware ──
  server.use((err, _req, res, _next) => {
    console.error(`[Unhandled Error] ${err.message}`);
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
    console.log(`\n${signal} received — shutting down gracefully…`);

    // Collect all destroyable systems from the app object
    const destroyables = Object.entries(smartApp)
      .filter(([_, sys]) => sys && typeof sys === 'object' && typeof sys.destroy === 'function')
      .map(([name, sys]) => ({ name, sys }));

    console.log(`Destroying ${destroyables.length} systems…`);

    // Destroy the event scheduler first (async with timeout)
    if (smartApp.unifiedEventScheduler && smartApp.unifiedEventScheduler.destroy) {
      try {
        await smartApp.unifiedEventScheduler.destroy(5000);
      } catch (e) {
        console.error('Error destroying UnifiedEventScheduler:', e.message);
      }
    }

    // Destroy remaining systems
    for (const { name, sys } of destroyables) {
      if (sys === smartApp.unifiedEventScheduler) continue; // already handled
      try {
        sys.destroy();
      } catch (e) {
        console.error(`Error destroying ${name}:`, e.message);
      }
    }

    console.log('Cleanup complete. Exiting.');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ── Listen ──
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    const bootSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log(`║  🏠 Smart Home Pro v${pkg.version} on port ${String(PORT).padEnd(5)}  ║`);
    console.log(`║  ⏱  Boot time: ${bootSeconds.padEnd(30)}║`);
    console.log(`║  📊 Systems: ${String(systemCount).padEnd(32)}║`);
    console.log(`║  📡 API routes: ${String(routeCount).padEnd(29)}║`);
    console.log(`║  🛡️  Rate limiting: enabled${' '.repeat(19)}║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log(`Health:   http://localhost:${PORT}/health`);
    console.log(`Ready:    http://localhost:${PORT}/ready`);
    console.log(`Stats:    http://localhost:${PORT}/api/v1/stats`);
    console.log(`Info:     http://localhost:${PORT}/api/v1/info`);
    console.log(`Systems:  http://localhost:${PORT}/health/systems`);
    console.log('');
  });
}

// ── Entry point ──
startServer().catch((err) => {
  console.error('Fatal error during server boot:', err);
  process.exit(1);
});
