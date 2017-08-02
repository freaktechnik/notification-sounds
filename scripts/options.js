"use strict";

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

        this.addListener = () => {
            this.addItem(value);
        };
        this.anchor.querySelector(".addbutton").addEventListener("click", this.addListener);
    }

    appendItem(value) {
        const root = document.createElement("li");
        root.appendChild(document.createTextElement(value));
        root.dataset.value = value;

        const button = document.createElement("button");
        button.textContent = "Remove";
        button.classList.add("removebutton");
        button.addEventListener("click", () => { TODO });

        root.appendChild(button);

        this.list.appendChild(root);
    }

    addItem(value) {
        const p = browser.storage.local.get(this.datastore).then((values) => {
            const newValue = values[this.datastore].push(value);
            return browser.storage.local.set({
                [this.datastore]: newValue
            });
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
        const children = this.list.childElements;
        for(const ch of children) {
            ch.remove();
        }
        this.anchor.querySelector(".addbutton").removeEventListener("click", this.addListener);
    }
}
