/**
 * @author Martin Giger
 * @license MPL-2.0
 * @todo Test ignore/allow list
 */
require("../index");

const { Cc, Ci, CC } = require("chrome");
const { defer } = require("sdk/core/promise");
const events = require("sdk/system/events");
const self = require("sdk/self");
const { Class } = require("sdk/core/heritage");
const { Unknown } = require("sdk/platform/xpcom");
const { cleanUI } = require("sdk/test/utils");

const AlertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
const AlertNotification = CC("@mozilla.org/alert-notification;1", "nsIAlertNotification", "init");

const NotificationObserver = Class({
    extends: Unknown,
    interfaces: [ "nsIObserver" ],
    initialize(listener) {
        this.listener = listener;
    },
    observe(subject, topic, data) {
        this.listener(topic, data);
    }
});

const getNotification = () => {
    return new AlertNotification("test-notif", self.data.url("icon-64.png"), "Test", "Notification for a unit test");
};

const getObserver = (listener) => {
    return new NotificationObserver(listener);
};

exports['test showAlertNotification observer notification'] = function*(assert) {
    const p = defer();

    events.once("notification-showing", p.resolve);

    AlertsService.showAlertNotification(self.data.url("icon-64.png"), "Test", "Notification for a unit test");

    yield p.promise;
    yield cleanUI();
};

exports['test showAlert observer notification'] = function*(assert) {
    const p = defer();

    events.once("notification-showing", p.resolve);

    AlertsService.showAlert(getNotification());

    yield p.promise;
    yield cleanUI();
};

exports['test showAlertNotification notification observer'] = function*(assert) {
    let p = defer();

    const observer = getObserver((topic, data) => {
        p.resolve(topic);
    });

    AlertsService.showAlertNotification(self.data.url("icon-64.png"), "Test", "Notification for a unit test", false, null, observer);

    let topic = yield p.promise;
    p = defer();

    assert.equal(topic, "alertshow", "Alert was shown");

    topic = yield p.promise;

    assert.equal(topic, "alertfinished", "Alert was hidden");

    yield cleanUI();
};

exports['test showAlertNotification notification observer'] = function*(assert) {
    let p = defer();

    const observer = getObserver((topic, data) => {
        p.resolve(topic);
    });

    AlertsService.showAlert(getNotification(), observer);

    let topic = yield p.promise;
    p = defer();

    assert.equal(topic, "alertshow", "Alert was shown");

    topic = yield p.promise;

    assert.equal(topic, "alertfinished", "Alert was hidden");

    yield cleanUI();
};

require("sdk/test").run(exports);
