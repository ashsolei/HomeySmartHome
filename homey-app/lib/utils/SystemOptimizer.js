'use strict';

/**
 * System Optimizer Utility
 * 
 * Provides reusable optimization utilities for all smart home systems:
 * - Error handling with retry logic
 * - Caching with TTL
 * - Memory management
 * - Rate limiting
 * - Performance monitoring
 * - Health checks
 * - Graceful degradation
 * 
 * Usage: Import and apply to any system for instant optimization
 */

class SystemOptimizer {
  constructor(options = {}) {
    this.options = {
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes default
      maxCacheSize: options.maxCacheSize || 100,
      retryEnabled: options.retryEnabled !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimitEnabled: options.rateLimitEnabled || false,
      rateLimitRequests: options.rateLimitRequests || 10,
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
      healthCheckEnabled: options.healthCheckEnabled || false,
      healthCheckInterval: options.healthCheckInterval || 300000, // 5 minutes
      memoryThreshold: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
      ...options
    };
    
    this._cache = new Map();
    this._rateLimitMap = new Map();
    this._healthMetrics = {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0,
      lastHealthCheck: Date.now()
    };
  }

  /**
   * Enhanced error handling with retry logic
   */
  async withRetry(fn, context = 'operation') {
    let lastError;
    const maxRetries = this.options.maxRetries;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = this.options.retryDelay * attempt; // Exponential backoff
          console.log(`Retry ${attempt}/${maxRetries} for ${context} after ${delay}ms:`, error.message);
          await this.delay(delay);
        }
      }
    }
    
    this._healthMetrics.errors++;
    throw new Error(`Failed after ${maxRetries} retries in ${context}: ${lastError.message}`);
  }

  /**
   * Caching with TTL
   */
  getCached(key) {
    if (!this.options.cacheEnabled) return null;
    
    const cached = this._cache.get(key);
    if (!cached) {
      this._healthMetrics.cacheMisses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.options.cacheTTL) {
      this._cache.delete(key);
      this._healthMetrics.cacheMisses++;
      return null;
    }
    
    this._healthMetrics.cacheHits++;
    return cached.data;
  }

  setCached(key, data) {
    if (!this.options.cacheEnabled) return;
    
    // Check cache size limit
    if (this._cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    
    this._cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(pattern = null) {
    if (pattern) {
      // Clear cache entries matching pattern
      for (const key of this._cache.keys()) {
        if (key.includes(pattern)) {
          this._cache.delete(key);
        }
      }
    } else {
      this._cache.clear();
    }
  }

  /**
   * Rate limiting
   */
  checkRateLimit(identifier) {
    if (!this.options.rateLimitEnabled) return true;
    
    const now = Date.now();
    const record = this._rateLimitMap.get(identifier) || { count: 0, windowStart: now };
    
    // Reset window if expired
    if (now - record.windowStart > this.options.rateLimitWindow) {
      record.count = 0;
      record.windowStart = now;
    }
    
    // Check limit
    if (record.count >= this.options.rateLimitRequests) {
      return false;
    }
    
    record.count++;
    this._rateLimitMap.set(identifier, record);
    return true;
  }

  /**
   * Memory management
   */
  checkMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      
      if (heapUsed > this.options.memoryThreshold) {
        console.warn(`High memory usage detected: ${Math.round(heapUsed / 1024 / 1024)}MB`);
        
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Clear cache to free memory
        this.clearCache();
        
        return false;
      }
    }
    return true;
  }

  /**
   * Performance tracking
   */
  async trackPerformance(fn, label = 'operation') {
    const startTime = Date.now();
    this._healthMetrics.requests++;
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Update average response time (cumulative moving average)
      const n = this._healthMetrics.requests;
      this._healthMetrics.avgResponseTime = 
        this._healthMetrics.avgResponseTime + (duration - this._healthMetrics.avgResponseTime) / n;
      
      if (duration > 5000) {
        console.warn(`Slow operation detected: ${label} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      this._healthMetrics.errors++;
      throw error;
    }
  }

  /**
   * Health check
   */
  getHealthMetrics() {
    const cacheHitRate = this._healthMetrics.requests > 0 ?
      (this._healthMetrics.cacheHits / (this._healthMetrics.cacheHits + this._healthMetrics.cacheMisses)) * 100 : 0;
    
    const errorRate = this._healthMetrics.requests > 0 ?
      (this._healthMetrics.errors / this._healthMetrics.requests) * 100 : 0;
    
    return {
      ...this._healthMetrics,
      cacheSize: this._cache.size,
      cacheHitRate: Math.round(cacheHitRate),
      errorRate: Math.round(errorRate * 100) / 100,
      healthy: errorRate < 5 && this._healthMetrics.avgResponseTime < 1000
    };
  }

  resetMetrics() {
    this._healthMetrics = {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0,
      lastHealthCheck: Date.now()
    };
  }

  /**
   * Safe JSON parsing with error handling
   */
  safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON parse error:', error.message);
      return defaultValue;
    }
  }

  /**
   * Safe JSON stringification
   */
  safeJsonStringify(obj, defaultValue = '{}') {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.error('JSON stringify error:', error.message);
      return defaultValue;
    }
  }

  /**
   * Debounce function
   */
  debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Throttle function
   */
  throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Batch operations
   */
  async batchProcess(items, processFn, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(item => processFn(item)));
      results.push(...batchResults);
      
      // Small delay between batches to prevent overload
      if (i + batchSize < items.length) {
        await this.delay(100);
      }
    }
    
    return results;
  }

  /**
   * Graceful degradation - fallback when primary fails
   */
  async withFallback(primaryFn, fallbackFn, context = 'operation') {
    try {
      return await primaryFn();
    } catch (error) {
      console.warn(`Primary ${context} failed, using fallback:`, error.message);
      return await fallbackFn();
    }
  }

  /**
   * Circuit breaker pattern
   */
  createCircuitBreaker(fn, threshold = 5, timeout = 60000) {
    let failures = 0;
    let lastFailureTime = 0;
    let state = 'closed'; // closed, open, half-open
    
    return async (...args) => {
      // Check if circuit should be reset
      if (state === 'open' && Date.now() - lastFailureTime > timeout) {
        state = 'half-open';
        failures = 0;
      }
      
      if (state === 'open') {
        throw new Error('Circuit breaker is open');
      }
      
      try {
        const result = await fn(...args);
        
        if (state === 'half-open') {
          state = 'closed';
        }
        
        failures = 0;
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();
        
        if (failures >= threshold) {
          state = 'open';
          console.error(`Circuit breaker opened after ${failures} failures`);
        }
        
        throw error;
      }
    };
  }

  /**
   * Data validation helper
   */
  validate(data, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
      }
      
      if (value !== undefined && rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
        }
      }
      
      if (value !== undefined && rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      
      if (value !== undefined && rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
      
      if (value !== undefined && rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Utility: delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  destroy() {
    this._cache.clear();
    this._rateLimitMap.clear();
  }
}

/**
 * Helper function to wrap existing system with optimizer
 */
function optimizeSystem(system, options = {}) {
  const optimizer = new SystemOptimizer(options);
  
  // Wrap saveSettings with retry and performance tracking
  if (system.saveSettings) {
    const originalSave = system.saveSettings.bind(system);
    system.saveSettings = async function() {
      return await optimizer.trackPerformance(
        () => optimizer.withRetry(originalSave, 'saveSettings'),
        'saveSettings'
      );
    };
  }
  
  // Wrap loadSettings with retry
  if (system.loadSettings) {
    const originalLoad = system.loadSettings.bind(system);
    system.loadSettings = async function() {
      return await optimizer.withRetry(originalLoad, 'loadSettings');
    };
  }
  
  // Add optimizer to system
  system._optimizer = optimizer;
  
  // Add getHealth method
  system.getHealthMetrics = function() {
    return optimizer.getHealthMetrics();
  };
  
  return system;
}

module.exports = {
  SystemOptimizer,
  optimizeSystem
};
