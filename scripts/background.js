/* global StoredBlob */
"use strict";

//TODO tab context menu to quickly whitelist/unwhitelist host (requires the before show listener to prepare)
//TODO sync?
//TODO catch ServiceWorker scoped showNotification calls.

const SOURCES = {
        WEBSITE: 0,
        EXTENSION: 1
    },
    NOTIFICATION_TOPIC = "new-notification",
    WWW_PREFIX = 'www.',
    DEFAULT_VOLUME = 1.0,
    NotificationListener = {
        DEFAULT_SOUND: browser.runtime.getURL('pop.flac'),
        PREF_NAME: 'soundName',
        getPlayer() {
            const player = new Audio();
            player.autoplay = false;
            player.preload = true;
            return player;
        },
        init() {
            this.player = this.getPlayer();
            this.playing = this.player;
            this.currentPref = this.PREF_NAME;
            this.loadSound();
            this.setPlayerVolume();

            browser.storage.onChanged.addListener((changes, areaName) => {
                if(areaName === "local") {
                    if(this.PREF_NAME in changes) {
                        this.loadSound();
                    }
                    if(`${this.PREF_NAME}-volume` in changes) {
                        this.player.volume = changes[`${this.PREF_NAME}-volume`].newValue;
                        if(this.currentPref === this.PREF_NAME) {
                            this.playing.volume = this.player.volume;
                        }
                    }
                    if(this.currentPref !== this.PREF_NAME && `${this.currentPref}-volume` in changes) {
                        this.playing.volume = changes[`${this.currentPref}-volume`].newValue;
                    }
                }
            });
        },
        async setPlayerVolume(prefName = this.PREF_NAME, player = this.player) {
            const volumePrefName = `${prefName}-volume`;
            let { [volumePrefName]: data } = await browser.storage.local.get({
                [volumePrefName]: false
            });
            // Fall back to global volume if none is set for the given pref
            if(data === false && prefName !== this.PREF_NAME) {
                const defaultVolumePref = `${this.PREF_NAME}-volume`,
                    { [defaultVolumePref]: defaultData } = await browser.storage.local.get({
                        [defaultVolumePref]: DEFAULT_VOLUME
                    });
                this.currentPref = this.PREF_NAME;
                data = defaultData;
            }
            else if(data === false) {
                this.currentPref = prefName;
                data = DEFAULT_VOLUME;
            }
            player.volume = data;
        },
        async loadFile(soundName) {
            const storedFile = new StoredBlob(soundName),
                file = await storedFile.get();
            return URL.createObjectURL(file);
        },
        async loadSound() {
            const { [this.PREF_NAME]: soundName } = await browser.storage.local.get({
                [this.PREF_NAME]: ''
            });
            if(this.player.src && this.player.src !== this.DEFAULT_SOUND) {
                const oldURL = this.player.src;
                this.player.src = "";
                URL.revokeObjectURL(oldURL);
            }
            let url = this.DEFAULT_SOUND;
            if(soundName.length) {
                try {
                    url = await this.loadFile(this.PREF_NAME + soundName);
                }
                catch(error) {
                    console.error("Could not load configured sound", error);
                    await browser.runtime.sendMessage({
                        command: "error",
                        error: error.message
                    });
                    url = this.DEFAULT_SOUND;
                }
            }
            this.player.src = url;
        },
        async extensionAllowed(id) {
            const {
                allExtensions, allowedExtensions, blockedExtensions
            } = await browser.storage.local.get({
                allExtensions: true,
                allowedExtensions: [],
                blockedExtensions: []
            });
            if(allExtensions) {
                return !blockedExtensions.includes(id);
            }

            return allowedExtensions.includes(id);
        },
        async websiteAllowed(host, isMuted = false) {
            const {
                allWebsites,
                allowedWebsites,
                blockedWebsites,
                tabMuted
            } = await browser.storage.local.get({
                allWebsites: true,
                allowedWebsites: [],
                blockedWebsites: [],
                tabMuted: true
            });
            if(tabMuted && isMuted) {
                return false;
            }
            if(allWebsites) {
                return !blockedWebsites.includes(host);
            }

            return allowedWebsites.includes(host);
        },
        shouldMakeSound(source, sourceSpec, sourceMuted = false) {
            if(source === SOURCES.EXTENSION) {
                return this.extensionAllowed(sourceSpec);
            }
            else if(source === SOURCES.WEBSITE) {
                return this.websiteAllowed(sourceSpec, sourceMuted);
            }
            return false;
        },
        async promisedPlay(player) {
            await player.play();
            this.playing = player;
        },
        makeSound() {
            if(this.playing !== this.player && !this.playing.paused) {
                this.playing.pause();
            }
            this.currentPref = this.PREF_NAME;
            this.player.currentTime = 0;
            return this.promisedPlay(this.player);
        },
        async getPrefForHost(sourceSpec) {
            // For now we only have one pref per host, but hopefully not forever.
            //TODO even though a page might not have a custom sound, it may have a custom volume!
            const hostPrefName = `sound-${sourceSpec}`,
                { [hostPrefName]: hostPrefValue } = await browser.storage.local.get({
                    [hostPrefName]: false
                });
            if(hostPrefValue) {
                return hostPrefName;
            }
            return this.PREF_NAME;
        },
        async onNotification(source, sourceSpec, sourceMuted = false) {
            if(await this.shouldMakeSound(source, sourceSpec, sourceMuted)) {
                const prefName = await this.getPrefForHost(sourceSpec);
                if(prefName !== this.PREF_NAME) {
                    try {
                        await this.playFromStorage(prefName);
                        return true;
                    }
                    catch(error) {
                        console.error("Could not load and play custom sound, falling back to global sound", error);
                    }
                }
                await this.makeSound();
                return true;
            }
            return false;
        },
        async shouldPlaySound(source, sourceSpec, sourceMuted = false) {
            if(source === SOURCES.WEBSITE) {
                const { websiteSound } = await browser.storage.local.get({
                    websiteSound: true
                });
                if(!websiteSound) {
                    return false;
                }
            }
            return this.shouldMakeSound(source, sourceSpec, sourceMuted);
        },
        play(url, player = this.getPlayer()) {
            if(this.playing && !this.playing.paused) {
                this.playing.pause();
            }
            player.src = url;
            return this.promisedPlay(player);
        },
        preparePlay(url, prefName) {
            const player = this.getPlayer();
            this.setPlayerVolume(prefName, player);
            return this.play(url, player);
        },
        async onPlay(source, sourceSpec, url, sourceMuted = false) {
            if(await this.shouldPlaySound(source, sourceSpec, sourceMuted)) {
                const prefName = await this.getPrefForHost(sourceSpec);
                try {
                    await this.preparePlay(url, prefName);
                }
                catch(error) {
                    console.warn("Couldn't play file specified by the website, falling back to default sound", error);
                    await this.onNotification(source, sourceSpec, sourceMuted);
                }
            }
        },
        async playFromStorage(prefName) {
            const { [prefName]: soundName } = await browser.storage.local.get(prefName);
            if(soundName) {
                const url = await this.loadFile(prefName + soundName),
                    discard = (event) => {
                        let otherEvent = "ended";
                        if(event.type == otherEvent) {
                            otherEvent = "pause";
                        }
                        this.playing.removeEventListener(otherEvent, discard);
                        URL.revokeObjectURL(url);
                        this.playing = null;
                    };
                await this.preparePlay(url, prefName);
                this.playing.addEventListener("ended", discard, {
                    once: true,
                    passive: true
                });
                this.playing.addEventListener("pause", discard, {
                    once: true,
                    passive: true
                });
            }
        },
        async preview(prefName) {
            if(prefName === this.PREF_NAME) {
                return this.makeSound();
            }
            return this.playFromStorage(prefName);
        }
    },
    extractHost = (url) => {
        const urlObject = new URL(url);
        let host = urlObject.hostname;
        if(host.startsWith(WWW_PREFIX)) {
            host = host.slice(WWW_PREFIX.length);
        }
        return host;
    },
    RecentExtensions = {
        recents: new Set(),
        add(id) {
            this.recents.add(id);
        },
        get() {
            return Array.from(this.recents.values());
        }
    },
    DownloadListener = {
        DOWNLOAD_COMPLETE: "complete",
        init() {
            browser.downloads.onChanged.addListener(async (download) => {
                if(download.state.current === this.DOWNLOAD_COMPLETE && download.state.previous !== this.DOWNLOAD_COMPLETE) {
                    const lastWindow = await browser.windows.getLastFocused({
                        windowTypes: [ 'normal' ]
                    });
                    if(!lastWindow.focused || lastWindow.state === "minimized") {
                        const { download: downloadSound } = await browser.storage.local.get({
                            download: true
                        });
                        if(downloadSound) {
                            NotificationListener.makeSound();
                        }
                    }
                    else {
                        const {
                            download: downloadSound,
                            downloadAlways
                        } = await browser.storage.local.get({
                            download: true,
                            downloadAlways: false
                        });
                        if(downloadSound && downloadAlways) {
                            NotificationListener.makeSound();
                        }
                    }
                }
            });
        }
    },
    TabMenu = {
        MENU_ITEM: 'toggle-ignore',
        ONE_ITEM: 1,
        TST_ID: 'treestyletab@piro.sakura.ne.jp',
        TYPES: {
            VANILLA: 'vanilla',
            TST: 'tst'
        },
        TST_TIMEOUT: 10000,
        currentId: 0,
        tstCurrentId: 0,
        disabledLabel: browser.i18n.getMessage('extensionName'),
        hasTST: false,
        init() {
            if(!browser.menus.hasOwnProperty('onShown') || !browser.menus.hasOwnProperty('onHidden')) {
                // Don't show the menu when we can't update the menu item
                return;
            }
            const { content_scripts: [ contentScript ] } = browser.runtime.getManifest(),
                parameters = {
                    contexts: [ "tab" ],
                    documentUrlPatterns: contentScript.matches,
                    id: this.MENU_ITEM,
                    title: this.disabledLabel,
                    enabled: false,
                    type: 'checkbox'
                };
            browser.menus.create(parameters);
            this.registerTST(parameters);
            browser.menus.onShown.addListener((context, tab) => this.updateItem(context, tab).catch(console.error));
            browser.menus.onHidden.addListener(() => this.closeMenu());
            browser.menus.onClicked.addListener((context, tab) => this.handleClick(context, tab).catch(console.error));
            browser.runtime.onMessageExternal.addListener((message, sender) => {
                if(sender.id === this.TST_ID) {
                    switch(message.type) {
                    case 'fake-contextMenu-click':
                        this.handleClick(message.info, message.tab).catch(console.error);
                        break;
                    case 'fake-contextMenu-shown':
                        this.updateItem(message.info, message.tab, this.TYPES.TST).catch(console.error);
                        break;
                    case 'fake-contextMenu-hidden':
                        this.closeMenu(this.TYPES.TST);
                        break;
                    case 'shutdown':
                        if(this.tstCheck) {
                            clearInterval(this.tstCheck);
                        }
                        this.hasTST = false;
                        break;
                    case 'ready':
                        this.registerTST(parameters);
                        break;
                    default:
                    }
                }
            });
        },
        async registerTST(parameters) {
            try {
                await browser.runtime.sendMessage(this.TST_ID, {
                    type: 'register-self',
                    name: browser.i18n.getMessage("extensionName"),
                    icons: browser.runtime.getManifest().icons,
                    listeningTypes: [
                        'ready',
                        'shutdown',
                        'fake-contextMenu-click',
                        'fake-contextMenu-shown',
                        'fake-contextMenu-hidden'
                    ]
                });
                this.hasTST = true;
                await browser.runtime.sendMessage(this.TST_ID, {
                    type: 'fake-contextMenu-create',
                    params: parameters
                });
                this.tstCheck = setInterval(() => this.checkTST().catch(console.error), this.TST_TIMEOUT);
            }
            catch(error) {
                this.hasTST = false;
            }
        },
        async checkTST() {
            try {
                await browser.runtime.sendMessage(this.TST_ID, {
                    type: 'ping'
                });
            }
            catch(error) {
                clearInterval(this.tstCheck);
                this.hasTST = false;
            }
        },
        async updateItem(context, tab, type = this.TYPES.VANILLA) {
            const menuId = type === this.TYPES.VANILLA ? this.currentId : this.tstCurrentId;
            if(context.menuIds.includes(this.MENU_ITEM) || type === this.TYPES.TST) {
                const updatedSpec = {
                        enabled: true
                    },
                    { allWebsites } = await browser.storage.local.get({
                        allWebsites: true
                    });
                if(!this.isCurrentMenu(menuId, type)) {
                    return;
                }
                const host = extractHost(tab.url);
                updatedSpec.title = browser.i18n.getMessage(allWebsites ? 'ignoreHost' : 'allowHost', host);
                const canPlaySound = await NotificationListener.websiteAllowed(host, false);
                if(!this.isCurrentMenu(menuId, type)) {
                    return;
                }
                updatedSpec.checked = allWebsites ? !canPlaySound : canPlaySound;
                if(this.hasTST && type === this.TYPES.TST) {
                    await browser.runtime.sendMessage(this.TST_ID, {
                        type: 'fake-contextMenu-update',
                        params: [
                            this.MENU_ITEM,
                            updatedSpec
                        ]
                    });
                }
                else if(type === this.TYPES.VANILLA) {
                    browser.menus.update(this.MENU_ITEM, updatedSpec);
                    browser.menus.refresh();
                }
            }
        },
        closeMenu(type = this.TYPES.VANILLA) {
            if(type === this.TYPES.VANILLA) {
                ++this.currentId;
            }
            else if(type === this.TYPES.TST) {
                ++this.tstCurrentId;
            }
        },
        isCurrentMenu(menuId, type = this.TYPES.VANILLA) {
            if(type === this.TYPES.VANILLA) {
                return menuId === this.currentId;
            }
            else if(type === this.TYPES.TST) {
                return menuId === this.tstCurrentId;
            }
        },
        async handleClick(context, tab) {
            const host = extractHost(tab.url),
                {
                    allWebsites,
                    allowedWebsites,
                    blockedWebsites
                } = await browser.storage.local.get({
                    allWebsites: true,
                    allowedWebsites: [],
                    blockedWebsites: []
                }),
                list = allWebsites ? blockedWebsites : allowedWebsites,
                updateProperty = allWebsites ? 'blockedWebsites' : 'allowedWebsites';
            if(list.includes(host)) {
                list.splice(list.indexOf(host), this.ONE_ITEM);
            }
            else {
                list.push(host);
            }
            return browser.storage.local.set({
                [updateProperty]: list
            });
        }
    },
    isWebsite = (sender) => sender.url.startsWith("http");

