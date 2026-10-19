const path = require('node:path');

function externalScriptPath(scriptPath) {
  if (typeof scriptPath !== 'string' || !path.isAbsolute(scriptPath) || path.extname(scriptPath).toLowerCase() !== '.ps1') throw new TypeError('external_script_path_invalid');
  return scriptPath.replace(/([\\/])app\.asar([\\/])/iu, '$1app.asar.unpacked$2');
}

module.exports = { externalScriptPath };
