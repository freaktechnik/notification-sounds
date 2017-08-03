/* eslint-disable no-eval */
const EVENT = "we-ns-notificationshown";
window.addEventListener(EVENT, ({ detail }) => {
    if(!detail && Notification.permission === "granted") {
        browser.runtime.sendMessage("new-notification");
    }
}, {
    passive: true,
    capture: true
});

// I tried doing this the XRay wrappers way, but there's just so much that can
// (and does) go wrong, that I eventually gave up and this works very well and
// seems secure-enough.

window.eval(`window.Notification = class extends Notification {
    constructor(title, options) {
        super(title, options);
        if(Notification.permission === "granted") {
            const e = new CustomEvent('${EVENT}', {
                detail: options ? options.silent: false
            });
            window.dispatchEvent(e);
        }
    }
};`);
