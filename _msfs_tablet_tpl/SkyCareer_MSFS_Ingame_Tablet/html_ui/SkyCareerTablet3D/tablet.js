(() => {
  const frame = document.getElementById("skycareer3d");
  if (!frame) return;

  window.addEventListener("message", (event) => {
    if (event?.data?.type === "SKYCAREER_RELOAD") {
      frame.src = frame.src;
    }
  });
})();
