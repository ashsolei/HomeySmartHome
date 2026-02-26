'use strict';

/**
 * lib/index.js — Domain-grouped barrel exports for homey-app/lib/
 *
 * Modules are organized into domain objects so consumers can import by domain:
 *   const { energy, security } = require('./lib');
 *   const { EnergyForecastingEngine } = require('./lib').energy;
 *
 * No files have been moved; all require() paths resolve to the flat lib/ directory.
 * See lib/README.md for the full domain classification and migration path.
 */

// ─── core ─────────────────────────────────────────────────────────────────────
// Central orchestration, scene management, AI inference, and multi-user support
const core = {
  AdvancedAutomationEngine:         require('./AdvancedAutomationEngine'),
  AdvancedSceneTemplateSystem:      require('./AdvancedSceneTemplateSystem'),
  SceneLearningSystem:              require('./SceneLearningSystem'),
  AmbientIntelligenceSystem:        require('./AmbientIntelligenceSystem'),
  MoodActivityDetectionSystem:      require('./MoodActivityDetectionSystem'),
  IntelligenceManager:              require('./IntelligenceManager'),
  IntelligentDashboard:             require('./IntelligentDashboard'),
  AdvancedAnalytics:                require('./AdvancedAnalytics'),
  MultiUserPreferenceSystem:        require('./MultiUserPreferenceSystem'),
  SmartSchedulingSystem:            require('./SmartSchedulingSystem'),
  SmartHomeAdaptiveLearningSystem:  require('./SmartHomeAdaptiveLearningSystem'),
  SmartHomeDigitalTwinSystem:       require('./SmartHomeDigitalTwinSystem'),
  CrossHomeSynchronizationSystem:   require('./CrossHomeSynchronizationSystem'),
  IntegrationHub:                   require('./IntegrationHub'),
  SmartSeasonalAdaptationSystem:    require('./SmartSeasonalAdaptationSystem'),
  NaturalLanguageAutomationEngine:  require('./NaturalLanguageAutomationEngine'),
  AdvancedAIPredictionEngine:       require('./AdvancedAIPredictionEngine'),
  CrossSystemAIOrchestrationHub:    require('./CrossSystemAIOrchestrationHub'),
  DeepLearningVisionSystem:         require('./DeepLearningVisionSystem'),
  SmartHomeAutomatedTestingSystem:  require('./SmartHomeAutomatedTestingSystem'),
};

// ─── energy ───────────────────────────────────────────────────────────────────
// Generation, storage, trading, billing, auditing, and sustainability tracking
const energy = {
  EnergyForecastingEngine:              require('./EnergyForecastingEngine'),
  EnergyStorageManagementSystem:        require('./EnergyStorageManagementSystem'),
  AdvancedEnergyTradingSystem:          require('./AdvancedEnergyTradingSystem'),
  SolarEnergyOptimizationSystem:        require('./SolarEnergyOptimizationSystem'),
  SmartRoofSolarMonitoringSystem:       require('./SmartRoofSolarMonitoringSystem'),
  EnergyBillingAnalyticsSystem:         require('./EnergyBillingAnalyticsSystem'),
  HomeEnergyAuditSystem:                require('./HomeEnergyAuditSystem'),
  PowerContinuityUPSSystem:             require('./PowerContinuityUPSSystem'),
  HomeSustainabilityTrackerSystem:      require('./HomeSustainabilityTrackerSystem'),
  SmartEVChargingManagementSystem:      require('./SmartEVChargingManagementSystem'),
  VehicleIntegrationSystem:             require('./VehicleIntegrationSystem'),
};

// ─── security ─────────────────────────────────────────────────────────────────
// Intrusion detection, locks, perimeter, drones, cameras, and network security
const security = {
  AdvancedSecuritySystem:                   require('./AdvancedSecuritySystem'),
  SmartLockManagementSystem:                require('./SmartLockManagementSystem'),
  SmartDoorbellIntercomSystem:              require('./SmartDoorbellIntercomSystem'),
  SmartPerimeterManagementSystem:           require('./SmartPerimeterManagementSystem'),
  HomeSecurityDroneSystem:                  require('./HomeSecurityDroneSystem'),
  GeofencingEngine:                         require('./GeofencingEngine'),
  AdvancedHomeNetworkSecuritySystem:        require('./AdvancedHomeNetworkSecuritySystem'),
  APIAuthenticationGateway:                 require('./APIAuthenticationGateway'),
  VisitorGuestManagementSystem:             require('./VisitorGuestManagementSystem'),
  AdvancedGuestEntertainmentSystem:         require('./AdvancedGuestEntertainmentSystem'),
  AuditLogSystem:                           require('./AuditLogSystem'),
  SmartHomeInsuranceRiskAssessmentSystem:   require('./SmartHomeInsuranceRiskAssessmentSystem'),
};

