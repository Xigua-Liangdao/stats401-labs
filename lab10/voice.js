import {parseCommand} from "./commands.js";

const listenButton = document.querySelector("#listen-button");
const stopButton = document.querySelector("#stop-listening");
const voiceStatus = document.querySelector("#voice-status");
const heard = document.querySelector("#heard-command");
const action = document.querySelector("#voice-action");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let map = window.gdpMap;
let active = null;
let timeout;

function updateButtons() {
    listenButton.disabled = !map || !SpeechRecognition || Boolean(active);
    stopButton.disabled = !active;
    listenButton.setAttribute("aria-pressed", active ? "true" : "false");
}

function ready() {
    map = window.gdpMap;
    voiceStatus.textContent = SpeechRecognition
        ? "Microphone off. Click Listen when you are ready."
        : "Voice is unavailable in this browser. Try Chrome, or use the menu below.";
    updateButtons();
}

function finish(message) {
    const recognition = active;
    active = null;
    clearTimeout(timeout);
    if (recognition) {
        try { recognition.abort(); } catch {}
    }
    voiceStatus.textContent = message;
    updateButtons();
}

listenButton.addEventListener("click", () => {
    if (!map || !SpeechRecognition || active) return;
    heard.textContent = "Waiting for speech…";
    action.textContent = "No change yet.";
    let recognition;
    try {
        recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } catch {
        voiceStatus.textContent = "Voice could not start in this browser. Use the menu below.";
        return;
    }
    active = recognition;
    let receivedResult = false;
    updateButtons();
    voiceStatus.textContent = "Waiting for microphone access…";
    recognition.onstart = () => {
        if (active !== recognition) return;
        voiceStatus.textContent = "Listening for one command…";
    };
    recognition.onresult = event => {
        if (active !== recognition || receivedResult) return;
        const result = event.results[event.resultIndex];
        if (!result?.isFinal) return;
        receivedResult = true;
        const transcript = result[0].transcript.trim();
        heard.textContent = transcript || "No words received.";
        const command = parseCommand(transcript, map.economies);
        if (command.type === "select") {
            const economy = map.selectEconomy(command.iso3);
            action.textContent = `Selected ${economy.country} in both maps.`;
        } else if (command.type === "reset") {
            map.resetVisualization();
            action.textContent = "Selection cleared and both maps reset.";
        } else {
            action.textContent = command.message;
        }
        finish("Microphone off. Click Listen for another command.");
    };
    recognition.onnomatch = () => {
        if (active !== recognition) return;
        heard.textContent = "No clear words received.";
        action.textContent = "Nothing changed. Try a shorter command, such as “highlight Japan”.";
        finish("Microphone off.");
    };
    recognition.onerror = event => {
        if (active !== recognition) return;
        const messages = {
            "not-allowed": "Microphone access was denied. Allow it in your browser, or use the menu below.",
            "service-not-allowed": "Your browser blocked speech recognition. Try Chrome, or use the menu below.",
            "audio-capture": "No microphone is available. You can still use the menu below.",
            "network": "The speech service could not connect. Try again, or use the menu below.",
            "no-speech": "No speech was detected. Click Listen to try again.",
            "language-not-supported": "English speech recognition is unavailable in this browser.",
            "aborted": "Listening stopped."
        };
        heard.textContent = "No transcript received.";
        action.textContent = "The maps have not changed.";
        finish(messages[event.error] || "Speech recognition failed. Try again, or use the menu below.");
    };
    recognition.onend = () => {
        if (active !== recognition) return;
        if (!receivedResult) {
            heard.textContent = "No transcript received.";
            action.textContent = "Nothing changed. Click Listen to try again.";
        }
        finish("Microphone off.");
    };
    timeout = setTimeout(() => {
        if (active !== recognition) return;
        action.textContent = "No command received. The maps have not changed.";
        heard.textContent = "No transcript received.";
        finish("Listening timed out. Click Listen to try again.");
    }, 20000);
    try { recognition.start(); }
    catch { finish("Voice could not start. Check microphone access or use the menu below."); }
});

stopButton.addEventListener("click", () => {
    if (!active) return;
    heard.textContent = "Listening cancelled.";
    action.textContent = "The maps have not changed.";
    finish("Microphone off.");
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden && active) finish("Microphone off. Listening stopped when you left this tab.");
});
window.addEventListener("pagehide", () => finish("Microphone off."));
window.addEventListener("gdp-map-ready", ready, {once: true});
window.addEventListener("gdp-map-error", () => {
    map = null;
    finish("Voice is unavailable until the maps load. Please reload the page.");
}, {once: true});
if (map) ready();
else if (!SpeechRecognition) {
    voiceStatus.textContent = "Voice is unavailable in this browser. Try Chrome, or use the menu below.";
}
