'use strict';

const Homey = require('homey');
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
// Sixth wave of autonomous features
const SmartHomeTheaterSystem = require('./lib/SmartHomeTheaterSystem');
const AdvancedKitchenAutomationSystem = require('./lib/AdvancedKitchenAutomationSystem');
const HomeSpaAndSaunaSystem = require('./lib/HomeSpaAndSaunaSystem');
const SmartWardrobeManagementSystem = require('./lib/SmartWardrobeManagementSystem');
const HomeBarManagementSystem = require('./lib/HomeBarManagementSystem');
const AdvancedBabyAndChildCareSystem = require('./lib/AdvancedBabyAndChildCareSystem');
const HomeCleaningAutomationSystem = require('./lib/HomeCleaningAutomationSystem');
const SmartGarageManagementSystem = require('./lib/SmartGarageManagementSystem');
// Seventh wave of autonomous features - Home, Hobbies & Lifestyle
const SmartLaundryManagementSystem = require('./lib/SmartLaundryManagementSystem');
const HomeWorkshopSafetySystem = require('./lib/HomeWorkshopSafetySystem');
const AdvancedMusicAudioSystem = require('./lib/AdvancedMusicAudioSystem');
const SmartAquariumManagementSystem = require('./lib/SmartAquariumManagementSystem');
const HomeOfficeProductivityHub = require('./lib/HomeOfficeProductivityHub');
const AdvancedIndoorPlantCareSystem = require('./lib/AdvancedIndoorPlantCareSystem');
const SmartPetDoorActivitySystem = require('./lib/SmartPetDoorActivitySystem');
const HomeLibraryManagementSystem = require('./lib/HomeLibraryManagementSystem');
// Eighth wave of autonomous features - Home Safety, Security & Infrastructure
const SolarEnergyOptimizationSystem = require('./lib/SolarEnergyOptimizationSystem');
const HomeEmergencyResponseSystem = require('./lib/HomeEmergencyResponseSystem');
const AdvancedHomeNetworkSecuritySystem = require('./lib/AdvancedHomeNetworkSecuritySystem');
const SmartIrrigationWaterConservationSystem = require('./lib/SmartIrrigationWaterConservationSystem');
const AdvancedAirQualityVentilationControlSystem = require('./lib/AdvancedAirQualityVentilationControlSystem');
const HomeAccessibilityElderlyCareSystem = require('./lib/HomeAccessibilityElderlyCareSystem');
const AdvancedPackageDeliveryManagementSystem = require('./lib/AdvancedPackageDeliveryManagementSystem');
const SmartHomeInsuranceRiskAssessmentSystem = require('./lib/SmartHomeInsuranceRiskAssessmentSystem');
// Ninth wave of autonomous features - AI & Advanced Integration
const AdvancedAIPredictionEngine = require('./lib/AdvancedAIPredictionEngine');
const CrossSystemAIOrchestrationHub = require('./lib/CrossSystemAIOrchestrationHub');
// Tenth wave of autonomous features - Deep Learning & NLP
const DeepLearningVisionSystem = require('./lib/DeepLearningVisionSystem');
const NaturalLanguageAutomationEngine = require('./lib/NaturalLanguageAutomationEngine');
// System optimizer
const { SystemOptimizer, optimizeSystem } = require('./lib/utils/SystemOptimizer');
// Wave 11 - Infrastructure & Optimization Systems
const { BaseSystem } = require('./lib/utils/BaseSystem');
const { CentralizedCacheManager, TTL_LEVELS } = require('./lib/utils/CentralizedCacheManager');
const { UnifiedEventScheduler } = require('./lib/utils/UnifiedEventScheduler');
const ErrorHandlingMiddleware = require('./lib/ErrorHandlingMiddleware');
const MemoryGuardSystem = require('./lib/MemoryGuardSystem');
const APIAuthenticationGateway = require('./lib/APIAuthenticationGateway');
const SystemHealthDashboard = require('./lib/SystemHealthDashboard');

class SmartHomeProApp extends Homey.App {
  