// ─── climate ──────────────────────────────────────────────────────────────────
// HVAC, ventilation, heating, cooling, air quality, water, and irrigation
const climate = {
  AirQualityManagementSystem:                   require('./AirQualityManagementSystem'),
  AdvancedAirPurificationSystem:                require('./AdvancedAirPurificationSystem'),
  AdvancedAirQualityVentilationControlSystem:   require('./AdvancedAirQualityVentilationControlSystem'),
  SmartHVACZoneControlSystem:                   require('./SmartHVACZoneControlSystem'),
  SmartHomeVentilationHeatRecoverySystem:       require('./SmartHomeVentilationHeatRecoverySystem'),
  SmartFloorHeatingControlSystem:               require('./SmartFloorHeatingControlSystem'),
  SmartFireplaceManagementSystem:               require('./SmartFireplaceManagementSystem'),
  SmartWaterManagementSystem:                   require('./SmartWaterManagementSystem'),
  HomeWaterLeakProtectionSystem:                require('./HomeWaterLeakProtectionSystem'),
  SmartIrrigationWaterConservationSystem:       require('./SmartIrrigationWaterConservationSystem'),
  AdvancedWeatherIntegration:                   require('./AdvancedWeatherIntegration'),
  SmartWeatherStationSystem:                    require('./SmartWeatherStationSystem'),
};

// ─── automation ───────────────────────────────────────────────────────────────
// Physical device control, scene execution, and scheduling primitives
const automation = {
  SmartApplianceController:         require('./SmartApplianceController'),
  SmartBlindsShutterControlSystem:  require('./SmartBlindsShutterControlSystem'),
  SmartWindowManagementSystem:      require('./SmartWindowManagementSystem'),
  SmartFurnitureControlSystem:      require('./SmartFurnitureControlSystem'),
  IndoorLightingSceneEngine:        require('./IndoorLightingSceneEngine'),
  SmartCircadianLightingSystem:     require('./SmartCircadianLightingSystem'),
  OutdoorLightingScenarios:         require('./OutdoorLightingScenarios'),
  RoomOccupancyMappingSystem:       require('./RoomOccupancyMappingSystem'),
  VoiceControlSystem:               require('./VoiceControlSystem'),
  AIVoiceAssistantIntegration:      require('./AIVoiceAssistantIntegration'),
  AdvancedNotificationManager:      require('./AdvancedNotificationManager'),
  SmartGarageManagementSystem:      require('./SmartGarageManagementSystem'),
  AdvancedKitchenAutomationSystem:  require('./AdvancedKitchenAutomationSystem'),
  HomeCleaningAutomationSystem:     require('./HomeCleaningAutomationSystem'),
  SmartHomePredictiveCleaningSystem: require('./SmartHomePredictiveCleaningSystem'),
  SmartLaundryManagementSystem:     require('./SmartLaundryManagementSystem'),
  HomeRoboticsOrchestrationSystem:  require('./HomeRoboticsOrchestrationSystem'),
};

// ─── lifestyle ────────────────────────────────────────────────────────────────
// Sleep, fitness, nutrition, wardrobe, children, pets, and personal wellness
const lifestyle = {
  WellnessSleepOptimizer:           require('./WellnessSleepOptimizer'),
  AdvancedSleepEnvironmentSystem:   require('./AdvancedSleepEnvironmentSystem'),
  AdvancedWakeUpRoutineSystem:      require('./AdvancedWakeUpRoutineSystem'),
  HomeGymFitnessSystem:             require('./HomeGymFitnessSystem'),
  HomeNutritionWellnessSystem:      require('./HomeNutritionWellnessSystem'),
  AdvancedBabyAndChildCareSystem:   require('./AdvancedBabyAndChildCareSystem'),
  HomeChildEducationSystem:         require('./HomeChildEducationSystem'),
  PetCareAutomationSystem:          require('./PetCareAutomationSystem'),
  SmartPetDoorActivitySystem:       require('./SmartPetDoorActivitySystem'),
  SmartWardrobeManagementSystem:    require('./SmartWardrobeManagementSystem'),
  HomeDigitalWellnessSystem:        require('./HomeDigitalWellnessSystem'),
  SmartNoiseManagementSystem:       require('./SmartNoiseManagementSystem'),
};

