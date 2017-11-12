"use strict";
/* global cloneInto, exportFunction */
//TODO handle renotify & tag

const OPTIONS_INDEX = 1,
    dispatchNotificationEvent = (options) => {
        if(Notification.permission === "granted" && (!options || !options.silent)) {
            if(!options || !options.sound) {
                browser.runtime.sendMessage("new-notification");
            }
            else {
                browser.runtime.sendMessage({
                    command: 'play',
                    url: new URL(options.sound, window.location).toString()
                });
            }
        }
    },
    OriginalNotification = window.wrappedJSObject.Notification,
    /**
     * @class
     * @extends {Notification}
     * @param {?} args - Arguments.
     * @returns {Notification} Instance.
     */
    ModifiedNotification = function(...args) {
        dispatchNotificationEvent(args[OPTIONS_INDEX]);
        return new OriginalNotification(...args);
    },
    descriptor = Object.getOwnPropertyDescriptors(OriginalNotification);

delete descriptor.prototype;

// Replace original Notification constructor with the version that plays sounds.
window.wrappedJSObject.Notification = exportFunction(ModifiedNotification, window, {
    allowCrossOriginArguments: true
});
// Ensure the prototype is correct, inheriting from the original prototype
window.wrappedJSObject.Notification.prototype = cloneInto({}, window);
window.wrappedJSObject.Notification.prototype.constructor = window.wrappedJSObject.Notification;
Object.setPrototypeOf(window.wrappedJSObject.Notification.prototype, OriginalNotification.prototype);
// Set static propertties on our constructor
Object.defineProperties(window.wrappedJSObject.Notification, descriptor);
Object.setPrototypeOf(window.wrappedJSObject.Notification, Object.getPrototypeOf(OriginalNotification));

// Override serviceWorker notifications in website scope.
const original = window.wrappedJSObject.ServiceWorkerRegistration.prototype.showNotification,
    /**
     * @param {?} args - Arguments.
     * @this {ServiceWorkerRegistration}
     * @returns {Promise}
     */
    replacement = function(...args) {
        dispatchNotificationEvent(args[OPTIONS_INDEX]);
        return original.call(this, ...args);
    };

window.wrappedJSObject.ServiceWorkerRegistration.prototype.showNotification = exportFunction(replacement, window, {
    allowCrossOriginArguments: true
});
