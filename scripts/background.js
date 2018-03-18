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
    NotificationListener = {
        DEFAULT_SOUND: browser.runtime.getURL('pop.flac'),
        getPlayer() {
            const player = new Audio();
            player.autoplay = false;
            player.preload = true;
            return player;
        },
        init() {
            this.player = this.getPlayer();
            this.playing = this.player;
            this.loadSound();

            browser.storage.onChanged.addListener((changes, areaName) => {
                if(areaName === "local" && "soundName" in changes) {
                    this.loadSound();
                }
            });
        },
        async loadSound() {
            const { soundName } = await browser.storage.local.get({
                soundName: ''
            });
            if(this.player.src && this.player.src !== this.DEFAULT_SOUND) {
                const oldURL = this.player.src;
                this.player.src = "";
                URL.revokeObjectURL(oldURL);
            }
            if(soundName.length) {
                const storedFile = new StoredBlob(soundName),
                    file = await storedFile.get();
                this.player.src = URL.createObjectURL(file);
            }
            else {
                this.player.src = this.DEFAULT_SOUND;
            }
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
        makeSound() {
            if(this.playing !== this.player && !this.playing.paused) {
                this.playing.pause();
            }
            this.player.currentTime = 0;
            this.player.play();
            this.playing = this.player;
        },
        async onNotification(source, sourceSpec, sourceMuted = false) {
            if(await this.shouldMakeSound(source, sourceSpec, sourceMuted)) {
                this.makeSound();
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
        async onPlay(source, sourceSpec, url, sourceMuted = false) {
            if(await this.shouldPlaySound(source, sourceSpec, sourceMuted)) {
                if(this.playing && !this.playing.paused) {
                    this.playing.pause();
                }
                const player = this.getPlayer();
                player.src = url;
                player.play();
                this.playing = player;
            }
        }
    },
    extractHost = (url) => {
        const urlObj = new URL(url);
        let host = urlObj.hostname;
        if(host.startsWith(WWW_PREFIX)) {
            host = host.substr(WWW_PREFIX.length);
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
        currentId: 0,
        disabledLabel: browser.i18n.getMessage('extensionName'),
        init() {
            if(!browser.menus.hasOwnProperty('onShown') || !browser.menus.hasOwnProperty('onHidden')) {
                // Don't show the menu when we can't update the menu item
                return;
            }
            browser.menus.create({
                contexts: [ "tab" ],
                documentUrlPatterns: [ "*://*/*" ],
                id: this.MENU_ITEM,
                title: this.disabledLabel,
                enabled: false,
                type: 'checkbox'
            });
            browser.menus.onShown.addListener((context, tab) => this.updateItem(context, tab).catch(console.error));
            browser.menus.onHidden.addListener(() => this.closeMenu());
            browser.menus.onClicked.addListener((context, tab) => this.handleClick(context, tab).catch(console.error));
        },
        async updateItem(context, tab) {
            const menuId = this.currentId;
            if(context.menuIds.includes(this.MENU_ITEM)) {
                const updatedSpec = {
                    enabled: true
                };
                const { allWebsites } = await browser.storage.local.get({
                    allWebsites: true
                });
                if(!this.isCurrentMenu(menuId)) {
                    return;
                }
                const host = extractHost(tab.url);
                updatedSpec.title = browser.i18n.getMessage(allWebsites ? 'ignoreHost' : 'allowHost', host);
                const canPlaySound = await NotificationListener.websiteAllowed(host, false);
                if(!this.isCurrentMenu(menuId)) {
                    return;
                }
                updatedSpec.checked = allWebsites ? !canPlaySound : canPlaySound;
                browser.menus.update(this.MENU_ITEM, updatedSpec);
                browser.menus.refresh();
            }
        },
        closeMenu() {
            ++this.currentId;
        },
        isCurrentMenu(menuId) {
            return menuId === this.currentId;
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
                updateProp = allWebsites ? 'blockedWebsites' : 'allowedWebsites';
            if(list.includes(host)) {
                list.splice(list.indexOf(host), 1);
            }
            else {
                list.push(host);
            }
            return browser.storage.local.set({
                [updateProp]: list
            });
        }
    },
    isWebsite = (sender) => sender.url.startsWith("http");

browser.runtime.onMessage.addListener((message, sender) => {
    if(message === NOTIFICATION_TOPIC && isWebsite(sender)) {
        NotificationListener.onNotification(SOURCES.WEBSITE, extractHost(sender.url), sender.tab.mutedInfo && sender.tab.mutedInfo.muted);
    }
    else if(typeof message === "object" && message.command === "play" && isWebsite(sender)) {
        NotificationListener.onPlay(SOURCES.WEBSITE, extractHost(sender.url), message.url, sender.tab.mutedInfo && sender.tab.mutedInfo.muted);
    }
    else if(message === "preview-sound") {
        NotificationListener.makeSound();
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

NotificationListener.init();
DownloadListener.init();
TabMenu.init();
