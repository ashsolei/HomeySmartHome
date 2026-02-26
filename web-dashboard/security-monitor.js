'use strict';

/**
 * Security AI Monitor
 * AI-powered security monitoring with anomaly detection
 */
class SecurityMonitor {
  constructor(app) {
    this.app = app;
    this.securityEvents = [];
    this.anomalies = [];
    this.baselineProfiles = new Map();
    this.alertRules = new Map();
    this.threatLevel = 'low'; // low, medium, high, critical
    this.maxEventsHistory = 10000;
  }

  async initialize() {
    // Initialize baseline profiles
    await this.buildBaselineProfiles();
    
    // Initialize alert rules
    this.initializeAlertRules();
    
    // Start monitoring
    this.startMonitoring();
  }

  // ============================================
  // BASELINE PROFILING
  // ============================================

  async buildBaselineProfiles() {
    // Normal device usage patterns
    this.baselineProfiles.set('device_usage', {
      typical_devices: new Set(),
      typical_times: {},
      typical_states: {},
      learn: true
    });

    // Normal presence patterns
    this.baselineProfiles.set('presence', {
      typical_home_hours: [],
      typical_away_hours: [],
      typical_occupancy: 0,
      learn: true
    });

    // Normal network activity
    this.baselineProfiles.set('network', {
      typical_connections: new Set(),
      typical_traffic: {},
      learn: true
    });

    // Normal automation behavior
    this.baselineProfiles.set('automation', {
      typical_triggers: {},
      typical_sequences: [],
      learn: true
    });

    // Normal entry/exit patterns
    this.baselineProfiles.set('access', {
      typical_entry_times: [],
      typical_exit_times: [],
      typical_methods: new Set(['door', 'app']),
      learn: true
    });
  }

  // ============================================
  // SECURITY EVENT MONITORING
  // ============================================

  startMonitoring() {
    // Monitor every 10 seconds
    setInterval(() => {
      this.performSecurityCheck();
    }, 10000);

    // Periodic anomaly analysis (every 5 minutes)
    setInterval(() => {
      this.analyzeAnomalies();
    }, 5 * 60 * 1000);
  }

  async performSecurityCheck() {
    try {
      const checks = [
        this.checkUnauthorizedAccess(),
        this.checkUnusualDeviceActivity(),
        this.checkUnusualPresence(),
        this.checkSecurityDevices(),
        this.checkNetworkAnomalies()
      ];

      const results = await Promise.all(checks);
      
      results.forEach(result => {
        if (result.anomaly) {
          this.handleAnomaly(result);
        }
      });

      // Update threat level
      this.updateThreatLevel();

    } catch (error) {
      console.error('Security check error:', error);
    }
  }

  async checkUnauthorizedAccess() {
    const _events = [];
    const now = Date.now();
    const accessProfile = this.baselineProfiles.get('access');

    // Check for access outside typical hours
    const hour = new Date().getHours();
    const isTypicalTime = accessProfile.typical_entry_times.includes(hour) ||
                         accessProfile.typical_exit_times.includes(hour);

    // Simulate door sensor check
    const recentAccess = Math.random() > 0.95; // 5% chance of access event

    if (recentAccess && !isTypicalTime) {
      return {
        anomaly: true,
        type: 'unauthorized_access',
        severity: 'high',
        timestamp: now,
        description: 'Åtkomst utanför normala tider',
        details: {
          time: new Date().toLocaleTimeString('sv-SE'),
          expected: false,
          location: 'Ytterdörr'
        }
      };
    }

    return { anomaly: false };
  }

  async checkUnusualDeviceActivity() {
    const _deviceProfile = this.baselineProfiles.get('device_usage');
    const now = Date.now();
    const _hour = new Date().getHours();

    // Simulate unusual device activation
    const unusualActivity = Math.random() > 0.97; // 3% chance

    if (unusualActivity) {
      return {
        anomaly: true,
        type: 'unusual_device_activity',
        severity: 'medium',
        timestamp: now,
        description: 'Ovanlig enhetsaktivitet upptäckt',
        details: {
          device: 'Garageport',
          time: new Date().toLocaleTimeString('sv-SE'),
          reason: 'Aktivering mitt i natten',
          frequency: 'Sällan används denna tid'
        }
      };
    }

    return { anomaly: false };
  }

