/**
 * Replaces the current alert service and plays a sound if desired.
 * @author Martin Giger
 * @license MPL-2.0
 * @module index
 */
"use strict";

//TODO play default system sound

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
        //TODO some kind of filter
        if(prefs.alert_sound) {
            const sound = new window.Audio("file://"+prefs.alert_sound);
            sound.play();
        }
        else {
            const soundService = new nsSound();
            soundService.playEventSound(soundService.EVENT_NEW_MAIL_RECEIVED);
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
