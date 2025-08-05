const { importCentennialData } = require('../dist/scripts/import-centennial-addresses');

console.log('Starting Centennial addresses import...');

importCentennialData()
  .then(() => {
    console.log('✅ Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
