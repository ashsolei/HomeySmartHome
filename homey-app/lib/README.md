# lib/ — Module Domain Organization

This directory contains 119 modules for Smart Home Pro, organized by domain category.
Files remain in the flat `lib/` directory for import compatibility; this document serves
as the authoritative domain reference.

## Domain Categories

### `core/` — Core Automation & Intelligence
Central orchestration, scene management, AI inference, and multi-user support.

| Module | Description |
|---|---|
| `AdvancedAutomationEngine.js` | Rule engine, trigger/condition/action pipeline |
| `AdvancedSceneTemplateSystem.js` | Pre-built scene templates with AI customization |
| `SceneLearningSystem.js` | Learns and auto-creates scenes from behavior patterns |
| `AmbientIntelligenceSystem.js` | Proactive, context-aware automation |
| `MoodActivityDetectionSystem.js` | Detects mood and activity to drive adaptive automation |
| `IntelligenceManager.js` | Central AI reasoning and decision manager |
| `IntelligentDashboard.js` | Smart dashboard aggregation and context |
| `AdvancedAnalytics.js` | Trends, insights, and performance metrics |
| `MultiUserPreferenceSystem.js` | Per-user settings, preference learning, conflict resolution |
| `SmartSchedulingSystem.js` | Time-based scheduling with conflict resolution |
| `SmartHomeAdaptiveLearningSystem.js` | Adapts automation logic from user habits |
| `SmartHomeDigitalTwinSystem.js` | Digital twin simulation of the physical home |
| `CrossHomeSynchronizationSystem.js` | Syncs settings and scenes across multiple homes |
| `IntegrationHub.js` | Third-party service integration broker |
| `SmartSeasonalAdaptationSystem.js` | Automatic seasonal adaptation for Nordic homes |
| `NaturalLanguageAutomationEngine.js` | Builds automations from natural-language descriptions |
| `AdvancedAIPredictionEngine.js` | ML prediction for behavior and device states |
| `CrossSystemAIOrchestrationHub.js` | Coordinates AI decisions across all subsystems |
| `DeepLearningVisionSystem.js` | Computer-vision-based occupancy and event detection |
| `SmartHomeAutomatedTestingSystem.js` | Automated integration testing of home systems |

### `energy/` — Energy Management & Sustainability
Generation, storage, trading, billing, auditing, and sustainability tracking.

| Module | Description |
|---|---|
| `EnergyForecastingEngine.js` | Consumption forecasting with ML models |
| `EnergyStorageManagementSystem.js` | Battery/solar storage optimization and grid interaction |
| `AdvancedEnergyTradingSystem.js` | Peer-to-peer and spot-market energy trading |
| `SolarEnergyOptimizationSystem.js` | Solar generation optimization and monitoring |
| `SmartRoofSolarMonitoringSystem.js` | Roof-mounted solar panel telemetry |
| `EnergyBillingAnalyticsSystem.js` | Utility bill tracking, cost analytics, budget management |
| `HomeEnergyAuditSystem.js` | Full home energy audit and savings recommendations |
| `PowerContinuityUPSSystem.js` | UPS management and power continuity |
| `HomeSustainabilityTrackerSystem.js` | Carbon footprint and renewable energy attribution |
| `SmartEVChargingManagementSystem.js` | EV charger scheduling and cost optimization |
| `VehicleIntegrationSystem.js` | Multi-vehicle support, trip history, fuel/charge tracking |

### `security/` — Security & Access Control
Intrusion detection, locks, perimeter, drones, cameras, and network security.

| Module | Description |
|---|---|
| `AdvancedSecuritySystem.js` | Intrusion detection, geofencing, multi-zone arming |
| `SmartLockManagementSystem.js` | Lock control, temporary codes, auto-lock, tamper detection |
| `SmartDoorbellIntercomSystem.js` | Doorbell and video intercom management |
| `SmartPerimeterManagementSystem.js` | Gate, fence, driveway security and intrusion detection |
| `HomeSecurityDroneSystem.js` | Security drone patrol and alert response |
| `GeofencingEngine.js` | Location-based automation and presence detection |
| `AdvancedHomeNetworkSecuritySystem.js` | Network monitoring, intrusion detection, device isolation |
| `APIAuthenticationGateway.js` | API auth, JWT validation, rate-limit enforcement |
| `VisitorGuestManagementSystem.js` | Visitor access control, temporary permissions |
| `AdvancedGuestEntertainmentSystem.js` | Guest hospitality, entertainment access, visitor profiles |
| `AuditLogSystem.js` | User action and system event audit trail |
| `SmartHomeInsuranceRiskAssessmentSystem.js` | Insurance risk scoring and incident reporting |

### `climate/` — Climate, Air & Water
HVAC, ventilation, heating, cooling, air quality, water, and irrigation.

