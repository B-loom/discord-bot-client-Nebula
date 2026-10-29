/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotice } from "@api/Notices";
import { hasAnyVisibleSettings, isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { CogWheel, InfoIcon } from "@components/Icons";
import { AddonCard } from "@components/settings/AddonCard";
import { frenchDescription } from "@utils/frenchPlugins";
import { Plugin } from "@utils/types";
import { React, showToast } from "@webpack/common";

import { cl, logger } from ".";
import { openPluginModal } from "./PluginModal";

interface PluginCardProps extends React.HTMLProps<HTMLDivElement> {
    plugin: Plugin;
    disabled: boolean;
    onRestartNeeded(name: string, key: string): void;
    isNew?: boolean;
}

/** Nebula's own mark, drawn beside the plugins shipped with the client */
function NebulaMark() {
    return (
        <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="currentColor"
            aria-label="Nebula"
            className={cl("nebula-mark")}
        >
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a8 8 0 0 1 7.6 5.5 15.3 15.3 0 0 1-5 3.9 15.3 15.3 0 0 1-6.2 1.6A8 8 0 0 1 12 4Zm-7.9 7.3a10.2 10.2 0 0 0 4 .9 17.3 17.3 0 0 0 7-1.8 17.3 17.3 0 0 0 4.6-3.3 8 8 0 1 1-15.6 4.2Z" />
            <circle cx="9" cy="9" r="1.4" />
            <circle cx="15.5" cy="15" r="1.1" />
        </svg>
    );
}

export function PluginCard({ plugin, disabled, onRestartNeeded, onMouseEnter, onMouseLeave, isNew }: PluginCardProps) {
    const settings = Settings.plugins[plugin.name];

    const isEnabled = () => isPluginEnabled(plugin.name);

    function toggleEnabled() {
        const wasEnabled = isEnabled();

        // If we're enabling a plugin, make sure all deps are enabled recursively.
        if (!wasEnabled) {
            const { restartNeeded, failures } = startDependenciesRecursive(plugin);

            if (failures.length) {
                logger.error(`Failed to start dependencies for ${plugin.name}: ${failures.join(", ")}`);
                showNotice("Failed to start dependencies: " + failures.join(", "), "Close", () => null);
                return;
            }

            if (restartNeeded) {
                // If any dependencies have patches, don't start the plugin yet.
                settings.enabled = true;
                onRestartNeeded(plugin.name, "enabled");
                return;
            }
        }

        // if the plugin requires a restart, don't use stopPlugin/startPlugin. Wait for restart to apply changes.
        if (pluginRequiresRestart(plugin)) {
            settings.enabled = !wasEnabled;
            onRestartNeeded(plugin.name, "enabled");
            return;
        }

        // If the plugin is enabled, but hasn't been started, then we can just toggle it off.
        if (wasEnabled && !plugin.started) {
            settings.enabled = !wasEnabled;
            return;
        }

        const result = wasEnabled ? stopPlugin(plugin) : startPlugin(plugin);

        if (!result) {
            settings.enabled = false;

            const msg = `Error while ${wasEnabled ? "stopping" : "starting"} plugin ${plugin.name}`;
            showToast({ text: msg, variant: "critical", position: "bottom" });

            return;
        }

        settings.enabled = !wasEnabled;
    }

    // The plugins written for Nebula carry its mark, to set them apart from Vencord's own
    const isNebula = plugin.authors?.some(author => author.name === "Nebula");

    return (
        <AddonCard
            name={isNebula
                ? <span className={cl("nebula-name")}><NebulaMark />{plugin.name}</span>
                : plugin.name}
            description={frenchDescription(plugin.name, plugin.description)}
            isNew={isNew}
            enabled={isEnabled()}
            setEnabled={toggleEnabled}
            disabled={disabled}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            infoButton={
                <button
                    role="switch"
                    onClick={() => openPluginModal(plugin, onRestartNeeded)}
                    className={cl("info-button")}
                >
                    {hasAnyVisibleSettings(plugin)
                        ? <CogWheel className={cl("info-icon")} />
                        : <InfoIcon className={cl("info-icon")} />
                    }
                </button>
            } />
    );
}
