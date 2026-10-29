/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showToast as showToastRaw } from "@webpack/common";

/**
 * Compatibility shim.
 *
 * Vencord dropped the `Toasts` object and changed `showToast` from
 * `showToast(message, type, options)` to `showToast({ text, variant })`.
 * This plugin still uses the old API in ~45 places, so the old shape is
 * rebuilt here on top of the current one.
 */

export const ToastType = {
    MESSAGE: 0,
    SUCCESS: 1,
    FAILURE: 2,
    CUSTOM: 3,
    CLIP: 4,
    LINK: 5,
    FORWARD: 6,
    BOOKMARK: 7,
    CLOCK: 8
} as const;

export const ToastPosition = {
    TOP: 0,
    BOTTOM: 1
} as const;

type ToastTypeValue = typeof ToastType[keyof typeof ToastType];

const variantByType: Record<number, string | undefined> = {
    [ToastType.SUCCESS]: "success",
    [ToastType.FAILURE]: "critical"
};

export function showToast(message: string, type: ToastTypeValue = ToastType.MESSAGE, options?: Record<string, any>) {
    const variant = variantByType[type];
    return (showToastRaw as any)({
        text: String(message),
        ...(variant ? { variant } : {}),
        ...options?.component ? { component: options.component } : {}
    });
}

export const Toasts = {
    Type: ToastType,
    Position: ToastPosition,
    genId: () => `${Math.random()}${Date.now()}`,
    show: (toast: { message: string; type?: ToastTypeValue; id?: string; options?: Record<string, any>; }) =>
        showToast(toast.message, toast.type ?? ToastType.MESSAGE, toast.options),
    pop: () => { }
};

export default Toasts;
