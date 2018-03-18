/* global StoredBlob */
"use strict";

//TODO nicer look for extensions list. Probably needs some inter-extension communication though :S
//TODO react to changes from context menu

const stores = {
        extension: {
            blocked: "blockedExtensions",
            allowed: "allowedExtensions"
        },
        website: {
            blocked: "blockedWebsites",
            allowed: "allowedWebsites"
        }
    },
    WWW_PREFIX = "www.";

class Sound {
    constructor(prefName, root, defaultSound = 'Default') {
        this.prefName = prefName;
        this.root = root;
        this.defaultSound = defaultSound;
        this.resetButton = this.root.querySelector(".resetSound");
        this.input = this.root.querySelector(".sound");
        this.output = this.root.querySelector(".currentSound");
        this.volume = this.root.querySelector(".volume");
        this.restoreFile();

        this.input.addEventListener("input", () => this.selectFile(), {
            capture: false,
            passive: true
        });
        this.resetButton.addEventListener("click", () => this.reset(), {
            capture: false,
            passive: true
        });
        this.root.querySelector(".playSound").addEventListener("click", () => {
            browser.runtime.sendMessage({
                command: "preview-sound",
                pref: this.prefName
            });
        }, {
            capture: false,
            passive: true
        });
        this.volume.addEventListener("input", () => this.saveVolume(), {
            capture: false,
            passive: true
        });
    }

    get volumePref() {
        return `${this.prefName}-volume`;
    }

    async reset() {
        this.resetButton.disabled = true;
        this.resetButton.classList.add("disabled");
        this.input.value = '';
        this.output.value = this.defaultSound;
        const { [this.prefName]: soundName } = await browser.storage.local.get(this.prefName);
        if(soundName) {
            const storedFile = new StoredBlob(soundName);
            await storedFile.delete();
        }
        return browser.storage.local.set({
            [this.prefName]: ''
        });
    }

    async selectFile() {
        if(this.input.files.length) {
            const [ file ] = this.input.files,
                storedFile = new StoredBlob(this.prefName + file.name);
            this.resetButton.disabled = false;
            this.resetButton.classList.remove("disabled");
            this.output.value = file.name;
            await storedFile.save(file);
            await browser.storage.local.set({
                [this.prefName]: file.name
            });
        }
    }

    saveVolume() {
        return browser.storage.local.set({
            [this.volumePref]: this.volume.valueAsNumber
        });
    }

    async restoreFile() {
        const {
            [this.prefName]: soundName,
            [this.volumePref]: volume
        } = await browser.storage.local.get({
            [this.prefName]: '',
            [this.volumePref]: 1.0
        });
        if(soundName.length) {
            this.output.value = soundName;
            this.resetButton.disabled = false;
            this.resetButton.classList.remove("disabled");
        }
        this.volume.value = volume;
    }
}

class FilterList {
    constructor(datastore, anchor) {
        this.datastore = datastore;
        this.anchor = anchor;
        this.list = this.anchor.querySelector("ul");

        browser.storage.local.get({
            [this.datastore]: []
        })
            .then((values) => {
                if(!values[this.datastore].length) {
                    return browser.storage.local.set({
                        [this.datastore]: []
                    });
                }

                for(const value of values[this.datastore]) {
                    this.appendItem(value);
                }
            })
            .catch(console.error);

        const input = this.anchor.querySelector("input");

        this.addListener = (e) => {
            e.preventDefault();
            if(input.validity.valid && input.value != "") {
                this.addItem(input.value);
                input.value = "";
            }
        };
        this.anchor.querySelector(".addbutton").addEventListener("click", this.addListener);
        this.anchor.querySelector("form").addEventListener("submit", this.addListener);
    }

    async itemContent(value) {
        const span = document.createElement("span");
        span.textContent = value;
        return span;
    }

    async appendItem(value) {
        const root = document.createElement("li"),
            button = document.createElement("button");
        root.appendChild(await this.itemContent(value));
        root.dataset.value = value;

        button.textContent = "🗙";
        button.title = browser.i18n.getMessage("remove");
        button.classList.add("removebutton");
        button.classList.add("browser-style");
        button.addEventListener("click", () => {
            this.removeItem(value);
        });

        root.appendChild(button);

        this.list.appendChild(root);
    }

    validate(value) {
        return value;
    }

    addItem(value) {
        try {
            value = this.validate(value);
            Promise.all([
                browser.storage.local.get(this.datastore).then((values) => {
                    values[this.datastore].push(value);
                    return browser.storage.local.set(values);
                }),
                this.appendItem(value)
            ]).catch(console.error);
        }
        catch(e) {
            // Do nothing
        }
    }

