/* global StoredBlob */
"use strict";

//TODO nicer look for extensions list. Probably needs some inter-extension communication though :S
//TODO provide some default extension IDs as autocomplete or similar?
//TODO  -> suggest extensions that have shown notifications this session (use-case: person wants to block an extension)?

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
    Sound = {
        defaultSound: undefined,
        resetButton: undefined,
        input: undefined,
        output: undefined,
        init() {
            this.resetButton = document.getElementById("resetSound");
            this.input = document.getElementById("sound");
            this.output = document.getElementById("currentSound");
            this.restoreFile();

            this.input.addEventListener("input", () => this.selectFile(), {
                capture: false,
                passive: true
            });
            this.resetButton.addEventListener("click", () => this.reset(), {
                capture: false,
                passive: true
            });
            document.getElementById("playSound").addEventListener("click", () => {
                browser.runtime.sendMessage("preview-sound");
            }, {
                capture: false,
                passive: true
            });
        },
        async reset() {
            this.resetButton.disabled = true;
            this.resetButton.classList.add("disabled");
            this.input.value = '';
            this.output.value = 'Default';
            const { soundName } = await browser.storage.local.get("soundName");
            if(soundName) {
                const storedFile = new StoredBlob(soundName);
                await storedFile.delete();
            }
            return browser.storage.local.set({
                soundName: ''
            });
        },
        async selectFile() {
            if(this.input.files.length) {
                const file = this.input.files.shift(),
                    storedFile = new StoredBlob(file.name);
                this.resetButton.disabled = false;
                this.resetButton.classList.remove("disabled");
                this.output.value = file.name;
                await storedFile.save(file);
                await browser.storage.local.set({
                    soundName: file.name
                });
            }
        },
        restoreFile() {
            return browser.storage.local.get({
                soundName: ''
            }).then(({ soundName }) => {
                if(soundName.length) {
                    this.output.value = soundName;
                    this.resetButton.disabled = false;
                }
            });
        }
    };

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
    constructor(stores, section, listType = FilterList) {
        this.stores = stores;
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
        const WWW_PREFIX = "www.";
        if(value.startsWith(WWW_PREFIX)) {
            return value.substr(WWW_PREFIX.length);
        }
        return value;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    Sound.init();
    new Filter(stores.extension, document.getElementById("extension-section"), ExtensionFilterList);
    new Filter(stores.website, document.getElementById("website-section"), HostFilterList);


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
