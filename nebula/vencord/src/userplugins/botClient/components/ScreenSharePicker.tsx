/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./ScreenSharePicker.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { closeModal, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { Button, Forms, React } from "@webpack/common";

const cl = classNameFactory("vc-nebula-share-");
const logger = new Logger("NebulaPartage", "#f5bde6");

type Source = {
    id: string;
    name: string;
    kind: "screen" | "window";
    thumbnail: string;
};

function native() {
    return (window as any).BotClientNative;
}

function Picker({ sources, onChoose, close }: {
    sources: Source[];
    onChoose: (id: string | null, audio: boolean) => void;
    close: () => void;
}) {
    const [kind, setKind] = React.useState<"screen" | "window">("screen");
    const [chosen, setChosen] = React.useState<string | null>(null);
    const [audio, setAudio] = React.useState(true);

    const shown = sources.filter(source => source.kind === kind);

    const share = (id: string | null) => {
        onChoose(id, audio);
        close();
    };

    return (
        <>
            <ModalHeader separator={false}>
                <div className={cl("header")}>
                    <Forms.FormTitle tag="h2" className={cl("title")}>Partager un écran</Forms.FormTitle>
                    <Forms.FormText className={cl("subtitle")}>
                        Choisis ce que les autres verront.
                    </Forms.FormText>
                </div>
            </ModalHeader>

            <ModalContent className={cl("content")}>
                <div className={cl("tabs")}>
                    {(["screen", "window"] as const).map(entry => (
                        <button
                            key={entry}
                            className={cl(entry === kind ? "tab-current" : "tab")}
                            onClick={() => setKind(entry)}
                        >
                            {entry === "screen" ? "Écrans" : "Fenêtres"}
                        </button>
                    ))}
                </div>

                {shown.length === 0 ? (
                    <Forms.FormText className={cl("empty")}>
                        {kind === "screen"
                            ? "Aucun écran détecté."
                            : "Aucune fenêtre ouverte à partager."}
                    </Forms.FormText>
                ) : (
                    <div className={cl("grid")}>
                        {shown.map(source => (
                            <button
                                key={source.id}
                                title={source.name}
                                className={cl(source.id === chosen ? "source-selected" : "source")}
                                onClick={() => setChosen(source.id)}
                                onDoubleClick={() => share(source.id)}
                            >
                                <img src={source.thumbnail} alt="" className={cl("thumb")} />
                                <span className={cl("name")}>{source.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </ModalContent>

            <ModalFooter>
                <label className={cl("audio")}>
                    <input type="checkbox" checked={audio} onChange={event => setAudio(event.currentTarget.checked)} />
                    Partager aussi le son de l'ordinateur
                </label>
                <Button color={Button.Colors.BRAND} disabled={!chosen} onClick={() => share(chosen)}>
                    Partager
                </Button>
                <Button color={Button.Colors.PRIMARY} look={Button.Looks.LINK} onClick={() => share(null)}>
                    Annuler
                </Button>
            </ModalFooter>
        </>
    );
}

/**
 * The main process asks what to share whenever Discord requests a screen. The answer has
 * to come back exactly once: Electron is holding the request open until it does, so
 * closing the window without choosing counts as a refusal.
 */
export function listenForScreenShare() {
    try {
        native()?.onScreenShareSources?.((sources: Source[]) => {
            let answered = false;
            const answer = (id: string | null, audio: boolean) => {
                if (answered) return;
                answered = true;
                native()?.chooseScreenShare?.(id, audio);
            };

            const key = openModal(props => (
                <ErrorBoundary noop onError={() => answer(null, false)}>
                    <ModalRoot {...props} size={ModalSize.LARGE}>
                        <Picker
                            sources={sources}
                            onChoose={answer}
                            close={() => closeModal(key)}
                        />
                    </ModalRoot>
                </ErrorBoundary>
            ), {
                // Dismissing the window is a refusal, not a silence
                onCloseCallback: () => answer(null, false),
            });
        });
    } catch (error) {
        logger.error("Impossible d'écouter les demandes de partage", error);
    }
}
