#!/usr/bin/env node

const { seedSampleData } = require('./database');

console.log('Starting database seeding...');
seedSampleData();
console.log('Seeding completed!');