  async checkUnusualPresence() {
    const _presenceProfile = this.baselineProfiles.get('presence');
    const now = Date.now();
    const hour = new Date().getHours();

    // Check for unexpected presence/absence
    const isHomeHour = hour >= 18 || hour <= 8;
    const shouldBeHome = isHomeHour;

    // Simulate presence detection (80% accurate)
    const actuallyHome = Math.random() > 0.2;

    if (shouldBeHome && !actuallyHome) {
      return {
        anomaly: true,
        type: 'unexpected_absence',
        severity: 'low',
        timestamp: now,
        description: 'Ingen närvaro när förväntad',
        details: {
          time: new Date().toLocaleTimeString('sv-SE'),
          expected: 'Hemma',
          detected: 'Borta'
        }
      };
    }

    return { anomaly: false };
  }

  async checkSecurityDevices() {
    const now = Date.now();

    // Check security device status (door sensors, motion sensors, cameras)
    const securityDevices = [
      { name: 'Ytterdörr sensor', status: 'online' },
      { name: 'Fönster sensor vardagsrum', status: 'online' },
      { name: 'Rörelsedetektor hall', status: 'online' },
      { name: 'Kamera garage', status: Math.random() > 0.98 ? 'offline' : 'online' }
    ];

    const offlineDevices = securityDevices.filter(d => d.status === 'offline');

    if (offlineDevices.length > 0) {
      return {
        anomaly: true,
        type: 'security_device_offline',
        severity: 'high',
        timestamp: now,
        description: 'Säkerhetsenhet offline',
        details: {
          devices: offlineDevices.map(d => d.name),
          count: offlineDevices.length,
          action_required: 'Kontrollera enheter omedelbart'
        }
      };
    }

    return { anomaly: false };
  }

  async checkNetworkAnomalies() {
    const _networkProfile = this.baselineProfiles.get('network');
    const now = Date.now();

    // Simulate network anomaly detection
    const anomaly = Math.random() > 0.98; // 2% chance

    if (anomaly) {
      return {
        anomaly: true,
        type: 'network_anomaly',
        severity: 'medium',
        timestamp: now,
        description: 'Ovanlig nätverksaktivitet',
        details: {
          connections: 'Okänd enhet ansluten',
          traffic: 'Ovanligt mycket datatrafik',
          source: 'Okänd IP-adress'
        }
      };
    }

    return { anomaly: false };
  }

  // ============================================
  // ANOMALY HANDLING
  // ============================================

  handleAnomaly(anomaly) {
    // Add to anomaly list
    this.anomalies.push(anomaly);

    // Trim if too many
    if (this.anomalies.length > 1000) {
      this.anomalies = this.anomalies.slice(-1000);
    }

    // Log security event
    this.logSecurityEvent(anomaly);

    // Check alert rules
    this.checkAlertRules(anomaly);

    // Take automated action if needed
    this.takeAutomatedAction(anomaly);
  }

  logSecurityEvent(event) {
    this.securityEvents.push({
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp,
      type: event.type,
      severity: event.severity,
      description: event.description,
      details: event.details,
      handled: false
    });

    // Trim history
    if (this.securityEvents.length > this.maxEventsHistory) {
      this.securityEvents = this.securityEvents.slice(-this.maxEventsHistory);
    }
  }

  // ============================================
  // ALERT RULES
  // ============================================

  initializeAlertRules() {
    // Critical access rule
    this.alertRules.set('critical_access', {
      name: 'Kritisk åtkomst',
      condition: (event) => event.type === 'unauthorized_access' && event.severity === 'high',
      action: 'immediate_alert',
      channels: ['push', 'sms', 'speech'],
      enabled: true
    });

    // Security device offline
    this.alertRules.set('device_offline', {
      name: 'Säkerhetsenhet offline',
      condition: (event) => event.type === 'security_device_offline',
      action: 'alert',
      channels: ['push', 'dashboard'],
      enabled: true
    });

    // Multiple anomalies in short time
    this.alertRules.set('multiple_anomalies', {
      name: 'Flera avvikelser',
      condition: (_event) => {
        const recentAnomalies = this.anomalies.filter(a => 
          Date.now() - a.timestamp < 15 * 60 * 1000
        );
        return recentAnomalies.length >= 3;
      },
      action: 'escalate',
      channels: ['push', 'sms', 'speech'],
      enabled: true
    });

    // Night-time activity
    this.alertRules.set('night_activity', {
      name: 'Nattaktivitet',
      condition: (event) => {
        const hour = new Date().getHours();
        return (hour >= 23 || hour <= 5) && 
               (event.type === 'unusual_device_activity' || event.type === 'unauthorized_access');
      },
      action: 'alert',
      channels: ['push', 'speech'],
      enabled: true
    });
  }

