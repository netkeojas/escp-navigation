/* eslint-disable no-console */
import csv from 'csvtojson';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, '..', 'public', 'rooms.csv');
const jsonFilePath = path.join(__dirname, '..', 'public', 'rooms.json');

async function convertCsvToJson() {
  try {
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`Input CSV not found at ${csvFilePath}`);
    }
    const jsonArray = await csv({
      trim: true,
    }).fromFile(csvFilePath);

    // Ensure array and proper formatting
    const pretty = JSON.stringify(jsonArray, null, 2);
    fs.writeFileSync(jsonFilePath, pretty, 'utf-8');
    console.log(`Successfully converted CSV to JSON: ${jsonFilePath}`);
  } catch (error) {
    console.error('Error converting CSV to JSON:', error.message || error);
    process.exit(1);
  }
}

convertCsvToJson();