// ─── monitoring ───────────────────────────────────────────────────────────────
// Health monitoring, performance, logging, audit, and predictive maintenance
const monitoring = {
  DeviceHealthMonitor:                      require('./DeviceHealthMonitor'),
  PredictiveMaintenanceScheduler:           require('./PredictiveMaintenanceScheduler'),
  SystemHealthDashboard:                    require('./SystemHealthDashboard'),
  PerformanceOptimizer:                     require('./PerformanceOptimizer'),
  MemoryGuardSystem:                        require('./MemoryGuardSystem'),
  BackupRecoverySystem:                     require('./BackupRecoverySystem'),
  ErrorHandlingMiddleware:                  require('./ErrorHandlingMiddleware'),
  SmartDisasterResilienceSystem:            require('./SmartDisasterResilienceSystem'),
  HomeEmergencyResponseSystem:              require('./HomeEmergencyResponseSystem'),
  SmartMirrorDashboardSystem:               require('./SmartMirrorDashboardSystem'),
  SmartHomeInsuranceRiskAssessmentSystem:   require('./SmartHomeInsuranceRiskAssessmentSystem'),
  AuditLogSystem:                           require('./AuditLogSystem'),
};

// ─── infrastructure ───────────────────────────────────────────────────────────
// Caching, event scheduling, base classes, auth, and shared utilities
const infrastructure = {
  BaseSystem:               require('./utils/BaseSystem').BaseSystem,
  CentralizedCacheManager:  require('./utils/CentralizedCacheManager').CentralizedCacheManager,
  TTL_LEVELS:               require('./utils/CentralizedCacheManager').TTL_LEVELS,
  UnifiedEventScheduler:    require('./utils/UnifiedEventScheduler').UnifiedEventScheduler,
  SystemOptimizer:          require('./utils/SystemOptimizer').SystemOptimizer,
  optimizeSystem:           require('./utils/SystemOptimizer').optimizeSystem,
  HomeyShim:                require('./utils/HomeyShim'),
  ManagerStubs:             require('./utils/ManagerStubs'),
  APIAuthenticationGateway: require('./APIAuthenticationGateway'),
  IntegrationHub:           require('./IntegrationHub'),
  swagger:                  require('./swagger'),
  logger:                   require('./logger'),
};

// ─── entertainment ────────────────────────────────────────────────────────────
// Home theater, audio, AV, bars, spas, and guest entertainment
const entertainment = {
  SmartHomeTheaterSystem:           require('./SmartHomeTheaterSystem'),
  AdvancedAVAutomation:             require('./AdvancedAVAutomation'),
  AdvancedMusicAudioSystem:         require('./AdvancedMusicAudioSystem'),
  HomeSpaAndSaunaSystem:            require('./HomeSpaAndSaunaSystem'),
  HomeBarManagementSystem:          require('./HomeBarManagementSystem'),
  WineCellarManagementSystem:       require('./WineCellarManagementSystem'),
  PoolSpaManagementSystem:          require('./PoolSpaManagementSystem'),
  AdvancedGuestEntertainmentSystem: require('./AdvancedGuestEntertainmentSystem'),
  HomeOfficeOptimizationSystem:     require('./HomeOfficeOptimizationSystem'),
  HomeOfficeProductivityHub:        require('./HomeOfficeProductivityHub'),
};

// ─── outdoor ──────────────────────────────────────────────────────────────────
// Garden, outdoor spaces, vehicles, and neighborhood integration
const outdoor = {
  GardenPlantCareSystem:                    require('./GardenPlantCareSystem'),
  AdvancedIndoorPlantCareSystem:            require('./AdvancedIndoorPlantCareSystem'),
  SmartCompostingGardenSystem:              require('./SmartCompostingGardenSystem'),
  SmartIrrigationWaterConservationSystem:   require('./SmartIrrigationWaterConservationSystem'),
  OutdoorLightingScenarios:                 require('./OutdoorLightingScenarios'),
  VehicleIntegrationSystem:                 require('./VehicleIntegrationSystem'),
  SmartEVChargingManagementSystem:          require('./SmartEVChargingManagementSystem'),
  PoolSpaManagementSystem:                  require('./PoolSpaManagementSystem'),
  AdvancedNeighborhoodIntegrationSystem:    require('./AdvancedNeighborhoodIntegrationSystem'),
  AdvancedPackageDeliveryManagementSystem:  require('./AdvancedPackageDeliveryManagementSystem'),
  MailboxPackageTrackingSystem:             require('./MailboxPackageTrackingSystem'),
  SmartWasteManagementSystem:               require('./SmartWasteManagementSystem'),
  SmartRoofSolarMonitoringSystem:           require('./SmartRoofSolarMonitoringSystem'),
  HomeWorkshopSafetySystem:                 require('./HomeWorkshopSafetySystem'),
  SmartAquariumManagementSystem:            require('./SmartAquariumManagementSystem'),
  HomeLibraryManagementSystem:              require('./HomeLibraryManagementSystem'),
  HomeAccessibilityElderlyCareSystem:       require('./HomeAccessibilityElderlyCareSystem'),
  SmartFoodPantryManagementSystem:          require('./SmartFoodPantryManagementSystem'),
};

module.exports = {
  core,
  energy,
  security,
  climate,
  automation,
  lifestyle,
  monitoring,
  infrastructure,
  entertainment,
  outdoor,
};
