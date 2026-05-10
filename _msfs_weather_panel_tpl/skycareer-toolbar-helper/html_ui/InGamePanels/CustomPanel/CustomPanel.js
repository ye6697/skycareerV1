class IngamePanelCustomPanel extends TemplateElement {
    constructor() {
        super();
        this.bridgeUrl = 'http://127.0.0.1:50557/skycareer-weather';
        this.weatherList = [];
        this.pendingCommand = null;
        this.lastCommandId = '';
        this.lastAttemptUtc = 0;
        this.helperStarted = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.bridgeState = this.querySelector('#BridgeState');
        this.presetState = this.querySelector('#PresetState');
        this.weatherApplyState = this.querySelector('#WeatherApplyState');
        this.status = this.querySelector('#SkyCareerStatus');

        const applyBtn = this.querySelector('#ApplySkyCareerWeather');
        if (applyBtn) applyBtn.addEventListener('click', () => this.applyPendingWeather(true));
        const closeBtn = this.querySelector('#WeatherPanelClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeWeatherPanel());

        this.setText(this.weatherApplyState, 'loading');
        setTimeout(() => this.setupWeatherHelper(), 1500);
    }

    disconnectedCallback() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        if (this.weatherTimer) clearInterval(this.weatherTimer);
    }

    setText(node, msg) {
        if (node) node.textContent = msg;
    }

    setStatus(msg) {
        this.setText(this.status, msg);
    }

    closeWeatherPanel() {
        const panel = this.querySelector('#SkyCareerPanel');
        if (panel) panel.classList.add('is-hidden');
        try {
            if (window.Coherent && typeof window.Coherent.trigger === 'function') {
                window.Coherent.trigger('TOOLBAR_BUTTON_TOGGLE', 'PANEL_CUSTOM_PANEL');
            }
        } catch (e) {}
    }

    setupWeatherHelper() {
        if (this.helperStarted) return;
        this.helperStarted = true;
        this.setText(this.bridgeState, 'connecting');
        this.setText(this.weatherApplyState, 'starting');

        try {
            const registerViewListener = window['RegisterViewListener'];
            if (typeof registerViewListener !== 'function') {
                throw new Error('MSFS RegisterViewListener not ready');
            }

            this.gameFlightListener = registerViewListener('JS_LISTENER_GAMEFLIGHT');
            this.weatherListener = registerViewListener('JS_LISTENER_WEATHER');

            if (!this.weatherListener || typeof this.weatherListener.on !== 'function') {
                throw new Error('MSFS weather listener API not ready');
            }

            this.weatherListener.on('SetWeatherList', (list) => {
                this.weatherList = Array.isArray(list) ? list : [];
                this.applyPendingWeather(false);
            });
        } catch (e) {
            this.helperStarted = false;
            this.setText(this.weatherApplyState, 'listener failed');
            this.setStatus(`MSFS weather listener konnte nicht gestartet werden: ${e && e.message ? e.message : e}`);
            return;
        }

        this.queryWeatherList();
        this.pollBridge();
        this.pollTimer = setInterval(() => this.pollBridge(), 2000);
        this.weatherTimer = setInterval(() => this.queryWeatherList(), 8000);
    }

    queryWeatherList() {
        try {
            this.safeTrigger(this.weatherListener, 'ASK_WEATHER_LIST');
        } catch (e) {
            this.setText(this.weatherApplyState, 'list failed');
        }
    }

    async pollBridge() {
        try {
            const res = await fetch(`${this.bridgeUrl}?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            this.setText(this.bridgeState, data && data.ok ? 'connected' : 'error');

            if (!data || !data.hasCommand || !data.commandId || !data.presetName) {
                this.setText(this.presetState, 'none');
                return;
            }

            this.pendingCommand = data;
            this.setText(this.presetState, data.presetName);
            this.applyPendingWeather(false);
        } catch (e) {
            this.setText(this.bridgeState, 'offline');
        }
    }

    normalize(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\.wpr$/g, '')
            .replace(/[^a-z0-9]+/g, '');
    }

    findWeatherPreset(presetName) {
        const target = this.normalize(presetName);
        for (const item of this.weatherList) {
            const rawName = item && item.name ? item.name : '';
            let translated = rawName;
            try { translated = Coherent.translate(rawName); } catch (e) {}
            if (this.normalize(rawName) === target || this.normalize(translated) === target) {
                return item;
            }
        }
        return null;
    }

    async ack(commandId, status) {
        try {
            await fetch(`${this.bridgeUrl}/ack?id=${encodeURIComponent(commandId)}&status=${encodeURIComponent(status)}&t=${Date.now()}`, { cache: 'no-store' });
        } catch (e) {}
    }

    applyPendingWeather(force) {
        if (!this.pendingCommand || !this.pendingCommand.commandId) return;

        const now = Date.now();
        if (!force && this.pendingCommand.commandId === this.lastCommandId) return;
        if (!force && now - this.lastAttemptUtc < 5000) return;

        const preset = this.findWeatherPreset(this.pendingCommand.presetName);
        if (!preset) {
            this.setText(this.weatherApplyState, 'preset not found');
            this.setStatus('SkyCareer Wetterpreset ist in der MSFS-Liste noch nicht sichtbar.');
            this.ack(this.pendingCommand.commandId, 'preset_not_found');
            this.queryWeatherList();
            return;
        }

        try {
            this.lastAttemptUtc = now;
            const sent = [
                this.callListenerMethod(this.gameFlightListener, 'setFlightConditionConfiguration', 'WEATHERPRESET'),
                this.safeTrigger(this.gameFlightListener, 'SET_FLIGHT_CONDITION_CONFIGURATION', 'WEATHERPRESET'),
                this.callListenerMethod(this.gameFlightListener, 'setWeatherPreset', preset.index),
                this.safeTrigger(this.gameFlightListener, 'SET_WEATHER_PRESET', preset.index),
                this.safeTrigger(this.gameFlightListener, 'WEATHER_PRESET_SET_NEW_INDEX', preset.index),
                this.safeTrigger(this.weatherListener, 'SET_WEATHER_PRESET', preset.index),
                this.safeTrigger(this.weatherListener, 'WEATHER_PRESET_SET_NEW_INDEX', preset.index),
                this.safeTrigger(this.weatherListener, 'SELECT_WEATHER_PRESET_ID', preset.index)
            ].some(Boolean);

            if (!sent) {
                throw new Error('No MSFS weather trigger accepted');
            }

            this.lastCommandId = this.pendingCommand.commandId;
            this.setText(this.weatherApplyState, `sent index ${preset.index}`);
            this.setStatus(`Wetterpreset gesendet: ${this.pendingCommand.presetName}`);
            this.ack(this.pendingCommand.commandId, 'applied');
        } catch (e) {
            this.setText(this.weatherApplyState, 'apply failed');
            this.setStatus('MSFS hat den Wetterpreset-Aufruf abgelehnt.');
            this.ack(this.pendingCommand.commandId, 'apply_failed');
        }
    }

    callListenerMethod(listener, methodName, value) {
        try {
            if (listener && typeof listener[methodName] === 'function') {
                listener[methodName](value);
                return true;
            }
        } catch (e) {}
        return false;
    }

    safeTrigger(listener, eventName, value) {
        if (!eventName) return false;
        try {
            if (listener && typeof listener.trigger === 'function') {
                if (typeof value === 'undefined') listener.trigger(eventName);
                else listener.trigger(eventName, value);
                return true;
            }
        } catch (e) {}
        try {
            if (window.Coherent && typeof window.Coherent.trigger === 'function') {
                if (typeof value === 'undefined') window.Coherent.trigger(eventName);
                else window.Coherent.trigger(eventName, value);
                return true;
            }
        } catch (e) {}
        return false;
    }
}

window.customElements.define('ingamepanel-custom', IngamePanelCustomPanel);
checkAutoload();
