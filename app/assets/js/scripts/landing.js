/**
 * Script for landing.ejs
 */
// Requirements
const download                = require('url-download-file')
const cp                      = require('child_process')
const crypto                  = require('crypto')
const {URL}                   = require('url')
const fs                      = require('fs')

// Internal Requirements
const DiscordWrapper          = require('./assets/js/discordwrapper')
const ProcessBuilder          = require('./assets/js/processbuilder')
const ServerStatus            = require('./assets/js/serverstatus')
const Warcraft                = require('./assets/js/warcraft')
const WoWClient               = require('./assets/js/wowclient')

const humanize_duration       = require('humanize-duration')
const humanize_duration_short = humanize_duration.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      y: () => 'y',
      mo: () => 'mo',
      w: () => 'w',
      d: () => 'd',
      h: () => 'h',
      m: () => 'm',
      s: () => 's',
      ms: () => 'ms',
    }
  }
})

// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launch_progress')
const launch_progress_label   = document.getElementById('launch_progress_label')
const launch_details_text     = document.getElementById('launch_details_text')
const server_selection_button = document.getElementById('server_selection_button')
const user_text               = document.getElementById('user_text')

let baseClient = null

function getAssetConfig () {
    const asset = JSON.parse(fs.readFileSync(path.resolve(__dirname, './assets/assetconfig.json')))

    return {
        prefix: asset['assetConfig'].urlPrefix,
        suffix: asset['assetConfig'].urlSuffix,
        links: asset['assets']
    }
}

function downloadTorrentFromUrl (url) {

    let source = url;
    let target = '../../toreents';
    let progress = (size, total) => console.log(`downloaded ${size}/${total}`)

    download(source, target, progress)
        .then(filename => console.log(`${filename} is downloaded`))
        .catch(err => console.log(`download failed: ${err}`))
}

function onWowPathChanged() {
  console.log("onWoWPathChanged")
  const {prefix, suffix, links} = getAssetConfig()

//   links.forEach(item => {
//     console.log('------', item.filename)
//     downloadTorrentFromUrl(prefix + item.filename + suffix)
//   })

  let wowpath = ConfigManager.getWoWPath()
  if(wowpath == "") {
    console.log("onWoWPathChanged: Disabling launch because there is no client.")
    setLaunchEnabled(false);
    return;
  }

  if(baseClient != null) {
    baseClient.stopDownloads()
  }

  let path_torrent = path.resolve(__dirname, 'wow.torrent')
  console.log('<<<<<<<<<', path_torrent)
  baseClient = new WoWClient(wowpath, DistroManager.getDistribution().warcraft.client.folder, path_torrent)
  if(!baseClient.downloadIfNotExists()) {
    baseClient.seed()
    setLaunchEnabled(true);
  }

  let torrent = baseClient.getCurrentTorrent()
  if(torrent != null) {
    toggleLaunchArea(true)
    setLaunchEnabled(false)

    torrent.on('error', function(err) {
      setLaunchDetails("An error occurred.")
      console.log('torrent error: ', err)
    })

    torrent.on('torrent', function (torrent) {
        setLaunchDetails('Torrent is ready...')
    })

    torrent.on('done', function() {
      setLaunchEnabled(true)
      toggleLaunchArea(false)

      baseClient.seed()
    })

    torrent.on('wire', function (wire, addr) {
        console.log('connected to peer with address ' + addr)
    })

    torrent.on('download', function() {
      let hoursRemaining = humanize_duration_short(torrent.timeRemaining, { largest: 2, round: true, spacer: '' });
      setLaunchPercentage((torrent.progress * 100).toFixed(1), 100)
      setLaunchDetails("Downloading<br />(" + (baseClient.getDownloadSpeed()/1000000.0).toFixed(2) + " MB/s, ETA: " + hoursRemaining + ")")
    })

    torrent.on('noPeers', function() {
      setLaunchDetails("Searching for peers...")
    })

    baseClient.getTorrentClient().on('error', function(err) {
      setLaunchDetails("An error occurred...")
      console.log(err)
    })
  }
}