| Module | Description |
|---|---|
| `AirQualityManagementSystem.js` | Indoor air quality monitoring and optimization |
| `AdvancedAirPurificationSystem.js` | Air purifier control and filter tracking |
| `AdvancedAirQualityVentilationControlSystem.js` | Integrated air quality and ventilation control |
| `SmartHVACZoneControlSystem.js` | Multi-zone HVAC scheduling and zone management |
| `SmartHomeVentilationHeatRecoverySystem.js` | HRV/ERV management with CO2-based control |
| `SmartFloorHeatingControlSystem.js` | Floor heating zone control and scheduling |
| `SmartFireplaceManagementSystem.js` | Smart fireplace control and safety monitoring |
| `SmartWaterManagementSystem.js` | Water consumption monitoring and leak detection |
| `HomeWaterLeakProtectionSystem.js` | Real-time leak detection and auto shut-off |
| `SmartIrrigationWaterConservationSystem.js` | Weather-aware irrigation scheduling |
| `AdvancedWeatherIntegration.js` | External weather API integration and forecasting |
| `SmartWeatherStationSystem.js` | Local weather station telemetry |

### `automation/` — Devices, Scenes & Scheduling
Physical device control, scene execution, and scheduling primitives.

| Module | Description |
|---|---|
| `SmartApplianceController.js` | Unified appliance control with energy tracking |
| `SmartBlindsShutterControlSystem.js` | Motorized blinds and shutter automation |
| `SmartWindowManagementSystem.js` | Smart window actuator control |
| `SmartFurnitureControlSystem.js` | Motorized furniture and adjustable desk control |
| `IndoorLightingSceneEngine.js` | Indoor lighting scene creation and execution |
| `SmartCircadianLightingSystem.js` | Circadian-rhythm-aligned lighting automation |
| `OutdoorLightingScenarios.js` | Outdoor lighting schedules and scenarios |
| `RoomOccupancyMappingSystem.js` | Room-level occupancy detection and mapping |
| `VoiceControlSystem.js` | Natural-language voice command processing |
| `AIVoiceAssistantIntegration.js` | Voice assistant platform integration (Alexa, Google) |
| `AdvancedNotificationManager.js` | Intelligent notification routing and delivery |
| `SmartSchedulingSystem.js` | *(also listed in core)* |
| `SmartGarageManagementSystem.js` | Garage door, lighting, and sensor automation |
| `AdvancedKitchenAutomationSystem.js` | Kitchen appliance and environment automation |
| `HomeCleaningAutomationSystem.js` | Robot vacuum scheduling and room sequencing |
| `SmartHomePredictiveCleaningSystem.js` | Predictive cleaning based on occupancy and air quality |
| `SmartLaundryManagementSystem.js` | Laundry cycle monitoring and notifications |
| `HomeRoboticsOrchestrationSystem.js` | Orchestration of all domestic robots |

### `lifestyle/` — Wellness, Sleep & Personal Care
Sleep, fitness, nutrition, wardrobe, children, pets, and personal wellness.

| Module | Description |
|---|---|
| `WellnessSleepOptimizer.js` | Sleep quality optimization through environment control |
| `AdvancedSleepEnvironmentSystem.js` | Temperature, light, sound optimization for sleep |
| `AdvancedWakeUpRoutineSystem.js` | Gradual wake-up routines with environment staging |
| `HomeGymFitnessSystem.js` | Gym equipment tracking and fitness session management |
| `HomeNutritionWellnessSystem.js` | Nutrition tracking and wellness coaching |
| `AdvancedBabyAndChildCareSystem.js` | Baby monitor, sleep tracking, safety alerts |
| `HomeChildEducationSystem.js` | Screen time management and child development tracking |
| `PetCareAutomationSystem.js` | Feeding schedules, activity tracking, vet reminders |
| `SmartPetDoorActivitySystem.js` | Smart pet door usage tracking and scheduling |
| `SmartWardrobeManagementSystem.js` | Wardrobe inventory and outfit suggestions |
| `HomeDigitalWellnessSystem.js` | Screen time, device usage, and digital detox management |
| `MultiUserPreferenceSystem.js` | *(also listed in core)* |

### `monitoring/` — Observability & Maintenance
Health monitoring, performance, logging, audit, and predictive maintenance.

| Module | Description |
|---|---|
| `DeviceHealthMonitor.js` | Device status polling and failure detection |
| `PredictiveMaintenanceScheduler.js` | ML-based failure prediction and maintenance scheduling |
| `SystemHealthDashboard.js` | Aggregated system health view |
| `PerformanceOptimizer.js` | Runtime performance profiling and tuning |
| `MemoryGuardSystem.js` | Memory usage monitoring and leak prevention |
| `SmartHomeInsuranceRiskAssessmentSystem.js` | *(also listed in security)* |
| `AuditLogSystem.js` | *(also listed in security)* |
| `BackupRecoverySystem.js` | Automated config/scene backup and recovery |
| `ErrorHandlingMiddleware.js` | Global error capture, classification, and alerting |
| `SmartDisasterResilienceSystem.js` | Disaster scenario detection and response plans |
| `HomeEmergencyResponseSystem.js` | Emergency service integration and alert escalation |
| `SmartMirrorDashboardSystem.js` | Smart mirror UI and ambient information display |

