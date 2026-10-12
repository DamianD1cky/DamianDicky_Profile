// Runs before first paint and keeps a dark panel over the page until the page
// script reports it is ready. After an in-site navigation the panel carries the
// destination's label: the label fades in, then the panel collapses downwards.
(function () {
  var FLAG_KEY = "damiandicky:transition";
  var READY_EVENT = "damiandicky:page-ready";
  var REVEAL_EVENT = "damiandicky:page-reveal";
  var FLAG_MAX_AGE_MS = 15000;
  var FAILSAFE_MS = 8000;
  var LABEL_FADE_MS = 800;
  var OPEN_DELAY_MS = 1300;
  var OPEN_MS = 1100;
  var root = document.documentElement;
  var incoming = false;
  var label = "";

  try {
    var raw = window.sessionStorage.getItem(FLAG_KEY);
    if (raw) {
      var flag = JSON.parse(raw);
      incoming = !!flag && typeof flag.t === "number" && Date.now() - flag.t < FLAG_MAX_AGE_MS;
      label = incoming && typeof flag.label === "string" ? flag.label : "";
      window.sessionStorage.removeItem(FLAG_KEY);
    }
  } catch (error) {}

  root.setAttribute("data-incoming", incoming ? "true" : "false");

  var shell = document.createElement("div");
  shell.className = "boot-shell";
  shell.setAttribute("aria-hidden", "true");
  shell.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  var panel = document.createElement("div");
  panel.style.cssText = "position:absolute;inset:0;background:#080808;transform-origin:50% 100%;";
  shell.appendChild(panel);

  var text = null;
  if (incoming && label) {
    text = document.createElement("div");
    text.textContent = label;
    text.style.cssText =
      "position:absolute;left:50%;top:50%;max-width:92vw;transform:translate(-50%,-50%);" +
      "color:#fff;text-align:center;text-transform:uppercase;white-space:nowrap;opacity:0;" +
      "font-family:'Fraunces Variable',Georgia,serif;font-weight:420;" +
      "font-size:clamp(44px,5.6vw,80px);line-height:0.8;";
    shell.appendChild(text);
  }
  root.appendChild(shell);

  var revealed = false;
  function announce() {
    window.dispatchEvent(new Event(REVEAL_EVENT));
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    root.setAttribute("data-ready", "true");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof panel.animate !== "function") {
      shell.remove();
      announce();
      return;
    }
    if (!incoming) {
      announce();
      shell.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "ease-out", fill: "forwards" })
        .onfinish = function () {
          shell.remove();
        };
      return;
    }
    if (text) {
      text.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LABEL_FADE_MS, easing: "linear", fill: "forwards" });
    }
    var open = { duration: OPEN_MS, delay: OPEN_DELAY_MS, easing: "cubic-bezier(0.9, 0, 0.58, 1)", fill: "forwards" };
    var collapse = panel.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], open);
    if (text) {
      text.animate([{ clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(100% 0% 0% 0%)" }], open);
    }
    window.setTimeout(announce, OPEN_DELAY_MS);
    collapse.onfinish = function () {
      shell.remove();
    };
  }

  window.addEventListener(READY_EVENT, reveal, { once: true });
  window.setTimeout(reveal, FAILSAFE_MS);
})();
