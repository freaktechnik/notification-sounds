"use strict";

const stores = {
    extension: {
        blocked: "blockedExtensions",
        allowed: "allowedExtensions"
    },
    website: {
        blocked: "blockedWebsites",
        allowed: "allowedWebsites"
    }
};

class FilterList {
    constructor(datastore, anchor) {
        this.datastore = datastore;
        this.anchor = anchor;
        this.list = this.anchor.querySelector("ul");

        browser.storage.local.get({
            [this.datastore]: []
        }).then((values) => {
            if(values[this.datastore].length === 0) {
                return browser.storage.local.set({
                    [this.datastore]: []
                });
            }
            else {
                for(const value of values[this.datastore]) {
                    this.appendItem(value);
                }
            }
        });

        const input = this.anchor.querySelector("input");

        this.addListener = (e) => {
            e.preventDefault();
            if(input.validity.valid) {
                this.addItem(input.value);
                input.value = "";
            }
        };
        this.anchor.querySelector(".addbutton").addEventListener("click", this.addListener);
        this.anchor.querySelector("form").addEventListener("submit", this.addListener);
    }

    appendItem(value) {
        const root = document.createElement("li");
        root.appendChild(document.createTextNode(value));
        root.dataset.value = value;

        const button = document.createElement("button");
        button.textContent = "Remove";
        button.classList.add("removebutton");
        button.addEventListener("click", () => {
            this.removeItem(value);
        });

        root.appendChild(button);

        this.list.appendChild(root);
    }

    addItem(value) {
        const p = browser.storage.local.get(this.datastore).then((values) => {
            values[this.datastore].push(value);
            return browser.storage.local.set(values);
        });

        this.appendItem(value);
        return p;
    }

    removeItem(value) {
        const p = browser.storage.local.get(this.datastore).then((values) => {
            const newValue = values[this.datastore].filter((v) => v !== value);
            return browser.storage.local.set({
                [this.datastore]: newValue
            });
        });

        const item = document.querySelector(`[data-value="${value}"]`);
        item.remove();
        return p;
    }

    clear() {
        const children = this.list.children;
        for(const ch of children) {
            ch.remove();
        }
        this.anchor.querySelector(".addbutton").removeEventListener("click", this.addListener);
        this.anchor.querySelector("form").removeEventListener("submit", this.addListener);
    }
}

class Filter {
    constructor(stores, section) {
        this.stores = stores;
        this.section = section;

        this.all = this.section.querySelector(".all");

        browser.storage.local.get({
            [this.all.id]: true
        }).then((values) => {
            this.all.checked = values[this.all.id];
            this.update();
        });

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

        const anchor = this.section.querySelector(".filterlist");
        if(this.all.checked) {
            this.list = new FilterList(this.stores.blocked, anchor);
        }
        else {
            this.list = new FilterList(this.stores.allowed, anchor);
        }
    }

    updateTitle() {
        this.section.querySelector(".blocked").hidden = !this.all.checked;
        this.section.querySelector(".allowed").hidden = this.all.checked;
    }
}
window.addEventListener("DOMContentLoaded", () => {
    new Filter(stores.extension, document.getElementById("extension-section"));
    new Filter(stores.website, document.getElementById("website-section"));
});
