/* Copyright Elysia © 2025. All rights reserved */

import { contextBridge, ipcRenderer } from "electron";

import { IPCEvent } from "./IPCEvents";

contextBridge.exposeInMainWorld("settingsAPI", {
    getCurrentSettings () {
        return ipcRenderer.invoke(IPCEvent.MonacoEditorGetConfig);
    },
    getAutoComplete () {
        return ipcRenderer.invoke(IPCEvent.MonacoEditorGetAutoComplete);
    },
    saveCurrentSettings (value: string) {
        return ipcRenderer.invoke(IPCEvent.MonacoEditorSaveConfig, value);
    },
    closeWindow: () => {
        ipcRenderer.send(IPCEvent.RequestCloseWindow);
    },
});