browser.runtime.onMessage.addListener((message, sender) => {
    if(message === NOTIFICATION_TOPIC && isWebsite(sender)) {
        NotificationListener.onNotification(SOURCES.WEBSITE, extractHost(sender.url), sender.tab.mutedInfo && sender.tab.mutedInfo.muted)
            .catch(console.error);
    }
    else if(typeof message === "object" && message.command === "play" && isWebsite(sender)) {
        NotificationListener.onPlay(SOURCES.WEBSITE, extractHost(sender.url), message.url, sender.tab.mutedInfo && sender.tab.mutedInfo.muted)
            .catch(console.error);
    }
    else if(typeof message === "object" && message.command === "preview-sound") {
        return NotificationListener.preview(message.pref);
    }
    else if(message === "recent-extensions") {
        return Promise.resolve(RecentExtensions.get());
    }
});
browser.runtime.onMessageExternal.addListener((message, sender) => {
    if(message === NOTIFICATION_TOPIC) {
        RecentExtensions.add(sender.id);
        return NotificationListener.onNotification(SOURCES.EXTENSION, sender.id);
    }
});
browser.runtime.onInstalled.addListener((details) => {
    if(details.reason === "install" && !details.temporary) {
        browser.tabs.create({
            url: browser.runtime.getURL("pages/firstrun.html")
        });
    }
});

NotificationListener.init();
DownloadListener.init();
TabMenu.init();
