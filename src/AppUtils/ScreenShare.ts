/* Copyright Elysia © 2025. All rights reserved */

import { desktopCapturer, ipcMain, type Session, webContents } from "electron";
import { IPCEvent } from "src/AppCore/IPCEvents";

/**
 * Electron answers a page asking to share a screen only if the session carries a handler
 * for it. Without one the request is refused with no message at all, which is what made
 * "Partager" look like a dead button.
 *
 * The choice is made inside Discord rather than in a window of our own: the sources are
 * handed to the client that asked, and it answers with what the person picked.
 */
export function installScreenShare (
    session: Session,
    logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void; },
) {
    session.setDisplayMediaRequestHandler(
        async (request, callback) => {
            try {
                const sources = await desktopCapturer.getSources({
                    types: ["screen", "window"],
                    thumbnailSize: { width: 380, height: 214 },
                    fetchWindowIcons: false,
                });

                if (!sources.length) {
                    logger.error("Aucune source de partage disponible");
                    // An empty answer is how Electron is told nothing will be shared
                    return callback({});
                }

                const target = request.frame ? webContents.fromFrame(request.frame) : null;
                if (!target) {
                    logger.error("Impossible de savoir quelle fenêtre demande le partage");
                    return callback({});
                }

                const choice = await askWhatToShare(target, sources);
                if (!choice) return callback({});

                const source = sources.find(entry => entry.id === choice.id);
                if (!source) return callback({});

                logger.info(`Partage d'écran : ${source.name}${choice.audio ? " (avec le son)" : ""}`);
                /*
                 * Electron rejects an "audio" set to nothing: sharing without sound means
                 * leaving the property out altogether, not handing it an empty value.
                 */
                callback(
                    choice.audio
                        // Loopback keeps the computer's own sound in the stream
                        ? { video: source, audio: "loopback" }
                        : { video: source },
                );
            } catch (error) {
                logger.error("Partage d'écran impossible:", error);
                callback({});
            }
        },
        // Discord draws the picker itself, so Electron's own is not wanted
        { useSystemPicker: false },
    );
}

type Source = Electron.DesktopCapturerSource;

/** Hands the sources to the client and waits for the answer */
function askWhatToShare (
    target: Electron.WebContents,
    sources: Source[],
): Promise<{ id: string; audio: boolean; } | null> {
    return new Promise(resolve => {
        let settled = false;

        const finish = (choice: { id: string; audio: boolean; } | null) => {
            if (settled) return;
            settled = true;
            ipcMain.removeListener(IPCEvent.PickerChoose, onChoose);
            target.removeListener("destroyed", onGone);
            resolve(choice);
        };

        const onChoose = (event: Electron.IpcMainEvent, id: string | null, audio: boolean) => {
            if (event.sender !== target) return;
            finish(id ? { id, audio } : null);
        };

        // A window closed mid-choice must not leave the request hanging
        const onGone = () => finish(null);

        ipcMain.on(IPCEvent.PickerChoose, onChoose);
        target.once("destroyed", onGone);

        target.send(
            IPCEvent.PickerSources,
            sources.map(source => ({
                id: source.id,
                name: source.name,
                kind: source.id.startsWith("screen:") ? "screen" : "window",
                thumbnail: source.thumbnail.toDataURL(),
            })),
        );
    });
}
