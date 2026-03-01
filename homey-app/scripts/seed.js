#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rooms = ['living', 'bedroom', 'kitchen', 'bathroom'];
const deviceTypes = ['light', 'sensor', 'switch', 'thermostat'];
const eventTypes = ['security', 'energy', 'automation', 'device'];

const data = {
  devices: [...Array(20)].map((_, i) => ({
    id: `device-${i + 1}`,
    name: `Device ${i + 1}`,
    type: deviceTypes[i % 4],
    status: i % 3 === 0 ? 'offline' : 'online',
    room: rooms[i % 4],
  })),

  automations: [...Array(10)].map((_, i) => ({
    id: `auto-${i + 1}`,
    name: `Automation ${i + 1}`,
    enabled: i % 2 === 0,
    trigger: 'time',
    action: 'device_control',
  })),

  energyReadings: [...Array(5)].map((_, i) => ({
    id: `energy-${i + 1}`,
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    kwh: (Math.random() * 5 + 0.5).toFixed(2),
    cost: (Math.random() * 2).toFixed(3),
  })),

  securityZones: [
    { id: 'zone-1', name: 'Perimeter', armed: true },
    { id: 'zone-2', name: 'Interior', armed: false },
    { id: 'zone-3', name: 'Garden', armed: true },
  ],

  timelineEvents: [...Array(10)].map((_, i) => ({
    id: `evt-${i + 1}`,
    timestamp: new Date(Date.now() - i * 300000).toISOString(),
    type: eventTypes[i % 4],
    title: `Event ${i + 1}`,
    severity: 'info',
  })),
};

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'seed.json'), JSON.stringify(data, null, 2));

console.log(
  'Seeded:',
  Object.entries(data)
    .map(([k, v]) => `${v.length} ${k}`)
    .join(', ')
);
