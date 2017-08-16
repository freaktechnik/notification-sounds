/* global StoredBlob */
"use strict";

//TODO tab context menu to quickly whitelist/unwhitelist host (requires the before show listener to prepare)
//TODO sync?

const SOURCES = {
        WEBSITE: 0,
        EXTENSION: 1
    },
    NOTIFICATION_TOPIC = "new-notification",
    NotificationListener = {
        DEFAULT_SOUND: browser.runtime.getURL('pop.flac'),
        init() {
            this.player = new Audio();
            this.player.autoplay = false;
            this.player.preload = true;
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
            const { allExtensions, allowedExtensions, blockedExtensions } = await
                browser.storage.local.get({
                    allExtensions: true,
                    allowedExtensions: [],
                    blockedExtensions: []
                });
            if(allExtensions) {
                return !blockedExtensions.includes(id);
            }
            else {
                return allowedExtensions.includes(id);
            }
        },
        async websiteAllowed(host) {
            if(host.startsWith("www.")) {
                host = hist.substr(4);
            }
            const { allWebsites, allowedWebsites, blockedWebsites } = await
                browser.storage.local.get({
                    allWebsites: true,
                    allowedWebsites: [],
                    blockedWebsites: []
                });
            if(allWebsites) {
                return !blockedWebsites.includes(host);
            }
            else {
                return allowedWebsites.includes(host);
            }
        },
        shouldMakeSound(source, sourceSpec) {
            if(source === SOURCES.EXTENSION) {
                return this.extensionAllowed(sourceSpec);
            }
            else if(source === SOURCES.WEBSITE) {
                return this.websiteAllowed(sourceSpec);
            }
            return false;
        },
        makeSound() {
            this.player.currentTime = 0;
            this.player.play();
        },
        async onNotification(source, sourceSpec) {
            if(await this.shouldMakeSound(source, sourceSpec)) {
                this.makeSound();
            }
        }
    },
    extractHost = (url) => {
        const urlObj = new URL(url);
        return urlObj.hostname;
    },
    RecentExtensions = {
        recents: new Set(),
        add(id) {
            this.recents.add(id);
        },
        get() {
            return Array.from(this.recents);
        }
    };

browser.runtime.onMessage.addListener((message, sender) => {
    if(message === NOTIFICATION_TOPIC && sender.url.startsWith("http")) {
        return NotificationListener.onNotification(SOURCES.WEBSITE, extractHost(sender.url));
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
