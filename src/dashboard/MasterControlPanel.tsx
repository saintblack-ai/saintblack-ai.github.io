"use client";

import { useEffect, useState } from "react";
import styles from "./MasterControlPanel.module.css";

const WORKER_URL = "https://archaios-saas-worker.quandrix357.workers.dev";
const NAV_ITEMS = ["Overview", "Agents", "Intelligence", "Content drafts", "Marketing queue", "Revenue analytics", "Infrastructure", "Logs", "Settings"] as const;

type NavItem = (typeof NAV_ITEMS)[number];

type SystemStatus = {
  worker: { status: string; url: string };
  supabase: { status: string; detail: string | null };
  stripe: { status: string; webhook_events: number };
  githubActions: { status: string };
  activeAgents: number;
  errorAlerts: number;
};

type Agent = {
  name: string;
  description: string | null;
  tags: string[];
  enabled: boolean;
  last_run: string | null;
  last_status: string;
};

type Revenue = {
  subscriptions: { total: number; active: number };
  revenueToday: number;
  stripeMetrics: Record<string, unknown> | null;
  webhookEvents: { total: number; latest: Array<Record<string, unknown>> };
};

type IntelligenceBrief = {
  id: number;
  topic: string;
  report: string;
  created_at: string;
};

type ContentDraft = {
  id: number;
  channel: string;
  content_type: string;
  content: string;
  status: string;
  created_at: string;
};

type MarketingQueueItem = {
  id: number;
  channel: string;
  content: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
};

type RevenueAsset = {
  id: number;
  content_type: string;
  content: string;
  status: string;
  created_at: string;
};