### `infrastructure/` — Platform Utilities & Shared Services
Caching, event scheduling, base classes, auth, and shared utilities.

| Module | Description |
|---|---|
| `utils/BaseSystem.js` | Abstract base class for all Smart* system modules |
| `utils/CentralizedCacheManager.js` | Singleton LRU cache shared across all modules |
| `utils/UnifiedEventScheduler.js` | Singleton cron/interval scheduler shared across modules |
| `utils/SystemOptimizer.js` | Startup and runtime optimization utilities |
| `utils/HomeyShim.js` | Homey SDK shim for standalone/dev mode |
| `utils/ManagerStubs.js` | Manager stubs for testing without Homey SDK |
| `APIAuthenticationGateway.js` | *(also listed in security)* |
| `IntegrationHub.js` | *(also listed in core)* |
| `swagger.js` | OpenAPI/Swagger spec generation |
| `logger.js` | Structured logger (pino) instance |

### `entertainment/` — Media, Audio & Hospitality
Home theater, audio, AV, bars, spas, and guest entertainment.

| Module | Description |
|---|---|
| `SmartHomeTheaterSystem.js` | Home theater control, scene presets, ambient lighting |
| `AdvancedAVAutomation.js` | Audio/video system automation and source routing |
| `AdvancedMusicAudioSystem.js` | Multi-room audio and music service integration |
| `HomeSpaAndSaunaSystem.js` | Spa/sauna temperature, timing, and session control |
| `HomeBarManagementSystem.js` | Home bar inventory, drink recipes, and mood lighting |
| `WineCellarManagementSystem.js` | Wine inventory, temperature monitoring, and pairings |
| `PoolSpaManagementSystem.js` | Pool/spa chemistry, filtration, and heating control |
| `AdvancedGuestEntertainmentSystem.js` | *(also listed in security)* |
| `HomeOfficeOptimizationSystem.js` | Home office environment optimization |
| `HomeOfficeProductivityHub.js` | Productivity tracking and focus environment management |

### `outdoor/` — Garden, Outdoor & Vehicles
Outdoor spaces, gardens, vehicles, and neighborhood integration.

| Module | Description |
|---|---|
| `GardenPlantCareSystem.js` | Plant watering schedules and soil sensor integration |
| `AdvancedIndoorPlantCareSystem.js` | Indoor plant care, light, and humidity optimization |
| `SmartCompostingGardenSystem.js` | Composting bin monitoring and garden health |
| `SmartIrrigationWaterConservationSystem.js` | *(also listed in climate)* |
| `OutdoorLightingScenarios.js` | *(also listed in automation)* |
| `VehicleIntegrationSystem.js` | *(also listed in energy)* |
| `SmartEVChargingManagementSystem.js` | *(also listed in energy)* |
| `PoolSpaManagementSystem.js` | *(also listed in entertainment)* |
| `AdvancedNeighborhoodIntegrationSystem.js` | Neighborhood alerts, community sharing, local events |
| `AdvancedPackageDeliveryManagementSystem.js` | Package delivery tracking and doorstep alerts |
| `MailboxPackageTrackingSystem.js` | Physical mailbox sensor and package notification |
| `SmartWasteManagementSystem.js` | Waste bin fill-level tracking and collection reminders |
| `SmartRoofSolarMonitoringSystem.js` | *(also listed in energy)* |
| `HomeWorkshopSafetySystem.js` | Workshop power tool safety and ventilation control |
| `SmartAquariumManagementSystem.js` | Aquarium water chemistry, temp, and feeding automation |
| `HomeLibraryManagementSystem.js` | Book inventory, lending tracking, and reading goals |
| `HomeAccessibilityElderlyCareSystem.js` | Accessibility features and elderly care monitoring |
| `SmartFoodPantryManagementSystem.js` | Food inventory, expiry tracking, and shopping lists |

## Module Count by Domain

| Domain | Count |
|---|---|
| core | 20 |
| energy | 11 |
| security | 12 |
| climate | 12 |
| automation | 18 |
| lifestyle | 12 |
| monitoring | 12 |
| infrastructure | 10 |
| entertainment | 10 |
| outdoor | 16 |

> Note: Modules that span multiple concerns are listed under their primary domain
> and noted as cross-listed in secondary domains. Total unique modules: 119.

## Future Migration Path

When import compatibility can be managed (e.g., via path aliases or a bundler):
1. Create subdirectories: `core/`, `energy/`, `security/`, etc.
2. Move files into subdirectories following this mapping
3. Update all `require('./lib/ModuleName')` paths in `app.js`, `server.js`, and `api.js`
4. Use `lib/index.js` as the single import surface for consumers

For now, `lib/index.js` provides domain-grouped exports without requiring any path changes.
