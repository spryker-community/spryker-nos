/**
 * Copyright (c) Andreas Penz
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ComponentConstructor } from './component.js';

const parseActionAttribute = (element: Element): { component: string; event: string; method: string }[] => {
    const attributeName = element.getAttributeNames().find((name) => name.endsWith('-action'));

    if (!attributeName) {
        return [];
    }

    const component = attributeName.slice(0, attributeName.lastIndexOf('-action'));
    const attributeValue = element.getAttribute(attributeName) || '';

    const actions = [];
    for (const action of attributeValue.trim().split(/\s+/)) {
        const separatorPosition = Math.max(0, action.lastIndexOf('#')) || action.length;

        actions.push({
            component: component,
            event: action.slice(0, separatorPosition),
            method: action.slice(separatorPosition + 1) || 'handleEvent',
        });
    }

    return actions;
};

const bindActions = (component: Component, element: Element) => {
    for (const action of parseActionAttribute(element)) {
        if (action.component !== component.tagName.toLowerCase()) {
            continue;
        }

        element.addEventListener(action.event, handleEvent);
    }
};

const handleEvent = (event: Event) => {
    const element = event.currentTarget as Element;
    for (const action of parseActionAttribute(element)) {
        if (action.event !== event.type) {
            continue;
        }

        type EventDispatcher = HTMLElement & Record<string, (ev: Event) => unknown>;
        const component = element.closest<EventDispatcher>(action.component);
        if (!component || typeof component[action.method] !== 'function') {
            continue;
        }

        component[action.method](event);
    }
};

const bindElements = (component: Component, root: Element) => {
    for (const element of root.querySelectorAll(`[${component.tagName.toLowerCase()}-action]`)) {
        bindActions(component, element);
    }

    if (root instanceof Element && root.hasAttribute(`${component.tagName.toLowerCase()}-action`)) {
        bindActions(component, root);
    }
};

const observeElements = (component: Component) => {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.target instanceof Element) {
                bindElements(component, mutation.target);
            } else if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof Element) {
                        bindElements(component, node);
                    }
                }
            }
        }
    });

    observer.observe(component, {
        childList: true,
        subtree: true,
        attributeFilter: [`${component.tagName.toLowerCase()}-action`],
    });
};

const initializeActionable = (component: Component): void => {
    bindElements(component, component);
    observeElements(component);
};

export function actionable(...args: any[]): any {
    const [component, context] = args as [ComponentConstructor, ClassDecoratorContext];

    if (context.kind !== 'class') {
        throw new TypeError('The @actionable decorator is for use on classes only.');
    }

    return class extends component {
        mountCallback() {
            initializeActionable(this);
            super.mountCallback();
        }
    };
}