type PerformanceMetric = {
  id: number;
  metric_type: string;
  value: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type LogResponse = {
  logs: Array<{
    agent_name: string;
    category: string;
    status: string;
    created_at: string;
    output: unknown;
  }>;
  page: number;
  pageSize: number;
  total: number;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function badgeClass(status: string) {
  if (status === "error") return `${styles.badge} ${styles.badgeError}`;
  if (status === "warning" || status === "paused" || status === "missing_config") {
    return `${styles.badge} ${styles.badgeWarn}`;
  }
  return styles.badge;
}

export default function MasterControlPanel() {
  const [activePage, setActivePage] = useState<NavItem>("Overview");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceBrief[]>([]);
  const [contentDrafts, setContentDrafts] = useState<ContentDraft[]>([]);
  const [marketingQueue, setMarketingQueue] = useState<MarketingQueueItem[]>([]);
  const [revenueAssets, setRevenueAssets] = useState<RevenueAsset[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [logs, setLogs] = useState<LogResponse | null>(null);
  const [logQuery, setLogQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefStatus, setBriefStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [marketAnalysis, setMarketAnalysis] = useState("");
  const [missionPriorities, setMissionPriorities] = useState("");
  const [commandNote, setCommandNote] = useState("");

  async function loadOverview() {
    const [systemRes, agentsRes, intelligenceRes, contentRes, marketingRes, revenueRes, metricsRes, logsRes] = await Promise.all([
      fetch("/api/system/status"),
      fetch("/api/agents"),
      fetch("/api/intelligence"),
      fetch("/api/content-drafts"),
      fetch("/api/marketing-queue"),
      fetch("/api/revenue"),
      fetch("/api/metrics"),
      fetch("/api/logs?page=1&pageSize=12")
    ]);

    const [systemJson, agentsJson, intelligenceJson, contentJson, marketingJson, revenueJson, metricsJson, logsJson] = await Promise.all([
      systemRes.json(),
      agentsRes.json(),
      intelligenceRes.json(),
      contentRes.json(),
      marketingRes.json(),
      revenueRes.json(),
      metricsRes.json(),
      logsRes.json()
    ]);

    setSystemStatus(systemJson);
    setAgents(agentsJson.agents || []);
    setIntelligence(intelligenceJson.briefs || []);
    setContentDrafts(contentJson.drafts || []);
    setMarketingQueue(marketingJson.queue || []);
    setRevenue(revenueJson);
    setRevenueAssets(metricsJson.salesContent || []);
    setPerformanceMetrics(metricsJson.metrics || []);
    setLogs(logsJson);
  }

  useEffect(() => {
    setLoading(true);
    loadOverview().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadGeneratedBrief() {
      setBriefStatus("loading");
      console.log("Using WORKER_URL:", WORKER_URL);

      const response = await fetch(`${WORKER_URL}/api/brief`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: "guest-free",
          tier: "free",
          location: "Chicago",
          focus: "market expansion",
          tone: "direct",
          prompt: "Generate a daily intelligence brief"
        })
      });

      const data = await response.json();
      if (!active) {
        return;
      }

      console.error("Brief API response:", data);

      if (!data?.brief) {
        throw new Error("brief_generation_failed");
      }

      if (response.ok) {
        setMarketAnalysis(data.brief.summary);
        setMissionPriorities(data.brief.content.split("\n")[0]);
        setCommandNote(data.brief.title);
        setBriefStatus("ready");
        return;
      }

      throw new Error("brief_generation_failed");
    }

    loadGeneratedBrief().catch((error) => {
      if (!active) {
        return;
      }
      console.error("Brief request error", error);
      setMarketAnalysis("");
      setMissionPriorities("");
      setCommandNote("");
      setBriefStatus("error");
    });

    return () => {
      active = false;
    };
  }, []);

  async function refreshLogs(page = 1, query = logQuery) {
    const response = await fetch(`/api/logs?page=${page}&pageSize=12&q=${encodeURIComponent(query)}`);
    const payload = await response.json();
    setLogs(payload);
  }

  async function runRoute(path: string) {
    setLoading(true);
    await fetch(path, { method: "POST" });
    await loadOverview();
    setLoading(false);
  }

  async function runAgent(name: string) {
    setLoading(true);
    await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: name })
    });
    await loadOverview();
    setLoading(false);
  }

  async function pauseAgent(name: string, enabled: boolean) {
    setLoading(true);
    await fetch("/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: name, enabled })
    });
    await loadOverview();
    setLoading(false);
  }

  async function scheduleAgent(name: string, currentTags: string[]) {
    const next = window.prompt("Enter schedule tags (comma separated: daily, hourly, weekly)", currentTags.join(", "));
    if (next == null) {
      return;
    }

    const tags = next
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item === "daily" || item === "hourly" || item === "weekly");

    setLoading(true);
    await fetch("/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: name, tags })
    });
    await loadOverview();
    setLoading(false);
  }

  async function approve(path: string, id: number) {
    setLoading(true);
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    await loadOverview();
    setLoading(false);
  }

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <aside className={styles.sidebar}>
          <h1 className={styles.brand}>
            ARCHAIOS
            <span>Master Control Panel</span>
          </h1>
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                className={`${styles.navButton} ${activePage === item ? styles.navButtonActive : ""}`}
                onClick={() => setActivePage(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.content}>
          <section className={styles.hero}>
            <h2 className={styles.heroTitle}>Operate the autonomous ARCHAIOS network from one console.</h2>
            <p className={styles.heroText}>
              Intelligence generation, content drafting, marketing queueing, and revenue copy all stay inside approved Supabase-backed workflows.
              {" "}
              {loading ? "Refreshing data..." : "Manual controls are ready."}
            </p>
          </section>

          {activePage === "Overview" && systemStatus && revenue && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Overview</h2>
                <div className={styles.actions}>
                  <button className={styles.button} onClick={() => loadOverview()} type="button">Refresh</button>
                </div>
              </div>
              <div className={styles.cards}>
                <Card label="Worker health" value={systemStatus.worker.status} hint={systemStatus.worker.url} />
                <Card label="Intelligence briefs" value={String(intelligence.length)} hint="Recent generated intelligence items" />
                <Card label="Content drafts" value={String(contentDrafts.length)} hint="Tweet, blog, and newsletter backlog" />
                <Card label="Marketing queue" value={String(marketingQueue.length)} hint="Scheduled but not published" />
                <Card label="Revenue assets" value={String(revenueAssets.length)} hint="Sales copy drafts ready for review" />
              </div>
              <div className={styles.cards}>
                <Card
                  label="Overnight Overview"
                  value={
                    briefStatus === "loading"
                      ? "Generating intelligence brief..."
                      : briefStatus === "error"
                        ? "Brief generation temporarily unavailable"
                        : marketAnalysis
                  }
                  hint="Latest strategic market signal"
                />
                <Card
                  label="Mission Priorities"
                  value={
                    briefStatus === "loading"
                      ? "Generating intelligence brief..."
                      : briefStatus === "error"
                        ? "Brief generation temporarily unavailable"
                        : missionPriorities
                  }
                  hint="First operational action from the brief"
                />
                <Card
                  label="Command Note"
                  value={
                    briefStatus === "loading"
                      ? "Generating intelligence brief..."
                      : briefStatus === "error"
                        ? "Brief generation temporarily unavailable"
                        : commandNote
                  }
                  hint="Generated brief title"
                />
              </div>
            </section>
          )}

          {activePage === "Agents" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Agents</h2>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>Schedule</th>
                      <th>Last run</th>
                      <th>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.name}>
                        <td>
                          <strong>{agent.name}</strong>
                          <div className={styles.hint}>{agent.description || "No description"}</div>
                        </td>
                        <td><span className={badgeClass(agent.enabled ? agent.last_status : "paused")}>{agent.enabled ? agent.last_status : "paused"}</span></td>
                        <td>{(agent.tags || []).join(", ") || "manual"}</td>
                        <td>{formatDate(agent.last_run)}</td>
                        <td>
                          <div className={styles.actions}>
                            <button className={styles.button} onClick={() => runAgent(agent.name)} type="button">Run</button>
                            <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => pauseAgent(agent.name, !agent.enabled)} type="button">
                              {agent.enabled ? "Pause" : "Resume"}
                            </button>
                            <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => scheduleAgent(agent.name, agent.tags || [])} type="button">
                              Schedule
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activePage === "Intelligence" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Intelligence</h2>
                <div className={styles.actions}>
                  <button className={styles.button} onClick={() => runRoute("/api/agents/intelligence")} type="button">Run intelligence</button>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Created</th>
                      <th>Brief</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intelligence.map((brief) => (
                      <tr key={brief.id}>
                        <td>{brief.topic}</td>
                        <td>{formatDate(brief.created_at)}</td>
                        <td><div className={styles.pre}>{brief.report}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activePage === "Content drafts" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Content drafts</h2>
                <div className={styles.actions}>
                  <button className={styles.button} onClick={() => runRoute("/api/agents/content")} type="button">Run content</button>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentDrafts.map((draft) => (
                      <tr key={draft.id}>
                        <td>{draft.channel}</td>
                        <td>{draft.content_type}</td>
                        <td><span className={badgeClass(draft.status)}>{draft.status}</span></td>
                        <td>{formatDate(draft.created_at)}</td>
                        <td>
                          <div className={styles.actions}>
                            <button className={styles.button} onClick={() => approve("/api/content-drafts/approve", draft.id)} type="button">Approve</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activePage === "Marketing queue" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Marketing queue</h2>
                <div className={styles.actions}>
                  <button className={styles.button} onClick={() => runRoute("/api/agents/marketing")} type="button">Run marketing</button>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Status</th>
                      <th>Scheduled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketingQueue.map((item) => (
                      <tr key={item.id}>
                        <td>{item.channel}</td>
                        <td><span className={badgeClass(item.status)}>{item.status}</span></td>
                        <td>{formatDate(item.scheduled_time)}</td>
                        <td>
                          <div className={styles.actions}>
                            <button className={styles.button} onClick={() => approve("/api/marketing-queue/approve", item.id)} type="button">Approve</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activePage === "Revenue analytics" && revenue && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Revenue analytics</h2>
                <div className={styles.actions}>
                  <button className={styles.button} onClick={() => runRoute("/api/agents/revenue")} type="button">Run revenue</button>
                </div>
              </div>
              <div className={styles.gridTwo}>
                <div className={styles.cards}>
                  <Card label="Subscriptions" value={String(revenue.subscriptions.total)} hint={`${revenue.subscriptions.active} active`} />
                  <Card label="Revenue today" value={String(revenue.revenueToday)} hint="Webhook deliveries seen today" />
                  <Card label="Revenue assets" value={String(revenueAssets.length)} hint="Sales copy drafts" />
                  <Card label="Metric rows" value={String(performanceMetrics.length)} hint="Feedback and optimization records" />
                </div>
                <div className={styles.pre}>{JSON.stringify({ stripeMetrics: revenue.stripeMetrics, performanceMetrics, salesContent: revenueAssets }, null, 2)}</div>
              </div>
            </section>
          )}

          {activePage === "Infrastructure" && systemStatus && (
            <section className={styles.section}>
              <div className={styles.metaGrid}>
                <StatusBlock title="Worker" status={systemStatus.worker.status} detail={systemStatus.worker.url} />
                <StatusBlock title="Supabase" status={systemStatus.supabase.status} detail={systemStatus.supabase.detail || "Queries available"} />
                <StatusBlock title="Stripe" status={systemStatus.stripe.status} detail={`${systemStatus.stripe.webhook_events} webhook events logged`} />
                <StatusBlock title="GitHub actions" status={systemStatus.githubActions.status} detail="Heartbeat workflow presence check" />
              </div>
            </section>
          )}

          {activePage === "Logs" && logs && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Logs</h2>
              </div>
              <div className={styles.searchBar}>
                <input className={styles.input} onChange={(event) => setLogQuery(event.target.value)} placeholder="Search by agent or category" value={logQuery} />
                <button className={styles.button} onClick={() => refreshLogs(1)} type="button">Search</button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.logs.map((log, index) => (
                      <tr key={`${log.agent_name}-${log.created_at}-${index}`}>
                        <td>{log.agent_name}</td>
                        <td>{log.category}</td>
                        <td><span className={badgeClass(log.status)}>{log.status}</span></td>
                        <td>{formatDate(log.created_at)}</td>
                        <td><div className={styles.pre}>{JSON.stringify(log.output, null, 2)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activePage === "Settings" && (
            <section className={styles.section}>
              <div className={styles.pre}>
                {JSON.stringify(
                  {
                    workerBaseUrl: "set via WORKER_BASE_URL or defaults to deployed worker",
                    controls: ["Run intelligence/content/marketing/revenue", "Approve content drafts", "Approve marketing queue"],
                    scheduler: "single cron trigger runs intelligence -> content -> marketing -> revenue"
                  },
                  null,
                  2
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      <p className={styles.hint}>{hint}</p>
    </article>
  );
}

function StatusBlock({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <article className={styles.card}>
      <p className={styles.label}>{title}</p>
      <p className={styles.value} style={{ fontSize: 22 }}>{status}</p>
      <p className={styles.hint}>{detail}</p>
    </article>
  );
}
