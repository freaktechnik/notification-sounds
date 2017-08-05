# ![icon](images/icon-48.png) Notification Sound

[![Greenkeeper badge](https://badges.greenkeeper.io/freaktechnik/notification-sounds.svg)](https://greenkeeper.io/) [![Build Status](https://travis-ci.org/freaktechnik/notification-sounds.svg?branch=master)](https://travis-ci.org/freaktechnik/notification-sounds)

Makes a sound when a notification is shown

## Extension integration
For extensions to trigger a sound when creating a notification, they have to send the following message:
```js
browser.runtime.sendMessage("@notification-sound", "new-notification");
```

## License
The code that makes up this project is licensed under the MPL-2.0

The pop.flac sound is licensed under the [CC-3.0-BY license](https://creativecommons.org/licenses/by/3.0/) and was created by [Tobiasz 'unfa' Karoń](https://freesound.org/people/unfa/), original available on [freesound.org](https://freesound.org/people/unfa/sounds/245645/)
