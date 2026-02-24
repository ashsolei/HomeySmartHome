'use strict';

/**
 * OpenAPI / Swagger configuration for Smart Home Pro API.
 *
 * Serves interactive documentation at GET /api/docs.
 * Annotations live in api.js as JSDoc @swagger blocks.
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Home Pro API',
      version: '3.3.0',
      description:
        'Advanced Smart Home Platform — 120+ API endpoints for home automation, ' +
        'energy management, security, climate control, and AI-driven automation.',
      contact: { name: 'Smart Home Pro Team' },
    },
    servers: [{ url: '/api', description: 'API Base' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-csrf-token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Internal server error' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
      },
    },
  },
  // Scan api.js for @swagger JSDoc blocks
  apis: ['./api.js'],
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };
