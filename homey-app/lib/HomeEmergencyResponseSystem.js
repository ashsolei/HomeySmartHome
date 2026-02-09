'use strict';

const EventEmitter = require('events');

/**
 * HomeEmergencyResponseSystem
 *
 * Comprehensive emergency detection, response, and recovery system for
 * Homey-based smart homes. Provides multi-sensor correlation, automated
 * response protocols, multi-channel alerting, evacuation management,
 * power backup monitoring, drill scheduling, lockdown, panic button,
 * wellbeing checks, weather alerts and full incident lifecycle tracking.
 *
 * @extends EventEmitter
 */
class HomeEmergencyResponseSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // ── 10 Emergency Types ──────────────────────────────────────────────
    this.emergencyTypes = {
      fire: {
        id: 'fire',
        label: 'Fire',
        severity: 5,
        colorCode: '#FF0000',
        emergencyNumber: '112',
        requiredSensors: ['smoke_detector', 'temperature_extreme'],
        correlationSensors: [['smoke_detector', 'temperature_extreme']],
        autoActions: ['activate_sprinklers', 'unlock_doors', 'cut_hvac', 'activate_emergency_lighting', 'send_alerts'],
        responseProtocol: [
          'Activate fire alarm sirens on all floors',
          'Cut HVAC system to prevent smoke spread',
          'Unlock all exterior doors for evacuation',
          'Activate emergency lighting on evacuation routes',
          'Activate sprinkler system in affected zone',
          'Send push notification to all residents',
          'Call emergency services (112)',
          'Send SMS to emergency contacts',
          'Display evacuation route on smart displays',
          'Monitor temperature sensors for fire spread'
        ],
        recoverySteps: [
          'Wait for fire department clearance',
          'Ventilate affected areas',
          'Inspect structural damage',
          'Check electrical systems',
          'Document damage for insurance',
          'Schedule professional cleaning'
        ]
      },
      flood: {
        id: 'flood',
        label: 'Flood / Water Leak',
        severity: 4,
        colorCode: '#0066FF',
        emergencyNumber: '112',
        requiredSensors: ['flood_sensor'],
        correlationSensors: [['flood_sensor', 'flood_sensor']],
        autoActions: ['shut_water_main', 'cut_power_affected', 'activate_sump_pump', 'send_alerts'],
        responseProtocol: [
          'Shut off main water valve automatically',
          'Cut power to affected zones to prevent electrocution',
          'Activate sump pumps if available',
          'Send immediate alert to all residents',
          'Notify water damage restoration service',
          'Document water levels and affected areas',
          'Move valuable items if time permits',
          'Contact insurance provider'
        ],
        recoverySteps: [
          'Assess water damage extent',
          'Remove standing water',
          'Run dehumidifiers',
          'Inspect for mold growth',
          'Restore power after safety check',
          'Document all damages'
        ]
      },
      'gas-leak': {
        id: 'gas-leak',
        label: 'Gas Leak',
        severity: 5,
        colorCode: '#FFAA00',
        emergencyNumber: '112',
        requiredSensors: ['gas_detector'],
        correlationSensors: [['gas_detector']],
        autoActions: ['cut_gas_supply', 'cut_power', 'open_ventilation', 'evacuate', 'send_alerts'],
        responseProtocol: [
          'Immediately shut off gas supply valve',
          'Cut all electrical power to prevent ignition',
          'Open all windows and ventilation automatically',
          'Sound evacuation alarm',
          'Do NOT use any electrical switches',
          'Evacuate all residents immediately',
          'Call emergency services (112)',
          'Call gas company emergency line',
          'Wait outside for professional clearance',
          'Do not re-enter until declared safe'
        ],
        recoverySteps: [
          'Wait for gas company clearance',
          'Professional gas line inspection',
          'Ventilate entire home thoroughly',
          'Relight pilot lights professionally',
          'Test all gas appliances',
          'Install additional gas detectors if needed'
        ]
      },
      'carbon-monoxide': {
        id: 'carbon-monoxide',
        label: 'Carbon Monoxide',
        severity: 5,
        colorCode: '#FF6600',
        emergencyNumber: '112',
        requiredSensors: ['co_detector'],
        correlationSensors: [['co_detector']],
        autoActions: ['cut_heating', 'open_ventilation', 'evacuate', 'send_alerts'],
        responseProtocol: [
          'Sound CO alarm on all floors',
          'Shut down all combustion appliances',
          'Open all windows and doors for ventilation',
          'Evacuate all residents immediately',
          'Call emergency services (112)',
          'Account for all household members',
          'Seek medical attention for anyone with symptoms',
          'Do not re-enter until CO levels are safe',
          'Have professional inspect heating system'
        ],
        recoverySteps: [
          'Professional HVAC inspection',
          'Check all combustion appliances',
          'Verify CO detector functionality',
          'Medical follow-up for exposed persons',
          'Install additional CO detectors',
          'Service or replace faulty equipment'
        ]
      },
      intruder: {
        id: 'intruder',
        label: 'Intruder / Break-in',
        severity: 4,
        colorCode: '#FF00FF',
        emergencyNumber: '114 14',
        requiredSensors: ['motion_sensor', 'glass_break_sensor'],
        correlationSensors: [['motion_sensor', 'glass_break_sensor'], ['motion_sensor', 'motion_sensor']],
        autoActions: ['activate_alarm', 'lock_safe_room', 'record_cameras', 'send_alerts', 'activate_lights'],
        responseProtocol: [
          'Activate intruder alarm siren',
          'Lock safe room automatically',
          'Turn on all exterior and interior lights',
          'Begin recording on all security cameras',
          'Send silent alert to residents',
          'Call police (114 14)',
          'Send camera snapshots to residents',
          'Activate strobe lights on exterior',
          'Lock all exterior doors',
          'Track motion sensor activity'
        ],
        recoverySteps: [
          'Wait for police clearance',
          'Check all entry points',
          'Review security camera footage',
          'Document any damage or theft',
          'File police report',
          'Upgrade security if needed',
          'Change access codes'
        ]
      },
      medical: {
        id: 'medical',
        label: 'Medical Emergency',
        severity: 5,
        colorCode: '#00CC00',
        emergencyNumber: '112',
        requiredSensors: [],
        correlationSensors: [],
        autoActions: ['unlock_front_door', 'activate_path_lighting', 'send_alerts', 'send_location'],
        responseProtocol: [
          'Call emergency services (112) immediately',
          'Unlock front door for paramedic access',
          'Turn on all path lighting to front door',
          'Flash exterior lights for ambulance visibility',
          'Send GPS coordinates to emergency contacts',
          'Prepare medical information display',
          'Clear path for stretcher access',
          'Notify emergency contacts via SMS',
          'Activate emergency lighting',
          'Open garage door if needed for ambulance'
        ],
        recoverySteps: [
          'Follow up with medical provider',
          'Update medical information',
          'Check emergency supply inventory',
          'Review response effectiveness',
          'Update emergency contacts if needed'
        ]
      },
      earthquake: {
        id: 'earthquake',
        label: 'Earthquake',
        severity: 5,
        colorCode: '#8B4513',
        emergencyNumber: '112',
        requiredSensors: [],
        correlationSensors: [],
        autoActions: ['cut_gas', 'cut_power_nonessential', 'unlock_doors', 'send_alerts'],
        responseProtocol: [
          'Sound earthquake alarm',
          'Send DROP-COVER-HOLD instruction to all displays',
          'Shut off gas supply immediately',
          'Cut power to non-essential systems',
          'Unlock all exit doors',
          'Activate emergency lighting',
          'After shaking stops: check for injuries',
          'Check for gas leaks and structural damage',
          'Evacuate if structural damage detected',
          'Call emergency services if needed'
        ],
        recoverySteps: [
          'Professional structural inspection',
          'Check all utilities before restoring',
          'Inspect foundation and walls',
          'Check water pipes for damage',
          'Restore systems gradually',
          'Prepare for aftershocks'
        ]
      },
      'severe-weather': {
        id: 'severe-weather',
        label: 'Severe Weather',
        severity: 3,
        colorCode: '#4B0082',
        emergencyNumber: '112',
        requiredSensors: [],
        correlationSensors: [],
        autoActions: ['close_shutters', 'retract_awnings', 'secure_outdoor', 'send_alerts'],
        responseProtocol: [
          'Close all motorized shutters and blinds',
          'Retract all awnings and outdoor covers',
          'Send weather warning to all residents',
          'Secure outdoor furniture and items',
          'Check backup power systems',
          'Fill emergency water supply',
          'Charge all portable devices',
          'Move vehicles to garage if possible',
          'Stay away from windows',
          'Monitor weather updates continuously'
        ],
        recoverySteps: [
          'Inspect exterior for damage',
          'Check roof and gutters',
          'Clear debris from property',
          'Restore outdoor items',
          'Check for water intrusion',
          'Resume normal automation'
        ]
      },
      'power-failure': {
        id: 'power-failure',
        label: 'Power Failure',
        severity: 2,
        colorCode: '#333333',
        emergencyNumber: null,
        requiredSensors: [],
        correlationSensors: [],
        autoActions: ['activate_ups', 'start_generator', 'reduce_power_usage', 'send_alerts'],
        responseProtocol: [
          'Switch to UPS power for critical systems',
          'Start backup generator if extended outage',
          'Reduce power consumption to essentials',
          'Activate emergency lighting',
          'Notify residents of power status',
          'Monitor refrigeration temperatures',
          'Check security system backup power',
          'Contact power company for outage info',
          'Estimate backup runtime remaining',
          'Prioritize critical medical devices'
        ],
        recoverySteps: [
          'Verify stable power restoration',
          'Switch back from backup power',
          'Reset tripped breakers',
          'Check all smart devices reconnected',
          'Verify security system operational',
          'Recharge backup systems',
          'Check food safety in refrigerators'
        ]
      },
      'structural-damage': {
        id: 'structural-damage',
        label: 'Structural Damage',
        severity: 4,
        colorCode: '#800000',
        emergencyNumber: '112',
        requiredSensors: [],
        correlationSensors: [],
        autoActions: ['evacuate', 'cut_gas', 'cut_power', 'send_alerts'],
        responseProtocol: [
          'Sound evacuation alarm immediately',
          'Shut off gas and electricity',
          'Evacuate all residents',
          'Call emergency services (112)',
          'Do not re-enter the building',
          'Account for all household members',
          'Set up safe distance perimeter',
          'Notify neighbors if adjacent risk',
          'Contact structural engineer',
          'Document visible damage from outside'
        ],
        recoverySteps: [
          'Wait for professional structural assessment',
          'Obtain permits for repairs',
          'Hire licensed contractors',
          'Arrange temporary housing if needed',
          'File insurance claim',
          'Monitor repairs closely'
        ]
      }
    };

    // ── 10 Emergency Contacts ───────────────────────────────────────────
    this.emergencyContacts = [
      { id: 'sos', name: 'SOS Alarm', number: '112', type: 'emergency', priority: 1, autoCall: true },
      { id: 'police', name: 'Polisen', number: '114 14', type: 'police', priority: 2, autoCall: false },
      { id: 'fire_dept', name: 'Brandkaaren', number: '112', type: 'fire', priority: 1, autoCall: true },
      { id: 'ambulance', name: 'Ambulans', number: '112', type: 'medical', priority: 1, autoCall: true },
      { id: 'poison', name: 'Giftinformationscentralen', number: '010-456 67 00', type: 'poison', priority: 3, autoCall: false },
      { id: 'hospital', name: 'Karolinska Universitetssjukhuset', number: '08-517 700 00', type: 'hospital', priority: 3, autoCall: false },
      { id: 'family1', name: 'Erik Johansson (Brother)', number: '+46-70-123-4567', type: 'family', priority: 2, autoCall: false },
      { id: 'family2', name: 'Anna Lindstroem (Mother)', number: '+46-73-987-6543', type: 'family', priority: 2, autoCall: false },
      { id: 'neighbor1', name: 'Lars Nilsson (Neighbor)', number: '+46-70-555-1234', type: 'neighbor', priority: 4, autoCall: false },
      { id: 'neighbor2', name: 'Maria Svensson (Neighbor)', number: '+46-70-555-5678', type: 'neighbor', priority: 4, autoCall: false }
    ];

    // ── 20 Emergency Sensors ────────────────────────────────────────────
    this.sensors = {
      smoke_detector_living: {
        id: 'smoke_detector_living', type: 'smoke_detector', location: 'Living Room',
        floor: 1, battery: 92, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Fibaro FGSD-002'
      },
      smoke_detector_kitchen: {
        id: 'smoke_detector_kitchen', type: 'smoke_detector', location: 'Kitchen',
        floor: 1, battery: 88, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Fibaro FGSD-002'
      },
      smoke_detector_bedroom: {
        id: 'smoke_detector_bedroom', type: 'smoke_detector', location: 'Master Bedroom',
        floor: 2, battery: 95, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Fibaro FGSD-002'
      },
      smoke_detector_hallway: {
        id: 'smoke_detector_hallway', type: 'smoke_detector', location: 'Upstairs Hallway',
        floor: 2, battery: 90, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Fibaro FGSD-002'
      },
      co_detector_basement: {
        id: 'co_detector_basement', type: 'co_detector', location: 'Basement',
        floor: 0, battery: 85, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Fibaro FGCO-001'
      },
      co_detector_garage: {
        id: 'co_detector_garage', type: 'co_detector', location: 'Garage',
        floor: 0, battery: 78, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Fibaro FGCO-001'
      },
      flood_sensor_basement: {
        id: 'flood_sensor_basement', type: 'flood_sensor', location: 'Basement Floor',
        floor: 0, battery: 91, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Aeotec Water Sensor 7'
      },
      flood_sensor_bathroom: {
        id: 'flood_sensor_bathroom', type: 'flood_sensor', location: 'Main Bathroom',
        floor: 1, battery: 87, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Aeotec Water Sensor 7'
      },
      flood_sensor_laundry: {
        id: 'flood_sensor_laundry', type: 'flood_sensor', location: 'Laundry Room',
        floor: 1, battery: 93, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Aeotec Water Sensor 7'
      },
      motion_sensor_front: {
        id: 'motion_sensor_front', type: 'motion_sensor', location: 'Front Entrance',
        floor: 1, battery: 82, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Philips Hue Motion'
      },
      motion_sensor_back: {
        id: 'motion_sensor_back', type: 'motion_sensor', location: 'Back Entrance',
        floor: 1, battery: 79, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Philips Hue Motion'
      },
      motion_sensor_garage: {
        id: 'motion_sensor_garage', type: 'motion_sensor', location: 'Garage',
        floor: 0, battery: 84, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Philips Hue Motion'
      },
      motion_sensor_living: {
        id: 'motion_sensor_living', type: 'motion_sensor', location: 'Living Room',
        floor: 1, battery: 88, status: 'online', sensitivity: 'low',
        lastTest: null, model: 'Philips Hue Motion'
      },
      motion_sensor_upstairs: {
        id: 'motion_sensor_upstairs', type: 'motion_sensor', location: 'Upstairs Landing',
        floor: 2, battery: 91, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Philips Hue Motion'
      },
      glass_break_front: {
        id: 'glass_break_front', type: 'glass_break_sensor', location: 'Front Windows',
        floor: 1, battery: 94, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Aeotec Glassbreak 7'
      },
      glass_break_back: {
        id: 'glass_break_back', type: 'glass_break_sensor', location: 'Back Windows',
        floor: 1, battery: 89, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Aeotec Glassbreak 7'
      },
      glass_break_basement: {
        id: 'glass_break_basement', type: 'glass_break_sensor', location: 'Basement Windows',
        floor: 0, battery: 86, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Aeotec Glassbreak 7'
      },
      gas_detector_kitchen: {
        id: 'gas_detector_kitchen', type: 'gas_detector', location: 'Kitchen',
        floor: 1, battery: 90, status: 'online', sensitivity: 'high',
        lastTest: null, model: 'Fibaro Gas Sensor'
      },
      temp_extreme_attic: {
        id: 'temp_extreme_attic', type: 'temperature_extreme', location: 'Attic',
        floor: 3, battery: 83, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Aeotec MultiSensor 7'
      },
      temp_extreme_basement: {
        id: 'temp_extreme_basement', type: 'temperature_extreme', location: 'Basement',
        floor: 0, battery: 87, status: 'online', sensitivity: 'medium',
        lastTest: null, model: 'Aeotec MultiSensor 7'
      }
    };

    // ── 3 Evacuation Routes ─────────────────────────────────────────────
    this.evacuationRoutes = [
      {
        id: 'front_door', name: 'Front Door Route',
        description: 'Main entrance through front hallway',
        steps: [
          'Exit room to hallway',
          'Proceed to front entrance',
          'Exit through front door',
          'Gather at front lawn assembly point'
        ],
        clearance: true, lighting: true, accessible: true,
        estimatedSeconds: 45, assemblyPoint: 'Front lawn by mailbox',
        floor: 1, obstacles: [], lastInspected: '2026-01-15'
      },
      {
        id: 'back_door', name: 'Back Door Route',
        description: 'Rear exit through kitchen to garden',
        steps: [
          'Exit room toward kitchen',
          'Proceed through kitchen to back door',
          'Exit to garden',
          'Move to rear assembly point'
        ],
        clearance: true, lighting: true, accessible: true,
        estimatedSeconds: 55, assemblyPoint: 'Back garden by shed',
        floor: 1, obstacles: [], lastInspected: '2026-01-15'
      },
      {
        id: 'garage_exit', name: 'Garage Exit Route',
        description: 'Exit through garage side door',
        steps: [
          'Proceed to garage',
          'Exit through garage side door',
          'Move to driveway',
          'Gather at street assembly point'
        ],
        clearance: true, lighting: false, accessible: false,
        estimatedSeconds: 60, assemblyPoint: 'Driveway near street',
        floor: 0, obstacles: ['Parked vehicles may block path'],
        lastInspected: '2026-01-10'
      }
    ];

    // ── 12 Emergency Equipment Items ────────────────────────────────────
    this.emergencyEquipment = {
      first_aid_main: {
        id: 'first_aid_main', name: 'First Aid Kit (Main)', type: 'first_aid',
        location: 'Kitchen cabinet', floor: 1, lastInspected: '2026-01-20',
        expiryDate: '2027-06-15', status: 'good',
        contents: ['bandages', 'antiseptic', 'painkillers', 'scissors', 'tweezers', 'gloves', 'CPR mask']
      },
      first_aid_car: {
        id: 'first_aid_car', name: 'First Aid Kit (Car)', type: 'first_aid',
        location: 'Car trunk', floor: 0, lastInspected: '2026-01-10',
        expiryDate: '2027-03-01', status: 'good',
        contents: ['bandages', 'antiseptic', 'emergency blanket', 'gloves']
      },
      fire_ext_kitchen: {
        id: 'fire_ext_kitchen', name: 'Fire Extinguisher (Kitchen)', type: 'fire_extinguisher',
        location: 'Kitchen wall mount', floor: 1, lastInspected: '2025-12-01',
        expiryDate: '2027-12-01', status: 'good',
        extinguisherType: 'ABC', weight: '6kg'
      },
      fire_ext_garage: {
        id: 'fire_ext_garage', name: 'Fire Extinguisher (Garage)', type: 'fire_extinguisher',
        location: 'Garage wall mount', floor: 0, lastInspected: '2025-12-01',
        expiryDate: '2027-12-01', status: 'good',
        extinguisherType: 'ABC', weight: '6kg'
      },
      fire_ext_upstairs: {
        id: 'fire_ext_upstairs', name: 'Fire Extinguisher (Upstairs)', type: 'fire_extinguisher',
        location: 'Upstairs hallway', floor: 2, lastInspected: '2025-12-01',
        expiryDate: '2028-06-01', status: 'good',
        extinguisherType: 'ABC', weight: '2kg'
      },
      flashlight_main: {
        id: 'flashlight_main', name: 'Flashlight (Main)', type: 'flashlight',
        location: 'Front hallway drawer', floor: 1, lastInspected: '2026-01-05',
        expiryDate: null, status: 'good', batteryLevel: 95
      },
      flashlight_bedroom: {
        id: 'flashlight_bedroom', name: 'Flashlight (Bedroom)', type: 'flashlight',
        location: 'Bedside drawer', floor: 2, lastInspected: '2026-01-05',
        expiryDate: null, status: 'good', batteryLevel: 80
      },
      flashlight_basement: {
        id: 'flashlight_basement', name: 'Flashlight (Basement)', type: 'flashlight',
        location: 'Basement shelf', floor: 0, lastInspected: '2026-01-05',
        expiryDate: null, status: 'good', batteryLevel: 70
      },
      flashlight_garage: {
        id: 'flashlight_garage', name: 'Flashlight (Garage)', type: 'flashlight',
        location: 'Garage workbench', floor: 0, lastInspected: '2026-01-05',
        expiryDate: null, status: 'good', batteryLevel: 88
      },
      emergency_radio: {
        id: 'emergency_radio', name: 'Emergency Radio', type: 'emergency_radio',
        location: 'Living room shelf', floor: 1, lastInspected: '2026-01-10',
        expiryDate: null, status: 'good', hasCrankPower: true, batteryLevel: 100
      },
      blanket_emergency1: {
        id: 'blanket_emergency1', name: 'Emergency Blanket Pack (4)', type: 'emergency_blanket',
        location: 'Safe room', floor: 0, lastInspected: '2026-01-01',
        expiryDate: '2030-01-01', status: 'good', quantity: 4
      },
      blanket_emergency2: {
        id: 'blanket_emergency2', name: 'Wool Blankets (2)', type: 'blanket',
        location: 'Hallway closet', floor: 1, lastInspected: '2026-01-01',
        expiryDate: null, status: 'good', quantity: 2
      }
    };

    // ── 7 Alert Channels + 4 Escalation Levels ─────────────────────────
    this.alertChannels = {
      push: { id: 'push', name: 'Push Notification', enabled: true, delay: 0, escalationLevel: 1 },
      sms: { id: 'sms', name: 'SMS Message', enabled: true, delay: 5, escalationLevel: 2 },
      email: { id: 'email', name: 'Email Alert', enabled: true, delay: 10, escalationLevel: 2 },
      siren: { id: 'siren', name: 'Indoor Siren', enabled: true, delay: 0, escalationLevel: 1 },
      voice: { id: 'voice', name: 'Voice Announcement', enabled: true, delay: 2, escalationLevel: 1 },
      smart_display: { id: 'smart_display', name: 'Smart Display Alert', enabled: true, delay: 0, escalationLevel: 1 },
      phone_call: { id: 'phone_call', name: 'Phone Call', enabled: true, delay: 30, escalationLevel: 3 }
    };

    this.escalationLevels = [
      { level: 1, name: 'Immediate', channels: ['push', 'siren', 'voice', 'smart_display'], delaySec: 0, description: 'Instant alerts to all in-home systems' },
      { level: 2, name: 'Urgent', channels: ['sms', 'email'], delaySec: 15, description: 'Remote notifications to residents' },
      { level: 3, name: 'Critical', channels: ['phone_call'], delaySec: 60, description: 'Phone calls to emergency contacts' },
      { level: 4, name: 'Maximum', channels: ['phone_call'], delaySec: 120, description: 'Contact all neighbors and extended family' }
    ];

    // ── 3 Drills ────────────────────────────────────────────────────────
    this.drills = {
      fire_drill: {
        id: 'fire_drill', type: 'fire', name: 'Fire Evacuation Drill',
        frequency: 'quarterly', lastPerformed: '2025-12-15',
        nextScheduled: '2026-03-15', bestScore: 85, lastScore: 82,
        averageEvacTime: 68, participants: ['All household members'],
        procedure: [
          'Alarm sounds', 'Drop everything and proceed to nearest exit',
          'Follow evacuation route signs', 'Meet at assembly point',
          'Account for all members', 'Record evacuation time'
        ]
      },
      earthquake_drill: {
        id: 'earthquake_drill', type: 'earthquake', name: 'Earthquake Safety Drill',
        frequency: 'biannual', lastPerformed: '2025-10-20',
        nextScheduled: '2026-04-20', bestScore: 78, lastScore: 75,
        averageEvacTime: 90, participants: ['All household members'],
        procedure: [
          'Alarm sounds with earthquake warning',
          'DROP to hands and knees', 'Take COVER under sturdy furniture',
          'HOLD ON until shaking stops', 'When safe evacuate building',
          'Meet at assembly point'
        ]
      },
      intruder_drill: {
        id: 'intruder_drill', type: 'intruder', name: 'Intruder Alert Drill',
        frequency: 'biannual', lastPerformed: '2025-11-10',
        nextScheduled: '2026-05-10', bestScore: 80, lastScore: 77,
        averageEvacTime: 40, participants: ['All household members'],
        procedure: [
          'Silent alarm triggers', 'Proceed to safe room quietly',
          'Lock safe room door', 'Call police from safe room',
          'Wait for all-clear signal', 'Do not confront intruder'
        ]
      }
    };

    // ── Safe Room ───────────────────────────────────────────────────────
    this.safeRoom = {
      location: 'Basement reinforced room',
      floor: 0,
      hasLock: true,
      lockType: 'Electronic deadbolt + manual backup',
      communicationDevices: ['Dedicated phone line', 'Mobile phone charger', 'Two-way radio'],
      supplies: {
        water: { quantity: '20 liters', expiry: '2026-08-01' },
        food: { quantity: '72-hour supply', expiry: '2026-12-01' },
        first_aid: { available: true, expiry: '2027-06-15' },
        flashlights: { quantity: 2, batteryLevel: 95 },
        blankets: { quantity: 4 },
        battery_pack: { capacity: '20000mAh', charged: 100 },
        radio: { type: 'Two-way + FM receiver', batteryLevel: 90 },
        documents: ['ID copies', 'Insurance papers', 'Medical records', 'Emergency contacts list']
      },
      ventilation: true,
      fireRating: '2 hours',
      lastInspected: '2026-01-20',
      capacity: 6
    };

    // ── Power Backup Systems ────────────────────────────────────────────
    this.powerBackup = {
      ups: {
        id: 'ups_main', name: 'Main UPS System', type: 'ups',
        status: 'standby', batteryLevel: 100, runtimeMinutes: 45,
        load: 0, maxLoadWatts: 1500,
        protectedDevices: ['Security system', 'Network equipment', 'Smart hub', 'Emergency lighting'],
        lastTest: '2026-01-25', model: 'APC Smart-UPS 1500VA'
      },
      battery_system: {
        id: 'battery_backup', name: 'Home Battery Backup', type: 'battery',
        status: 'charged', batteryLevel: 98, runtimeMinutes: 240,
        maxLoadWatts: 5000,
        protectedCircuits: ['Critical loads', 'Refrigeration', 'Medical devices', 'Communication'],
        lastTest: '2026-01-20', model: 'Tesla Powerwall 2'
      },
      generator: {
        id: 'generator_backup', name: 'Backup Generator', type: 'generator',
        status: 'ready', fuelLevel: 85, fuelType: 'diesel',
        runtimeHours: 18, maxLoadWatts: 8000, autoStart: true,
        lastTest: '2026-01-15', lastServiced: '2025-11-20',
        model: 'Honda EU7000iS'
      }
    };

    // ── 8 Emergency Lights ──────────────────────────────────────────────
    this.emergencyLighting = [
      { id: 'emlight_hallway1', location: 'Front Hallway', floor: 1, type: 'LED emergency', batteryBackup: true, batteryLevel: 100, status: 'ready', autoActivate: true },
      { id: 'emlight_hallway2', location: 'Upstairs Hallway', floor: 2, type: 'LED emergency', batteryBackup: true, batteryLevel: 98, status: 'ready', autoActivate: true },
      { id: 'emlight_stairs1', location: 'Main Staircase', floor: 1, type: 'LED strip', batteryBackup: true, batteryLevel: 95, status: 'ready', autoActivate: true },
      { id: 'emlight_basement', location: 'Basement Corridor', floor: 0, type: 'LED emergency', batteryBackup: true, batteryLevel: 92, status: 'ready', autoActivate: true },
      { id: 'emlight_garage', location: 'Garage', floor: 0, type: 'LED emergency', batteryBackup: true, batteryLevel: 88, status: 'ready', autoActivate: true },
      { id: 'emlight_kitchen', location: 'Kitchen', floor: 1, type: 'LED under-cabinet', batteryBackup: true, batteryLevel: 97, status: 'ready', autoActivate: true },
      { id: 'emlight_exit_front', location: 'Front Door Exit Sign', floor: 1, type: 'Exit sign illuminated', batteryBackup: true, batteryLevel: 100, status: 'ready', autoActivate: true },
      { id: 'emlight_exit_back', location: 'Back Door Exit Sign', floor: 1, type: 'Exit sign illuminated', batteryBackup: true, batteryLevel: 100, status: 'ready', autoActivate: true }
    ];

    // ── Runtime State ───────────────────────────────────────────────────
    this.incidentLog = [];
    this.activeEmergencies = [];
    this.lockdownActive = false;
    this.panicButtonActive = false;
    this.sensorEventBuffer = [];
    this.correlationWindowMs = 30000;
    this.weatherAlerts = {
      region: 'Stockholm',
      lastCheck: null,
      activeAlerts: [],
      alertHistory: []
    };
    this.wellbeingChecks = {
      pendingChecks: [],
      completedChecks: [],
      checkInterval: 30
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Initialization
  // ════════════════════════════════════════════════════════════════════════

  async initialize() {
    try {
      this.homey.log('[EmergencyResponse] Initializing Home Emergency Response System...');

      this._initializeSensorTimestamps();
      this._startSensorMonitoring();
      this._startWeatherMonitoring();
      this._startEquipmentChecks();
      this._startDrillScheduler();
      this._startPowerBackupMonitoring();
      this._startWellbeingScheduler();
      this._startCorrelationEngine();

      this.initialized = true;

      this.homey.log('[EmergencyResponse] System initialized with ' + Object.keys(this.sensors).length + ' sensors');
      this.homey.log('[EmergencyResponse] Monitoring ' + Object.keys(this.emergencyTypes).length + ' emergency types');
      this.homey.log('[EmergencyResponse] ' + this.evacuationRoutes.length + ' evacuation routes configured');
      this.homey.log('[EmergencyResponse] ' + this.emergencyContacts.length + ' emergency contacts loaded');

      this.homey.emit('emergency-response-initialized', {
        sensors: Object.keys(this.sensors).length,
        emergencyTypes: Object.keys(this.emergencyTypes).length,
        routes: this.evacuationRoutes.length,
        contacts: this.emergencyContacts.length,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (err) {
      this.homey.error('[EmergencyResponse] Initialization failed:', err.message);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Sensor Initialization & Monitoring
  // ════════════════════════════════════════════════════════════════════════

  _initializeSensorTimestamps() {
    var now = new Date().toISOString();
    var sensorKeys = Object.keys(this.sensors);
    for (var i = 0; i < sensorKeys.length; i++) {
      this.sensors[sensorKeys[i]].lastTest = now;
      this.sensors[sensorKeys[i]].lastTriggered = null;
      this.sensors[sensorKeys[i]].triggerCount = 0;
    }
  }

  _startSensorMonitoring() {
    var self = this;
    var interval = setInterval(function() {
      self._monitorAllSensors();
    }, 60000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Sensor monitoring started (60s interval)');
  }

  _monitorAllSensors() {
    var offlineSensors = [];
    var lowBatterySensors = [];
    var keys = Object.keys(this.sensors);

    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var sensor = this.sensors[id];

      // Slow battery drain simulation
      if (sensor.battery > 5) {
        sensor.battery = Math.max(5, sensor.battery - (Math.random() * 0.02));
      }

      if (sensor.battery < 20) {
        lowBatterySensors.push({
          id: id,
          location: sensor.location,
          battery: Math.round(sensor.battery)
        });
      }

      // Rare random offline simulation
      if (Math.random() < 0.001) {
        sensor.status = 'offline';
        offlineSensors.push({ id: id, location: sensor.location, type: sensor.type });
      }
    }

    if (offlineSensors.length > 0) {
      this.homey.log('[EmergencyResponse] WARNING: ' + offlineSensors.length + ' sensors offline');
      this.homey.emit('emergency-sensor-offline', {
        sensors: offlineSensors,
        timestamp: new Date().toISOString()
      });
    }

    if (lowBatterySensors.length > 0) {
      this.homey.log('[EmergencyResponse] Low battery sensors: ' + lowBatterySensors.length);
      this.homey.emit('emergency-sensor-low-battery', {
        sensors: lowBatterySensors,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Weather Monitoring (Stockholm)
  // ════════════════════════════════════════════════════════════════════════

  _startWeatherMonitoring() {
    var self = this;
    var interval = setInterval(function() {
      self._checkWeatherAlerts();
    }, 300000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Weather monitoring started for Stockholm (5min interval)');
  }

  _checkWeatherAlerts() {
    this.weatherAlerts.lastCheck = new Date().toISOString();

    var possibleAlerts = [
      { type: 'storm', severity: 3, message: 'Storm warning for Stockholm region' },
      { type: 'heavy_snow', severity: 2, message: 'Heavy snowfall expected in Stockholm' },
      { type: 'extreme_cold', severity: 2, message: 'Extreme cold warning below -20C' },
      { type: 'flooding', severity: 3, message: 'Flood risk in low-lying areas of Stockholm' },
      { type: 'high_winds', severity: 2, message: 'High wind warning for Stockholm archipelago' }
    ];

    // Low probability weather alert simulation
    if (Math.random() < 0.002) {
      var alert = possibleAlerts[Math.floor(Math.random() * possibleAlerts.length)];
      alert.timestamp = new Date().toISOString();
      alert.id = 'weather_' + Date.now();
      alert.region = 'Stockholm';
      alert.active = true;

      this.weatherAlerts.activeAlerts.push(alert);
      this.weatherAlerts.alertHistory.push(Object.assign({}, alert));

      this.homey.log('[EmergencyResponse] Weather alert: ' + alert.message);
      this.homey.emit('emergency-weather-alert', alert);

      if (alert.severity >= 3) {
        this._triggerEmergency('severe-weather', 'Weather service: ' + alert.message, {
          weatherAlert: alert
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Equipment Checks
  // ════════════════════════════════════════════════════════════════════════

  _startEquipmentChecks() {
    var self = this;
    var interval = setInterval(function() {
      self._checkEquipmentStatus();
    }, 3600000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Equipment check monitoring started (1hr interval)');
  }

  _checkEquipmentStatus() {
    var issues = [];
    var now = new Date();
    var keys = Object.keys(this.emergencyEquipment);

    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var item = this.emergencyEquipment[id];

      if (item.expiryDate) {
        var expiry = new Date(item.expiryDate);
        var daysUntilExpiry = Math.floor((expiry - now) / 86400000);

        if (daysUntilExpiry < 0) {
          issues.push({ id: id, name: item.name, issue: 'expired', daysOverdue: Math.abs(daysUntilExpiry) });
          item.status = 'expired';
        } else if (daysUntilExpiry < 30) {
          issues.push({ id: id, name: item.name, issue: 'expiring_soon', daysRemaining: daysUntilExpiry });
          item.status = 'expiring_soon';
        }
      }

      if (item.batteryLevel !== undefined && item.batteryLevel < 30) {
        issues.push({ id: id, name: item.name, issue: 'low_battery', batteryLevel: item.batteryLevel });
      }
    }

    if (issues.length > 0) {
      this.homey.log('[EmergencyResponse] Equipment issues found: ' + issues.length);
      this.homey.emit('emergency-equipment-issues', {
        issues: issues,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Drill Scheduler
  // ════════════════════════════════════════════════════════════════════════

  _startDrillScheduler() {
    var self = this;
    var interval = setInterval(function() {
      self._checkScheduledDrills();
    }, 86400000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Drill scheduler started (daily check)');
  }

  _checkScheduledDrills() {
    var now = new Date();
    var keys = Object.keys(this.drills);

    for (var i = 0; i < keys.length; i++) {
      var drill = this.drills[keys[i]];
      var nextDate = new Date(drill.nextScheduled);
      var daysUntil = Math.floor((nextDate - now) / 86400000);

      if (daysUntil <= 7 && daysUntil > 0) {
        this.homey.log('[EmergencyResponse] Drill reminder: ' + drill.name + ' in ' + daysUntil + ' days');
        this.homey.emit('emergency-drill-reminder', {
          drill: drill.name,
          type: drill.type,
          daysUntil: daysUntil,
          scheduledDate: drill.nextScheduled,
          timestamp: new Date().toISOString()
        });
      } else if (daysUntil <= 0) {
        this.homey.log('[EmergencyResponse] Drill overdue: ' + drill.name);
        this.homey.emit('emergency-drill-overdue', {
          drill: drill.name,
          type: drill.type,
          scheduledDate: drill.nextScheduled,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Power Backup Monitoring
  // ════════════════════════════════════════════════════════════════════════

  _startPowerBackupMonitoring() {
    var self = this;
    var interval = setInterval(function() {
      self._monitorPowerBackup();
    }, 120000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Power backup monitoring started (2min interval)');
  }

  _monitorPowerBackup() {
    var ups = this.powerBackup.ups;
    var batSys = this.powerBackup.battery_system;
    var gen = this.powerBackup.generator;

    if (ups.status === 'active') {
      ups.batteryLevel = Math.max(0, ups.batteryLevel - 0.5);
      if (ups.batteryLevel < 20) {
        this.homey.log('[EmergencyResponse] UPS battery critical: ' + Math.round(ups.batteryLevel) + '%');
        this.homey.emit('emergency-ups-critical', {
          batteryLevel: Math.round(ups.batteryLevel),
          runtimeMinutes: Math.round(ups.runtimeMinutes * ups.batteryLevel / 100)
        });
        if (gen.autoStart && gen.status === 'ready' && gen.fuelLevel > 5) {
          this._startGenerator();
        }
      }
    }

    if (batSys.status === 'discharging') {
      batSys.batteryLevel = Math.max(0, batSys.batteryLevel - 0.1);
      if (batSys.batteryLevel < 15) {
        this.homey.log('[EmergencyResponse] Battery backup low: ' + Math.round(batSys.batteryLevel) + '%');
        this.homey.emit('emergency-battery-low', {
          batteryLevel: Math.round(batSys.batteryLevel)
        });
      }
    }

    if (gen.status === 'running') {
      gen.fuelLevel = Math.max(0, gen.fuelLevel - 0.05);
      if (gen.fuelLevel < 15) {
        this.homey.log('[EmergencyResponse] Generator fuel low: ' + Math.round(gen.fuelLevel) + '%');
        this.homey.emit('emergency-generator-fuel-low', {
          fuelLevel: Math.round(gen.fuelLevel)
        });
      }
    }
  }

  _startGenerator() {
    this.powerBackup.generator.status = 'running';
    this.homey.log('[EmergencyResponse] Backup generator started automatically');
    this.homey.emit('emergency-generator-started', {
      fuelLevel: this.powerBackup.generator.fuelLevel,
      estimatedRuntime: Math.round(
        this.powerBackup.generator.runtimeHours * this.powerBackup.generator.fuelLevel / 100
      ),
      timestamp: new Date().toISOString()
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Wellbeing Scheduler
  // ════════════════════════════════════════════════════════════════════════

  _startWellbeingScheduler() {
    var self = this;
    var interval = setInterval(function() {
      self._processWellbeingChecks();
    }, 1800000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Wellbeing check scheduler started (30min interval)');
  }

  _processWellbeingChecks() {
    if (this.wellbeingChecks.pendingChecks.length === 0) {
      return;
    }

    var now = Date.now();
    for (var i = 0; i < this.wellbeingChecks.pendingChecks.length; i++) {
      var check = this.wellbeingChecks.pendingChecks[i];
      if (!check.responded && (now - check.scheduledAt > this.wellbeingChecks.checkInterval * 60000)) {
        check.escalated = true;
        this.homey.log('[EmergencyResponse] Wellbeing check overdue for: ' + check.person);
        this.homey.emit('emergency-wellbeing-overdue', {
          person: check.person,
          scheduledAt: new Date(check.scheduledAt).toISOString(),
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Multi-Sensor Correlation Engine
  // ════════════════════════════════════════════════════════════════════════

  _startCorrelationEngine() {
    var self = this;
    var interval = setInterval(function() {
      self._processCorrelationBuffer();
    }, 5000);
    this.intervals.push(interval);
    this.homey.log('[EmergencyResponse] Multi-sensor correlation engine started (5s interval)');
  }

  _processCorrelationBuffer() {
    var now = Date.now();
    var winMs = this.correlationWindowMs;

    // Prune stale events
    this.sensorEventBuffer = this.sensorEventBuffer.filter(function(e) {
      return (now - e.timestamp) < winMs;
    });

    if (this.sensorEventBuffer.length < 2) {
      return;
    }

    // Smoke + Heat = FIRE
    var smokeEvents = this.sensorEventBuffer.filter(function(e) {
      return e.sensorType === 'smoke_detector';
    });
    var heatEvents = this.sensorEventBuffer.filter(function(e) {
      return e.sensorType === 'temperature_extreme';
    });

    if (smokeEvents.length > 0 && heatEvents.length > 0) {
      this.homey.log('[EmergencyResponse] CORRELATION: Smoke + Heat detected - FIRE confirmed');
      this._triggerEmergency('fire', 'Multi-sensor correlation: smoke and extreme heat detected', {
        smokeSensors: smokeEvents.map(function(e) { return e.sensorId; }),
        heatSensors: heatEvents.map(function(e) { return e.sensorId; })
      });
      this.sensorEventBuffer = this.sensorEventBuffer.filter(function(e) {
        return e.sensorType !== 'smoke_detector' && e.sensorType !== 'temperature_extreme';
      });
    }

    // Motion + Glass break = INTRUDER
    var motionEvents = this.sensorEventBuffer.filter(function(e) {
      return e.sensorType === 'motion_sensor';
    });
    var glassEvents = this.sensorEventBuffer.filter(function(e) {
      return e.sensorType === 'glass_break_sensor';
    });

    if (motionEvents.length > 0 && glassEvents.length > 0) {
      this.homey.log('[EmergencyResponse] CORRELATION: Motion + Glass break - INTRUDER confirmed');
      this._triggerEmergency('intruder', 'Multi-sensor correlation: motion and glass break detected', {
        motionSensors: motionEvents.map(function(e) { return e.sensorId; }),
        glassSensors: glassEvents.map(function(e) { return e.sensorId; })
      });
      this.sensorEventBuffer = this.sensorEventBuffer.filter(function(e) {
        return e.sensorType !== 'motion_sensor' && e.sensorType !== 'glass_break_sensor';
      });
    }

    // Multiple flood sensors = FLOOD
    var floodEvents = this.sensorEventBuffer.filter(function(e) {
      return e.sensorType === 'flood_sensor';
    });
    if (floodEvents.length >= 2) {
      this.homey.log('[EmergencyResponse] CORRELATION: Multiple flood sensors - FLOOD confirmed');
      this._triggerEmergency('flood', 'Multi-sensor correlation: multiple flood sensors triggered', {
        floodSensors: floodEvents.map(function(e) { return e.sensorId; })
      });
      this.sensorEventBuffer = this.sensorEventBuffer.filter(function(e) {
        return e.sensorType !== 'flood_sensor';
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Sensor Event Reporting
  // ════════════════════════════════════════════════════════════════════════

  reportSensorEvent(sensorId, eventType, data) {
    var sensor = this.sensors[sensorId];
    if (!sensor) {
      this.homey.error('[EmergencyResponse] Unknown sensor: ' + sensorId);
      return;
    }

    sensor.lastTriggered = new Date().toISOString();
    sensor.triggerCount = (sensor.triggerCount || 0) + 1;

    var event = {
      sensorId: sensorId,
      sensorType: sensor.type,
      location: sensor.location,
      floor: sensor.floor,
      eventType: eventType,
      data: data,
      timestamp: Date.now()
    };
    this.sensorEventBuffer.push(event);

    this.homey.log('[EmergencyResponse] Sensor event: ' + sensor.type + ' at ' + sensor.location + ' - ' + eventType);

    // Check for immediate single-sensor vs multi-sensor confirmation
    var sType = sensor.type;
    var winMs = this.correlationWindowMs;
    var recentSameType = this.sensorEventBuffer.filter(function(e) {
      return e.sensorType === sType && (Date.now() - e.timestamp) < winMs;
    });

    if (recentSameType.length === 1) {
      this.homey.log('[EmergencyResponse] Single sensor trigger - issuing WARNING (possible false alarm)');
      this.homey.emit('emergency-warning', {
        type: sensor.type,
        location: sensor.location,
        message: 'Single sensor triggered - monitoring for confirmation',
        sensorId: sensorId,
        timestamp: new Date().toISOString()
      });
    } else if (recentSameType.length >= 2) {
      this.homey.log('[EmergencyResponse] Multiple sensors confirm - escalating to ALARM');
      this._handleConfirmedSensorAlarm(sensor.type, recentSameType);
    }
  }

  _handleConfirmedSensorAlarm(sensorType, events) {
    var typeMapping = {
      smoke_detector: 'fire',
      co_detector: 'carbon-monoxide',
      flood_sensor: 'flood',
      gas_detector: 'gas-leak',
      glass_break_sensor: 'intruder',
      temperature_extreme: 'fire'
    };

    var emergencyType = typeMapping[sensorType];
    if (emergencyType) {
      var locations = events.map(function(e) { return e.location; }).join(', ');
      this._triggerEmergency(
        emergencyType,
        'Multiple ' + sensorType + ' sensors triggered at: ' + locations,
        { sensorEvents: events, confirmedBy: events.length + ' sensors' }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Emergency Trigger & Lifecycle
  // ════════════════════════════════════════════════════════════════════════

  _triggerEmergency(typeId, reason, details) {
    var emergencyType = this.emergencyTypes[typeId];
    if (!emergencyType) {
      this.homey.error('[EmergencyResponse] Unknown emergency type: ' + typeId);
      return null;
    }

    // De-duplicate active emergencies of same type
    var existingActive = null;
    for (var i = 0; i < this.activeEmergencies.length; i++) {
      if (this.activeEmergencies[i].typeId === typeId && this.activeEmergencies[i].status === 'active') {
        existingActive = this.activeEmergencies[i];
        break;
      }
    }
    if (existingActive) {
      this.homey.log('[EmergencyResponse] Emergency already active: ' + typeId + ', updating details');
      existingActive.updates.push({
        reason: reason,
        details: details,
        timestamp: new Date().toISOString()
      });
      return existingActive;
    }

    var incident = {
      id: 'emergency_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      typeId: typeId,
      type: emergencyType,
      reason: reason,
      details: details || {},
      severity: emergencyType.severity,
      status: 'active',
      triggeredAt: new Date().toISOString(),
      resolvedAt: null,
      updates: [],
      actionsExecuted: [],
      alertsSent: [],
      responseTimeMs: null
    };

    this.activeEmergencies.push(incident);
    this.incidentLog.push(Object.assign({}, incident, { loggedAt: new Date().toISOString() }));

    this.homey.log('[EmergencyResponse] *** EMERGENCY TRIGGERED: ' + emergencyType.label + ' (Severity ' + emergencyType.severity + ') ***');
    this.homey.log('[EmergencyResponse] Reason: ' + reason);

    this._executeResponseProtocol(incident);
    this._sendMultiChannelAlerts(incident);
    this._executeAutoActions(incident);

    this.homey.emit('emergency-triggered', {
      id: incident.id,
      type: typeId,
      label: emergencyType.label,
      severity: emergencyType.severity,
      reason: reason,
      colorCode: emergencyType.colorCode,
      timestamp: incident.triggeredAt
    });

    return incident;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Response Protocol Execution
  // ════════════════════════════════════════════════════════════════════════

  _executeResponseProtocol(incident) {
    var protocol = incident.type.responseProtocol;
    this.homey.log('[EmergencyResponse] Executing response protocol for: ' + incident.type.label);

    for (var i = 0; i < protocol.length; i++) {
      this.homey.log('[EmergencyResponse] Protocol step ' + (i + 1) + '/' + protocol.length + ': ' + protocol[i]);
      incident.actionsExecuted.push({
        step: i + 1,
        action: protocol[i],
        executedAt: new Date().toISOString(),
        status: 'executed'
      });
    }

    this.homey.emit('emergency-protocol-executed', {
      emergencyId: incident.id,
      type: incident.typeId,
      stepsExecuted: protocol.length,
      timestamp: new Date().toISOString()
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Multi-Channel Alert System
  // ════════════════════════════════════════════════════════════════════════

  _sendMultiChannelAlerts(incident) {
    this.homey.log('[EmergencyResponse] Sending multi-channel alerts for: ' + incident.type.label);

    for (var li = 0; li < this.escalationLevels.length; li++) {
      var level = this.escalationLevels[li];

      for (var ci = 0; ci < level.channels.length; ci++) {
        var channelId = level.channels[ci];
        var channel = this.alertChannels[channelId];
        if (!channel || !channel.enabled) {
          continue;
        }

        var alertObj = {
          channelId: channelId,
          channelName: channel.name,
          escalationLevel: level.level,
          escalationName: level.name,
          delay: channel.delay + level.delaySec,
          message: this._formatAlertMessage(incident, channel),
          sentAt: new Date().toISOString(),
          status: 'sent'
        };

        incident.alertsSent.push(alertObj);
        this.homey.log('[EmergencyResponse] Alert [Level ' + level.level + '] via ' + channel.name + ': ' + incident.type.label);
      }
    }

    if (incident.severity >= 4) {
      this._notifyEmergencyContacts(incident);
    }

    this.homey.emit('emergency-alerts-sent', {
      emergencyId: incident.id,
      alertCount: incident.alertsSent.length,
      timestamp: new Date().toISOString()
    });
  }

  _formatAlertMessage(incident, channel) {
    var t = incident.type;
    var base = 'EMERGENCY: ' + t.label + ' (Severity ' + t.severity + '/5) - ';
    var reason = 'Reason: ' + incident.reason;

    if (channel.id === 'sms') {
      return base + reason + ' Call ' + (t.emergencyNumber || '112') + ' if needed.';
    }
    if (channel.id === 'voice') {
      return 'Attention! ' + t.label + ' emergency detected. ' + incident.reason + '. Please follow evacuation procedures.';
    }
    if (channel.id === 'smart_display') {
      return base + reason + ' Time: ' + incident.triggeredAt + ' Color: ' + t.colorCode + ' Evacuation routes displayed.';
    }
    return base + reason + ' Time: ' + incident.triggeredAt + ' Follow emergency protocol.';
  }

  _notifyEmergencyContacts(incident) {
    var contacts = this.emergencyContacts.slice().sort(function(a, b) {
      return a.priority - b.priority;
    });

    for (var i = 0; i < contacts.length; i++) {
      var contact = contacts[i];
      this.homey.log('[EmergencyResponse] Notifying contact: ' + contact.name + ' (' + contact.number + ')');
      incident.alertsSent.push({
        channelId: 'contact_notification',
        contactName: contact.name,
        contactNumber: contact.number,
        contactType: contact.type,
        autoCall: contact.autoCall,
        sentAt: new Date().toISOString(),
        status: contact.autoCall ? 'auto_called' : 'notified'
      });
    }

    this.homey.emit('emergency-contacts-notified', {
      emergencyId: incident.id,
      contactsNotified: contacts.length,
      timestamp: new Date().toISOString()
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Auto-Actions & Emergency Lighting
  // ════════════════════════════════════════════════════════════════════════

  _executeAutoActions(incident) {
    var actions = incident.type.autoActions || [];
    this.homey.log('[EmergencyResponse] Executing ' + actions.length + ' auto-actions for: ' + incident.type.label);

    for (var i = 0; i < actions.length; i++) {
      this.homey.log('[EmergencyResponse] Auto-action: ' + actions[i]);
      incident.actionsExecuted.push({
        action: actions[i],
        type: 'auto',
        executedAt: new Date().toISOString(),
        status: 'executed'
      });
    }

    this._activateEmergencyLighting();

    this.homey.emit('emergency-actions-executed', {
      emergencyId: incident.id,
      actionsCount: actions.length,
      timestamp: new Date().toISOString()
    });
  }

  _activateEmergencyLighting() {
    var activated = 0;
    for (var i = 0; i < this.emergencyLighting.length; i++) {
      var light = this.emergencyLighting[i];
      if (light.autoActivate && light.status === 'ready' && light.batteryLevel > 5) {
        light.status = 'active';
        activated++;
      }
    }
    if (activated > 0) {
      this.homey.log('[EmergencyResponse] Activated ' + activated + ' emergency lights');
      this.homey.emit('emergency-lighting-activated', {
        count: activated,
        timestamp: new Date().toISOString()
      });
    }
  }

  _deactivateEmergencyLighting() {
    for (var i = 0; i < this.emergencyLighting.length; i++) {
      if (this.emergencyLighting[i].status === 'active') {
        this.emergencyLighting[i].status = 'ready';
      }
    }
    this.homey.log('[EmergencyResponse] Emergency lighting deactivated');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Emergency Resolution & Recovery
  // ════════════════════════════════════════════════════════════════════════

  resolveEmergency(emergencyId, resolution) {
    var incident = null;
    for (var i = 0; i < this.activeEmergencies.length; i++) {
      if (this.activeEmergencies[i].id === emergencyId) {
        incident = this.activeEmergencies[i];
        break;
      }
    }

    if (!incident) {
      this.homey.error('[EmergencyResponse] Emergency not found: ' + emergencyId);
      return null;
    }

    incident.status = 'resolved';
    incident.resolvedAt = new Date().toISOString();
    incident.resolution = resolution || 'Manually resolved';
    incident.responseTimeMs = new Date(incident.resolvedAt) - new Date(incident.triggeredAt);

    this.homey.log('[EmergencyResponse] Emergency resolved: ' + incident.type.label +
      ' (Response time: ' + Math.round(incident.responseTimeMs / 1000) + 's)');

    // Update log entry
    for (var j = 0; j < this.incidentLog.length; j++) {
      if (this.incidentLog[j].id === emergencyId) {
        this.incidentLog[j].status = 'resolved';
        this.incidentLog[j].resolvedAt = incident.resolvedAt;
        this.incidentLog[j].resolution = incident.resolution;
        this.incidentLog[j].responseTimeMs = incident.responseTimeMs;
        break;
      }
    }

    this._deactivateEmergencyLighting();
    this._initiateRecoveryProcedures(incident);
    this._scheduleWellbeingCheck(incident);

    // Remove from active list
    this.activeEmergencies = this.activeEmergencies.filter(function(e) {
      return e.id !== emergencyId;
    });

    // Lift lockdown if no more active emergencies
    if (this.lockdownActive && this.activeEmergencies.length === 0) {
      this.deactivateLockdown('All emergencies resolved');
    }

    this.homey.emit('emergency-resolved', {
      id: emergencyId,
      type: incident.typeId,
      label: incident.type.label,
      responseTimeMs: incident.responseTimeMs,
      resolution: incident.resolution,
      timestamp: incident.resolvedAt
    });

    return incident;
  }

  _initiateRecoveryProcedures(incident) {
    var recoverySteps = incident.type.recoverySteps || [];
    if (recoverySteps.length === 0) {
      return null;
    }

    this.homey.log('[EmergencyResponse] Initiating recovery procedures for: ' + incident.type.label);

    var recoveryPlan = {
      emergencyId: incident.id,
      type: incident.typeId,
      steps: [],
      createdAt: new Date().toISOString(),
      status: 'in_progress'
    };

    for (var i = 0; i < recoverySteps.length; i++) {
      recoveryPlan.steps.push({
        step: i + 1,
        description: recoverySteps[i],
        status: 'pending',
        completedAt: null
      });
      this.homey.log('[EmergencyResponse] Recovery step ' + (i + 1) + ': ' + recoverySteps[i]);
    }

    this.homey.emit('emergency-recovery-initiated', {
      emergencyId: incident.id,
      type: incident.typeId,
      stepsCount: recoverySteps.length,
      timestamp: new Date().toISOString()
    });

    return recoveryPlan;
  }

  _scheduleWellbeingCheck(incident) {
    var check = {
      id: 'wellbeing_' + Date.now(),
      emergencyId: incident.id,
      emergencyType: incident.typeId,
      person: 'All household members',
      scheduledAt: Date.now(),
      responded: false,
      escalated: false,
      checkType: 'post_emergency'
    };

    this.wellbeingChecks.pendingChecks.push(check);
    this.homey.log('[EmergencyResponse] Wellbeing check scheduled for post-emergency: ' + incident.type.label);

    this.homey.emit('emergency-wellbeing-scheduled', {
      checkId: check.id,
      emergencyId: incident.id,
      timestamp: new Date().toISOString()
    });
  }

  respondToWellbeingCheck(checkId, response) {
    var check = null;
    var checkIdx = -1;

    for (var i = 0; i < this.wellbeingChecks.pendingChecks.length; i++) {
      if (this.wellbeingChecks.pendingChecks[i].id === checkId) {
        check = this.wellbeingChecks.pendingChecks[i];
        checkIdx = i;
        break;
      }
    }

    if (!check) {
      this.homey.error('[EmergencyResponse] Wellbeing check not found: ' + checkId);
      return false;
    }

    check.responded = true;
    check.responseTime = new Date().toISOString();
    check.response = response;

    this.wellbeingChecks.pendingChecks.splice(checkIdx, 1);
    this.wellbeingChecks.completedChecks.push(check);

    this.homey.log('[EmergencyResponse] Wellbeing check responded: ' + checkId + ' - ' + response);
    this.homey.emit('emergency-wellbeing-responded', {
      checkId: checkId,
      response: response,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Panic Button
  // ════════════════════════════════════════════════════════════════════════

  triggerPanicButton(source, details) {
    this.panicButtonActive = true;
    var reason = 'Panic button activated from ' + (source || 'unknown source');

    this.homey.log('[EmergencyResponse] *** PANIC BUTTON ACTIVATED *** Source: ' + source);

    var incident = this._triggerEmergency('medical', reason, {
      source: source,
      panicButton: true,
      details: details || {}
    });

    this.homey.emit('emergency-panic-button', {
      source: source,
      emergencyId: incident ? incident.id : null,
      timestamp: new Date().toISOString()
    });

    return incident;
  }

  deactivatePanicButton() {
    this.panicButtonActive = false;
    this.homey.log('[EmergencyResponse] Panic button deactivated');
    this.homey.emit('emergency-panic-deactivated', {
      timestamp: new Date().toISOString()
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Lockdown
  // ════════════════════════════════════════════════════════════════════════

  activateLockdown(reason) {
    if (this.lockdownActive) {
      this.homey.log('[EmergencyResponse] Lockdown already active');
      return;
    }

    this.lockdownActive = true;
    this.homey.log('[EmergencyResponse] *** LOCKDOWN ACTIVATED *** Reason: ' + reason);

    var lockdownActions = [
      'Lock all exterior doors',
      'Close all motorized windows',
      'Activate security cameras to record',
      'Enable perimeter alarm',
      'Lock garage doors',
      'Activate exterior lights',
      'Arm all security zones',
      'Enable safe room access',
      'Disable guest access codes',
      'Activate monitoring mode on all sensors'
    ];

    for (var i = 0; i < lockdownActions.length; i++) {
      this.homey.log('[EmergencyResponse] Lockdown action: ' + lockdownActions[i]);
    }

    this.homey.emit('emergency-lockdown-activated', {
      reason: reason,
      actionsCount: lockdownActions.length,
      timestamp: new Date().toISOString()
    });

    this._activateEmergencyLighting();
  }

  deactivateLockdown(reason) {
    if (!this.lockdownActive) {
      this.homey.log('[EmergencyResponse] No active lockdown to deactivate');
      return;
    }

    this.lockdownActive = false;
    this.homey.log('[EmergencyResponse] Lockdown deactivated. Reason: ' + reason);
    this._deactivateEmergencyLighting();

    this.homey.emit('emergency-lockdown-deactivated', {
      reason: reason,
      timestamp: new Date().toISOString()
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Drill Execution
  // ════════════════════════════════════════════════════════════════════════

  runDrill(drillId) {
    var drill = this.drills[drillId];
    if (!drill) {
      this.homey.error('[EmergencyResponse] Unknown drill: ' + drillId);
      return null;
    }

    this.homey.log('[EmergencyResponse] Starting drill: ' + drill.name);

    var drillRun = {
      id: 'drill_run_' + Date.now(),
      drillId: drillId,
      name: drill.name,
      type: drill.type,
      startedAt: new Date().toISOString(),
      endedAt: null,
      score: null,
      evacuationTime: null,
      participants: drill.participants,
      steps: []
    };

    for (var i = 0; i < drill.procedure.length; i++) {
      this.homey.log('[EmergencyResponse] Drill step ' + (i + 1) + ': ' + drill.procedure[i]);
      drillRun.steps.push({
        step: i + 1,
        description: drill.procedure[i],
        completedAt: new Date().toISOString()
      });
    }

    var elapsedSeconds = 30 + Math.floor(Math.random() * 60);
    var score = Math.max(50, Math.min(100, 85 + Math.floor(Math.random() * 15) - 7));

    drillRun.endedAt = new Date().toISOString();
    drillRun.score = score;
    drillRun.evacuationTime = elapsedSeconds;

    drill.lastPerformed = new Date().toISOString().split('T')[0];
    drill.lastScore = score;
    if (score > drill.bestScore) {
      drill.bestScore = score;
    }
    drill.averageEvacTime = Math.round((drill.averageEvacTime + elapsedSeconds) / 2);

    var freqMap = { quarterly: 90, biannual: 180, annual: 365 };
    var nextDays = freqMap[drill.frequency] || 90;
    var nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextDays);
    drill.nextScheduled = nextDate.toISOString().split('T')[0];

    this.homey.log('[EmergencyResponse] Drill completed: ' + drill.name +
      ' - Score: ' + score + ', Time: ' + elapsedSeconds + 's');

    this.homey.emit('emergency-drill-completed', {
      drillId: drillId,
      name: drill.name,
      score: score,
      evacuationTime: elapsedSeconds,
      nextScheduled: drill.nextScheduled,
      timestamp: new Date().toISOString()
    });

    return drillRun;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Evacuation Route Selection
  // ════════════════════════════════════════════════════════════════════════

  getEvacuationRoute(preferredRoute) {
    if (preferredRoute) {
      for (var i = 0; i < this.evacuationRoutes.length; i++) {
        if (this.evacuationRoutes[i].id === preferredRoute && this.evacuationRoutes[i].clearance) {
          return this.evacuationRoutes[i];
        }
      }
    }

    // Rank by accessibility, lighting, then time
    var available = this.evacuationRoutes.filter(function(r) { return r.clearance; });
    available.sort(function(a, b) {
      if (a.accessible !== b.accessible) { return a.accessible ? -1 : 1; }
      if (a.lighting !== b.lighting) { return a.lighting ? -1 : 1; }
      return a.estimatedSeconds - b.estimatedSeconds;
    });

    if (available.length === 0) {
      this.homey.error('[EmergencyResponse] No evacuation routes available!');
      return null;
    }

    this.homey.log('[EmergencyResponse] Recommended evacuation: ' + available[0].name +
      ' (' + available[0].estimatedSeconds + 's)');
    return available[0];
  }

  setEvacuationRouteClearance(routeId, cleared) {
    var route = null;
    for (var i = 0; i < this.evacuationRoutes.length; i++) {
      if (this.evacuationRoutes[i].id === routeId) {
        route = this.evacuationRoutes[i];
        break;
      }
    }

    if (!route) {
      this.homey.error('[EmergencyResponse] Route not found: ' + routeId);
      return false;
    }

    route.clearance = cleared;
    this.homey.log('[EmergencyResponse] Route ' + route.name + ' clearance: ' + (cleared ? 'CLEAR' : 'BLOCKED'));
    this.homey.emit('emergency-route-updated', {
      routeId: routeId,
      name: route.name,
      clearance: cleared,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Safe Room Status
  // ════════════════════════════════════════════════════════════════════════

  getSafeRoomStatus() {
    var room = this.safeRoom;
    var supplies = room.supplies;
    var issues = [];

    if (supplies.water.expiry && new Date(supplies.water.expiry) < new Date()) {
      issues.push('Water supply expired');
    }
    if (supplies.food.expiry && new Date(supplies.food.expiry) < new Date()) {
      issues.push('Food supply expired');
    }
    if (supplies.first_aid.expiry && new Date(supplies.first_aid.expiry) < new Date()) {
      issues.push('First aid kit expired');
    }
    if (supplies.battery_pack.charged < 50) {
      issues.push('Battery pack low: ' + supplies.battery_pack.charged + '%');
    }
    if (supplies.flashlights.batteryLevel < 30) {
      issues.push('Flashlight batteries low');
    }

    return {
      location: room.location,
      floor: room.floor,
      capacity: room.capacity,
      hasLock: room.hasLock,
      ventilation: room.ventilation,
      fireRating: room.fireRating,
      communication: room.communicationDevices,
      suppliesStatus: issues.length === 0 ? 'all_good' : 'issues_found',
      issues: issues,
      lastInspected: room.lastInspected,
      supplies: {
        water: supplies.water.quantity,
        food: supplies.food.quantity,
        batteryCharge: supplies.battery_pack.charged,
        documents: supplies.documents.length + ' document sets'
      }
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Power Backup Status
  // ════════════════════════════════════════════════════════════════════════

  getPowerBackupStatus() {
    var ups = this.powerBackup.ups;
    var batSys = this.powerBackup.battery_system;
    var gen = this.powerBackup.generator;

    var totalRuntimeMin =
      (ups.status !== 'failed' ? (ups.runtimeMinutes * ups.batteryLevel / 100) : 0) +
      (batSys.batteryLevel > 0 ? (batSys.runtimeMinutes * batSys.batteryLevel / 100) : 0) +
      (gen.fuelLevel > 0 ? (gen.runtimeHours * gen.fuelLevel / 100 * 60) : 0);

    return {
      overallStatus: this._calculatePowerStatus(),
      totalEstimatedRuntimeMinutes: Math.round(totalRuntimeMin),
      ups: {
        status: ups.status,
        batteryLevel: Math.round(ups.batteryLevel),
        runtimeMinutes: Math.round(ups.runtimeMinutes * ups.batteryLevel / 100),
        maxLoadWatts: ups.maxLoadWatts,
        model: ups.model,
        lastTest: ups.lastTest
      },
      batterySystem: {
        status: batSys.status,
        batteryLevel: Math.round(batSys.batteryLevel),
        runtimeMinutes: Math.round(batSys.runtimeMinutes * batSys.batteryLevel / 100),
        maxLoadWatts: batSys.maxLoadWatts,
        model: batSys.model,
        lastTest: batSys.lastTest
      },
      generator: {
        status: gen.status,
        fuelLevel: Math.round(gen.fuelLevel),
        estimatedRuntimeHours: Math.round(gen.runtimeHours * gen.fuelLevel / 100),
        fuelType: gen.fuelType,
        autoStart: gen.autoStart,
        model: gen.model,
        lastServiced: gen.lastServiced
      }
    };
  }

  _calculatePowerStatus() {
    var ups = this.powerBackup.ups;
    var batSys = this.powerBackup.battery_system;
    var gen = this.powerBackup.generator;

    if (ups.batteryLevel > 50 && batSys.batteryLevel > 50 && gen.fuelLevel > 50) {
      return 'optimal';
    }
    if (ups.batteryLevel > 20 && batSys.batteryLevel > 20 && gen.fuelLevel > 20) {
      return 'good';
    }
    if (ups.batteryLevel > 5 || batSys.batteryLevel > 5 || gen.fuelLevel > 5) {
      return 'degraded';
    }
    return 'critical';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Power Failure Handlers
  // ════════════════════════════════════════════════════════════════════════

  handlePowerFailure() {
    this.homey.log('[EmergencyResponse] Power failure detected - activating backup systems');

    this.powerBackup.ups.status = 'active';
    this.homey.log('[EmergencyResponse] UPS activated - estimated runtime: ' +
      Math.round(this.powerBackup.ups.runtimeMinutes * this.powerBackup.ups.batteryLevel / 100) + ' min');

    this.powerBackup.battery_system.status = 'discharging';
    this.homey.log('[EmergencyResponse] Battery backup discharging - estimated runtime: ' +
      Math.round(this.powerBackup.battery_system.runtimeMinutes * this.powerBackup.battery_system.batteryLevel / 100) + ' min');

    if (this.powerBackup.generator.autoStart && this.powerBackup.generator.fuelLevel > 5) {
      this._startGenerator();
    }

    this._activateEmergencyLighting();

    this._triggerEmergency('power-failure', 'Main power failure detected', {
      upsStatus: this.powerBackup.ups.status,
      batteryLevel: this.powerBackup.battery_system.batteryLevel,
      generatorStatus: this.powerBackup.generator.status
    });
  }

  handlePowerRestored() {
    this.homey.log('[EmergencyResponse] Power restored - switching back to mains');

    this.powerBackup.ups.status = 'standby';
    this.powerBackup.battery_system.status = 'charging';

    if (this.powerBackup.generator.status === 'running') {
      this.powerBackup.generator.status = 'cooldown';
      var self = this;
      setTimeout(function() {
        self.powerBackup.generator.status = 'ready';
        self.homey.log('[EmergencyResponse] Generator cooled down and ready');
      }, 300000);
    }

    this._deactivateEmergencyLighting();

    // Auto-resolve power emergency
    var powerEmergency = null;
    for (var i = 0; i < this.activeEmergencies.length; i++) {
      if (this.activeEmergencies[i].typeId === 'power-failure') {
        powerEmergency = this.activeEmergencies[i];
        break;
      }
    }
    if (powerEmergency) {
      this.resolveEmergency(powerEmergency.id, 'Power restored to mains');
    }

    this.homey.emit('emergency-power-restored', {
      timestamp: new Date().toISOString()
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Damage Assessment
  // ════════════════════════════════════════════════════════════════════════

  assessDamage(emergencyId, assessment) {
    var incident = null;
    for (var i = 0; i < this.incidentLog.length; i++) {
      if (this.incidentLog[i].id === emergencyId) {
        incident = this.incidentLog[i];
        break;
      }
    }

    if (!incident) {
      this.homey.error('[EmergencyResponse] Incident not found for damage assessment: ' + emergencyId);
      return null;
    }

    var damageReport = {
      id: 'damage_' + Date.now(),
      emergencyId: emergencyId,
      emergencyType: incident.typeId,
      assessedAt: new Date().toISOString(),
      assessor: assessment.assessor || 'Homeowner',
      overallSeverity: assessment.severity || 'unknown',
      areas: assessment.areas || [],
      estimatedCost: assessment.estimatedCost || 0,
      insuranceClaim: assessment.insuranceClaim || false,
      notes: assessment.notes || '',
      photos: assessment.photos || 0,
      professionalNeeded: assessment.professionalNeeded || false,
      habitableStatus: assessment.habitable !== undefined ? assessment.habitable : true
    };

    incident.damageAssessment = damageReport;

    this.homey.log('[EmergencyResponse] Damage assessment filed for: ' + emergencyId +
      ' - Severity: ' + damageReport.overallSeverity);
    this.homey.emit('emergency-damage-assessed', {
      emergencyId: emergencyId,
      report: damageReport,
      timestamp: new Date().toISOString()
    });

    return damageReport;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Emergency Contact Management
  // ════════════════════════════════════════════════════════════════════════

  getEmergencyContacts() {
    return this.emergencyContacts.slice().sort(function(a, b) {
      return a.priority - b.priority;
    });
  }

  addEmergencyContact(contact) {
    if (!contact.name || !contact.number || !contact.type) {
      this.homey.error('[EmergencyResponse] Invalid contact: missing required fields');
      return false;
    }

    var newContact = {
      id: 'contact_' + Date.now(),
      name: contact.name,
      number: contact.number,
      type: contact.type,
      priority: contact.priority || 5,
      autoCall: contact.autoCall || false
    };

    this.emergencyContacts.push(newContact);
    this.homey.log('[EmergencyResponse] Added emergency contact: ' + newContact.name);
    this.homey.emit('emergency-contact-added', {
      contact: newContact,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  removeEmergencyContact(contactId) {
    var idx = -1;
    for (var i = 0; i < this.emergencyContacts.length; i++) {
      if (this.emergencyContacts[i].id === contactId) {
        idx = i;
        break;
      }
    }

    if (idx === -1) {
      this.homey.error('[EmergencyResponse] Contact not found: ' + contactId);
      return false;
    }

    var removed = this.emergencyContacts.splice(idx, 1)[0];
    this.homey.log('[EmergencyResponse] Removed emergency contact: ' + removed.name);
    this.homey.emit('emergency-contact-removed', {
      contact: removed,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Equipment Inventory & Inspection
  // ════════════════════════════════════════════════════════════════════════

  getEquipmentInventory() {
    return Object.values(this.emergencyEquipment).map(function(item) {
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        location: item.location,
        floor: item.floor,
        status: item.status,
        lastInspected: item.lastInspected,
        expiryDate: item.expiryDate,
        batteryLevel: item.batteryLevel
      };
    });
  }

  inspectEquipment(equipmentId) {
    var item = this.emergencyEquipment[equipmentId];
    if (!item) {
      this.homey.error('[EmergencyResponse] Equipment not found: ' + equipmentId);
      return null;
    }

    item.lastInspected = new Date().toISOString().split('T')[0];
    if (item.status === 'expired') {
      this.homey.log('[EmergencyResponse] Equipment ' + item.name + ' needs replacement (expired)');
    } else {
      item.status = 'good';
    }

    this.homey.log('[EmergencyResponse] Inspected equipment: ' + item.name);
    this.homey.emit('emergency-equipment-inspected', {
      id: equipmentId,
      name: item.name,
      status: item.status,
      timestamp: new Date().toISOString()
    });
    return item;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Status Queries
  // ════════════════════════════════════════════════════════════════════════

  getEmergencyLightingStatus() {
    var total = this.emergencyLighting.length;
    var ready = 0;
    var active = 0;
    var lowBattery = 0;

    for (var i = 0; i < this.emergencyLighting.length; i++) {
      var l = this.emergencyLighting[i];
      if (l.status === 'ready' || l.status === 'active') { ready++; }
      if (l.status === 'active') { active++; }
      if (l.batteryLevel < 30) { lowBattery++; }
    }

    return {
      totalLights: total,
      readyCount: ready,
      activeCount: active,
      lowBatteryCount: lowBattery,
      coveragePercent: Math.round((ready / total) * 100),
      lights: this.emergencyLighting.map(function(l) {
        return {
          id: l.id,
          location: l.location,
          floor: l.floor,
          status: l.status,
          batteryLevel: l.batteryLevel,
          type: l.type
        };
      })
    };
  }

  getSensorStatus() {
    var allSensors = Object.values(this.sensors);
    var online = 0;
    var offline = 0;
    var lowBattery = 0;

    for (var i = 0; i < allSensors.length; i++) {
      if (allSensors[i].status === 'online') { online++; }
      if (allSensors[i].status === 'offline') { offline++; }
      if (allSensors[i].battery < 20) { lowBattery++; }
    }

    var byType = {};
    for (var j = 0; j < allSensors.length; j++) {
      var s = allSensors[j];
      if (!byType[s.type]) {
        byType[s.type] = { total: 0, online: 0, batteries: [] };
      }
      byType[s.type].total++;
      if (s.status === 'online') { byType[s.type].online++; }
      byType[s.type].batteries.push(s.battery);
    }

    var typeKeys = Object.keys(byType);
    for (var k = 0; k < typeKeys.length; k++) {
      var bt = byType[typeKeys[k]];
      var sum = 0;
      for (var m = 0; m < bt.batteries.length; m++) { sum += bt.batteries[m]; }
      bt.avgBattery = Math.round(sum / bt.batteries.length);
      delete bt.batteries;
    }

    return {
      totalSensors: allSensors.length,
      onlineCount: online,
      offlineCount: offline,
      lowBatteryCount: lowBattery,
      healthPercent: Math.round((online / allSensors.length) * 100),
      byType: byType,
      sensors: allSensors.map(function(s) {
        return {
          id: s.id,
          type: s.type,
          location: s.location,
          floor: s.floor,
          status: s.status,
          battery: Math.round(s.battery),
          sensitivity: s.sensitivity,
          model: s.model
        };
      })
    };
  }

  getActiveEmergencies() {
    return this.activeEmergencies.map(function(e) {
      return {
        id: e.id,
        type: e.typeId,
        label: e.type.label,
        severity: e.severity,
        colorCode: e.type.colorCode,
        reason: e.reason,
        triggeredAt: e.triggeredAt,
        actionsExecuted: e.actionsExecuted.length,
        alertsSent: e.alertsSent.length,
        status: e.status
      };
    });
  }

  getIncidentHistory(limit) {
    var sorted = this.incidentLog.slice().sort(function(a, b) {
      return new Date(b.loggedAt) - new Date(a.loggedAt);
    });
    var items = limit ? sorted.slice(0, limit) : sorted;
    return items.map(function(i) {
      return {
        id: i.id,
        type: i.typeId,
        label: i.type ? i.type.label : 'Unknown',
        severity: i.severity,
        status: i.status,
        triggeredAt: i.triggeredAt,
        resolvedAt: i.resolvedAt,
        resolution: i.resolution,
        responseTimeMs: i.responseTimeMs
      };
    });
  }

  getDrillSchedule() {
    return Object.values(this.drills).map(function(d) {
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        frequency: d.frequency,
        lastPerformed: d.lastPerformed,
        nextScheduled: d.nextScheduled,
        lastScore: d.lastScore,
        bestScore: d.bestScore,
        averageEvacTime: d.averageEvacTime
      };
    });
  }

  getWeatherAlerts() {
    return {
      region: this.weatherAlerts.region,
      lastCheck: this.weatherAlerts.lastCheck,
      activeAlerts: this.weatherAlerts.activeAlerts,
      alertHistory: this.weatherAlerts.alertHistory.slice(-20)
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Statistics
  // ════════════════════════════════════════════════════════════════════════

  getStatistics() {
    var allSensors = Object.values(this.sensors);
    var onlineSensors = 0;
    var batterySum = 0;
    for (var i = 0; i < allSensors.length; i++) {
      if (allSensors[i].status === 'online') { onlineSensors++; }
      batterySum += allSensors[i].battery;
    }
    var avgBattery = allSensors.length > 0 ? Math.round(batterySum / allSensors.length) : 0;

    var resolvedIncidents = [];
    var respSum = 0;
    for (var j = 0; j < this.incidentLog.length; j++) {
      if (this.incidentLog[j].status === 'resolved') {
        resolvedIncidents.push(this.incidentLog[j]);
      }
    }
    for (var k = 0; k < resolvedIncidents.length; k++) {
      respSum += (resolvedIncidents[k].responseTimeMs || 0);
    }
    var avgResponseTime = resolvedIncidents.length > 0 ? Math.round(respSum / resolvedIncidents.length) : 0;

    var drillList = Object.values(this.drills);
    var drillScoreSum = 0;
    for (var d = 0; d < drillList.length; d++) {
      drillScoreSum += drillList[d].lastScore;
    }
    var avgDrillScore = drillList.length > 0 ? Math.round(drillScoreSum / drillList.length) : 0;

    var emergencyLightsReady = 0;
    for (var e = 0; e < this.emergencyLighting.length; e++) {
      if (this.emergencyLighting[e].status === 'ready' || this.emergencyLighting[e].status === 'active') {
        emergencyLightsReady++;
      }
    }

    var equipmentItems = Object.values(this.emergencyEquipment);
    var equipmentGood = 0;
    for (var f = 0; f < equipmentItems.length; f++) {
      if (equipmentItems[f].status === 'good') { equipmentGood++; }
    }

    var routesClear = 0;
    for (var g = 0; g < this.evacuationRoutes.length; g++) {
      if (this.evacuationRoutes[g].clearance) { routesClear++; }
    }

    return {
      initialized: this.initialized,
      emergencyTypes: Object.keys(this.emergencyTypes).length,
      totalSensors: allSensors.length,
      onlineSensors: onlineSensors,
      sensorHealthPercent: allSensors.length > 0 ? Math.round((onlineSensors / allSensors.length) * 100) : 0,
      averageSensorBattery: avgBattery,
      activeEmergencies: this.activeEmergencies.length,
      totalIncidents: this.incidentLog.length,
      resolvedIncidents: resolvedIncidents.length,
      averageResponseTimeMs: avgResponseTime,
      evacuationRoutes: this.evacuationRoutes.length,
      routesClear: routesClear,
      emergencyContacts: this.emergencyContacts.length,
      emergencyLightsTotal: this.emergencyLighting.length,
      emergencyLightsReady: emergencyLightsReady,
      equipmentTotal: equipmentItems.length,
      equipmentGood: equipmentGood,
      equipmentIssues: equipmentItems.length - equipmentGood,
      drillsScheduled: drillList.length,
      averageDrillScore: avgDrillScore,
      lockdownActive: this.lockdownActive,
      panicButtonActive: this.panicButtonActive,
      powerBackupStatus: this._calculatePowerStatus(),
      safeRoomReady: this.safeRoom.hasLock && this.safeRoom.ventilation,
      weatherAlertsActive: this.weatherAlerts.activeAlerts.length,
      wellbeingChecksPending: this.wellbeingChecks.pendingChecks.length,
      alertChannels: Object.keys(this.alertChannels).length,
      escalationLevels: this.escalationLevels.length,
      timestamp: new Date().toISOString()
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ════════════════════════════════════════════════════════════════════════

  destroy() {
    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];
    this.activeEmergencies = [];
    this.sensorEventBuffer = [];
    this.lockdownActive = false;
    this.panicButtonActive = false;
    this.initialized = false;
    this.homey.log('[EmergencyResponse] System destroyed - all monitoring stopped');
  }
}

module.exports = HomeEmergencyResponseSystem;
