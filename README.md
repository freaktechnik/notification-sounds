# ![icon](images/icon-48.png) Notification Sound

[![Greenkeeper badge](https://badges.greenkeeper.io/freaktechnik/notification-sounds.svg)](https://greenkeeper.io/) [![Build Status](https://travis-ci.org/freaktechnik/notification-sounds.svg?branch=master)](https://travis-ci.org/freaktechnik/notification-sounds)

Makes a sound when a notification is shown.

Overrides Website's `Notification` constructor and `showNotification` method on
ServiceWorker registrations to get notified when they're called. Other extensions
can also let this extension know that they've shown a notification.

Currently can not play a sound when a ServiceWorker shows a notification.

Supports the `silent` and `sound` option on the `Notification` constructor.

## Extension integration
For extensions to trigger a sound when creating a notification, they have to send the following message:
```js
browser.runtime.sendMessage("@notification-sound", "new-notification");
```

`new-notification` returns a Promise that resolves to a boolean, indicating, whether the sound was played (based on user settings).

Starting from Firefox 56, an extension can just add the following code to the top level of its background page to send the message whenever it shows a notification:
```js
browser.notifications.onShown.addListener(() => {
    browser.runtime.sendMessage("@notification-sound", "new-notification");
});
```

## Notification tester
ServiceWorker tests don't work, since JSFiddle has not ServiceWorker.

[JSFiddle Notification Tester](http://jsfiddle.net/y5gj9tj1/5/)

## License
The code that makes up this project is licensed under the MPL-2.0

The pop.flac sound is licensed under the [CC-3.0-BY license](https://creativecommons.org/licenses/by/3.0/) and was created by [Tobiasz 'unfa' Karoń](https://freesound.org/people/unfa/), original available on [freesound.org](https://freesound.org/people/unfa/sounds/245645/)