  async onInit() {
    this.log('Smart Home Pro initializing...');
    
    // Initialize stores
    this.scenes = {};
    this.routines = {};
    this.securityMode = 'disarmed';
    this.nightMode = false;
    this.energySavingMode = false;
    this.presenceData = {};
    
    // Initialize managers
    await this.initializeManagers();
    
    // Register flow cards
    await this.registerFlowCards();
    
    // Start monitoring services
    await this.startMonitoring();
    
    // Load saved data
    await this.loadSavedData();
    
    this.log('Smart Home Pro initialized successfully!');
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async initializeManagers() {
    this.deviceManager = new DeviceManager(this);
    this.sceneManager = new SceneManager(this);
    this.automationManager = new AutomationManager(this);
    this.energyManager = new EnergyManager(this);
    this.securityManager = new SecurityManager(this);
    this.climateManager = new ClimateManager(this);
    this.presenceManager = new PresenceManager(this);
    this.notificationManager = new NotificationManager(this);
    
    // Advanced features
    this.automationEngine = new AdvancedAutomationEngine(this.homey);
    this.intelligentDashboard = new IntelligentDashboard(this.homey);
    this.intelligenceManager = new IntelligenceManager(this.homey);
    this.advancedAnalytics = new AdvancedAnalytics(this.homey);
    
    // New advanced features (autonomous expansion)
    this.voiceControlSystem = new VoiceControlSystem(this.homey);
    this.geofencingEngine = new GeofencingEngine(this.homey);
    this.sceneLearningSystem = new SceneLearningSystem(this.homey);
    this.advancedNotificationManager = new AdvancedNotificationManager(this.homey);
    this.deviceHealthMonitor = new DeviceHealthMonitor(this.homey);
    this.energyForecastingEngine = new EnergyForecastingEngine(this.homey);
    this.smartSchedulingSystem = new SmartSchedulingSystem(this.homey);
    this.integrationHub = new IntegrationHub(this.homey);
    this.multiUserPreferenceSystem = new MultiUserPreferenceSystem(this.homey);
    
    // Second wave of autonomous features
    this.backupRecoverySystem = new BackupRecoverySystem(this.homey);
    this.performanceOptimizer = new PerformanceOptimizer(this.homey);
    this.ambientIntelligenceSystem = new AmbientIntelligenceSystem(this.homey);
    this.moodActivityDetectionSystem = new MoodActivityDetectionSystem(this.homey);
    this.energyStorageManagementSystem = new EnergyStorageManagementSystem(this.homey);
    this.advancedSceneTemplateSystem = new AdvancedSceneTemplateSystem(this.homey);
    this.predictiveMaintenanceScheduler = new PredictiveMaintenanceScheduler(this.homey);
    this.crossHomeSynchronizationSystem = new CrossHomeSynchronizationSystem(this.homey);
    
    // Third wave of autonomous features
    this.smartWaterManagementSystem = new SmartWaterManagementSystem(this.homey);
    this.airQualityManagementSystem = new AirQualityManagementSystem(this.homey);
    this.advancedSecuritySystem = new AdvancedSecuritySystem(this.homey);
    this.wellnessSleepOptimizer = new WellnessSleepOptimizer(this.homey);
    this.smartApplianceController = new SmartApplianceController(this.homey);
    this.gardenPlantCareSystem = new GardenPlantCareSystem(this.homey);
    this.aiVoiceAssistantIntegration = new AIVoiceAssistantIntegration(this.homey);
    this.smartLockManagementSystem = new SmartLockManagementSystem(this.homey);
    
    // Fourth wave of autonomous features
    this.petCareAutomationSystem = new PetCareAutomationSystem(this.homey);
    this.advancedWeatherIntegration = new AdvancedWeatherIntegration(this.homey);
    this.smartWasteManagementSystem = new SmartWasteManagementSystem(this.homey);
    this.vehicleIntegrationSystem = new VehicleIntegrationSystem(this.homey);
    this.advancedAVAutomation = new AdvancedAVAutomation(this.homey);
    this.outdoorLightingScenarios = new OutdoorLightingScenarios(this.homey);
    this.poolSpaManagementSystem = new PoolSpaManagementSystem(this.homey);
    this.advancedEnergyTradingSystem = new AdvancedEnergyTradingSystem(this.homey);
    
    // Fifth wave of autonomous features
    this.homeGymFitnessSystem = new HomeGymFitnessSystem(this.homey);
    this.smartWindowManagementSystem = new SmartWindowManagementSystem(this.homey);
    this.wineCellarManagementSystem = new WineCellarManagementSystem(this.homey);
    this.advancedWakeUpRoutineSystem = new AdvancedWakeUpRoutineSystem(this.homey);
    this.mailboxPackageTrackingSystem = new MailboxPackageTrackingSystem(this.homey);
    this.advancedAirPurificationSystem = new AdvancedAirPurificationSystem(this.homey);
    this.smartFurnitureControlSystem = new SmartFurnitureControlSystem(this.homey);
    this.homeOfficeOptimizationSystem = new HomeOfficeOptimizationSystem(this.homey);
    
    // Sixth wave of autonomous features - Entertainment & Lifestyle
    this.smartHomeTheaterSystem = new SmartHomeTheaterSystem(this.homey);
    this.advancedKitchenAutomationSystem = new AdvancedKitchenAutomationSystem(this.homey);
    this.homeSpaAndSaunaSystem = new HomeSpaAndSaunaSystem(this.homey);
    this.smartWardrobeManagementSystem = new SmartWardrobeManagementSystem(this.homey);
    this.homeBarManagementSystem = new HomeBarManagementSystem(this.homey);
    this.advancedBabyAndChildCareSystem = new AdvancedBabyAndChildCareSystem(this.homey);
    this.homeCleaningAutomationSystem = new HomeCleaningAutomationSystem(this.homey);
    this.smartGarageManagementSystem = new SmartGarageManagementSystem(this.homey);
    
    // Seventh wave of autonomous features - Home, Hobbies & Lifestyle
    this.smartLaundryManagementSystem = new SmartLaundryManagementSystem(this.homey);
    this.homeWorkshopSafetySystem = new HomeWorkshopSafetySystem(this.homey);
    this.advancedMusicAudioSystem = new AdvancedMusicAudioSystem(this.homey);
    this.smartAquariumManagementSystem = new SmartAquariumManagementSystem(this.homey);
    this.homeOfficeProductivityHub = new HomeOfficeProductivityHub(this.homey);
    this.advancedIndoorPlantCareSystem = new AdvancedIndoorPlantCareSystem(this.homey);
    this.smartPetDoorActivitySystem = new SmartPetDoorActivitySystem(this.homey);
    this.homeLibraryManagementSystem = new HomeLibraryManagementSystem(this.homey);
    
    // Eighth wave of autonomous features - Home Safety, Security & Infrastructure
    this.solarEnergyOptimizationSystem = new SolarEnergyOptimizationSystem();
    this.homeEmergencyResponseSystem = new HomeEmergencyResponseSystem();
    this.advancedHomeNetworkSecuritySystem = new AdvancedHomeNetworkSecuritySystem();
    this.smartIrrigationWaterConservationSystem = new SmartIrrigationWaterConservationSystem();
    this.advancedAirQualityVentilationControlSystem = new AdvancedAirQualityVentilationControlSystem();
    this.homeAccessibilityElderlyCareSystem = new HomeAccessibilityElderlyCareSystem();
    this.advancedPackageDeliveryManagementSystem = new AdvancedPackageDeliveryManagementSystem();
    this.smartHomeInsuranceRiskAssessmentSystem = new SmartHomeInsuranceRiskAssessmentSystem();
    
    // Ninth wave of autonomous features - AI & Advanced Integration
    this.advancedAIPredictionEngine = new AdvancedAIPredictionEngine();
    this.crossSystemAIOrchestrationHub = new CrossSystemAIOrchestrationHub();
    
    // Tenth wave of autonomous features - Deep Learning & NLP
    this.deepLearningVisionSystem = new DeepLearningVisionSystem();
    this.naturalLanguageAutomationEngine = new NaturalLanguageAutomationEngine();
    
    // Initialize system optimizer
    this.systemOptimizer = new SystemOptimizer();
    
    // Wave 11 - Infrastructure & Optimization Systems
    this.centralizedCacheManager = CentralizedCacheManager.getInstance({ maxGlobalSize: 10000 });
    this.unifiedEventScheduler = UnifiedEventScheduler.getInstance();
    this.errorHandlingMiddleware = ErrorHandlingMiddleware.getInstance(this.homey);
    this.memoryGuardSystem = MemoryGuardSystem.getInstance();
    this.apiAuthenticationGateway = APIAuthenticationGateway.getInstance();
    this.systemHealthDashboard = new SystemHealthDashboard();

    await Promise.all([
      this.deviceManager.initialize(),
      this.sceneManager.initialize(),
      this.automationManager.initialize(),
      this.energyManager.initialize(),
      this.securityManager.initialize(),
      this.climateManager.initialize(),
      this.presenceManager.initialize(),
      this.automationEngine.initialize(),
      this.intelligentDashboard.initialize(),
      this.intelligenceManager.initialize(),
      this.advancedAnalytics.initialize(),
      this.voiceControlSystem.initialize(),
      this.geofencingEngine.initialize(),
      this.sceneLearningSystem.initialize(),
      this.advancedNotificationManager.initialize(),
      this.deviceHealthMonitor.initialize(),
      this.energyForecastingEngine.initialize(),
      this.smartSchedulingSystem.initialize(),
      this.integrationHub.initialize(),
      this.multiUserPreferenceSystem.initialize(),
      this.backupRecoverySystem.initialize(),
      this.performanceOptimizer.initialize(),
      this.ambientIntelligenceSystem.initialize(),
      this.moodActivityDetectionSystem.initialize(),
      this.energyStorageManagementSystem.initialize(),
      this.advancedSceneTemplateSystem.initialize(),
      this.predictiveMaintenanceScheduler.initialize(),
      this.crossHomeSynchronizationSystem.initialize(),
      this.smartWaterManagementSystem.initialize(),
      this.airQualityManagementSystem.initialize(),
      this.advancedSecuritySystem.initialize(),
      this.wellnessSleepOptimizer.initialize(),
      this.smartApplianceController.initialize(),
      this.gardenPlantCareSystem.initialize(),
      this.aiVoiceAssistantIntegration.initialize(),
      this.smartLockManagementSystem.initialize(),
      this.petCareAutomationSystem.initialize(),
      this.advancedWeatherIntegration.initialize(),
      this.smartWasteManagementSystem.initialize(),
      this.vehicleIntegrationSystem.initialize(),
      this.advancedAVAutomation.initialize(),
      this.outdoorLightingScenarios.initialize(),
      this.poolSpaManagementSystem.initialize(),
      this.advancedEnergyTradingSystem.initialize(),
      this.homeGymFitnessSystem.initialize(),
      this.smartWindowManagementSystem.initialize(),
      this.wineCellarManagementSystem.initialize(),
      this.advancedWakeUpRoutineSystem.initialize(),
      this.mailboxPackageTrackingSystem.initialize(),
      this.advancedAirPurificationSystem.initialize(),
      this.smartFurnitureControlSystem.initialize(),
      this.homeOfficeOptimizationSystem.initialize(),
      this.smartHomeTheaterSystem.initialize(),
      this.advancedKitchenAutomationSystem.initialize(),
      this.homeSpaAndSaunaSystem.initialize(),
      this.smartWardrobeManagementSystem.initialize(),
      this.homeBarManagementSystem.initialize(),
      this.advancedBabyAndChildCareSystem.initialize(),
      this.homeCleaningAutomationSystem.initialize(),
      this.smartGarageManagementSystem.initialize(),
      this.smartLaundryManagementSystem.initialize(),
      this.homeWorkshopSafetySystem.initialize(),
      this.advancedMusicAudioSystem.initialize(),
      this.smartAquariumManagementSystem.initialize(),
      this.homeOfficeProductivityHub.initialize(),
      this.advancedIndoorPlantCareSystem.initialize(),
      this.smartPetDoorActivitySystem.initialize(),
      this.homeLibraryManagementSystem.initialize(),
      this.solarEnergyOptimizationSystem.initialize(),
      this.homeEmergencyResponseSystem.initialize(),
      this.advancedHomeNetworkSecuritySystem.initialize(),
      this.smartIrrigationWaterConservationSystem.initialize(),
      this.advancedAirQualityVentilationControlSystem.initialize(),
      this.homeAccessibilityElderlyCareSystem.initialize(),
      this.advancedPackageDeliveryManagementSystem.initialize(),
      this.smartHomeInsuranceRiskAssessmentSystem.initialize(),
      this.advancedAIPredictionEngine.initialize(),
      this.crossSystemAIOrchestrationHub.initialize(),
      this.deepLearningVisionSystem.initialize(),
      this.naturalLanguageAutomationEngine.initialize()
    ]);
    
    // Wave 11 post-initialization setup
    await this.initializeWave11Infrastructure();
    
    // Setup Wave 9 AI event listeners
    this.setupAIEventListeners();
    
    // Setup Wave 10 Deep Learning event listeners
    this.setupWave10EventListeners();
    
    // Setup Wave 11 Infrastructure event listeners
    this.setupWave11EventListeners();
  }
  
  async initializeWave11Infrastructure() {
    try {
      // Initialize the unified event scheduler
      this.unifiedEventScheduler.start();
      
      // Initialize memory guard
      await this.memoryGuardSystem.initialize();
      
      // Initialize the system health dashboard and register all systems
      await this.systemHealthDashboard.initialize();
      this.registerAllSystemsForHealthMonitoring();
      
      // Register core monitoring tasks with unified scheduler
      this.registerCoreSchedulerTasks();
      
      // Run initial diagnostics
      const diagnostics = await this.systemHealthDashboard.runDiagnostics();
      this.log(`Wave 11 Infrastructure initialized - Platform health: ${diagnostics.overallScore || 'OK'}`);
    } catch (error) {
      this.error('Wave 11 infrastructure initialization error:', error);
    }
  }
  
  registerAllSystemsForHealthMonitoring() {
    const systems = {
      'AdvancedAutomationEngine': this.advancedAutomationEngine,
      'IntelligentDashboard': this.intelligentDashboard,
      'IntelligenceManager': this.intelligenceManager,
      'AdvancedAnalytics': this.advancedAnalytics,
      'VoiceControlSystem': this.voiceControlSystem,
      'GeofencingEngine': this.geofencingEngine,
      'SceneLearningSystem': this.sceneLearningSystem,
      'AirQualityManagement': this.airQualityManagementSystem,
      'SmartWaterManagement': this.smartWaterManagementSystem,
      'SmartApplianceController': this.smartApplianceController,
      'EnergyForecastingEngine': this.energyForecastingEngine,
      'SmartSchedulingSystem': this.smartSchedulingSystem,
      'MultiUserPreference': this.multiUserPreferenceSystem,
      'AdvancedSceneTemplate': this.advancedSceneTemplateSystem,
      'SmartLockManagement': this.smartLockManagementSystem,
      'SmartWindowManagement': this.smartWindowManagementSystem,
      'OutdoorLightingScenarios': this.outdoorLightingScenarios,
      'PoolSpaManagement': this.poolSpaManagementSystem,
      'AdvancedEnergyTrading': this.advancedEnergyTradingSystem,
      'WineCellarManagement': this.wineCellarManagementSystem,
      'MoodActivityDetection': this.moodActivityDetectionSystem,
      'AmbientIntelligence': this.ambientIntelligenceSystem,
      'GardenAutomation': this.gardenAutomationSystem,
      'SmartWasteManagement': this.smartWasteManagementSystem,
      'AdvancedWakeUpRoutine': this.advancedWakeUpRoutineSystem,
      'EVChargingOptimization': this.evChargingOptimizationSystem,
      'HomeGymFitness': this.homeGymFitnessSystem,
      'WeatherAdaptiveHome': this.weatherAdaptiveHomeSystem,
      'SmartPetManagement': this.smartPetManagementSystem,
      'AdvancedSleepOptimization': this.advancedSleepOptimizationSystem,
      'AdvancedWaterLeakPrevention': this.advancedWaterLeakPreventionSystem,
      'MailboxPackageTracking': this.mailboxPackageTrackingSystem,
      'AdvancedAirPurification': this.advancedAirPurificationSystem,
      'SmartFurnitureControl': this.smartFurnitureControlSystem,
      'HomeOfficeOptimization': this.homeOfficeOptimizationSystem,
      'SmartHomeTheater': this.smartHomeTheaterSystem,
      'AdvancedKitchenAutomation': this.advancedKitchenAutomationSystem,
      'HomeSpaAndSauna': this.homeSpaAndSaunaSystem,
      'SmartWardrobeManagement': this.smartWardrobeManagementSystem,
      'HomeBarManagement': this.homeBarManagementSystem,
      'AdvancedBabyAndChildCare': this.advancedBabyAndChildCareSystem,
      'HomeCleaningAutomation': this.homeCleaningAutomationSystem,
      'SmartGarageManagement': this.smartGarageManagementSystem,
      'SmartLaundryManagement': this.smartLaundryManagementSystem,
      'HomeWorkshopSafety': this.homeWorkshopSafetySystem,
      'AdvancedMusicAudio': this.advancedMusicAudioSystem,
      'SmartAquariumManagement': this.smartAquariumManagementSystem,
      'HomeOfficeProductivity': this.homeOfficeProductivityHub,
      'AdvancedIndoorPlantCare': this.advancedIndoorPlantCareSystem,
      'SmartPetDoorActivity': this.smartPetDoorActivitySystem,
      'HomeLibraryManagement': this.homeLibraryManagementSystem,
      'SolarEnergyOptimization': this.solarEnergyOptimizationSystem,
      'HomeEmergencyResponse': this.homeEmergencyResponseSystem,
      'AdvancedHomeNetworkSecurity': this.advancedHomeNetworkSecuritySystem,
      'SmartIrrigationWaterConservation': this.smartIrrigationWaterConservationSystem,
      'AdvancedAirQualityVentilation': this.advancedAirQualityVentilationControlSystem,
      'HomeAccessibilityElderlyCare': this.homeAccessibilityElderlyCareSystem,
      'AdvancedPackageDelivery': this.advancedPackageDeliveryManagementSystem,
      'SmartHomeInsuranceRisk': this.smartHomeInsuranceRiskAssessmentSystem,
      'AdvancedAIPrediction': this.advancedAIPredictionEngine,
      'CrossSystemAIOrchestration': this.crossSystemAIOrchestrationHub,
      'DeepLearningVision': this.deepLearningVisionSystem,
      'NaturalLanguageAutomation': this.naturalLanguageAutomationEngine,
      'CentralizedCacheManager': this.centralizedCacheManager,
      'UnifiedEventScheduler': this.unifiedEventScheduler,
      'ErrorHandlingMiddleware': this.errorHandlingMiddleware,
      'MemoryGuardSystem': this.memoryGuardSystem,
      'APIAuthenticationGateway': this.apiAuthenticationGateway
    };
    
    for (const [name, ref] of Object.entries(systems)) {
      if (ref) {
        this.systemHealthDashboard.registerSystem(name, ref);
      }
    }
    this.log(`Registered ${Object.keys(systems).length} systems for health monitoring`);
  }
  
  registerCoreSchedulerTasks() {
    // Memory monitoring - CRITICAL priority
    this.unifiedEventScheduler.registerTask('memory-monitor', 'CRITICAL', async () => {
      const report = this.memoryGuardSystem.getMemoryReport();
      if (report && report.pressureLevel !== 'normal') {
        this.log(`Memory pressure: ${report.pressureLevel}`);
      }
    }, { enabled: true });
    
    // Health dashboard polling - HIGH priority
    this.unifiedEventScheduler.registerTask('health-poll', 'HIGH', async () => {
      await this.systemHealthDashboard.pollAllSystems();
    }, { enabled: true });
    
    // Error trends analysis - NORMAL priority
    this.unifiedEventScheduler.registerTask('error-trends', 'NORMAL', async () => {
      const report = this.errorHandlingMiddleware.getErrorReport();
      if (report && report.totalErrors > 0) {
        this.log(`Error report: ${report.totalErrors} total errors, ${report.criticalCount || 0} critical`);
      }
    }, { enabled: true });
    
    // Cache optimization - LOW priority
    this.unifiedEventScheduler.registerTask('cache-optimization', 'LOW', async () => {
      const stats = this.centralizedCacheManager.getGlobalStats();
      if (stats && stats.hitRate < 50) {
        this.log(`Cache hit rate low: ${stats.hitRate}%`);
      }
    }, { enabled: true });
    
    // Token cleanup - BACKGROUND priority
    this.unifiedEventScheduler.registerTask('auth-cleanup', 'BACKGROUND', async () => {
      const tokenList = this.apiAuthenticationGateway.listActiveTokens();
      if (tokenList) {
        this.log(`Active auth tokens: ${tokenList.length || 0}`);
      }
    }, { enabled: true });
    
    this.log('Core scheduler tasks registered');
  }
  setupWave10EventListeners() {
    // Deep Learning Vision System events
    this.deepLearningVisionSystem.on('face-detected', (data) => {
      this.log('Face detected:', data);
      this.advancedNotificationManager.sendNotification({
        title: 'Face Detected',
        message: `${data.faces.length} face(s) detected on ${data.cameraId}`,
        priority: 'medium'
      });
    });
    
    this.deepLearningVisionSystem.on('critical-anomaly', (anomaly) => {
      this.log('Critical anomaly detected:', anomaly);
      this.advancedNotificationManager.sendNotification({
        title: 'Security Alert',
        message: anomaly.description,
        priority: 'critical'
      });
    });
    
    this.deepLearningVisionSystem.on('notification', (notification) => {
      this.advancedNotificationManager.sendNotification(notification);
    });
    
    // Natural Language Automation Engine events
    this.naturalLanguageAutomationEngine.on('command-processed', ({ command, result }) => {
      this.log('NLP command processed:', command.rawCommand, '→', result.response);
    });
    
    this.naturalLanguageAutomationEngine.on('notification', (notification) => {
      this.advancedNotificationManager.sendNotification(notification);
    });
  }
  
  setupWave11EventListeners() {
    // Memory Guard events
    this.memoryGuardSystem.on('memory-warning', (data) => {
      this.log('[MemoryGuard] WARNING:', data);
      this.homey.notifications.createNotification({
        excerpt: `Minnesvarning: ${Math.round(data.heapUsed / 1024 / 1024)}MB heap använt`
      }).catch(() => {});
    });
    
    this.memoryGuardSystem.on('memory-critical', (data) => {
      this.error('[MemoryGuard] CRITICAL:', data);
      this.homey.notifications.createNotification({
        excerpt: `Kritiskt minnesläge: ${Math.round(data.heapUsed / 1024 / 1024)}MB heap`
      }).catch(() => {});
    });
    
    this.memoryGuardSystem.on('memory-emergency', (data) => {
      this.error('[MemoryGuard] EMERGENCY:', data);
      this.homey.notifications.createNotification({
        excerpt: 'NÖDSITUATION: Minnet är nästan slut! Icke-kritiska system pausade.'
      }).catch(() => {});
    });
    
    this.memoryGuardSystem.on('leak-detected', (report) => {
      this.error('[MemoryGuard] Potential memory leak detected:', report);
      this.homey.notifications.createNotification({
        excerpt: `Potentiellt minnesläckage upptäckt: ${report.growthRate || 'unknown'} MB/min`
      }).catch(() => {});
    });
    
    // Error Handling Middleware events
    this.errorHandlingMiddleware.on('error-storm', (data) => {
      this.error('[ErrorHandler] Error storm detected:', data);
      this.homey.notifications.createNotification({
        excerpt: `Felstorm upptäckt från ${data.system}: ${data.count} fel på 1 minut`
      }).catch(() => {});
    });
    
    this.errorHandlingMiddleware.on('circuit-open', (data) => {
      this.log('[ErrorHandler] Circuit breaker opened:', data);
    });
    
    // System Health Dashboard events
    this.systemHealthDashboard.on('health-alert', (alert) => {
      if (alert.level === 'CRITICAL') {
        this.homey.notifications.createNotification({
          excerpt: `Systemhälsa: ${alert.message}`
        }).catch(() => {});
      }
    });
    
    this.systemHealthDashboard.on('system-degraded', (data) => {
      this.log(`[HealthDashboard] System degraded: ${data.system || data.name}`);
    });
    
    this.systemHealthDashboard.on('system-recovered', (data) => {
      this.log(`[HealthDashboard] System recovered: ${data.system || data.name}`);
    });
    
    // API Authentication events
    this.apiAuthenticationGateway.on('lockout', (data) => {
      this.error(`[AuthGateway] IP locked out: ${data.ip}`);
      this.homey.notifications.createNotification({
        excerpt: `Säkerhetsvarning: IP ${data.ip} har blivit utelåst efter upprepade misslyckade inloggningsförsök`
      }).catch(() => {});
    });
    
    this.apiAuthenticationGateway.on('suspicious-activity', (data) => {
      this.error('[AuthGateway] Suspicious activity:', data);
      this.homey.notifications.createNotification({
        excerpt: `Misstänkt aktivitet från IP ${data.ip}: ${data.reason || 'multiple failures'}`
      }).catch(() => {});
    });
    
    // Cache Manager events
    this.centralizedCacheManager.on('memoryPressure', (data) => {
      this.log('[CacheManager] Memory pressure:', data);
    });
    
    // Unified Event Scheduler events
    this.unifiedEventScheduler.on('task-timeout', (data) => {
      this.log(`[Scheduler] Task timeout: ${data.taskId || data.id}`);
    });
    
    this.unifiedEventScheduler.on('task-failed', (data) => {
      this.log(`[Scheduler] Task failed: ${data.taskId || data.id}`, data.error?.message);
    });
    
    this.log('Wave 11 event listeners configured successfully');
  }
  
  setupAIEventListeners() {
    // AI Prediction Engine events
    this.advancedAIPredictionEngine.on('notification', async (data) => {
      this.log('[AI Prediction]', data.message);
      
      // Trigger Flow cards based on prediction type
      if (data.type === 'high-energy-predicted') {
        await this.homey.flow.getTriggerCard('ai-prediction-high-energy').trigger({
          predicted_consumption: data.value || 0,
          confidence: data.confidence || 0,
          hours_ahead: data.hoursAhead || 1
        }).catch(err => this.error('Error triggering high-energy flow:', err));
        
        // Send notification to user
        await this.homey.notifications.createNotification({
          excerpt: data.message
        }).catch(err => this.error('Error sending notification:', err));
      }
      
      if (data.type === 'device-failure-predicted') {
        await this.homey.flow.getTriggerCard('ai-device-failure-predicted').trigger({
          device: data.device || 'Unknown',
          urgency: data.urgency || 'low',
          days_until_failure: data.daysUntilFailure || 0,
          probability: data.probability || 0
        }).catch(err => this.error('Error triggering device-failure flow:', err));
        
        await this.homey.notifications.createNotification({
          excerpt: data.message
        }).catch(err => this.error('Error sending notification:', err));
      }
      
      if (data.type === 'arrival-predicted') {
        await this.homey.flow.getTriggerCard('ai-presence-predicted').trigger({
          predicted_time: data.time || 'Unknown',
          confidence: data.confidence || 0
        }).catch(err => this.error('Error triggering presence flow:', err));
      }
    });
    
    // Cross-System AI Orchestration Hub events
    this.crossSystemAIOrchestrationHub.on('notification', async (data) => {
      this.log('[AI Orchestration]', data.message);
      
      if (data.type === 'orchestration-executed') {
        await this.homey.flow.getTriggerCard('orchestration-executed').trigger({
          rule_name: data.rule || 'Unknown',
          actions_count: data.actionsCount || 0,
          energy_saved: data.energySaved || 0
        }).catch(err => this.error('Error triggering orchestration flow:', err));
        
        // Send notification for significant orchestrations
        if (data.energySaved > 10) {
          await this.homey.notifications.createNotification({
            excerpt: `AI orchestration saved ${data.energySaved} SEK in energy costs`
          }).catch(err => this.error('Error sending notification:', err));
        }
      }
      
      if (data.type === 'conflict-detected') {
        await this.homey.flow.getTriggerCard('orchestration-conflict').trigger({
          systems: data.systems || 'Unknown',
          resolution: data.resolution || 'user-preference'
        }).catch(err => this.error('Error triggering conflict flow:', err));
        
        await this.homey.notifications.createNotification({
          excerpt: data.message
        }).catch(err => this.error('Error sending notification:', err));
      }
    });
    
    this.log('AI event listeners configured successfully');
  }

  async loadSavedData() {
    try {
      this.scenes = await this.homey.settings.get('scenes') || this.getDefaultScenes();
      this.routines = await this.homey.settings.get('routines') || this.getDefaultRoutines();
      this.securityMode = await this.homey.settings.get('securityMode') || 'disarmed';
    } catch (error) {
      this.error('Error loading saved data:', error);
    }
  }

  getDefaultScenes() {
    return {
      'morning': {
        id: 'morning',
        name: { en: 'Good Morning', sv: 'God Morgon' },
        actions: [
          { type: 'lights', zone: 'bedroom', brightness: 50 },
          { type: 'lights', zone: 'kitchen', brightness: 100 },
          { type: 'climate', zone: 'all', temperature: 21 }
        ]
      },
      'evening': {
        id: 'evening',
        name: { en: 'Evening', sv: 'Kväll' },
        actions: [
          { type: 'lights', zone: 'living_room', brightness: 40, color: '#FF8C00' },
          { type: 'lights', zone: 'bedroom', brightness: 20 }
        ]
      },
      'night': {
        id: 'night',
        name: { en: 'Good Night', sv: 'God Natt' },
        actions: [
          { type: 'lights', zone: 'all', brightness: 0 },
          { type: 'security', mode: 'night' },
          { type: 'climate', zone: 'bedroom', temperature: 18 }
        ]
      },
      'away': {
        id: 'away',
        name: { en: 'Away', sv: 'Borta' },
        actions: [
          { type: 'lights', zone: 'all', brightness: 0 },
          { type: 'security', mode: 'away' },
          { type: 'climate', zone: 'all', temperature: 16 }
        ]
      },
      'movie': {
        id: 'movie',
        name: { en: 'Movie Time', sv: 'Filmkväll' },
        actions: [
          { type: 'lights', zone: 'living_room', brightness: 10, color: '#4B0082' }
        ]
      },
      'party': {
        id: 'party',
        name: { en: 'Party', sv: 'Fest' },
        actions: [
          { type: 'lights', zone: 'living_room', brightness: 80, effect: 'colorloop' }
        ]
      }
    };
  }

  getDefaultRoutines() {
    return {
      'wake-up': {
        id: 'wake-up',
        name: { en: 'Wake Up Routine', sv: 'Väckningsrutin' },
        trigger: { type: 'time', value: '07:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
        conditions: [{ type: 'presence', value: true }],
        actions: [
          { type: 'scene', sceneId: 'morning', delay: 0 },
          { type: 'notification', message: 'God morgon!', delay: 0 }
        ]
      },
      'leave-home': {
        id: 'leave-home',
        name: { en: 'Leave Home', sv: 'Lämna hemmet' },
        trigger: { type: 'presence', value: 'last_person_left' },
        actions: [
          { type: 'scene', sceneId: 'away', delay: 300 },
          { type: 'check_devices', delay: 60 }
        ]
      },
      'arrive-home': {
        id: 'arrive-home',
        name: { en: 'Arrive Home', sv: 'Kom hem' },
        trigger: { type: 'presence', value: 'first_person_arrived' },
        conditions: [{ type: 'time', range: ['sunset', '23:00'] }],
        actions: [
          { type: 'scene', sceneId: 'evening', delay: 0 },
          { type: 'security', mode: 'disarmed', delay: 0 }
        ]
      },
      'bedtime': {
        id: 'bedtime',
        name: { en: 'Bedtime', sv: 'Läggdags' },
        trigger: { type: 'time', value: '23:00' },
        conditions: [{ type: 'presence', value: true }],
        actions: [
          { type: 'notification', message: 'Dags att sova?', delay: 0 },
          { type: 'scene', sceneId: 'night', delay: 1800, conditional: true }
        ]
      },
      'energy-saving': {
        id: 'energy-saving',
        name: { en: 'Energy Saving', sv: 'Energisparande' },
        trigger: { type: 'energy', value: 'high_consumption' },
        actions: [
          { type: 'notification', message: 'Hög energiförbrukning upptäckt', priority: 'high' },
          { type: 'reduce_standby', delay: 0 }
        ]
      }
    };
  }

  // ============================================
  // FLOW CARDS REGISTRATION
  // ============================================

  async registerFlowCards() {
    // TRIGGERS
    this.presenceChangedTrigger = this.homey.flow.getTriggerCard('presence-changed');
    this.energyThresholdTrigger = this.homey.flow.getTriggerCard('energy-threshold-exceeded');
    this.temperatureAlertTrigger = this.homey.flow.getTriggerCard('temperature-alert');
    this.securityEventTrigger = this.homey.flow.getTriggerCard('security-event');
    this.sceneActivatedTrigger = this.homey.flow.getTriggerCard('scene-activated');

    this.sceneActivatedTrigger.registerArgumentAutocompleteListener('scene', 
      async (query) => this.autocompleteScenes(query)
    );

    // CONDITIONS
    const isAnyoneHome = this.homey.flow.getConditionCard('is-anyone-home');
    isAnyoneHome.registerRunListener(async () => {
      return this.presenceManager.isAnyoneHome();
    });

    const isNightMode = this.homey.flow.getConditionCard('is-night-mode');
    isNightMode.registerRunListener(async () => {
      return this.nightMode;
    });

    const isEnergySaving = this.homey.flow.getConditionCard('is-energy-saving');
    isEnergySaving.registerRunListener(async () => {
      return this.energySavingMode;
    });

    const tempInRange = this.homey.flow.getConditionCard('temperature-in-range');
    tempInRange.registerRunListener(async (args) => {
      const temp = await this.climateManager.getZoneTemperature(args.zone.id);
      return temp >= args.min && temp <= args.max;
    });
    tempInRange.registerArgumentAutocompleteListener('zone',
      async (query) => this.autocompleteZones(query)
    );

    const isSceneActive = this.homey.flow.getConditionCard('is-scene-active');
    isSceneActive.registerRunListener(async (args) => {
      return this.sceneManager.isSceneActive(args.scene.id);
    });
    isSceneActive.registerArgumentAutocompleteListener('scene',
      async (query) => this.autocompleteScenes(query)
    );

    // ACTIONS
    const activateScene = this.homey.flow.getActionCard('activate-scene');
    activateScene.registerRunListener(async (args) => {
      await this.sceneManager.activateScene(args.scene.id);
    });
    activateScene.registerArgumentAutocompleteListener('scene',
      async (query) => this.autocompleteScenes(query)
    );

    const setAllLights = this.homey.flow.getActionCard('set-all-lights');
    setAllLights.registerRunListener(async (args) => {
      await this.deviceManager.setZoneLights(args.zone.id, args.action, args.brightness);
    });
    setAllLights.registerArgumentAutocompleteListener('zone',
      async (query) => this.autocompleteZones(query)
    );

    const setClimate = this.homey.flow.getActionCard('set-climate');
    setClimate.registerRunListener(async (args) => {
      await this.climateManager.setZoneTemperature(args.zone.id, args.temperature);
    });
    setClimate.registerArgumentAutocompleteListener('zone',
      async (query) => this.autocompleteZones(query)
    );

    const sendNotification = this.homey.flow.getActionCard('send-smart-notification');
    sendNotification.registerRunListener(async (args) => {
      await this.notificationManager.send(args.message, args.priority);
    });

    const setSecurityMode = this.homey.flow.getActionCard('enable-security-mode');
    setSecurityMode.registerRunListener(async (args) => {
      await this.securityManager.setMode(args.mode);
    });

    const startRoutine = this.homey.flow.getActionCard('start-routine');
    startRoutine.registerRunListener(async (args) => {
      await this.automationManager.executeRoutine(args.routine.id);
    });
    startRoutine.registerArgumentAutocompleteListener('routine',
      async (query) => this.autocompleteRoutines(query)
    );
    
    // WAVE 9 AI PREDICTION & ORCHESTRATION FLOW CARDS
    
    // AI Prediction Conditions
    const predictionConfidence = this.homey.flow.getConditionCard('prediction-confidence-above');
    predictionConfidence.registerRunListener(async (args) => {
      const stats = await this.advancedAIPredictionEngine.getPredictionStatistics();
      const modelConfidence = stats.currentPredictions?.[args.model]?.confidence || 0;
      return modelConfidence >= (args.threshold / 100);
    });
    
    const modelAccuracy = this.homey.flow.getConditionCard('model-accuracy-above');
    modelAccuracy.registerRunListener(async (args) => {
      const stats = await this.advancedAIPredictionEngine.getPredictionStatistics();
      const accuracy = stats.models?.[args.model]?.accuracy || 0;
      return accuracy >= (args.accuracy / 100);
    });
    
    const orchestrationActive = this.homey.flow.getConditionCard('orchestration-active');
    orchestrationActive.registerRunListener(async () => {
      const stats = await this.crossSystemAIOrchestrationHub.getOrchestrationStatistics();
      return stats.totalOrchestrations > 0 && stats.successRate > 0;
    });
    
    // AI Prediction Actions
    const trainModel = this.homey.flow.getActionCard('train-ai-model');
    trainModel.registerRunListener(async (args) => {
      try {
        await this.advancedAIPredictionEngine.trainModel(args.model, null);
        await this.homey.notifications.createNotification({
          excerpt: `AI model ${args.model} training started`
        });
      } catch (error) {
        this.error('Error training model:', error);
        throw new Error(`Failed to train model: ${error.message}`);
      }
    });
    
    const executeOrchestration = this.homey.flow.getActionCard('execute-orchestration');
    executeOrchestration.registerRunListener(async (args) => {
      try {
        const result = await this.crossSystemAIOrchestrationHub.orchestrateAction(args.trigger, {
          manual: true,
          timestamp: Date.now()
        });
        await this.homey.notifications.createNotification({
          excerpt: `Orchestration ${args.trigger} executed successfully`
        });
      } catch (error) {
        this.error('Error executing orchestration:', error);
        throw new Error(`Failed to execute orchestration: ${error.message}`);
      }
    });
    
    const setOrchestrationMode = this.homey.flow.getActionCard('set-orchestration-mode');
    setOrchestrationMode.registerRunListener(async (args) => {
      try {
        this.crossSystemAIOrchestrationHub.settings.conflictResolutionMode = args.mode;
        await this.homey.settings.set('orchestrationMode', args.mode);
        await this.homey.notifications.createNotification({
          excerpt: `Orchestration mode set to ${args.mode}`
        });
      } catch (error) {
        this.error('Error setting orchestration mode:', error);
        throw new Error(`Failed to set orchestration mode: ${error.message}`);
      }
    });
    
    const enableAutoPredictions = this.homey.flow.getActionCard('enable-auto-predictions');
    enableAutoPredictions.registerRunListener(async (args) => {
      try {
        const enabled = args.enabled === 'true';
        this.advancedAIPredictionEngine.settings.autoActOnPredictions = enabled;
        await this.homey.settings.set('autoActOnPredictions', enabled);
        await this.homey.notifications.createNotification({
          excerpt: `Automatic predictions ${enabled ? 'enabled' : 'disabled'}`
        });
      } catch (error) {
        this.error('Error toggling auto predictions:', error);
        throw new Error(`Failed to toggle auto predictions: ${error.message}`);
      }
    });
    
    // WAVE 11 - INFRASTRUCTURE FLOW CARDS
    
    // Triggers
    this.systemHealthAlertTrigger = this.homey.flow.getTriggerCard('system-health-alert');
    this.memoryPressureTrigger = this.homey.flow.getTriggerCard('memory-pressure-detected');
    this.errorStormTrigger = this.homey.flow.getTriggerCard('error-storm-detected');
    this.securityLockoutTrigger = this.homey.flow.getTriggerCard('security-lockout');
    
    // Wire triggers to events
    this.systemHealthDashboard.on('health-alert', async (alert) => {
      try {
        await this.systemHealthAlertTrigger.trigger({
          alert_level: alert.level,
          system_name: alert.system || 'Platform',
          message: alert.message
        });
      } catch (err) { this.error('Error triggering health alert flow:', err); }
    });
    
    this.memoryGuardSystem.on('memory-warning', async (data) => {
      try {
        await this.memoryPressureTrigger.trigger({
          pressure_level: 'warning',
          heap_used_mb: Math.round((data.heapUsed || 0) / 1024 / 1024)
        });
      } catch (err) { this.error('Error triggering memory pressure flow:', err); }
    });
    
    this.memoryGuardSystem.on('memory-critical', async (data) => {
      try {
        await this.memoryPressureTrigger.trigger({
          pressure_level: 'critical',
          heap_used_mb: Math.round((data.heapUsed || 0) / 1024 / 1024)
        });
      } catch (err) { this.error('Error triggering memory pressure flow:', err); }
    });
    
    this.errorHandlingMiddleware.on('error-storm', async (data) => {
      try {
        await this.errorStormTrigger.trigger({
          source_system: data.system || 'unknown',
          error_count: data.count || 0
        });
      } catch (err) { this.error('Error triggering error storm flow:', err); }
    });
    
    this.apiAuthenticationGateway.on('lockout', async (data) => {
      try {
        await this.securityLockoutTrigger.trigger({
          ip_address: data.ip || 'unknown',
          reason: data.reason || 'Too many failed attempts'
        });
      } catch (err) { this.error('Error triggering lockout flow:', err); }
    });
    
    // Conditions
    const systemHealthAbove = this.homey.flow.getConditionCard('system-health-above');
    systemHealthAbove.registerRunListener(async (args) => {
      const dashboard = await this.systemHealthDashboard.getDashboard();
      return (dashboard.overallScore || 0) >= args.threshold;
    });
    
    const memoryUsageBelow = this.homey.flow.getConditionCard('memory-usage-below');
    memoryUsageBelow.registerRunListener(async (args) => {
      const snapshot = this.memoryGuardSystem.getSnapshot();
      const heapMB = (snapshot.heapUsed || 0) / 1024 / 1024;
      return heapMB < args.threshold_mb;
    });
    
    const cacheHitRateAbove = this.homey.flow.getConditionCard('cache-hit-rate-above');
    cacheHitRateAbove.registerRunListener(async (args) => {
      const stats = this.centralizedCacheManager.getGlobalStats();
      return (stats.hitRate || 0) >= args.threshold;
    });
    
    // Actions
    const clearCacheNamespace = this.homey.flow.getActionCard('clear-cache-namespace');
    clearCacheNamespace.registerRunListener(async (args) => {
      this.centralizedCacheManager.clearNamespace(args.namespace);
      await this.homey.notifications.createNotification({
        excerpt: `Cache namespace '${args.namespace}' cleared`
      });
    });
    
    const runDiagnosticsAction = this.homey.flow.getActionCard('run-diagnostics');
    runDiagnosticsAction.registerRunListener(async () => {
      const result = await this.systemHealthDashboard.runDiagnostics();
      await this.homey.notifications.createNotification({
        excerpt: `Diagnostics complete: Score ${result.overallScore || 'N/A'}`
      });
    });
    
    const toggleSchedulerTask = this.homey.flow.getActionCard('toggle-scheduler-task');
    toggleSchedulerTask.registerRunListener(async (args) => {
      const enabled = args.enabled === 'true';
      if (enabled) {
        this.unifiedEventScheduler.enableTask(args.taskId);
      } else {
        this.unifiedEventScheduler.disableTask(args.taskId);
      }
      await this.homey.notifications.createNotification({
        excerpt: `Scheduler task '${args.taskId}' ${enabled ? 'enabled' : 'disabled'}`
      });
    });
  }

  // ============================================
  // AUTOCOMPLETE HELPERS
  // ============================================

  async autocompleteScenes(query) {
    const scenes = Object.values(this.scenes);
    return scenes
      .filter(scene => {
        const name = scene.name.sv || scene.name.en;
        return name.toLowerCase().includes(query.toLowerCase());
      })
      .map(scene => ({
        id: scene.id,
        name: scene.name.sv || scene.name.en
      }));
  }

  async autocompleteZones(query) {
    const zones = await this.homey.zones.getZones();
    return Object.values(zones)
      .filter(zone => zone.name.toLowerCase().includes(query.toLowerCase()))
      .map(zone => ({
        id: zone.id,
        name: zone.name
      }));
  }

  async autocompleteRoutines(query) {
    const routines = Object.values(this.routines);
    return routines
      .filter(routine => {
        const name = routine.name.sv || routine.name.en;
        return name.toLowerCase().includes(query.toLowerCase());
      })
      .map(routine => ({
        id: routine.id,
        name: routine.name.sv || routine.name.en
      }));
  }

  // ============================================
  // MONITORING
  // ============================================

  async startMonitoring() {
    // Device state monitoring
    this.homey.devices.on('device.create', this.onDeviceAdded.bind(this));
    this.homey.devices.on('device.delete', this.onDeviceRemoved.bind(this));

    // Start periodic checks
    this.monitoringInterval = this.homey.setInterval(async () => {
      await this.performPeriodicChecks();
    }, 60000); // Every minute

    // Energy monitoring
    this.energyInterval = this.homey.setInterval(async () => {
      await this.energyManager.checkConsumption();
    }, 300000); // Every 5 minutes
  }

  async performPeriodicChecks() {
    try {
      // Check temperatures
      await this.climateManager.checkTemperatures();
      
      // Check presence
      await this.presenceManager.updatePresence();
      
      // Check scheduled routines
      await this.automationManager.checkScheduledRoutines();
    } catch (error) {
      this.error('Error in periodic checks:', error);
    }
  }

  async onDeviceAdded(device) {
    this.log(`Device added: ${device.name}`);
    await this.deviceManager.registerDevice(device);
  }

  async onDeviceRemoved(device) {
    this.log(`Device removed: ${device.name}`);
    await this.deviceManager.unregisterDevice(device);
  }

  // ============================================
  // TRIGGER HELPERS
  // ============================================

  async triggerPresenceChanged(zone, presence) {
    await this.presenceChangedTrigger.trigger({ zone, presence });
  }

  async triggerEnergyThreshold(device, consumption) {
    await this.energyThresholdTrigger.trigger({ device, consumption });
  }

  async triggerTemperatureAlert(zone, temperature, args) {
    await this.temperatureAlertTrigger.trigger({ zone, temperature }, args);
  }

  async triggerSecurityEvent(eventType, device, zone) {
    await this.securityEventTrigger.trigger({ eventType, device, zone });
  }

  async triggerSceneActivated(sceneId) {
    const scene = this.scenes[sceneId];
    if (scene) {
      await this.sceneActivatedTrigger.trigger({}, { scene: { id: sceneId } });
    }
  }

  // ============================================
  // API ENDPOINTS
  // ============================================

  async getDashboardData() {
    return {
      presence: await this.presenceManager.getStatus(),
      energy: await this.energyManager.getCurrentConsumption(),
      climate: await this.climateManager.getAllZonesStatus(),
      security: {
        mode: this.securityMode,
        status: await this.securityManager.getStatus()
      },
      scenes: this.scenes,
      activeScene: this.sceneManager.getActiveScene(),
      devices: await this.deviceManager.getDevicesSummary()
    };
  }

  async onUninit() {
    if (this.monitoringInterval) {
      this.homey.clearInterval(this.monitoringInterval);
    }
    if (this.energyInterval) {
      this.homey.clearInterval(this.energyInterval);
    }
    
    // Wave 11 graceful shutdown
    try {
      if (this.unifiedEventScheduler) await this.unifiedEventScheduler.destroy(5000);
      if (this.systemHealthDashboard && this.systemHealthDashboard.destroy) this.systemHealthDashboard.destroy();
      if (this.memoryGuardSystem && this.memoryGuardSystem.destroy) this.memoryGuardSystem.destroy();
      if (this.centralizedCacheManager && this.centralizedCacheManager.destroy) this.centralizedCacheManager.destroy();
      if (this.errorHandlingMiddleware && this.errorHandlingMiddleware.destroy) this.errorHandlingMiddleware.destroy();
      if (this.apiAuthenticationGateway && this.apiAuthenticationGateway.destroy) this.apiAuthenticationGateway.destroy();
      this.log('Wave 11 infrastructure shut down gracefully');
    } catch (error) {
      this.error('Error during Wave 11 shutdown:', error);
    }
    
    this.log('Smart Home Pro has been uninitialized');
  }
}

// ============================================
// MANAGER CLASSES
// ============================================

class DeviceManager {
  constructor(app) {
    this.app = app;
    this.devices = {};
  }

  async initialize() {
    const devices = await this.app.homey.devices.getDevices();
    for (const device of Object.values(devices)) {
      await this.registerDevice(device);
    }
  }

  async registerDevice(device) {
    this.devices[device.id] = {
      id: device.id,
      name: device.name,
      class: device.class,
      zone: device.zone,
      capabilities: device.capabilities,
      capabilitiesObj: device.capabilitiesObj
    };

    // Listen for capability changes
    device.on('capability', (capabilityId, value) => {
      this.onCapabilityChanged(device, capabilityId, value);
    });
  }

  async unregisterDevice(device) {
    delete this.devices[device.id];
  }

  onCapabilityChanged(device, capabilityId, value) {
    this.app.log(`${device.name}: ${capabilityId} = ${value}`);
    
    // Check for security-relevant changes
    if (['alarm_contact', 'alarm_motion', 'alarm_tamper'].includes(capabilityId) && value) {
      this.app.securityManager.onAlarmTriggered(device, capabilityId);
    }
  }

  async setZoneLights(zoneId, action, brightness) {
    const devices = Object.values(this.devices).filter(d => 
      d.zone === zoneId && d.class === 'light'
    );

    for (const deviceInfo of devices) {
      const device = await this.app.homey.devices.getDevice({ id: deviceInfo.id });
      
      switch (action) {
        case 'on':
          await device.setCapabilityValue('onoff', true);
          if (brightness && device.capabilities.includes('dim')) {
            await device.setCapabilityValue('dim', brightness / 100);
          }
          break;
        case 'off':
          await device.setCapabilityValue('onoff', false);
          break;
        case 'dim':
          if (device.capabilities.includes('dim')) {
            await device.setCapabilityValue('dim', brightness / 100);
          }
          break;
      }
    }
  }

  async getDevicesSummary() {
    const summary = {
      total: Object.keys(this.devices).length,
      byClass: {},
      byZone: {},
      online: 0,
      offline: 0
    };

    for (const device of Object.values(this.devices)) {
      // By class
      summary.byClass[device.class] = (summary.byClass[device.class] || 0) + 1;
      
      // By zone
      if (device.zone) {
        summary.byZone[device.zone] = (summary.byZone[device.zone] || 0) + 1;
      }
    }

    return summary;
  }
}

class SceneManager {
  constructor(app) {
    this.app = app;
    this.activeScene = null;
  }

  async initialize() {
    this.app.log('SceneManager initialized');
  }

  async activateScene(sceneId) {
    const scene = this.app.scenes[sceneId];
    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`);
    }

    this.app.log(`Activating scene: ${scene.name.sv || scene.name.en}`);

    for (const action of scene.actions) {
      await this.executeSceneAction(action);
    }

    this.activeScene = sceneId;
    await this.app.triggerSceneActivated(sceneId);
  }

  async executeSceneAction(action) {
    switch (action.type) {
      case 'lights':
        await this.app.deviceManager.setZoneLights(
          action.zone, 
          action.brightness > 0 ? 'on' : 'off', 
          action.brightness
        );
        break;
      case 'climate':
        await this.app.climateManager.setZoneTemperature(action.zone, action.temperature);
        break;
      case 'security':
        await this.app.securityManager.setMode(action.mode);
        break;
    }
  }

  isSceneActive(sceneId) {
    return this.activeScene === sceneId;
  }

  getActiveScene() {
    return this.activeScene;
  }
}

class AutomationManager {
  constructor(app) {
    this.app = app;
    this.executionHistory = [];
  }

  async initialize() {
    this.app.log('AutomationManager initialized');
  }

  async executeRoutine(routineId) {
    const routine = this.app.routines[routineId];
    if (!routine) {
      throw new Error(`Routine not found: ${routineId}`);
    }

    this.app.log(`Executing routine: ${routine.name.sv || routine.name.en}`);

    // Check conditions
    if (routine.conditions) {
      for (const condition of routine.conditions) {
        if (!await this.checkCondition(condition)) {
          this.app.log(`Routine condition not met, skipping`);
          return;
        }
      }
    }

    // Execute actions
    for (const action of routine.actions) {
      if (action.delay) {
        await this.delay(action.delay * 1000);
      }
      await this.executeAction(action);
    }

    this.executionHistory.push({
      routineId,
      timestamp: new Date().toISOString()
    });
  }

  async checkCondition(condition) {
    switch (condition.type) {
      case 'presence':
        return this.app.presenceManager.isAnyoneHome() === condition.value;
      case 'time':
        return this.isTimeInRange(condition.range);
      default:
        return true;
    }
  }

  isTimeInRange(range) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Handle 'sunset', 'sunrise' etc
    const getMinutes = (timeStr) => {
      if (timeStr === 'sunset') return 18 * 60; // Approximate
      if (timeStr === 'sunrise') return 6 * 60; // Approximate
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const start = getMinutes(range[0]);
    const end = getMinutes(range[1]);
    
    return currentMinutes >= start && currentMinutes <= end;
  }

  async executeAction(action) {
    switch (action.type) {
      case 'scene':
        await this.app.sceneManager.activateScene(action.sceneId);
        break;
      case 'notification':
        await this.app.notificationManager.send(action.message, action.priority);
        break;
      case 'security':
        await this.app.securityManager.setMode(action.mode);
        break;
    }
  }

  async checkScheduledRoutines() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];

    for (const routine of Object.values(this.app.routines)) {
      if (routine.trigger?.type === 'time' && routine.trigger.value === currentTime) {
        if (!routine.trigger.days || routine.trigger.days.includes(currentDay)) {
          await this.executeRoutine(routine.id);
        }
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class EnergyManager {
  constructor(app) {
    this.app = app;
    this.consumptionHistory = [];
    this.threshold = 3000; // Watts
  }

  async initialize() {
    this.app.log('EnergyManager initialized');
  }

  async getCurrentConsumption() {
    let totalConsumption = 0;
    const deviceConsumption = [];

    const devices = await this.app.homey.devices.getDevices();
    
    for (const device of Object.values(devices)) {
      if (device.capabilities?.includes('measure_power')) {
        const power = device.capabilitiesObj?.measure_power?.value || 0;
        totalConsumption += power;
        deviceConsumption.push({
          id: device.id,
          name: device.name,
          power
        });
      }
    }

    return {
      total: totalConsumption,
      devices: deviceConsumption.sort((a, b) => b.power - a.power),
      threshold: this.threshold,
      isHigh: totalConsumption > this.threshold
    };
  }

  async checkConsumption() {
    const consumption = await this.getCurrentConsumption();
    
    this.consumptionHistory.push({
      timestamp: new Date().toISOString(),
      value: consumption.total
    });

    // Keep last 24 hours (288 entries at 5-min intervals)
    if (this.consumptionHistory.length > 288) {
      this.consumptionHistory.shift();
    }

    if (consumption.isHigh) {
      this.app.energySavingMode = true;
      
      // Find the highest consuming device
      if (consumption.devices.length > 0) {
        const topDevice = consumption.devices[0];
        await this.app.triggerEnergyThreshold(topDevice.name, topDevice.power);
      }
    } else {
      this.app.energySavingMode = false;
    }

    return consumption;
  }
}

class SecurityManager {
  constructor(app) {
    this.app = app;
    this.events = [];
  }

  async initialize() {
    this.app.log('SecurityManager initialized');
  }

  async setMode(mode) {
    this.app.securityMode = mode;
    await this.app.homey.settings.set('securityMode', mode);
    this.app.log(`Security mode set to: ${mode}`);

    if (mode === 'night') {
      this.app.nightMode = true;
    } else {
      this.app.nightMode = false;
    }
  }

  async getStatus() {
    const securityDevices = [];
    const devices = await this.app.homey.devices.getDevices();
    
    for (const device of Object.values(devices)) {
      const isSecurityDevice = 
        device.capabilities?.includes('alarm_contact') ||
        device.capabilities?.includes('alarm_motion') ||
        device.capabilities?.includes('alarm_tamper');
      
      if (isSecurityDevice) {
        securityDevices.push({
          id: device.id,
          name: device.name,
          zone: device.zone,
          status: this.getDeviceSecurityStatus(device)
        });
      }
    }

    return {
      mode: this.app.securityMode,
      devices: securityDevices,
      recentEvents: this.events.slice(-10)
    };
  }

  getDeviceSecurityStatus(device) {
    return {
      contact: device.capabilitiesObj?.alarm_contact?.value,
      motion: device.capabilitiesObj?.alarm_motion?.value,
      tamper: device.capabilitiesObj?.alarm_tamper?.value
    };
  }

  async onAlarmTriggered(device, capabilityId) {
    const event = {
      type: capabilityId.replace('alarm_', ''),
      device: device.name,
      zone: device.zone,
      timestamp: new Date().toISOString()
    };

    this.events.push(event);
    
    // Only alert in armed modes
    if (['away', 'night'].includes(this.app.securityMode)) {
      await this.app.triggerSecurityEvent(event.type, event.device, event.zone);
      await this.app.notificationManager.send(
        `Säkerhetsvarning: ${event.type} från ${event.device}`,
        'critical'
      );
    }
  }
}

class ClimateManager {
  constructor(app) {
    this.app = app;
    this.temperatureHistory = {};
    this.alertThresholds = { min: 15, max: 28 };
  }

  async initialize() {
    this.app.log('ClimateManager initialized');
  }

  async getZoneTemperature(zoneId) {
    const devices = await this.app.homey.devices.getDevices();
    const zoneDevices = Object.values(devices).filter(d => 
      d.zone === zoneId && d.capabilities?.includes('measure_temperature')
    );

    if (zoneDevices.length === 0) return null;

    const temps = zoneDevices
      .map(d => d.capabilitiesObj?.measure_temperature?.value)
      .filter(t => t !== null && t !== undefined);

    return temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  }

  async setZoneTemperature(zoneId, temperature) {
    const devices = await this.app.homey.devices.getDevices();
    const thermostats = Object.values(devices).filter(d =>
      d.zone === zoneId && d.capabilities?.includes('target_temperature')
    );

    for (const device of thermostats) {
      try {
        await device.setCapabilityValue('target_temperature', temperature);
      } catch (error) {
        this.app.error(`Failed to set temperature for ${device.name}:`, error);
      }
    }
  }

  async getAllZonesStatus() {
    const zones = await this.app.homey.zones.getZones();
    const status = {};

    for (const zone of Object.values(zones)) {
      status[zone.id] = {
        name: zone.name,
        temperature: await this.getZoneTemperature(zone.id),
        humidity: await this.getZoneHumidity(zone.id)
      };
    }

    return status;
  }

  async getZoneHumidity(zoneId) {
    const devices = await this.app.homey.devices.getDevices();
    const zoneDevices = Object.values(devices).filter(d =>
      d.zone === zoneId && d.capabilities?.includes('measure_humidity')
    );

    if (zoneDevices.length === 0) return null;

    const humidity = zoneDevices
      .map(d => d.capabilitiesObj?.measure_humidity?.value)
      .filter(h => h !== null && h !== undefined);

    return humidity.length > 0 ? humidity.reduce((a, b) => a + b, 0) / humidity.length : null;
  }

  async checkTemperatures() {
    const zones = await this.app.homey.zones.getZones();

    for (const zone of Object.values(zones)) {
      const temp = await this.getZoneTemperature(zone.id);
      if (temp === null) continue;

      if (temp < this.alertThresholds.min) {
        await this.app.triggerTemperatureAlert(
          zone.name, temp, { condition: 'below', temperature: this.alertThresholds.min }
        );
      } else if (temp > this.alertThresholds.max) {
        await this.app.triggerTemperatureAlert(
          zone.name, temp, { condition: 'above', temperature: this.alertThresholds.max }
        );
      }
    }
  }
}

class PresenceManager {
  constructor(app) {
    this.app = app;
    this.presenceStatus = {};
  }

  async initialize() {
    this.app.log('PresenceManager initialized');
  }

  async updatePresence() {
    const users = await this.app.homey.users?.getUsers?.() || {};
    const previousPresence = { ...this.presenceStatus };
    
    for (const user of Object.values(users)) {
      this.presenceStatus[user.id] = {
        name: user.name,
        present: user.present
      };
    }

    // Detect changes
    for (const userId in this.presenceStatus) {
      const current = this.presenceStatus[userId];
      const previous = previousPresence[userId];
      
      if (previous && current.present !== previous.present) {
        await this.app.triggerPresenceChanged(current.name, current.present);
        
        // Check for first arrival or last leave
        if (current.present && !this.wasAnyoneHome(previousPresence)) {
          await this.app.automationManager.executeRoutine('arrive-home');
        } else if (!current.present && !this.isAnyoneHome()) {
          await this.app.automationManager.executeRoutine('leave-home');
        }
      }
    }
  }

  isAnyoneHome() {
    return Object.values(this.presenceStatus).some(p => p.present);
  }

  wasAnyoneHome(previousPresence) {
    return Object.values(previousPresence).some(p => p.present);
  }

  async getStatus() {
    return {
      users: this.presenceStatus,
      anyoneHome: this.isAnyoneHome(),
      homeCount: Object.values(this.presenceStatus).filter(p => p.present).length
    };
  }
}

class NotificationManager {
  constructor(app) {
    this.app = app;
    this.history = [];
  }

  async initialize() {
    this.app.log('NotificationManager initialized');
  }

  async send(message, priority = 'normal') {
    const notification = {
      message,
      priority,
      timestamp: new Date().toISOString()
    };

    // Send via Homey's notification system
    await this.app.homey.notifications.createNotification({ excerpt: message });

    // For critical notifications, also use speech
    if (priority === 'critical') {
      try {
        await this.app.homey.speechOutput.say(message);
      } catch (error) {
        this.app.log('Speech output not available');
      }
    }

    this.history.push(notification);
    
    // Keep last 100 notifications
    if (this.history.length > 100) {
      this.history.shift();
    }

    return notification;
  }
}

module.exports = SmartHomeProApp;
