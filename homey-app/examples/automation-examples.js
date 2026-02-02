/**
 * Example Automation Configurations
 * Copy these examples and modify them to suit your needs
 */

// Example 1: Intelligent Morning Routine
const morningRoutine = {
  id: "intelligent_morning",
  name: {
    en: "Intelligent Morning Routine",
    sv: "Intelligent Morgonrutin"
  },
  enabled: true,
  priority: 8,
  
  triggers: [
    {
      type: "time",
      value: "07:00",
      days: ["mon", "tue", "wed", "thu", "fri"]
    }
  ],
  
  conditions: [
    {
      type: "presence",
      operator: "equals",
      value: true
    },
    {
      type: "weather",
      target: { property: "temperature" },
      operator: "<",
      value: 20
    }
  ],
  
  conditionLogic: "AND",
  
  actions: [
    {
      type: "device_control",
      target: {
        deviceId: "thermostat_living_room",
        capability: "target_temperature"
      },
      params: { value: 22 }
    },
    {
      type: "scene",
      target: { sceneId: "morning" }
    },
    {
      type: "notification",
      params: {
        message: "God morgon! Värmen är påslagen.",
        priority: "normal"
      }
    }
  ],
  
  learningEnabled: true,
  adaptiveThresholds: true,
  contextAware: true,
  
  constraints: {
    cooldownMinutes: 60,
    maxExecutionsPerDay: 1
  }
};

// Example 2: Energy Saving Automation
const energySaving = {
  id: "energy_saving_auto",
  name: {
    en: "Automatic Energy Saving",
    sv: "Automatisk Energibesparing"
  },
  enabled: true,
  priority: 7,
  
  triggers: [
    {
      type: "energy",
      threshold: 3000, // Watts
      duration: 300 // 5 minutes
    }
  ],
  
  conditions: [
    {
      type: "time",
      operator: "between",
      value: { start: 6, end: 23 }
    }
  ],
  
  actions: [
    {
      type: "notification",
      params: {
        message: "Hög energiförbrukning! Stänger av onödiga enheter.",
        priority: "high"
      }
    },
    {
      type: "device_control",
      target: {
        deviceId: "standby_outlets",
        capability: "onoff"
      },
      params: { value: false }
    },
    {
      type: "conditional_action",
      params: {
        condition: {
          type: "device",
          target: { deviceId: "thermostat", capability: "target_temperature" },
          operator: ">",
          value: 21
        },
        action: {
          type: "device_control",
          target: { deviceId: "thermostat", capability: "target_temperature" },
          params: { value: 21 }
        }
      }
    }
  ],
  
  learningEnabled: true,
  adaptiveThresholds: true,
  
  constraints: {
    cooldownMinutes: 30,
    maxExecutionsPerDay: 10
  }
};

// Example 3: Smart Presence Detection
const smartPresence = {
  id: "smart_presence",
  name: {
    en: "Smart Presence Automation",
    sv: "Smart Närvaroautomation"
  },
  enabled: true,
  priority: 9,
  
  triggers: [
    {
      type: "presence",
      event: "first_person_arrived"
    }
  ],
  
  conditions: [
    {
      type: "time",
      operator: "between",
      value: { start: "sunset", end: "23:00" }
    }
  ],
  
  actions: [
    {
      type: "device_control",
      target: {
        deviceId: "entrance_light",
        capability: "onoff"
      },
      params: { value: true }
    },
    {
      type: "delay",
      params: { milliseconds: 2000 }
    },
    {
      type: "scene",
      target: { sceneId: "evening" }
    },
    {
      type: "device_control",
      target: {
        deviceId: "thermostat",
        capability: "target_temperature"
      },
      params: { value: 21 }
    }
  ],
  
  learningEnabled: true,
  contextAware: true,
  
  constraints: {
    cooldownMinutes: 15
  }
};

