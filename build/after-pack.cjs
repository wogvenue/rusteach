// electron-builder afterPack hook. The app is packaged from the Electron copy that `npm install`
// already put in node_modules/electron/dist (no download needed), which still carries Electron's
// sample app and a version stamp. Neither belongs in Rusteach, so they go before the installer is made.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  for (const file of [path.join('resources', 'default_app.asar'), 'version']) {
    fs.rmSync(path.join(context.appOutDir, file), { force: true });
  }
};
