const WebTorrent = require('webtorrent-hybrid-electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

class WoWClient {
  constructor(path, installFolder, torrent) {
    this.path = path
    this.installFolder = installFolder
    this.torrentUrl = torrent
    this.torrentClient = new WebTorrent()
  }

  fixPermissions() {
    if(os.platform() == "darwin") {
      fs.chmodSync(path.join(this.path, this.installFolder, 'World of Warcraft.app', 'Contents', 'MacOS', 'World of Warcraft'), '777')
    }
  }

  exists() {
    return fs.existsSync(path.join(this.path, this.installFolder, 'Wow.exe'));
  }

  downloadIfNotExists() {
    // if(!this.exists()) {
      // console.log('>>>>>torrent add ', this.path, this.torrentUrl, typeof this.torrentUrl, 'aaaa',  typeof fs.readFile)

      this.torrent = this.torrentClient.add(this.torrentUrl, { path: this.path }, function(torrent, err) {
        console.log("Client is downloading:", torrent.infoHash)
        console.log(torrent)
        console.log(err)
      })

      return true;
    // }

    // return false;
  }

  seed() {
    console.log('seed:', this.path, this.installFolder)
    this.torrentClient.seed(path.join(this.path, this.installFolder))
  }

  isDownloading() {
    return this.torrentClient.torrents.length > 0
  }

  addToDownloadList (torrentUrl) {

    if(this.isDownloading()) {
      return false
    }

    this.torrent = this.torrentClient.add(this.torrentUrl, {
      path: this.path
    })

    return true
  }

  getCurrentTorrentFiles () {
    return this.torrentClient.files
  }

  getDownloadPercent() {
    if(isDownloading()) {
      return this.torrentClient.progress * 100;
    } else {
      return 100;
    }
  }

  getDownloadSpeed() {
    return this.torrentClient.downloadSpeed;
  }

  stopDownloads() {
    if(this.torrentClient != null) {
      this.torrentClient.destroy()
      this.torrentClient = null
    }
    this.torrent = null
  }

  getCurrentTorrent() {
    return this.torrent
  }

  getTorrentClient() {
    return this.torrentClient;
  }
}

module.exports = WoWClient
