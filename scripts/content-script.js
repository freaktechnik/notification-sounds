/* global XPCNativeWrapper, exportFunction */
/* eslint-disable new-cap */
const EVENT = "we-ns-notificationshown";
window.addEventListener(EVENT, ({ detail }) => {
    if(!detail) {
        browser.runtime.sendMessage("new-notification");
    }
}, {
    passive: true,
    capture: true
});

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