// Example 4: Night Mode with Multiple Conditions
const nightMode = {
  id: "intelligent_night_mode",
  name: {
    en: "Intelligent Night Mode",
    sv: "Intelligent Nattläge"
  },
  enabled: true,
  priority: 6,
  
  triggers: [
    {
      type: "time",
      value: "23:00"
    }
  ],
  
  conditions: [
    {
      type: "presence",
      operator: "equals",
      value: true
    },
    {
      type: "device",
      target: {
        deviceId: "tv_living_room",
        capability: "onoff"
      },
      operator: "equals",
      value: false
    }
  ],
  
  conditionLogic: "AND",
  
  actions: [
    {
      type: "notification",
      params: {
        message: "Dags att sova? Stänger av lampor om 30 minuter.",
        priority: "low"
      }
    },
    {
      type: "delay",
      params: { milliseconds: 1800000 } // 30 minutes
    },
    {
      type: "conditional_action",
      params: {
        condition: {
          type: "device",
          target: { deviceId: "motion_sensor_living_room", capability: "alarm_motion" },
          operator: "equals",
          value: false
        },
        action: {
          type: "scene",
          target: { sceneId: "night" }
        }
      }
    }
  ],
  
  learningEnabled: true,
  adaptiveThresholds: true,
  
  constraints: {
    cooldownMinutes: 120,
    maxExecutionsPerDay: 1
  }
};

// Example 5: Weather-Based Climate Control
const weatherClimate = {
  id: "weather_climate_control",
  name: {
    en: "Weather-Based Climate Control",
    sv: "Väderbaserad Klimatkontroll"
  },
  enabled: true,
  priority: 5,
  
  triggers: [
    {
      type: "weather",
      property: "temperature",
      changeThreshold: 5 // degrees
    }
  ],
  
  conditions: [
    {
      type: "presence",
      operator: "equals",
      value: true
    }
  ],
  
  actions: [
    {
      type: "script",
      params: {
        script: `
          const outsideTemp = context.weather.temperature;
          const targetTemp = outsideTemp < 10 ? 22 : 
                           outsideTemp < 20 ? 21 : 20;
          return { temperature: targetTemp };
        `
      }
    },
    {
      type: "device_control",
      target: {
        deviceId: "thermostat",
        capability: "target_temperature"
      },
      params: { value: "$script.temperature" }
    }
  ],
  
  learningEnabled: true,
  adaptiveThresholds: true,
  contextAware: true,
  
  constraints: {
    cooldownMinutes: 60
  }
};

// Example 6: Advanced Loop Automation
const morningLightsSequence = {
  id: "morning_lights_sequence",
  name: {
    en: "Morning Lights Sequence",
    sv: "Morgonljussekvens"
  },
  enabled: true,
  priority: 4,
  
  triggers: [
    {
      type: "time",
      value: "06:30"
    }
  ],
  
  conditions: [
    {
      type: "presence",
      value: true
    }
  ],
  
  actions: [
    {
      type: "loop",
      params: {
        iterations: 10,
        action: {
          type: "device_control",
          target: {
            deviceId: "bedroom_light",
            capability: "dim"
          },
          params: { value: "$iteration * 10" } // 0%, 10%, 20%... 90%
        }
      }
    },
    {
      type: "delay",
      params: { milliseconds: 5000 }
    },
    {
      type: "notification",
      params: {
        message: "God morgon! Lamporna är påslagna.",
        priority: "low"
      }
    }
  ],
  
  learningEnabled: false,
  
  constraints: {
    cooldownMinutes: 1440, // Once per day
    maxExecutionsPerDay: 1
  }
};

// Example 7: Security Alert Automation
const securityAlert = {
  id: "security_alert_auto",
  name: {
    en: "Security Alert Automation",
    sv: "Säkerhetsvarningsautomation"
  },
  enabled: true,
  priority: 10, // Highest priority
  
  triggers: [
    {
      type: "device",
      deviceId: "door_sensor_front",
      capability: "alarm_contact",
      value: true
    }
  ],
  
  conditions: [
    {
      type: "presence",
      operator: "equals",
      value: false // Nobody home
    },
    {
      type: "time",
      operator: "between",
      value: { start: 22, end: 6 }
    }
  ],
  
  conditionLogic: "OR",
  
  actions: [
    {
      type: "notification",
      params: {
        message: "SÄKERHETSVARNING: Dörr öppnad när ingen är hemma!",
        priority: "urgent"
      }
    },
    {
      type: "device_control",
      target: {
        deviceId: "all_lights",
        capability: "onoff"
      },
      params: { value: true }
    },
    {
      type: "device_control",
      target: {
        deviceId: "alarm_siren",
        capability: "onoff"
      },
      params: { value: true }
    }
  ],
  
  learningEnabled: false, // Security automations should not learn
  contextAware: true,
  
  constraints: {
    cooldownMinutes: 5,
    maxExecutionsPerDay: 50
  }
};

// Export all examples
module.exports = {
  morningRoutine,
  energySaving,
  smartPresence,
  nightMode,
  weatherClimate,
  morningLightsSequence,
  securityAlert
};
