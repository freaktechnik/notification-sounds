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
                    url: new URL(options.sound, globalThis.location).toString(),
                });
            }
        }
    },
    OriginalNotification = globalThis.wrappedJSObject.Notification,
    /**
     * @class
     * @param {?} arguments_ - Arguments.
     * @returns {Notification} Instance.
     * @extends {Notification}
     */
    ModifiedNotification = function(...arguments_) {
        dispatchNotificationEvent(arguments_.length > OPTIONS_INDEX ? arguments_[OPTIONS_INDEX] : undefined);
        return new OriginalNotification(...arguments_);
    },
    descriptor = globalThis.wrappedJSObject.Object.getOwnPropertyDescriptors(OriginalNotification);


// Replace original Notification constructor with the version that plays sounds.
globalThis.wrappedJSObject.Notification = exportFunction(ModifiedNotification, globalThis, {
    allowCrossOriginArguments: true,
});
// Ensure the prototype is correct, inheriting from the original prototype.
descriptor.prototype.value = cloneInto({}, globalThis);
Object.setPrototypeOf(descriptor.prototype.value, OriginalNotification.prototype);
// Make instanceof work with overwritten constructor.
descriptor[Symbol.hasInstance] = cloneInto({
    enumerable: false,
    writable: false,
    configurable: false,
    value: (instance) => instance instanceof OriginalNotification,
}, globalThis, {
    cloneFunctions: true,
});
// Set static propertties on our constructor.
globalThis.wrappedJSObject.Object.defineProperties(globalThis.wrappedJSObject.Notification, descriptor);
// Set the constructor property. Have to set it here so it gets set to the same instance as the main constructor.
globalThis.wrappedJSObject.Notification.prototype.constructor = globalThis.wrappedJSObject.Notification;
// Set the top level proto, which for some reason is an EventTarget.
Object.setPrototypeOf(globalThis.wrappedJSObject.Notification, Object.getPrototypeOf(OriginalNotification));

// Override serviceWorker notifications in website scope.
const original = globalThis.wrappedJSObject.ServiceWorkerRegistration.prototype.showNotification,
    /**
     * @param {?} arguments_ - Arguments.
     * @returns {Promise} Resolves with the original promise.
     * @this {ServiceWorkerRegistration}
     */
    replacement = function(...arguments_) {
        dispatchNotificationEvent(arguments_.length > OPTIONS_INDEX ? arguments_[OPTIONS_INDEX] : undefined);
        return Reflect.apply(original, this, arguments_);
    };

globalThis.wrappedJSObject.ServiceWorkerRegistration.prototype.showNotification = exportFunction(replacement, globalThis, {
    allowCrossOriginArguments: true,
});
