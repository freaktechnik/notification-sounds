"use strict";

//TODO default sound
//TODO provide some default extension IDs
//TODO tab context menu to quickly whitelist/unwhitelist host
//TODO content script that does the magic for websites
//TODO sync?

const SOURCES = {
        WEBSITE: 0,
        EXTENSION: 1
    },
    NOTIFICATION_TOPIC = "new-notification",
    NotificationListener = {
        init() {
            this.player = new Audio();
            this.player.autoplay = false;
            this.player.preload = true;

            //TODO load sound
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
    };

browser.runtime.onMessage.addListener((message, sender) => {
    if(message === NOTIFICATION_TOPIC && sender.url.startsWith("http")) {
        return NotificationListener.onNotification(SOURCES.WEBSITE, extractHost(sender.url));
    }
});
browser.runtime.onMessageExternal.addListener((message, sender) => {
    if(message === NOTIFICATION_TOPIC) {
        return NotificationListener.onNotification(SOURCES.EXTENSION, sender.id);
    }
});
NotificationListener.init();
