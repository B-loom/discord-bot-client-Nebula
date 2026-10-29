/* Copyright Elysia © 2025. All rights reserved */

import { contextBridge, ipcRenderer } from "electron";

import { IPCEvent } from "./IPCEvents";

contextBridge.exposeInMainWorld("electronAPI", {
    reactReady: () => {
        ipcRenderer.send(IPCEvent.MessageEditorReactReady);
    },
    closeWindow: () => {
        ipcRenderer.send(IPCEvent.RequestCloseWindow);
    },
});

ipcRenderer.once(IPCEvent.MessageEditorReceivePort, event => {
    const port = event.ports[0];
    window.postMessage("forward-editor-port", "*", [port]);
});
