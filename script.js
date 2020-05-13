const EXTERNAL_SOUND = "tetris.MP3",
    showNotification = async (options) => {
        const perm = await Notification.requestPermission();
        if(perm === "granted") {
            const notif = new Notification("Test notification", options);
            for(const p in options) {
                console.log(p, notif[p] === options[p]);
            }
        }
        else {
            console.error("Can not play sound because permission was not granted.");
        }
    },
    showSWNotification = async (options) => {
        const perm = await Notification.requestPermission();
        if(perm === "granted" && navigator.serviceWorker) {
            const sw = await navigator.serviceWorker.ready;
            sw.showNotification("Test notification", options);
        }
        else {
            console.error("Can not play sound because permission was not granted.");
        }
    };

navigator.serviceWorker.register('sw.js');

document.getElementById("normal").addEventListener("click", () => showNotification());
document.getElementById("silent").addEventListener("click", () => showNotification({ silent: true }));
document.getElementById("custom").addEventListener("click", () => showNotification({ sound: EXTERNAL_SOUND}));
document.getElementById("swnormal").addEventListener("click", () => showSWNotification());
