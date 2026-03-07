(() => {
  const frame = document.getElementById("skycareerFrame");
  if (!frame) return;

  const refresh = () => {
    try {
      const src = frame.src;
      frame.src = src;
    } catch (e) {
      console.log("SkyCareer tablet refresh failed", e);
    }
  };

  window.addEventListener("keydown", (evt) => {
    if (evt.key === "F5" || (evt.ctrlKey && evt.key.toLowerCase() === "r")) {
      evt.preventDefault();
      refresh();
    }
  });
})();
