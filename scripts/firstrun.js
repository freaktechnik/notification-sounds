const player = new Audio(),
    canPlay = player.canPlayType("audio/flac");

document.addEventListener("DOMContentLoaded", () => {
    if(canPlay) {
        document.getElementById("preview").addEventListener("click", () => {
            browser.runtime.sendMessage({
                command: "preview-sound",
                pref: 'soundName',
            }).catch(console.error);
        }, {
            passive: true,
        });
    }
    else {
        document.getElementById("support").hidden = true;
        document.getElementById("preview").hidden = true;
        document.getElementById("nosupport").hidden = false;
    }

    document.getElementById("options").addEventListener("click", () => {
        browser.runtime.openOptionsPage();
    }, {
        passive: true,
    });
}, {
    passive: true,
    once: true,
});
