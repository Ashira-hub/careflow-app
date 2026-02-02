const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add the dependencies
packageJson.dependencies['react-native-html-to-pdf'] = '^0.12.0';
packageJson.dependencies['react-native-print'] = '^0.11.0';

// Write back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('Added react-native-html-to-pdf and react-native-print to package.json');
console.log('Please run "npm install" to install the packages');
