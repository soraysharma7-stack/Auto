import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Capability = "screen" | "input" | "files";
type Permission = { capability: Capability; enabled: boolean; paths: string[] };
type Config = { serverUrl: string; deviceId: string; deviceName: string; appVersion: string; permissions: Permission[] };
type PublicState = { paired: boolean; config: Config | null; sessionId: string | null; notice: string | null };
type DeviceAction = { id: string; type: string; status: string };
type PollResult = { state: PublicState; actions: DeviceAction[] };
type ActionOutcome = { id: string; status: string; notice: string | null };

export default function App() {
  const [state, setState] = useState<PublicState | null>(null);
  const [serverUrl, setServerUrl] = useState("http://localhost:3000");
  const [deviceName, setDeviceName] = useState("My Windows PC");
  const [code, setCode] = useState("");
  const [folderText, setFolderText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const polling = useRef(false);

  const applyState = useCallback((next: PublicState) => {
    setState(next);
    const paths = next.config?.permissions.find((permission) => permission.capability === "files")?.paths ?? [];
    setFolderText(paths.join("\n"));
  }, []);
  const loadState = useCallback(async () => {
    try { applyState(await invoke<PublicState>("get_state")); }
    catch (caught) { setError(String(caught)); }
  }, [applyState]);
  useEffect(() => {
    let active = true;
    void invoke<PublicState>("get_state")
      .then((next) => { if (active) applyState(next); })
      .catch((caught) => { if (active) setError(String(caught)); });
    return () => { active = false; };
  }, [applyState]);

  const log = useCallback((message: string) => {
    setEvents((current) => [`${new Date().toLocaleTimeString()} · ${message}`, ...current].slice(0, 8));
  }, []);

  const poll = useCallback(async () => {
    if (!state?.paired || polling.current) return;
    polling.current = true;
    try {
      const result = await invoke<PollResult>("poll");
      setState(result.state);
      for (const action of result.actions) {
        log(`Executing ${action.type}`);
        const outcome = await invoke<ActionOutcome>("execute_action", { actionId: action.id });
        log(`${action.type}: ${outcome.status}${outcome.notice ? ` · ${outcome.notice}` : ""}`);
      }
    } catch (caught) {
      setError(String(caught));
      await loadState();
    } finally {
      polling.current = false;
    }
  }, [state?.paired, loadState, log]);
  useEffect(() => {
    if (!state?.paired) return;
    const timer = setInterval(() => void poll(), 3000);
    return () => clearInterval(timer);
  }, [state?.paired, poll]);

  async function pair(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const next = await invoke<PublicState>("pair_device", { serverUrl, code: code.toUpperCase(), deviceName });
      applyState(next); setCode(""); log("Device paired; permissions remain off");
    } catch (caught) { setError(String(caught)); }
    finally { setBusy(false); }
  }
  async function command(name: "start_session" | "stop_session") {
    setBusy(true); setError(null);
    try {
      const next = await invoke<PublicState>(name);
      applyState(next); log(name === "start_session" ? "Visible session started" : "Agent stopped");
    } catch (caught) { setError(String(caught)); }
    finally { setBusy(false); }
  }
  async function permission(capability: Capability, enabled: boolean) {
    setError(null);
    const paths = capability === "files" ? folderText.split("\n").map((path) => path.trim()).filter(Boolean) : [];
    try {
      const next = await invoke<PublicState>("set_permission", { capability, enabled, paths });
      applyState(next); log(`${capability} permission ${enabled ? "granted" : "revoked"}`);
    } catch (caught) { setError(String(caught)); }
  }

  if (!state) return <main><p className="muted">Loading local companion state…</p></main>;
  if (!state.paired || !state.config) return <main>
    <header><div className="logo">A</div><div><h1>Auto Agent PC</h1><p>Visible, permission-controlled local actions</p></div></header>
    <section><span className="eyebrow">One-time secure pairing</span><h2>Connect this computer</h2><p className="muted">Generate a code in Auto Web → Agent PC. The device token stays in your operating system’s credential store.</p>
      <form onSubmit={pair}><label>Auto server URL<input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} required /></label><label>Device name<input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} minLength={2} required /></label><label>Pairing code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={8} minLength={8} autoCapitalize="characters" required placeholder="ABCDEFGH" /></label>{error ? <p role="alert" className="error">{error}</p> : null}<button disabled={busy} type="submit">{busy ? "Pairing…" : "Pair this PC"}</button></form>
    </section><p className="footnote">All permissions start disabled. Auto never requests your Windows password.</p>
  </main>;

  const active = Boolean(state.sessionId);
  return <main>
    <header><div className="logo">A</div><div><h1>Auto Agent PC</h1><p>{state.config.deviceName} · v{state.config.appVersion}</p></div><span className={active ? "status active" : "status"}>{active ? "SESSION ACTIVE" : "STOPPED"}</span></header>
    {active ? <button className="stop" disabled={busy} onClick={() => command("stop_session")}>■ Stop Agent now</button> : <button disabled={busy} onClick={() => command("start_session")}>Start visible session</button>}
    {state.notice ? <p className="notice">{state.notice}</p> : null}{error ? <p role="alert" className="error">{error}</p> : null}
    <section><span className="eyebrow">Local permissions</span><h2>You decide on this PC</h2><p className="muted">Revocation works locally even when the network is unavailable.</p>
      {state.config.permissions.map((item) => <div className="permission" key={item.capability}><div><strong>{item.capability === "screen" ? "Screen viewing" : item.capability === "input" ? "Mouse & keyboard" : "Selected files & folders"}</strong><p>{item.capability === "screen" ? "Allow requested screen snapshots" : item.capability === "input" ? "Allow input only during an active session" : "Restrict native file operations to these folders"}</p></div><button className={item.enabled ? "enabled" : "secondary"} onClick={() => permission(item.capability, !item.enabled)}>{item.enabled ? "Revoke" : "Grant"}</button></div>)}
      <label>Allowed folders (one absolute path per line)<textarea value={folderText} onChange={(event) => setFolderText(event.target.value)} placeholder={"C:\\Users\\you\\Approved"} rows={3} /></label><button className="secondary" onClick={() => permission("files", true)}>Save folders & grant file access</button>
    </section>
    <section><span className="eyebrow">Connection</span><p className="server">{state.config.serverUrl}</p><p className="muted">Polling every 3 seconds. Connection loss stops the local session. Pending actions are checked again by Rust before execution.</p></section>
    <section><span className="eyebrow">Visible activity</span>{events.length ? <ul className="events">{events.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}</ul> : <p className="muted">No local actions in this app session.</p>}</section>
    <p className="footnote">Device ID · {state.config.deviceId}</p>
  </main>;
}
