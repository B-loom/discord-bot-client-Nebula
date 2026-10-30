/* Copyright Elysia © 2025. All rights reserved */

export class IPCEvent extends null {
    static Close = "app:window:close";
    static Minimize = "app:window:minimize";
    static Maximize = "app:window:maximize";
    static Focus = "app:window:focus";
    static FlashFrame = "app:window:flash_frame";
    static RequestCloseWindow = "app:request_close_window";
    // Preload IPC Events
    static GetBotInfo = "app:preload:get_bot_info";
    static GetVersion = "app:preload:get_version";
    static GetName = "app:preload:get_name";
    static GetExperiment = "app:preload:get_experiment";
    static GetDefaultUserPatch = "app:preload:get_default_user_patch";
    static GetIsUserToken = "app:preload:get_is_user_token";
    // Game detection
    static RunningGamesChanged = "app:games:changed";
    static GetRunningGames = "app:games:get";
    // Logging from Main Process
    static LogFromMainProcess = "app:main:log";
    // Main > Renderer Events
    static GetPreloadedUserSettings = "app:preload:get_preloaded_user_settings";
    static GetPreloadedUserSettingsResponse = "app:preload:get_preloaded_user_settings_response";
    static SetPreloadedUserSettings = "app:preload:set_preloaded_user_settings";

    static GetFrecencyUserSettings = "app:preload:get_frecency_user_settings";
    static GetFrecencyUserSettingsResponse = "app:preload:get_frecency_user_settings_response";
    static SetFrecencyUserSettings = "app:preload:set_frecency_user_settings";
    // User Account Login (email + password)
    static OpenAccountLoginWindow = "app:account:open_window";
    static AccountLogin = "app:account:login";
    static AccountMfa = "app:account:mfa";
    static AccountSendSms = "app:account:send_sms";
    static AccountSolveCaptcha = "app:account:solve_captcha";
    static AccountCaptchaResult = "app:account:captcha_result";
    static AccountList = "app:account:list";
    static AccountRemove = "app:account:remove";
    static AccountUse = "app:account:use";
    static AccountOpenWindow = "app:account:open_client_window";
    static RememberBot = "app:account:remember_bot";
    static GetBotAccountIds = "app:account:bot_ids";
    static GetSupportInvite = "app:support_invite";
    static SupportInviteCopied = "app:support_invite:copied";
    // Updates
    static UpdateCheck = "app:update:check";
    static UpdateState = "app:update:state";
    static UpdateGetState = "app:update:get_state";
    static UpdateInstall = "app:update:install";
    static AccountTokenLogin = "app:account:token_login";
    // Monaco Editor IPC Events
    static MonacoEditorGetConfig = "app:editor:get_config";
    static MonacoEditorGetAutoComplete = "app:editor:get_autocomplete";
    static MonacoEditorSaveConfig = "app:editor:save_config";
    // Beta Features
    static RequestOpenMessageEditorWindow = "app:request_open_message_editor_window";
    static MessageEditorReactReady = "app:message_editor_ready";
    static MessageEditorReceivePort = "app:message_editor_receive_port";
    static MainAppReceiveEditorPort = "app:main_receive_editor_port";
}
