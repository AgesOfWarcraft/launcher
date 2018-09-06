/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path          = require('path')

const ConfigManager = require('./assets/js/configmanager')
const DistroManager = require('./assets/js/distromanager')

let rscShouldLoad = false
let fatalStartupError = false

// Mapping of each view to their container IDs.
const VIEWS = {
    landing: '#landingContainer',
    settings: '#settingsContainer',
    welcome: '#welcomeContainer'
}

// The currently shown view container.
let currentView

/**
 * Switch launcher views.
 *
 * @param {string} current The ID of the current view container.
 * @param {*} next The ID of the next view container.
 * @param {*} currentFadeTime Optional. The fade out time for the current view.
 * @param {*} nextFadeTime Optional. The fade in time for the next view.
 * @param {*} onCurrentFade Optional. Callback function to execute when the current
 * view fades out.
 * @param {*} onNextFade Optional. Callback function to execute when the next view
 * fades in.
 */
function switchView(current, next, currentFadeTime = 500, nextFadeTime = 500, onCurrentFade = () => {}, onNextFade = () => {}){
    currentView = next
    $(`${current}`).fadeOut(currentFadeTime, () => {
        onCurrentFade()
        $(`${next}`).fadeIn(nextFadeTime, () => {
            onNextFade()
        })
    })
}

/**
 * Get the currently shown view container.
 *
 * @returns {string} The currently shown view container.
 */
function getCurrentView(){
    return currentView
}

function showMainUI(data){

    if(!isDev){
        console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'Initializing..')
        ipcRenderer.send('autoUpdateAction', 'initAutoUpdater', ConfigManager.getAllowPrerelease())
    }

    updateSelectedServer(data.getServer(ConfigManager.getSelectedServer()).getName())
    refreshServerStatus()
    setTimeout(() => {
        document.getElementById('frameBar').style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        document.body.style.backgroundImage = `url('assets/images/backgrounds/${document.body.getAttribute('bkid')}.jpg')`
        $('#main').show()

        if(ConfigManager.isFirstLaunch() || ConfigManager.getWoWPath() == ""){
            currentView = VIEWS.welcome
            $(VIEWS.welcome).fadeIn(1000)
        } else {
            currentView = VIEWS.landing
            $(VIEWS.landing).fadeIn(1000)
        }

        setTimeout(() => {
            $('#loadingContainer').fadeOut(500, () => {
                $('#loadSpinnerImage').removeClass('rotating')
            })
        }, 250)

    }, 750)
    // Disable tabbing to the news container.
    initNews().then(() => {
        $('#newsContainer *').attr('tabindex', '-1')
    })

    onWowPathChanged()
}

function showFatalStartupError(){
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                'Fatal Error: Unable to Load Distribution Index',
                'A connection could not be established to our servers to download the distribution index. No local copies were available to load. <br><br>The distribution index is an essential file which provides the latest server information. The launcher is unable to start without it. Ensure you are connected to the internet and relaunch the application.',
                'Close'
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}

/**
 * Common functions to perform after refreshing the distro index.
 *
 * @param {Object} data The distro index object.
 */
function onDistroRefresh(data){
    updateSelectedServer(data.getServer(ConfigManager.getSelectedServer()).getName())
    refreshServerStatus()
    initNews()
    syncModConfigurations(data)

    // Prepare the settings UI on startup.
    prepareSettings(true)
}

/**
 * Sync the mod configurations with the distro index.
 *
 * @param {Object} data The distro index object.
 */
function syncModConfigurations(data){

    const syncedCfgs = []

    for(let serv of data.getServers()){

        const id = serv.getID()
        const mdls = serv.getModules()
        const cfg = ConfigManager.getModConfiguration(id)

        if(cfg != null){

            const modsOld = cfg.mods
            const mods = {}

            for(let mdl of mdls){
                const type = mdl.getType()

                if(type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader){
                    if(!mdl.getRequired().isRequired()){
                        const mdlID = mdl.getVersionlessID()
                        if(modsOld[mdlID] == null){
                            mods[mdlID] = scanOptionalSubModules(mdl.getSubModules(), mdl)
                        } else {
                            mods[mdlID] = mergeModConfiguration(modsOld[mdlID], scanOptionalSubModules(mdl.getSubModules(), mdl))
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        } else {

            const mods = {}

            for(let mdl of mdls){
                const type = mdl.getType()
                if(type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader){
                    if(!mdl.getRequired().isRequired()){
                        mods[mdl.getVersionlessID()] = scanOptionalSubModules(mdl.getSubModules(), mdl)
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        }
    }

    ConfigManager.setModConfigurations(syncedCfgs)
    ConfigManager.save()
}

/**
 * Recursively scan for optional sub modules. If none are found,
 * this function returns a boolean. If optional sub modules do exist,
 * a recursive configuration object is returned.
 *
 * @returns {boolean | Object} The resolved mod configuration.
 */
function scanOptionalSubModules(mdls, origin){
    if(mdls != null){
        const mods = {}

        for(let mdl of mdls){
            const type = mdl.getType()
            // Optional types.
            if(type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader){
                // It is optional.
                if(!mdl.getRequired().isRequired()){
                    mods[mdl.getVersionlessID()] = scanOptionalSubModules(mdl.getSubModules(), mdl)
                }
            }
        }

        if(Object.keys(mods).length > 0){
            return {
                value: origin.getRequired().isDefault(),
                mods
            }
        }
    }
    return origin.getRequired().isDefault()
}

/**
 * Recursively merge an old configuration into a new configuration.
 *
 * @param {boolean | Object} o The old configuration value.
 * @param {boolean | Object} n The new configuration value.
 *
 * @returns {boolean | Object} The merged configuration.
 */
function mergeModConfiguration(o, n){
    if(typeof o === 'boolean'){
        if(typeof n === 'boolean') return o
        else if(typeof n === 'object'){
            n.value = o
            return n
        }
    } else if(typeof o === 'object'){
        if(typeof n === 'boolean') return o.value
        else if(typeof n === 'object'){
            n.value = o.value

            const newMods = Object.keys(n.mods)
            for(let i=0; i<newMods.length; i++){

                const mod = newMods[i]
                if(o.mods[mod] != null){
                    n.mods[mod] = mergeModConfiguration(o.mods[mod], n.mods[mod])
                }
            }

            return n
        }
    }
    // If for some reason we haven't been able to merge,
    // wipe the old value and use the new one. Just to be safe
    return n
}

function refreshDistributionIndex(remote, onSuccess, onError){
    if(remote){
        DistroManager.pullRemote()
            .then(onSuccess)
            .catch(onError)
    } else {
        DistroManager.pullLocal()
            .then(onSuccess)
            .catch(onError)
    }
}

// Synchronous Listener
document.addEventListener('readystatechange', function(){

    if (document.readyState === 'complete'){
        if(rscShouldLoad){
            if(!fatalStartupError){
                const data = DistroManager.getDistribution()
                showMainUI(data)
            } else {
                showFatalStartupError()
            }
        }
    } else if(document.readyState === 'interactive'){
        //toggleOverlay(true, 'loadingContent')
    }

    /*if (document.readyState === 'interactive'){

    }*/
}, false)

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', (event, res) => {
    if(res) {
        const data = DistroManager.getDistribution()
        syncModConfigurations(data)
        prepareSettings(true)
        if(document.readyState === 'complete'){
            showMainUI(data)
        } else {
            rscShouldLoad = true
        }
    } else {
        fatalStartupError = true
        if(document.readyState === 'complete'){
            showFatalStartupError()
        } else {
            rscShouldLoad = true
        }
    }
})
