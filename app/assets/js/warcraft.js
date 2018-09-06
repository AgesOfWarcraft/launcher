const os = require('os')
const path = require('path');
const cp = require('child_process')
const fs = require('fs');
const Filehound = require('filehound');

function getWoWExecutable() {
  let basePath = ConfigManager.getWoWPath()
  let installFolder = DistroManager.getDistribution().warcraft.client.folder

  if(os.platform() == "darwin") {
    return path.join(ConfigManager.getWoWPath(), installFolder, 'World of Warcraft.app', 'Contents', 'MacOS', 'World of Warcraft')
  } else {
    return path.join(ConfigManager.getWoWPath(), installFolder, 'Wow.exe')
  }
}

exports.launch = function() {
  let wow = cp.spawn(
    getWoWExecutable(),
    {
      stdio: 'ignore',
      detached: true
    }
  )
  return wow
}

exports.setRealmlist = function(realmlist) {
  let installFolder = DistroManager.getDistribution().warcraft.client.folder
  let searchPath = path.join(ConfigManager.getWoWPath(), installFolder, 'Data')
  Filehound.create()
    .ext('wtf')
    .paths(searchPath)
    .find()
    .then(function(files, err) {
      if(err) {
        console.log("An error occurred while trying to locate realmlist.wtf");
        console.log(err);
        return;
      }

      for(let i = 0; i < files.length; ++i) {
        fs.writeFileSync(files[i], "set realmlist " + realmlist, { flag: 'w'} );
      }
    });
}