/* Launch Progress Wrapper Functions */

/**
 * Show/hide the loading area.
 *
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading){
    if(loading){
        launch_details.style.display = 'flex'
        launch_content.style.display = 'none'
    } else {
        launch_details.style.display = 'none'
        launch_content.style.display = 'inline-flex'
    }
}

/**
 * Set the details text of the loading area.
 *
 * @param {string} details The new text for the loading details.
 */
function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

/**
 * Set the value of the loading progress bar and display that value.
 *
 * @param {number} value The progress value.
 * @param {number} max The total size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setLaunchPercentage(value, max, percent = ((value/max)*100)){
    launch_progress.setAttribute('max', max)
    launch_progress.setAttribute('value', value)
    launch_progress_label.innerHTML = percent.toFixed(1) + '%'
}

/**
 * Set the value of the OS progress bar and display that on the UI.
 *
 * @param {number} value The progress value.
 * @param {number} max The total download size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setDownloadPercentage(value, max, percent = ((value/max)*100)){
    remote.getCurrentWindow().setProgressBar(value/max)
    setLaunchPercentage(value, max, percent)
}

/**
 * Enable or disable the launch button.
 *
 * @param {boolean} val True to enable, false to disable.
 */
function setLaunchEnabled(val){
    document.getElementById('launch_button').disabled = !val
}
setLaunchEnabled(false)

// Bind launch button
document.getElementById('launch_button').addEventListener('click', function(e){
    console.log('Launching game..')
    const wowPath = ConfigManager.getWoWPath()
    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(100, 100)

    Warcraft.setRealmlist(DistroManager.getDistribution().getServer(ConfigManager.getSelectedServer()).getAddress())
    baseClient.fixPermissions()

    // Launch WoW in 2 seconds, I'm too lazy to avoid the race in setRealmlist
    setTimeout(function() {
      let wow = Warcraft.launch()
      setLaunchDetails('Playing')
      wow.on('exit', () => {
        setLaunchDetails('')
        toggleLaunchArea(false)
      });
      wow.unref();
    }, 2000)
})

// Bind settings button
document.getElementById('settingsMediaButton').onclick = (e) => {
    prepareSettings()
    switchView(getCurrentView(), VIEWS.settings)
}

// Bind selected server
function updateSelectedServer(serverName){
    if(serverName == null){
        serverName = 'No Server Selected'
    }
    server_selection_button.innerHTML = '\u2022 ' + serverName
}
// Real text is set in uibinder.js on distributionIndexDone.
updateSelectedServer('Loading..')
server_selection_button.addEventListener('click', (e) => {
    e.target.blur()
    toggleServerSelection(true)
})

const refreshServerStatus = async function(fade = false){
    console.log('Refreshing Server Status')
    const serv = DistroManager.getDistribution().getServer(ConfigManager.getSelectedServer())

    let pLabel = 'SERVER'
    let pVal = 'ONLINE'

    try {
        const serverURL = new URL('my://' + serv.getAddress())
        const servStat = await ServerStatus.getStatus(serverURL.hostname, serverURL.port)
    } catch (err) {
        console.warn('Unable to refresh server status, assuming offline.')
        console.debug(err)
    }
    if(fade){
        $('#server_status_wrapper').fadeOut(250, () => {
            document.getElementById('landingPlayerLabel').innerHTML = pLabel
            document.getElementById('player_count').innerHTML = pVal
            $('#server_status_wrapper').fadeIn(500)
        })
    } else {
        document.getElementById('landingPlayerLabel').innerHTML = pLabel
        document.getElementById('player_count').innerHTML = pVal
    }

}

// Server Status is refreshed in uibinder.js on distributionIndexDone.

// Set refresh rate to once every 5 minutes.
let serverStatusListener = setInterval(() => refreshServerStatus(true), 300000)

/* System (Java) Scan */

let sysAEx
let scanAt

let extractListener

