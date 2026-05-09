(() => {
  const frame = document.getElementById("skycareerFrame");
  const panel = document.getElementById("SkyCareerWeatherPanel");
  const closeButton = document.getElementById("SkyCareerWeatherClose");
  const stateDot = document.getElementById("SkyCareerWeatherState");
  const title = document.getElementById("SkyCareerWeatherTitle");
  const preset = document.getElementById("SkyCareerWeatherPreset");
  const hint = document.getElementById("SkyCareerWeatherHint");
  if (!frame || !panel || !closeButton || !stateDot || !title || !preset || !hint) return;

  const endpoint = "http://127.0.0.1:50557/skycareer-weather";
  const ackEndpoint = `${endpoint}/ack`;
  let armed = false;
  let lastCommandId = "";
  let ackedCommandId = "";

  const setState = (mode, titleText, presetText, hintText) => {
    stateDot.className = `weatherDot ${mode}`;
    title.textContent = titleText;
    preset.textContent = presetText;
    hint.textContent = hintText;
  };

  const armPanel = () => {
    armed = true;
    panel.classList.remove("isHidden");
    setState("isQueued", "SkyCareer Weather", "Waiting for bridge", "Preset loads as soon as the bridge sees this panel.");
    pollWeather();
  };

  const fetchJson = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const ackCommand = async (commandId) => {
    if (!commandId || ackedCommandId === commandId) return;
    ackedCommandId = commandId;
    try {
      await fetchJson(`${ackEndpoint}?id=${encodeURIComponent(commandId)}&status=panel_ready&ts=${Date.now()}`, {
        cache: "no-store"
      });
    } catch (err) {
      ackedCommandId = "";
      console.log("SkyCareer weather ack failed", err);
    }
  };

  const describePreset = (data) => {
    const label = data && (data.presetName || data.appliedPreset || data.label || data.preset || data.difficulty || data.command);
    return label ? String(label) : "Weather preset ready";
  };

  async function pollWeather() {
    if (!armed) return;

    try {
      const data = await fetchJson(`${endpoint}?panel=ready&ts=${Date.now()}`, { cache: "no-store" });
      if (!data || data.ok === false) {
        setState("isOffline", "SkyCareer Weather", "Bridge not ready", "Keep the bridge running, then click this panel again.");
        return;
      }

      const commandId = String(data.commandId || "");
      if (commandId && commandId !== lastCommandId) {
        lastCommandId = commandId;
        ackedCommandId = "";
      }

      if (data.hasCommand || data.pending) {
        setState("isQueued", "Preset queued", describePreset(data), "Loading now. Keep this panel open for a moment.");
        await ackCommand(commandId);
        return;
      }

      if (data.applied || data.panelConnected) {
        setState("isReady", "Panel connected", describePreset(data), "Set weather in SkyCareer, then click here once.");
        return;
      }

      setState("isIdle", "SkyCareer Weather", "Click to load preset", "Click once after setting mission weather.");
    } catch (err) {
      setState("isOffline", "SkyCareer Weather", "Bridge offline", "Start the SkyCareer bridge, then click this panel again.");
    }
  }

  const refresh = () => {
    try {
      frame.src = frame.src;
    } catch (e) {
      console.log("SkyCareer tablet refresh failed", e);
    }
  };

  closeButton.addEventListener("pointerdown", (evt) => evt.stopPropagation());
  closeButton.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    armed = false;
    panel.classList.add("isHidden");
  });

  panel.addEventListener("pointerdown", armPanel);
  panel.addEventListener("click", armPanel);
  panel.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      armPanel();
    }
  });
  window.setInterval(pollWeather, 2400);

  window.addEventListener("keydown", (evt) => {
    if (evt.key === "F5" || (evt.ctrlKey && evt.key.toLowerCase() === "r")) {
      evt.preventDefault();
      refresh();
    }
  });
})();
