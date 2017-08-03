/* global XPCNativeWrapper, exportFunction */
/* eslint-disable new-cap */
window.addEventListener("notificationshown", ({ detail }) => {
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
            const e = new CustomEvent('notificationshown', {
                detail: options ? options.silent: false
            });
            window.dispatchEvent(e);
        }
    }
};`);
