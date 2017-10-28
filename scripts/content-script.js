const EVENT = "we-ns-notificationshown";
window.addEventListener(EVENT, ({ detail }) => {
    if(Notification.permission === "granted") {
        if(!detail) {
            browser.runtime.sendMessage("new-notification");
        }
        else {
            browser.runtime.sendMessage({
                command: 'play',
                url: new URL(detail, window.location).toString()
            });
        }
    }
}, {
    passive: true,
    capture: true
});

// I tried doing this the XRay wrappers way, but there's just so much that can
// (and does) go wrong, that I eventually gave up and this works very well and
// seems secure-enough.
//TODO handle renotify & tag
//TODO share code?

/* eslint-disable no-eval */
// Override the Notification class.
window.eval(`window.Notification = class extends Notification {
    constructor(title, options) {
        super(title, options);
        if(Notification.permission === "granted" && (!options || !options.silent)) {
            const e = new CustomEvent('${EVENT}', {
                detail: options ? options.sound : false
            });
            window.dispatchEvent(e);
        }
    }
};`);

// Override service worker showNotification in the website scope.
window.eval(`{
    const original = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function(...args) {
        if(Notification.permission === "granted") {
            const e = new CustomEvent('${EVENT}', {
                detail: false
            });
            window.dispatchEvent(e);
        }
        return original.apply(this, args);
    };
}`);
/* eslint-enable no-eval */
