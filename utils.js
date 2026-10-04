const fs = require('fs');

function saveJSON(filePath, data) {
  try {
    // Convert the JavaScript object into a formatted JSON string
    const jsonString = JSON.stringify(data, null, 2);
    
    // Synchronously write the string to the file
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    console.log('Data successfully saved!');
  } catch (error) {
    console.error('Error saving JSON data:', error);
  }
}


module.exports = {saveJSON}
