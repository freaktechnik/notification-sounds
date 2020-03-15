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
     * @param {?} arguments_ - Arguments.
     * @returns {Notification} Instance.
     */
    ModifiedNotification = function(...arguments_) {
        dispatchNotificationEvent(arguments_.length > OPTIONS_INDEX ? arguments_[OPTIONS_INDEX] : undefined);
        return new OriginalNotification(...arguments_);
    },
    descriptor = window.wrappedJSObject.Object.getOwnPropertyDescriptors(OriginalNotification);


// Replace original Notification constructor with the version that plays sounds.
window.wrappedJSObject.Notification = exportFunction(ModifiedNotification, window, {
    allowCrossOriginArguments: true
});
// Ensure the prototype is correct, inheriting from the original prototype.
descriptor.prototype.value = cloneInto({}, window);
Object.setPrototypeOf(descriptor.prototype.value, OriginalNotification.prototype);
// Make instanceof work with overwritten constructor.
descriptor[Symbol.hasInstance] = cloneInto({
    enumerable: false,
    writable: false,
    configurable: false,
    value: (instance) => instance instanceof OriginalNotification
}, window, {
    cloneFunctions: true
});
// Set static propertties on our constructor.
window.wrappedJSObject.Object.defineProperties(window.wrappedJSObject.Notification, descriptor);
// Set the constructor property. Have to set it here so it gets set to the same instance as the main constructor.
window.wrappedJSObject.Notification.prototype.constructor = window.wrappedJSObject.Notification;
// Set the top level proto, which for some reason is an EventTarget.
Object.setPrototypeOf(window.wrappedJSObject.Notification, Object.getPrototypeOf(OriginalNotification));

// Override serviceWorker notifications in website scope.
const original = window.wrappedJSObject.ServiceWorkerRegistration.prototype.showNotification,
    /**
     * @param {?} arguments_ - Arguments.
     * @this {ServiceWorkerRegistration}
     * @returns {Promise} Resolves with the original promise.
     */
    replacement = function(...arguments_) {
        dispatchNotificationEvent(arguments_.length > OPTIONS_INDEX ? arguments_[OPTIONS_INDEX] : undefined);
        return Reflect.apply(original, this, arguments_);
    };

window.wrappedJSObject.ServiceWorkerRegistration.prototype.showNotification = exportFunction(replacement, window, {
    allowCrossOriginArguments: true
});
