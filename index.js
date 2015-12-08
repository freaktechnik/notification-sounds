/**
 * Replaces the current alert service and plays a sound if desired.
 * @author Martin Giger
 * @license MPL-2.0
 * @module index
 */
"use strict";

const xpcom = require("sdk/platform/xpcom");
const { Class } = require("sdk/core/heritage");
const { CC, Ci, Cm } = require("chrome");
const { prefs } = require("sdk/simple-prefs");
const { window } = require("sdk/addon/window");

const registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);

const ALERT_SERVICE_CONTRACT = "@mozilla.org/alerts-service;1";
const originalFactory = Cm.getClassObject(xpcom.factoryByContract(ALERT_SERVICE_CONTRACT), Ci.nsIFactory);
const factoryCID = registrar.contractIDToCID(ALERT_SERVICE_CONTRACT);

const nsSound = CC("@mozilla.org/sound;1", "nsISound");

const oldService = xpcom.factoryByContract(ALERT_SERVICE_CONTRACT).getService(Ci.nsIAlertsService);

const NATIVE_SOURCE = "native";

const isNotIgnored = (origin) => {
    return !prefs.ignore ||
        prefs.ignore.split(",").every((s) => !origin.includes(s.trim()));
};

const isFiltered = (origin) => {
    return !prefs.filter ||
        prefs.filter.split(",").some((s) => origin.includes(s.trim()));
};

const shouldPlaySound = (principal = null) => {
    if(!prefs.filter && !prefs.ignore)
        return true;
    else if(principal !== null)
        return isNotIgnored(principal.origin) && isFiltered(principal.origin);
    else
        return isNotIgnored(NATIVE_SOURCE) && isFiltered(NATIVE_SOURCE);
};

const Wrapper = Class({
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

        let argArr = [...args];
        let principal = argArr.length >= 10 ? argArr[10] : null;
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