    removeItem(value) {
        const p = browser.storage.local.get(this.datastore).then((values) => {
                const newValue = values[this.datastore].filter((v) => v !== value);
                return browser.storage.local.set({
                    [this.datastore]: newValue
                });
            }),
            item = document.querySelector(`[data-value="${value}"]`);
        item.remove();
        return p;
    }

    clear() {
        const { children } = this.list;
        for(const ch of children) {
            ch.remove();
        }
        this.anchor.querySelector(".addbutton").removeEventListener("click", this.addListener);
        this.anchor.querySelector("form").removeEventListener("submit", this.addListener);
    }
}

class Filter {
    constructor(prefStores, section, listType = FilterList) {
        this.stores = prefStores;
        this.section = section;
        this.listType = listType;

        this.all = this.section.querySelector(".all");

        browser.storage.local.get({
            [this.all.id]: true
        })
            .then((values) => {
                this.all.checked = values[this.all.id];
                this.update();
            })
            .catch(console.error);

        this.all.addEventListener("input", () => {
            this.update();
            browser.storage.local.set({
                [this.all.id]: this.all.checked
            });
        });
    }

    update() {
        this.updateList();
        this.updateTitle();
    }

    updateList() {
        if(this.list) {
            this.list.clear();
        }

        const anchor = this.section.querySelector(".filterlist"),
            ListConstructor = this.listType;
        if(this.all.checked) {
            this.list = new ListConstructor(this.stores.blocked, anchor);
        }
        else {
            this.list = new ListConstructor(this.stores.allowed, anchor);
        }
    }

    updateTitle() {
        this.section.querySelector(".blocked").hidden = !this.all.checked;
        this.section.querySelector(".allowed").hidden = this.all.checked;
    }
}

class ExtensionFilterList extends FilterList {
    async itemContent(value) {
        try {
            const extension = await browser.management.get(value),
                span = document.createElement("span");
            span.appendChild(document.createTextNode(`${extension.name} (${extension.id})`));
            return span;
        }
        catch(e) {
            return super.itemContent(value);
        }
    }
}

class HostFilterList extends FilterList {
    validate(value) {
        const NO_RESULT = -1;
        if(value.search(/[a-zA-Z0-9-.]+\.[a-z][a-z]+/) === NO_RESULT) {
            throw new Error();
        }
        if(value.startsWith(WWW_PREFIX)) {
            return value.substr(WWW_PREFIX.length);
        }
        return value;
    }
}

class Checkbox {
    constructor(storageKey, node, defaultValue = true) {
        this.storageKey = storageKey;
        this.checkbox = node;
        this.defaultValue = defaultValue;
        this.changeListeners = new Set();

        this.checkbox.addEventListener("change", () => {
            browser.storage.local.set({
                [this.storageKey]: this.checkbox.checked
            });
            for(const listener of this.changeListeners.values()) {
                listener(this.checkbox.checked);
            }
        }, {
            capture: false,
            passive: true
        });

        browser.storage.local.get({
            [this.storageKey]: this.defaultValue
        })
            .then(({ [this.storageKey]: value }) => {
                this.checkbox.checked = value;
            })
            .catch(console.error);
    }

    addChangeListener(cbk) {
        this.changeListeners.add(cbk);
    }

    toggleState(state) {
        this.checkbox.disabled = !state;
        this.checkbox.classList.toggle('disabled', !state);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    new Sound('soundName', document.getElementById('sound-section'));
    new Filter(stores.extension, document.getElementById("extension-section"), ExtensionFilterList);
    new Filter(stores.website, document.getElementById("website-section"), HostFilterList);
    const download = new Checkbox("download", document.getElementById("download")),
        downloadAlways = new Checkbox("downloadAlways", document.getElementById("downloadalways"), false);
    new Checkbox("websiteSound", document.getElementById("websitesound"), true);
    new Checkbox("tabMuted", document.getElementById("tabmuted"), true);

    download.addChangeListener((checked) => {
        downloadAlways.toggleState(checked);
    });


    const datalist = document.getElementById("extensions");
    browser.runtime.sendMessage("recent-extensions")
        .then((recents) => {
            const existingRecents = Array.from(datalist.options, (o) => o.value),
                promises = [];
            for(const recent of recents) {
                if(!existingRecents.includes(recent)) {
                    promises.push(browser.management.get(recent).then((e) => new Option(e.name, recent), () => new Option(recent)));
                }
            }
            return Promise.all(promises);
        })
        .then((options) => {
            for(const o of options) {
                datalist.appendChild(o);
            }
        })
        .catch(console.error);
});
