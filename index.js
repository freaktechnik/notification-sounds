/**
 * Replaces the current alert service and plays a sound if desired.
 * @author Martin Giger
 * @license MPL-2.0
 * @module index
 */
"use strict";

/**
 * XPCOM base interface.
 * @external nsISupports
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsISupports
 */
/**
 * The important notification service interface that has methods for showing a
 * notification.
 * @external nsIAlertsService
 * @extends external:nsISupports
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIAlertsService
 */
/**
 * Provides the interface to a principal, which represents a security context.
 * @external nsIPrincipal
 * @extends external:nsISerializable
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrincipal
 */
/**
 * SDK helpers to interact with XPCOM
 * @external sdk/platform/xpcom
 * @requires sdk/platform/xpcom
 * @see https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/platform_xpcom
 */
/**
 * @class Unknown
 * @memberof external:sdk/platform/xpcom
 * @implements external:nsISupports
 * @see https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/platform_xpcom#Unknown
 */
const xpcom = require("sdk/platform/xpcom");
const { Class } = require("sdk/core/heritage");
const { CC, Ci, Cm } = require("chrome");
const { prefs } = require("sdk/simple-prefs");
const { window } = require("sdk/addon/window");
const events = require("sdk/system/event");

const registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);

const ALERT_SERVICE_CONTRACT = "@mozilla.org/alerts-service;1";
const originalFactory = Cm.getClassObject(xpcom.factoryByContract(ALERT_SERVICE_CONTRACT), Ci.nsIFactory);
const factoryCID = registrar.contractIDToCID(ALERT_SERVICE_CONTRACT);

const nsSound = CC("@mozilla.org/sound;1", "nsISound");

const oldService = xpcom.factoryByContract(ALERT_SERVICE_CONTRACT).getService(Ci.nsIAlertsService);

const NOTIFICATION_EVENT = "notification-showing";

/**
 * @const {string}
 * @default "native"
 */
const NATIVE_SOURCE = "native";

/**
 * Check if something is not ignored.
 * @argument {string} origin - The string to check for
 * @return {boolean}
 */
const isNotIgnored = (origin) => {
    return !prefs.ignore ||
        prefs.ignore.split(",").every((s) => !origin.includes(s.trim()));
};

/**
 * Check if something is allowed.
 * @argument {string} origin - The string to check for
 * @return {boolean}
 */
const isFiltered = (origin) => {
    return !prefs.filter ||
        prefs.filter.split(",").some((s) => origin.includes(s.trim()));
};

/**
 * Determine if a sound should be played for a notification.
 * @argument {external:nsIPrincipal?} [principal = null] - Principal of the
 *                                                         notification if any.
 * @return {boolean} Indicates if a sound should be played.
 */
const shouldPlaySound = (principal = null) => {
    if(!prefs.filter && !prefs.ignore)
        return true;
    else if(principal !== null)
        return isNotIgnored(principal.origin) && isFiltered(principal.origin);
    else
        return isNotIgnored(NATIVE_SOURCE) && isFiltered(NATIVE_SOURCE);
};

/**
 * A wrapper around the original alert service that plays a sound whenever a
 * notification is shown and it should have a sound according to user-defined
 * rules.
 * @class
 * @implements external:nsIAlertsService
 * @implements external:nsIAlertsProgressListener
 * @implements external:nsIAlertsDoNotDisturb
 * @extends external:sdk/platform/xpcom.Unknown
 */
const Wrapper = Class(
/** @lends module:index~Wrapper.prototype */
{
    extends: xpcom.Unknown,
    interfaces: [ "nsIAlertsService", "nsIAlertsProgressListener", "nsIAlertsDoNotDisturb" ],
    onProgress(...args) {
        oldService.QueryInterface(Ci.nsIAlertsProgressListener).onProgress(...args);
    },
    onCancel(...args) {
        oldService.QueryInterface(Ci.nsIAlertsProgressListener).onCancel(...args);
    },
    get manualDoNotDisturb() {
        return oldService.QueryInterface(Ci.nsIAlertsDoNotDisturb).manualDoNotDisturb;
    },
    set manualDoNotDisturb(val) {
        oldService.QueryInterface(Ci.nsIAlertsDoNotDisturb).manualDoNotDisturb = val;
    },
    showAlertNotification(...args) {
        oldService.showAlertNotification(...args);

        let principal = args.length >= 10 ? args[10] : null;
        if(shouldPlaySound(principal)) {
            if(prefs.alert_sound) {
                const sound = new window.Audio("file://"+prefs.alert_sound);
                sound.play();
            }
            else {
                const soundService = new nsSound();
                soundService.playEventSound(prefs.native_sound);
            }
        }

        events.emit(NOTIFICATION_EVENT, {
            data: args,
            subject: this
        });
    },
    closeAlert(...args) {
        oldService.closeAlert(...args);
    }
});

// Unregister the current alert service and replace it with our wrapper.
registrar.unregisterFactory(factoryCID, originalFactory);
const wrapperFactory = xpcom.Service({
    contract: ALERT_SERVICE_CONTRACT,
    Component: Wrapper,
    unregister: false,
    id: factoryCID
});

// Unregister our own service on unload and replace it with the original.
exports.onUnload = function() {
    xpcom.unregister(wrapperFactory);
    registrar.registerFactory(
        factoryCID,
        "Alerts Service",
        ALERT_SERVICE_CONTRACT,
        originalFactory
    );
};
