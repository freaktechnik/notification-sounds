/* global XPCNativeWrapper, exportFunction */
/* eslint-disable new-cap */
class Notification extends XPCNativeWrapper(window.wrappedJSObject.Notification) {
    constructor(title, options) {
        super(title, options);
        if(!options.silent) {
            browser.runtime.sendMessage("new-notification");
        }
    }
}
//TODO this probably doesn't work.
exportFunction(Notification, window.wrappedJSObject, { defineAs: 'Notification' });