function asyncSystemScan(launchAfter = true){

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    // Fork a process to run validations.
    sysAEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getCommonDirectory(),
        ConfigManager.getJavaExecutable()
    ], {
        stdio: 'pipe'
    })
    // Stdout
    sysAEx.stdio[1].on('data', (data) => {
        console.log('%c[SysAEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })
    // Stderr
    sysAEx.stdio[2].on('data', (data) => {
        console.log('%c[SysAEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })

    sysAEx.on('message', (m) => {

        if(m.context === 'validateJava'){
            if(m.result == null){
                // If the result is null, no valid Java installation was found.
                // Show this information to the user.
                setOverlayContent(
                    'No Compatible<br>Java Installation Found',
                    'In order to join WesterosCraft, you need a 64-bit installation of Java 8. Would you like us to install a copy? By installing, you accept <a href="http://www.oracle.com/technetwork/java/javase/terms/license/index.html">Oracle\'s license agreement</a>.',
                    'Install Java',
                    'Install Manually'
                )
                setOverlayHandler(() => {
                    setLaunchDetails('Preparing Java Download..')
                    sysAEx.send({task: 'execute', function: '_enqueueOracleJRE', argsArr: [ConfigManager.getLauncherDirectory()]})
                    toggleOverlay(false)
                })
                setDismissHandler(() => {
                    $('#overlayContent').fadeOut(250, () => {
                        //$('#overlayDismiss').toggle(false)
                        setOverlayContent(
                            'Don\'t Forget!<br>Java is Required',
                            'A valid x64 installation of Java 8 is required to launch. Downloads can be found on <a href="http://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html">Oracle\'s website</a>. Once installed, you will be able to connect to the server.<br><br>Please refer to our <a href="http://westeroscraft.wikia.com/wiki/Troubleshooting_Guide">Troubleshooting Guide</a> if you have any difficulty.',
                            'I Understand',
                            'Go Back'
                        )
                        setOverlayHandler(() => {
                            toggleLaunchArea(false)
                            toggleOverlay(false)
                        })
                        setDismissHandler(() => {
                            toggleOverlay(false, true)
                            asyncSystemScan()
                        })
                        $('#overlayContent').fadeIn(250)
                    })
                })
                toggleOverlay(true, true)

            } else {
                // Java installation found, use this to launch the game.
                ConfigManager.setJavaExecutable(m.result)
                ConfigManager.save()

                // We need to make sure that the updated value is on the settings UI.
                // Just incase the settings UI is already open.
                settingsJavaExecVal.value = m.result
                populateJavaExecDetails(settingsJavaExecVal.value)

                if(launchAfter){
                    dlAsync()
                }
                sysAEx.disconnect()
            }
        } else if(m.context === '_enqueueOracleJRE'){

            if(m.result === true){

                // Oracle JRE enqueued successfully, begin download.
                setLaunchDetails('Downloading Java..')
                sysAEx.send({task: 'execute', function: 'processDlQueues', argsArr: [[{id:'java', limit:1}]]})

            } else {

                // Oracle JRE enqueue failed. Probably due to a change in their website format.
                // User will have to follow the guide to install Java.
                setOverlayContent(
                    'Unexpected Issue:<br>Java Download Failed',
                    'Unfortunately we\'ve encountered an issue while attempting to install Java. You will need to manually install a copy. Please check out our <a href="http://westeroscraft.wikia.com/wiki/Troubleshooting_Guide">Troubleshooting Guide</a> for more details and instructions.',
                    'I Understand'
                )
                setOverlayHandler(() => {
                    toggleOverlay(false)
                    toggleLaunchArea(false)
                })
                toggleOverlay(true)
                sysAEx.disconnect()

            }

        } else if(m.context === 'progress'){

            switch(m.data){
                case 'download':
                // Downloading..
                    setDownloadPercentage(m.value, m.total, m.percent)
                    break
            }

        } else if(m.context === 'complete'){

            switch(m.data){
                case 'download': {
                    // Show installing progress bar.
                    remote.getCurrentWindow().setProgressBar(2)

                    // Wait for extration to complete.
                    const eLStr = 'Extracting'
                    let dotStr = ''
                    setLaunchDetails(eLStr)
                    extractListener = setInterval(() => {
                        if(dotStr.length >= 3){
                            dotStr = ''
                        } else {
                            dotStr += '.'
                        }
                        setLaunchDetails(eLStr + dotStr)
                    }, 750)
                    break
                }
                case 'java':
                // Download & extraction complete, remove the loading from the OS progress bar.
                    remote.getCurrentWindow().setProgressBar(-1)

                    // Extraction completed successfully.
                    ConfigManager.setJavaExecutable(m.args[0])
                    ConfigManager.save()

                    if(extractListener != null){
                        clearInterval(extractListener)
                        extractListener = null
                    }

                    setLaunchDetails('Java Installed!')

                    if(launchAfter){
                        dlAsync()
                    }

                    sysAEx.disconnect()
                    break
            }

        }
    })

    // Begin system Java scan.
    setLaunchDetails('Checking system info..')
    sysAEx.send({task: 'execute', function: 'validateJava', argsArr: [ConfigManager.getLauncherDirectory()]})

}

// Keep reference to Minecraft Process
let proc
// Is DiscordRPC enabled
let hasRPC = false
// Joined server regex
const servJoined = /[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/INFO\]: \[CHAT\] [a-zA-Z0-9_]{1,16} joined the game/g
const gameJoined = /\[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/WARN\]: Skipping bad option: lastServer:/g
const gameJoined2 = /\[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/INFO\]: Created: \d+x\d+ textures-atlas/g

let aEx
let serv
let versionData
let forgeData

let progressListener

function dlAsync(){

    // Login parameter is temporary for debug purposes. Allows testing the validation/downloads without
    // launching the game.

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    // Start AssetExec to run validations and downloads in a forked process.
    aEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getCommonDirectory(),
        ConfigManager.getJavaExecutable()
    ], {
        stdio: 'pipe'
    })
    // Stdout
    aEx.stdio[1].on('data', (data) => {
        console.log('%c[AEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })
    // Stderr
    aEx.stdio[2].on('data', (data) => {
        console.log('%c[AEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })

    // Establish communications between the AssetExec and current process.
    aEx.on('message', (m) => {

        if(m.context === 'validate'){
            switch(m.data){
                case 'distribution':
                    setLaunchPercentage(20, 100)
                    console.log('Validated distibution index.')
                    setLaunchDetails('Loading version information..')
                    break
                case 'version':
                    setLaunchPercentage(40, 100)
                    console.log('Version data loaded.')
                    setLaunchDetails('Validating asset integrity..')
                    break
                case 'assets':
                    setLaunchPercentage(60, 100)
                    console.log('Asset Validation Complete')
                    setLaunchDetails('Validating library integrity..')
                    break
                case 'libraries':
                    setLaunchPercentage(80, 100)
                    console.log('Library validation complete.')
                    setLaunchDetails('Validating miscellaneous file integrity..')
                    break
                case 'files':
                    setLaunchPercentage(100, 100)
                    console.log('File validation complete.')
                    setLaunchDetails('Downloading files..')
                    break
            }
        } else if(m.context === 'progress'){
            switch(m.data){
                case 'assets': {
                    const perc = (m.value/m.total)*20
                    setLaunchPercentage(40+perc, 100, parseInt(40+perc))
                    break
                }
                case 'download':
                    setDownloadPercentage(m.value, m.total, m.percent)
                    break
                case 'extract': {
                    // Show installing progress bar.
                    remote.getCurrentWindow().setProgressBar(2)

                    // Download done, extracting.
                    const eLStr = 'Extracting libraries'
                    let dotStr = ''
                    setLaunchDetails(eLStr)
                    progressListener = setInterval(() => {
                        if(dotStr.length >= 3){
                            dotStr = ''
                        } else {
                            dotStr += '.'
                        }
                        setLaunchDetails(eLStr + dotStr)
                    }, 750)
                    break
                }
            }
        } else if(m.context === 'complete'){
            switch(m.data){
                case 'download':
                    // Download and extraction complete, remove the loading from the OS progress bar.
                    remote.getCurrentWindow().setProgressBar(-1)
                    if(progressListener != null){
                        clearInterval(progressListener)
                        progressListener = null
                    }

                    setLaunchDetails('Preparing to launch..')
                    break
            }
        } else if(m.context === 'error'){
            switch(m.data){
                case 'download':
                    console.error(m.error)

                    if(m.error.code === 'ENOENT'){
                        setOverlayContent(
                            'Download Error',
                            'Could not connect to the file server. Ensure that you are connected to the internet and try again.',
                            'Okay'
                        )
                        setOverlayHandler(null)
                    } else {
                        setOverlayContent(
                            'Download Error',
                            'Check the console for more details. Please try again.',
                            'Okay'
                        )
                        setOverlayHandler(null)
                    }

                    remote.getCurrentWindow().setProgressBar(-1)
                    toggleOverlay(true)
                    toggleLaunchArea(false)

                    // Disconnect from AssetExec
                    aEx.disconnect()
                    break
            }
        } else if(m.context === 'validateEverything'){

            // If these properties are not defined it's likely an error.
            if(m.result.forgeData == null || m.result.versionData == null){
                console.error(m.result)
            }

            forgeData = m.result.forgeData
            versionData = m.result.versionData

            if(login) {
                const authUser = ConfigManager.getSelectedAccount()
                console.log('authu', authUser)
                let pb = new ProcessBuilder(serv, versionData, forgeData, authUser)
                setLaunchDetails('Launching game..')
                try {
                    // Build Minecraft process.
                    proc = pb.build()
                    setLaunchDetails('Done. Enjoy the server!')

                    // Attach a temporary listener to the client output.
                    // Will wait for a certain bit of text meaning that
                    // the client application has started, and we can hide
                    // the progress bar stuff.
                    const tempListener = function(data){
                        if(data.indexOf('[Client thread/INFO]: -- System Details --') > -1){
                            toggleLaunchArea(false)
                            if(hasRPC){
                                DiscordWrapper.updateDetails('Loading game..')
                            }
                            proc.stdout.removeListener('data', tempListener)
                        }
                    }

                    // Listener for Discord RPC.
                    const gameStateChange = function(data){
                        if(servJoined.test(data)){
                            DiscordWrapper.updateDetails('Exploring the Realm!')
                        } else if(gameJoined.test(data)){
                            DiscordWrapper.updateDetails('Sailing to Westeros!')
                        }
                    }

                    // Bind listeners to stdout.
                    proc.stdout.on('data', tempListener)
                    proc.stdout.on('data', gameStateChange)

                    // Init Discord Hook
                    const distro = DistroManager.getDistribution()
                    if(distro.discord != null && serv.discord != null){
                        DiscordWrapper.initRPC(distro.discord, serv.discord)
                        hasRPC = true
                        proc.on('close', (code, signal) => {
                            console.log('Shutting down Discord Rich Presence..')
                            DiscordWrapper.shutdownRPC()
                            hasRPC = false
                            proc = null
                        })
                    }

                } catch(err) {

                    console.error('Error during launch', err)
                    setOverlayContent(
                        'Error During Launch',
                        'Please check the console for more details.',
                        'Okay'
                    )
                    setOverlayHandler(null)
                    toggleOverlay(true)
                    toggleLaunchArea(false)

                }
            }

            // Disconnect from AssetExec
            aEx.disconnect()

        }
    })

    // Begin Validations

    // Validate Forge files.
    setLaunchDetails('Loading server information..')

    refreshDistributionIndex(true, (data) => {
        onDistroRefresh(data)
        serv = data.getServer(ConfigManager.getSelectedServer())
        aEx.send({task: 'execute', function: 'validateEverything', argsArr: [ConfigManager.getSelectedServer(), DistroManager.isDevMode()]})
    }, (err) => {
        console.log(err)
        refreshDistributionIndex(false, (data) => {
            onDistroRefresh(data)
            serv = data.getServer(ConfigManager.getSelectedServer())
            aEx.send({task: 'execute', function: 'validateEverything', argsArr: [ConfigManager.getSelectedServer(), DistroManager.isDevMode()]})
        }, (err) => {
            console.error('Unable to refresh distribution index.', err)
            if(DistroManager.getDistribution() == null){
                setOverlayContent(
                    'Fatal Error',
                    'Could not load a copy of the distribution index. See the console for more details.',
                    'Okay'
                )
                setOverlayHandler(null)

                toggleOverlay(true)
                toggleLaunchArea(false)

                // Disconnect from AssetExec
                aEx.disconnect()
            } else {
                serv = data.getServer(ConfigManager.getSelectedServer())
                aEx.send({task: 'execute', function: 'validateEverything', argsArr: [ConfigManager.getSelectedServer(), DistroManager.isDevMode()]})
            }
        })
    })
}

/**
 * News Loading Functions
 */

// DOM Cache
const newsContent                   = document.getElementById('newsContent')
const newsArticleTitle              = document.getElementById('newsArticleTitle')
const newsArticleDate               = document.getElementById('newsArticleDate')
const newsArticleAuthor             = document.getElementById('newsArticleAuthor')
const newsArticleComments           = document.getElementById('newsArticleComments')
const newsNavigationStatus          = document.getElementById('newsNavigationStatus')
const newsArticleContentScrollable  = document.getElementById('newsArticleContentScrollable')
const nELoadSpan                    = document.getElementById('nELoadSpan')

// News slide caches.
let newsActive = false
let newsGlideCount = 0

/**
 * Show the news UI via a slide animation.
 *
 * @param {boolean} up True to slide up, otherwise false.
 */
function slide_(up){
    const lCUpper = document.querySelector('#landingContainer > #upper')
    const lCLLeft = document.querySelector('#landingContainer > #lower > #left')
    const lCLCenter = document.querySelector('#landingContainer > #lower > #center')
    const lCLRight = document.querySelector('#landingContainer > #lower > #right')
    const newsBtn = document.querySelector('#landingContainer > #lower > #center #content')
    const landingContainer = document.getElementById('landingContainer')
    const newsContainer = document.querySelector('#landingContainer > #newsContainer')

    newsGlideCount++

    if(up){
        lCUpper.style.top = '-200vh'
        lCLLeft.style.top = '-200vh'
        lCLCenter.style.top = '-200vh'
        lCLRight.style.top = '-200vh'
        newsBtn.style.top = '130vh'
        newsContainer.style.top = '0px'
        //date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})
        //landingContainer.style.background = 'rgba(29, 29, 29, 0.55)'
        landingContainer.style.background = 'rgba(0, 0, 0, 0.50)'
        setTimeout(() => {
            if(newsGlideCount === 1){
                lCLCenter.style.transition = 'none'
                newsBtn.style.transition = 'none'
            }
            newsGlideCount--
        }, 2000)
    } else {
        setTimeout(() => {
            newsGlideCount--
        }, 2000)
        landingContainer.style.background = null
        lCLCenter.style.transition = null
        newsBtn.style.transition = null
        newsContainer.style.top = '100%'
        lCUpper.style.top = '0px'
        lCLLeft.style.top = '0px'
        lCLCenter.style.top = '0px'
        lCLRight.style.top = '0px'
        newsBtn.style.top = '10px'
    }
}

// Bind news button.
document.getElementById('newsButton').onclick = () => {
    // Toggle tabbing.
    if(newsActive){
        $('#landingContainer *').removeAttr('tabindex')
        $('#newsContainer *').attr('tabindex', '-1')
    } else {
        $('#landingContainer *').attr('tabindex', '-1')
        $('#newsContainer, #newsContainer *, #lower, #lower #center *').removeAttr('tabindex')
        if(newsAlertShown){
            $('#newsButtonAlert').fadeOut(2000)
            newsAlertShown = false
            ConfigManager.setNewsCacheDismissed(true)
            ConfigManager.save()
        }
    }
    slide_(!newsActive)
    newsActive = !newsActive
}

// Array to store article meta.
let newsArr = null

// News load animation listener.
let newsLoadingListener = null

/**
 * Set the news loading animation.
 *
 * @param {boolean} val True to set loading animation, otherwise false.
 */
function setNewsLoading(val){
    if(val){
        const nLStr = 'Checking for News'
        let dotStr = '..'
        nELoadSpan.innerHTML = nLStr + dotStr
        newsLoadingListener = setInterval(() => {
            if(dotStr.length >= 3){
                dotStr = ''
            } else {
                dotStr += '.'
            }
            nELoadSpan.innerHTML = nLStr + dotStr
        }, 750)
    } else {
        if(newsLoadingListener != null){
            clearInterval(newsLoadingListener)
            newsLoadingListener = null
        }
    }
}

// Bind retry button.
newsErrorRetry.onclick = () => {
    $('#newsErrorFailed').fadeOut(250, () => {
        initNews()
        $('#newsErrorLoading').fadeIn(250)
    })
}

newsArticleContentScrollable.onscroll = (e) => {
    if(e.target.scrollTop > Number.parseFloat($('.newsArticleSpacerTop').css('height'))){
        newsContent.setAttribute('scrolled', '')
    } else {
        newsContent.removeAttribute('scrolled')
    }
}

/**
 * Reload the news without restarting.
 *
 * @returns {Promise.<void>} A promise which resolves when the news
 * content has finished loading and transitioning.
 */
function reloadNews(){
    return new Promise((resolve, reject) => {
        $('#newsContent').fadeOut(250, () => {
            $('#newsErrorLoading').fadeIn(250)
            initNews().then(() => {
                resolve()
            })
        })
    })
}

let newsAlertShown = false

/**
 * Show the news alert indicating there is new news.
 */
function showNewsAlert(){
    newsAlertShown = true
    $(newsButtonAlert).fadeIn(250)
}

/**
 * Initialize News UI. This will load the news and prepare
 * the UI accordingly.
 *
 * @returns {Promise.<void>} A promise which resolves when the news
 * content has finished loading and transitioning.
 */
function initNews(){

    return new Promise((resolve, reject) => {
        setNewsLoading(true)

        let news = {}
        loadNews().then(news => {

            newsArr = news.articles || null

            if(newsArr == null){
                // News Loading Failed
                setNewsLoading(false)

                $('#newsErrorLoading').fadeOut(250, () => {
                    $('#newsErrorFailed').fadeIn(250, () => {
                        resolve()
                    })
                })
            } else if(newsArr.length === 0) {
                // No News Articles
                setNewsLoading(false)

                ConfigManager.setNewsCache({
                    date: null,
                    content: null,
                    dismissed: false
                })
                ConfigManager.save()

                $('#newsErrorLoading').fadeOut(250, () => {
                    $('#newsErrorNone').fadeIn(250, () => {
                        resolve()
                    })
                })
            } else {
                // Success
                setNewsLoading(false)

                const lN = newsArr[0]
                const cached = ConfigManager.getNewsCache()
                let newHash = crypto.createHash('sha1').update(lN.content).digest('hex')
                let newDate = new Date(lN.date)
                let isNew = false

                if(cached.date != null && cached.content != null){

                    if(new Date(cached.date) >= newDate){

                        // Compare Content
                        if(cached.content !== newHash){
                            isNew = true
                            showNewsAlert()
                        } else {
                            if(!cached.dismissed){
                                isNew = true
                                showNewsAlert()
                            }
                        }

                    } else {
                        isNew = true
                        showNewsAlert()
                    }

                } else {
                    isNew = true
                    showNewsAlert()
                }

                if(isNew){
                    ConfigManager.setNewsCache({
                        date: newDate.getTime(),
                        content: newHash,
                        dismissed: false
                    })
                    ConfigManager.save()
                }

                const switchHandler = (forward) => {
                    let cArt = parseInt(newsContent.getAttribute('article'))
                    let nxtArt = forward ? (cArt >= newsArr.length-1 ? 0 : cArt + 1) : (cArt <= 0 ? newsArr.length-1 : cArt - 1)

                    displayArticle(newsArr[nxtArt], nxtArt+1)
                }

                document.getElementById('newsNavigateRight').onclick = () => { switchHandler(true) }
                document.getElementById('newsNavigateLeft').onclick = () => { switchHandler(false) }

                $('#newsErrorContainer').fadeOut(250, () => {
                    displayArticle(newsArr[0], 1)
                    $('#newsContent').fadeIn(250, () => {
                        resolve()
                    })
                })
            }

        })

    })
}

/**
 * Add keyboard controls to the news UI. Left and right arrows toggle
 * between articles. If you are on the landing page, the up arrow will
 * open the news UI.
 */
document.addEventListener('keydown', (e) => {
    if(newsActive){
        if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
            document.getElementById(e.key === 'ArrowRight' ? 'newsNavigateRight' : 'newsNavigateLeft').click()
        }
        // Interferes with scrolling an article using the down arrow.
        // Not sure of a straight forward solution at this point.
        // if(e.key === 'ArrowDown'){
        //     document.getElementById('newsButton').click()
        // }
    } else {
        if(getCurrentView() === VIEWS.landing){
            if(e.key === 'ArrowUp'){
                document.getElementById('newsButton').click()
            }
        }
    }
})

/**
 * Display a news article on the UI.
 *
 * @param {Object} articleObject The article meta object.
 * @param {number} index The article index.
 */
function displayArticle(articleObject, index){
    newsArticleTitle.innerHTML = articleObject.title
    newsArticleTitle.href = articleObject.link
    newsArticleAuthor.innerHTML = 'by ' + articleObject.author
    newsArticleDate.innerHTML = articleObject.date
    newsArticleComments.innerHTML = articleObject.comments
    newsArticleComments.href = articleObject.commentsLink
    newsArticleContentScrollable.innerHTML = '<div id="newsArticleContentWrapper"><div class="newsArticleSpacerTop"></div>' + articleObject.content + '<div class="newsArticleSpacerBot"></div></div>'
    newsNavigationStatus.innerHTML = index + ' of ' + newsArr.length
    newsContent.setAttribute('article', index-1)
}

/**
 * Load news information from the RSS feed specified in the
 * distribution index.
 */
function loadNews(){
    return new Promise((resolve, reject) => {
        const distroData = DistroManager.getDistribution()
        const newsFeed = distroData.getRSS()
        const newsHost = new URL(newsFeed).origin + '/'
        $.ajax(
            {
                url: newsFeed,
                success: (data) => {
                    const items = $(data).find('item')
                    const articles = []

                    for(let i=0; i<items.length; i++){
                    // JQuery Element
                        const el = $(items[i])

                        // Resolve date.
                        const date = new Date(el.find('pubDate').text()).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})

                        // Resolve comments.
                        let comments = el.find('slash\\:comments').text() || '0'
                        comments = comments + ' Comment' + (comments === '1' ? '' : 's')

                        // Fix relative links in content.
                        let content = el.find('description').text()
                        let regex = /src="(?!http:\/\/|https:\/\/)(.+)"/g
                        let matches
                        while((matches = regex.exec(content))){
                            content = content.replace(matches[1], newsHost + matches[1])
                        }

                        let link   = el.find('link').text()
                        let title  = el.find('title').text()
                        let author = el.find('dc\\:creator').text()

                        // Generate article.
                        articles.push(
                            {
                                link,
                                title,
                                date,
                                author,
                                content,
                                comments,
                                commentsLink: link + '#comments'
                            }
                        )
                    }
                    resolve({
                        articles
                    })
                },
                timeout: 2500
            }).catch(err => {
            resolve({
                articles: null
            })
        })
    })
}