  checkAlertRules(event) {
    for (const [key, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(event)) {
          this.triggerAlert(rule, event);
        }
      } catch (error) {
        console.error(`Alert rule ${key} error:`, error);
      }
    }
  }

  async triggerAlert(rule, event) {
    const alert = {
      rule: rule.name,
      event: event,
      action: rule.action,
      channels: rule.channels,
      timestamp: Date.now()
    };

    console.log('🚨 Security Alert:', rule.name);
    console.log('Event:', event.description);
    console.log('Action:', rule.action);

    // Send notifications through specified channels
    // (Integration with notification system)

    return alert;
  }

  // ============================================
  // AUTOMATED ACTIONS
  // ============================================

  async takeAutomatedAction(anomaly) {
    const actions = [];

    switch (anomaly.type) {
      case 'unauthorized_access':
        actions.push(
          { action: 'lock_all_doors', description: 'Lås alla dörrar' },
          { action: 'enable_alarm', description: 'Aktivera larm' },
          { action: 'record_cameras', description: 'Starta kamerainspelning' },
          { action: 'lights_on', description: 'Tänd all belysning' }
        );
        break;

      case 'security_device_offline':
        actions.push(
          { action: 'notify_maintenance', description: 'Skicka underhållsvarning' },
          { action: 'activate_backup', description: 'Aktivera backup-sensorer' }
        );
        break;

      case 'network_anomaly':
        actions.push(
          { action: 'block_connection', description: 'Blockera okänd anslutning' },
          { action: 'log_traffic', description: 'Logga nätverkstrafik' }
        );
        break;

      case 'unusual_device_activity':
        actions.push(
          { action: 'verify_user', description: 'Begär användarverifiering' },
          { action: 'increase_monitoring', description: 'Öka övervakning' }
        );
        break;
    }

    // Execute high-priority automated actions
    if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
      for (const action of actions) {
        await this.executeSecurityAction(action);
      }
    }

    return actions;
  }

  async executeSecurityAction(action) {
    console.log(`Executing security action: ${action.description}`);
    
    // Implementation would interact with actual devices
    switch (action.action) {
      case 'lock_all_doors':
        // Lock all smart locks
        break;
      case 'enable_alarm':
        // Activate alarm system
        break;
      case 'record_cameras':
        // Start camera recording
        break;
      case 'lights_on':
        // Turn on all lights
        break;
    }
  }

  // ============================================
  // THREAT LEVEL MANAGEMENT
  // ============================================

  updateThreatLevel() {
    const recentAnomalies = this.anomalies.filter(a => 
      Date.now() - a.timestamp < 60 * 60 * 1000 // Last hour
    );

    const criticalCount = recentAnomalies.filter(a => a.severity === 'critical').length;
    const highCount = recentAnomalies.filter(a => a.severity === 'high').length;
    const mediumCount = recentAnomalies.filter(a => a.severity === 'medium').length;

    let newLevel = 'low';

    if (criticalCount > 0) {
      newLevel = 'critical';
    } else if (highCount >= 2) {
      newLevel = 'high';
    } else if (highCount >= 1 || mediumCount >= 3) {
      newLevel = 'medium';
    }

    if (newLevel !== this.threatLevel) {
      const oldLevel = this.threatLevel;
      this.threatLevel = newLevel;
      
      this.logThreatLevelChange(oldLevel, newLevel);
    }
  }

  logThreatLevelChange(oldLevel, newLevel) {
    console.log(`Threat level changed: ${oldLevel} → ${newLevel}`);
    
    this.securityEvents.push({
      id: `threat_${Date.now()}`,
      timestamp: Date.now(),
      type: 'threat_level_change',
      severity: newLevel,
      description: `Hotnivå ändrad från ${oldLevel} till ${newLevel}`,
      details: { oldLevel, newLevel }
    });
  }

  // ============================================
  // ANOMALY ANALYSIS
  // ============================================

  async analyzeAnomalies() {
    const analysis = {
      total: this.anomalies.length,
      last_hour: 0,
      last_24h: 0,
      by_type: {},
      by_severity: {},
      patterns: []
    };

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    this.anomalies.forEach(anomaly => {
      const age = now - anomaly.timestamp;
      
      if (age < oneHour) analysis.last_hour++;
      if (age < oneDay) analysis.last_24h++;

      // By type
      analysis.by_type[anomaly.type] = (analysis.by_type[anomaly.type] || 0) + 1;

      // By severity
      analysis.by_severity[anomaly.severity] = (analysis.by_severity[anomaly.severity] || 0) + 1;
    });

    // Detect patterns
    analysis.patterns = this.detectAnomalyPatterns();

    return analysis;
  }

  detectAnomalyPatterns() {
    const patterns = [];

    // Check for repeating anomalies
    const typeCounts = {};
    this.anomalies.forEach(a => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });

    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count >= 5) {
        patterns.push({
          type: 'repeating',
          anomaly_type: type,
          count,
          description: `${type} har inträffat ${count} gånger`
        });
      }
    });

    // Check for time-based patterns
    const hourlyDistribution = new Array(24).fill(0);
    this.anomalies.forEach(a => {
      const hour = new Date(a.timestamp).getHours();
      hourlyDistribution[hour]++;
    });

    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    if (hourlyDistribution[peakHour] > 5) {
      patterns.push({
        type: 'time_based',
        peak_hour: peakHour,
        count: hourlyDistribution[peakHour],
        description: `Flest avvikelser klockan ${peakHour}:00`
      });
    }

    return patterns;
  }

  // ============================================
  // SECURITY REPORTS
  // ============================================

  async getSecurityReport(period = 24 * 60 * 60 * 1000) {
    const since = Date.now() - period;
    const recentEvents = this.securityEvents.filter(e => e.timestamp >= since);
    const recentAnomalies = this.anomalies.filter(a => a.timestamp >= since);

    return {
      period: {
        start: new Date(since).toISOString(),
        end: new Date().toISOString(),
        hours: period / (60 * 60 * 1000)
      },
      summary: {
        total_events: recentEvents.length,
        total_anomalies: recentAnomalies.length,
        current_threat_level: this.threatLevel,
        critical_events: recentEvents.filter(e => e.severity === 'critical').length,
        high_events: recentEvents.filter(e => e.severity === 'high').length
      },
      anomalies: await this.analyzeAnomalies(),
      top_threats: this.getTopThreats(recentAnomalies),
      recommendations: this.getSecurityRecommendations()
    };
  }

  getTopThreats(anomalies) {
    const threatCounts = {};
    
    anomalies.forEach(a => {
      const key = a.type;
      threatCounts[key] = {
        type: key,
        count: (threatCounts[key]?.count || 0) + 1,
        severity: a.severity,
        lastOccurrence: Math.max(threatCounts[key]?.lastOccurrence || 0, a.timestamp)
      };
    });

    return Object.values(threatCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  getSecurityRecommendations() {
    const recommendations = [];
    const recentAnomalies = this.anomalies.filter(a => 
      Date.now() - a.timestamp < 24 * 60 * 60 * 1000
    );

    // Check for offline devices
    const offlineEvents = recentAnomalies.filter(a => a.type === 'security_device_offline');
    if (offlineEvents.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'maintenance',
        title: 'Kontrollera offlineenheter',
        description: 'Säkerhetsenheter är offline och måste åtgärdas',
        action: 'check_devices'
      });
    }

    // Check for access anomalies
    const accessEvents = recentAnomalies.filter(a => a.type === 'unauthorized_access');
    if (accessEvents.length >= 2) {
      recommendations.push({
        priority: 'high',
        type: 'security',
        title: 'Granska åtkomstkontroll',
        description: 'Flera obehöriga åtkomstförsök upptäckta',
        action: 'review_access'
      });
    }

    // General security improvement
    if (recentAnomalies.length > 10) {
      recommendations.push({
        priority: 'medium',
        type: 'improvement',
        title: 'Förbättra säkerhetskonfiguration',
        description: 'Många avvikelser upptäckta, överväg att justera säkerhetsinställningar',
        action: 'review_settings'
      });
    }

    return recommendations;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getCurrentStatus() {
    return {
      threat_level: this.threatLevel,
      active_anomalies: this.anomalies.filter(a => 
        Date.now() - a.timestamp < 60 * 60 * 1000
      ).length,
      recent_events: this.securityEvents.slice(-10),
      system_health: 'operational' // operational, degraded, critical
    };
  }

  async getAnomalyHistory(limit = 50) {
    return this.anomalies
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

module.exports = SecurityMonitor;
