const NAV_ITEMS = ["Overview", "Intelligence", "Decision Engine", "Operations", "Saved Briefs", "Settings"];
const MISSION_MODES = ["Growth Mode", "Revenue Mode", "Build Mode", "Intel Mode", "Creator Mode"];
const STORAGE_KEY = "archaiosDocsSavedBriefs";
const REVENUE_FALLBACK = {
  totalRevenue: 49.99,
  mrr: 49.99,
  activeSubscriptions: 1,
  failedPayments: 0,
  lastPaymentTimestamp: null,
  revenueStatus: "Fallback"
};
const SWARM_FALLBACK = {
  totalAgents: 7,
  activeAgents: 6,
  topPerformers: [
    { name: "launch_agent", score: 92, revenue: 3200 },
    { name: "trend_scout", score: 84, revenue: 1800 },
    { name: "revenue_optimizer", score: 81, revenue: 2600 }
  ],
  revenuePerAgent: [
    { name: "launch_agent", revenue: 3200 },
    { name: "revenue_optimizer", revenue: 2600 },
    { name: "trend_scout", revenue: 1800 }
  ],
  experimentsRunning: 3,
  maxAgents: 50,
  maxTasksPerAgent: 10
};

const FALLBACK = {
  "Growth Mode": {
    overview: "AI demand is clustering around focused operator workflows, so growth wins belong to products that show value immediately and make operator momentum visible.",
    priorities: [
      "Tighten the first-screen promise around one concrete workflow.",
      "Turn the strongest brief output into a public proof asset.",
      "Use fast wins to deepen operator trust and repeat usage."
    ],
    commandNote: "Position ARCHAIOS as an operating advantage rather than a generic assistant.",
    bestNextMove: "Publish one concrete operator use case that shows how ARCHAIOS compresses research-to-decision time.",
    whyNow: "The market is crowded with generic AI language, so clarity and proof are compounding faster than breadth.",
    expectedImpact: "Higher conversion from curious visitors into operators who understand the product in one session.",
    marketIntelligence: {
      opportunity: "Operators are actively testing AI systems that collapse research, planning, and execution into one surface.",
      threat: "Broad AI positioning still risks blending into undifferentiated assistant experiences.",
      recommendation: "Lead with operator outcomes and back them with visible proof.",
      status: "ready"
    },
    actionQueue: [
      { title: "Package the strongest growth workflow into a proof card.", assignedAgent: "growth_agent", result: "Growth proof card drafted and queued for review." },
      { title: "Draft a public-facing sample brief for operators.", assignedAgent: "media_ops_agent", result: "Sample operator brief drafted for distribution." },
      { title: "Refine the primary CTA around operator speed.", assignedAgent: "brief_agent", result: "Primary CTA revised around faster operator decisions." }
    ]
  },
  "Revenue Mode": {
    overview: "Revenue momentum is strongest when intelligence resolves into a clear commercial move with low friction between insight, offer, and follow-through.",
    priorities: [
      "Surface the revenue-critical KPI and decision in one view.",
      "Translate the brief into a pricing, upsell, or conversion move.",
      "Keep the operator path from signal to monetization extremely short."
    ],
    commandNote: "Turn intelligence into monetization actions that are visible and fast to execute.",
    bestNextMove: "Create one revenue play card tied to a pricing, sales, or upsell action from the current brief.",
    whyNow: "The dashboard already exposes revenue context, so the fastest win is turning it into direct operator motion.",
    expectedImpact: "More monetization behavior and a stronger reason for operators to return daily.",
    marketIntelligence: {
      opportunity: "Lean buyers still spend when a product clearly replaces fragmented revenue-adjacent manual work.",
      threat: "Decorative AI experiences lose monetization power when they do not improve conversion or retention.",
      recommendation: "Tie every brief to a revenue action and commercial outcome.",
      status: "ready"
    },
    actionQueue: [
      { title: "Define a monetization move from the current brief.", assignedAgent: "revenue_agent", result: "Revenue move attached to the current operator brief." },
      { title: "Add revenue framing to the command summary.", assignedAgent: "brief_agent", result: "Command summary updated with revenue-forward framing." },
      { title: "Draft a follow-up tied to upsell or conversion.", assignedAgent: "growth_agent", result: "Follow-up drafted for revenue conversion flow." }
    ]
  },
  "Build Mode": {
    overview: "Build momentum is highest when intelligence clearly reveals what to ship next, why it matters, and how it compounds operator trust.",
    priorities: [
      "Turn the dashboard into an execution surface for the next feature.",
      "Promote reliability and traceability as user-visible product strengths.",
      "Make each new capability measurable in operator terms."
    ],
    commandNote: "Use intelligence to prioritize the next build decision, not just summarize conditions.",
    bestNextMove: "Ship one operator-facing workflow step that turns current intelligence into action.",
    whyNow: "The command center already has state, history, and actions, so the next build step compounds immediately.",
    expectedImpact: "Higher user trust and faster product differentiation through visible execution support.",
    marketIntelligence: {
      opportunity: "Teams reward automation products that make orchestration legible and dependable.",
      threat: "Black-box behavior slows adoption of advanced features.",
      recommendation: "Ship operator-visible decision tools that make next action unmistakable.",
      status: "ready"
    },
    actionQueue: [
      { title: "Select the highest-leverage workflow gap from the brief.", assignedAgent: "brief_agent", result: "Workflow gap prioritized for the next build cycle." },
      { title: "Define one operator UI state to close the gap.", assignedAgent: "media_ops_agent", result: "UI state outlined for the next operator flow." },
      { title: "Instrument the action for dashboard-visible impact.", assignedAgent: "growth_agent", result: "Instrumentation plan drafted for command-center visibility." }
    ]
  },
  "Intel Mode": {
    overview: "Decision advantage now comes from turning noisy signals into clear operator moves faster than competitors can interpret them.",
    priorities: [
      "Condense the strongest signal into one decisive recommendation.",
      "Preserve context while reducing interpretation load.",
      "Keep the intelligence loop visible and repeatable."
    ],
    commandNote: "Treat every brief as a command asset that shortens the path from awareness to action.",
    bestNextMove: "Promote the clearest market signal into a top-level command for the operator.",
    whyNow: "Fast-changing AI and media conditions reward systems that reduce hesitation rather than just add information.",
    expectedImpact: "Faster operator response time and stronger trust that ARCHAIOS is driving decisions.",
    marketIntelligence: {
      opportunity: "Teams need intelligence surfaces that translate trends into operational posture.",
      threat: "Raw summaries still create hesitation when they do not resolve into a recommendation.",
      recommendation: "Prioritize decision clarity over data volume.",
      status: "ready"
    },
    actionQueue: [
      { title: "Select the strongest signal in the current brief.", assignedAgent: "brief_agent", result: "Highest-conviction signal promoted for operator review." },
      { title: "Map the signal to one strategic decision.", assignedAgent: "market_intel_agent", result: "Strategic decision recommendation attached to the signal." },
      { title: "Log the outcome so the next brief compounds context.", assignedAgent: "security_sentinel", result: "Decision outcome logged into the ARCHAIOS memory loop." }
    ]
  },
  "Creator Mode": {
    overview: "Creators respond to systems that transform market awareness into content direction, monetization angles, and immediate execution without flattening voice.",
    priorities: [
      "Connect the signal to a publishable angle.",
      "Tie strategy output to growth or monetization.",
      "Keep creativity guided rather than templated."
    ],
    commandNote: "Turn insight into a differentiated creator move with visible upside.",
    bestNextMove: "Convert the strongest signal into one creator-facing angle with monetizable follow-through.",
    whyNow: "Attention windows are short, so creators benefit most when insight becomes a publishing decision quickly.",
    expectedImpact: "More differentiated content and stronger alignment between effort and return.",
    marketIntelligence: {
      opportunity: "Creators want systems that reveal what to say next and how it compounds across channels and products.",
      threat: "Generic AI output reduces distinctiveness and weakens audience trust.",
      recommendation: "Use ARCHAIOS to suggest sharp creator actions tied to monetization.",
      status: "ready"
    },
    actionQueue: [
      { title: "Turn the brief into one strong creator angle.", assignedAgent: "media_ops_agent", result: "Creator angle drafted from the strongest signal." },
      { title: "Connect the angle to an offer or funnel step.", assignedAgent: "revenue_agent", result: "Creator angle tied to a monetization path." },
      { title: "Prepare the first execution move while the signal is fresh.", assignedAgent: "growth_agent", result: "First creator execution move staged for launch." }
    ]
  }
};

const AGENTS = [
  { name: "Brief Agent", key: "brief_agent", detail: "Brief orchestration online" },
  { name: "Market Intel Agent", key: "market_intel_agent", detail: "Signal ingestion synchronized" },
  { name: "Revenue Agent", key: "revenue_agent", detail: "Revenue playbooks synced" },
  { name: "Media Ops Agent", key: "media_ops_agent", detail: "Distribution board synchronized" },
  { name: "Growth Agent", key: "growth_agent", detail: "Growth experiments staged" },
  { name: "Security Sentinel", key: "security_sentinel", detail: "Environment checks stable" }
];

const state = {
  activeView: "Overview",
  missionMode: "Intel Mode",
  lastBriefTimestamp: null,
  revenueStatus: "$49.99",
  revenueSignals: { ...REVENUE_FALLBACK },
  revenueSource: "Fallback",
  revenueEventMarkers: [],
  revenueSnapshot: null,
  savedBriefs: readSavedBriefs(),
  intelStream: [],
  brief: createBrief("Intel Mode"),
  operations: [],
  commandStatus: "Operator Ready",
  swarm: { ...SWARM_FALLBACK }
};

function normalizeTask(mode, task, index) {
  return {
    id: task.id || task.taskId || `${mode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${index}`,
    title: task.title || task.description || `ARCHAIOS task ${index + 1}`,
    assignedAgent: task.assignedAgent || "brief_agent",
    priority: task.priority || (index === 0 ? "high" : index === 1 ? "medium" : "low"),
    status: task.status || "pending",
    result: task.result || `Completed ${task.title || task.description || "task"}.`,
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null
  };
}

function normalizeSavedBrief(entry) {
  const mode = entry.missionMode && FALLBACK[entry.missionMode] ? entry.missionMode : "Intel Mode";
  const fallback = createBrief(mode);
  return {
    id: entry.id || `${Date.now()}-${mode}`,
    savedAt: entry.savedAt || new Date().toISOString(),
    missionMode: mode,
    overview: entry.overview || fallback.overview,
    priorities: Array.isArray(entry.priorities) ? entry.priorities : fallback.priorities,
    commandNote: entry.commandNote || fallback.commandNote,
    bestNextMove: entry.bestNextMove || fallback.bestNextMove,
    whyNow: entry.whyNow || fallback.whyNow,
    expectedImpact: entry.expectedImpact || fallback.expectedImpact,
    marketIntelligence: entry.marketIntelligence || fallback.marketIntelligence,
    actionQueue: Array.isArray(entry.actionQueue)
      ? entry.actionQueue.map((task, index) => normalizeTask(mode, task, index))
      : fallback.actionQueue
  };
}

initialize();

function initialize() {
  renderNav();
  renderMissionModes();
  attachControls();
  refreshRevenueSignals().finally(() => renderAll());
  generateBrief();
  window.setInterval(() => {
    refreshRevenueSignals().finally(() => renderAll());
  }, 60000);
}

function resolveRevenueConfig() {
  return {
    revenueSummaryUrl: (document.body.dataset.revenueSummaryUrl || "").trim(),
    supabaseUrl: (document.body.dataset.supabaseUrl || "").trim().replace(/\/+$/, ""),
    supabaseAnonKey: (document.body.dataset.supabaseAnonKey || "").trim()
  };
}

async function refreshRevenueSignals() {
  const config = resolveRevenueConfig();

  try {
    if (config.revenueSummaryUrl) {
      const response = await fetch(config.revenueSummaryUrl, {
        headers: {
          Accept: "application/json"
        }
      });
      if (response.ok) {
        applyRevenueSignals(await response.json(), "Public Summary Endpoint");
        appendStream("revenue_signal_sync :: live endpoint");
        return;
      }
    }

    if (config.supabaseUrl && config.supabaseAnonKey) {
      const headers = {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        Accept: "application/json"
      };
      const [summaryResponse, eventsResponse] = await Promise.all([
        fetch(
          `${config.supabaseUrl}/rest/v1/revenue_summary?scope=eq.global&select=scope,total_revenue,mrr,active_subscriptions,failed_payments,last_payment_at,revenue_status,updated_at,source_event_id`,
          { headers }
        ),
        fetch(
          `${config.supabaseUrl}/rest/v1/revenue_events?select=stripe_event_id,event_type,amount,revenue_delta,status,occurred_at,customer_email&order=occurred_at.desc&limit=8`,
          { headers }
        ).catch(() => null)
      ]);

      if (summaryResponse.ok) {
        const payload = await summaryResponse.json();
        const summary = Array.isArray(payload) ? payload[0] : payload;
        const recentEvents = eventsResponse && eventsResponse.ok ? await eventsResponse.json() : [];
        applyRevenueSignals({ ...summary, recentEvents }, "Supabase");
        appendStream("revenue_signal_sync :: supabase");
        return;
      }
    }
  } catch (error) {
    console.error("Revenue signal fetch failed", error);
  }

  state.revenueSignals = { ...REVENUE_FALLBACK };
  state.revenueSource = "Fallback";
  state.revenueStatus = formatCurrency(state.revenueSignals.mrr);
  appendStream("revenue_signal_sync :: fallback");
}

function safeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function applyRevenueSignals(payload, sourceLabel) {
  const previousSignals = state.revenueSignals;
  state.revenueSignals = {
    totalRevenue: safeNumber(payload?.total_revenue ?? payload?.totalRevenue, REVENUE_FALLBACK.totalRevenue),
    mrr: safeNumber(payload?.mrr, REVENUE_FALLBACK.mrr),
    activeSubscriptions: safeNumber(payload?.active_subscriptions ?? payload?.activeSubscriptions, REVENUE_FALLBACK.activeSubscriptions),
    failedPayments: safeNumber(payload?.failed_payments ?? payload?.failedPayments, REVENUE_FALLBACK.failedPayments),
    lastPaymentTimestamp: payload?.last_payment_at ?? payload?.lastPaymentTimestamp ?? null,
    revenueStatus: String(payload?.revenue_status ?? payload?.revenueStatus ?? REVENUE_FALLBACK.revenueStatus)
  };
  state.revenueSource = sourceLabel;
  state.revenueStatus = formatCurrency(state.revenueSignals.mrr);
  syncRevenueEventsToIntelStream(payload?.recentEvents, previousSignals);
}

function syncRevenueEventsToIntelStream(events, previousSignals) {
  if (Array.isArray(events) && events.length > 0) {
    const nextMarkers = [];

    events
      .slice()
      .reverse()
      .forEach((event) => {
        const marker = String(event?.stripe_event_id || `${event?.event_type}-${event?.occurred_at}`);
        nextMarkers.push(marker);
        if (state.revenueEventMarkers.includes(marker)) {
          return;
        }

        const amount = safeNumber(event?.revenue_delta ?? event?.amount, 0);
        const amountLabel = amount > 0 ? formatCurrency(amount) : "no revenue delta";
        const status = String(event?.status || "recorded");
        const eventType = String(event?.event_type || "stripe.event");
        appendStream(`revenue_event :: ${eventType} :: ${status} :: ${amountLabel}`);
      });

    state.revenueEventMarkers = nextMarkers.slice(-20);
    state.revenueSnapshot = null;
    return;
  }

  const snapshot = [
    state.revenueSignals.totalRevenue,
    state.revenueSignals.mrr,
    state.revenueSignals.activeSubscriptions,
    state.revenueSignals.failedPayments,
    state.revenueSignals.lastPaymentTimestamp,
    state.revenueSignals.revenueStatus
  ].join("|");

  if (state.revenueSnapshot === snapshot) {
    return;
  }

  const changed =
    !previousSignals ||
    previousSignals.totalRevenue !== state.revenueSignals.totalRevenue ||
    previousSignals.mrr !== state.revenueSignals.mrr ||
    previousSignals.activeSubscriptions !== state.revenueSignals.activeSubscriptions ||
    previousSignals.failedPayments !== state.revenueSignals.failedPayments ||
    previousSignals.lastPaymentTimestamp !== state.revenueSignals.lastPaymentTimestamp ||
    previousSignals.revenueStatus !== state.revenueSignals.revenueStatus;

  state.revenueSnapshot = snapshot;

  if (!changed) {
    return;
  }

  appendStream(
    `revenue_event :: summary_sync :: ${state.revenueSignals.revenueStatus} :: total ${formatCurrency(state.revenueSignals.totalRevenue)} :: mrr ${formatCurrency(state.revenueSignals.mrr)}`
  );
}

function createTask(mode, task, index) {
  return {
    id: `${mode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${index}`,
    title: task.title,
    assignedAgent: task.assignedAgent,
    priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    status: "pending",
    result: task.result,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

function createBrief(mode) {
  const template = FALLBACK[mode];
  return {
    missionMode: mode,
    overview: template.overview,
    priorities: [...template.priorities],
    commandNote: template.commandNote,
    bestNextMove: template.bestNextMove,
    whyNow: template.whyNow,
    expectedImpact: template.expectedImpact,
    marketIntelligence: { ...template.marketIntelligence },
    actionQueue: template.actionQueue.map((task, index) => createTask(mode, task, index))
  };
}

function renderNav() {
  const rail = document.getElementById("nav-rail");
  rail.innerHTML = NAV_ITEMS.map((item) => `
    <button class="${item === state.activeView ? "active" : ""}" data-view="${item}">${item}</button>
  `).join("");

  rail.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      renderAll();
    });
  });
}

function renderMissionModes() {
  const select = document.getElementById("mission-mode");
  select.innerHTML = MISSION_MODES.map((mode) => `<option value="${mode}">${mode}</option>`).join("");
  select.value = state.missionMode;
}

function attachControls() {
  document.getElementById("mission-mode").addEventListener("change", (event) => {
    state.missionMode = event.target.value;
    state.commandStatus = `Mission mode switched to ${state.missionMode}`;
    appendStream(`command_mode_switch :: ${state.missionMode}`);
    renderAll();
  });

  document.getElementById("generate-brief").addEventListener("click", () => generateBrief());
  document.getElementById("save-brief").addEventListener("click", () => saveBrief());

  document.getElementById("command-form").addEventListener("submit", (event) => {
    event.preventDefault();
    parseCommand(document.getElementById("command-input").value);
  });
}

function generateBrief() {
  const timestamp = new Date().toISOString();
  state.brief = createBrief(state.missionMode);
  state.operations = state.brief.actionQueue.map((task) => ({ ...task, createdAt: timestamp }));
  state.lastBriefTimestamp = timestamp;
  state.commandStatus = "Brief refreshed";
  appendStream(`brief_run_started :: ${state.missionMode}`);
  appendStream(`brief_run_completed :: ${state.brief.bestNextMove}`);
  appendStream(`market_intel_completed :: ${state.brief.marketIntelligence.opportunity}`);
  renderAll();
}

function saveBrief() {
  const savedAt = state.lastBriefTimestamp || new Date().toISOString();
  const entry = { id: `${savedAt}-${state.brief.missionMode}`, savedAt, ...structuredClone(state.brief) };
  state.savedBriefs = [entry, ...state.savedBriefs.filter((item) => item.id !== entry.id)];
  writeSavedBriefs(state.savedBriefs);
  state.commandStatus = "Brief archived";
  appendStream(`brief_archive :: saved ${state.brief.missionMode}`);
  renderAll();
}

function executeTask(taskId) {
  const task = state.operations.find((item) => item.id === taskId);
  if (!task || task.status !== "pending") {
    appendStream(`task_execution_blocked :: ${taskId}`);
    renderAll();
    return;
  }

  task.status = "running";
  task.createdAt = new Date().toISOString();
  syncBriefQueue();
  appendStream(`task_execution_started :: ${task.assignedAgent} :: ${task.title}`);
  renderAll();

  window.setTimeout(() => {
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    syncBriefQueue();
    appendStream(`task_execution_completed :: ${task.assignedAgent} :: ${task.result}`);
    renderAll();
  }, 1000);
}

function queueScanTask() {
  const task = {
    id: `scan-${Date.now()}`,
    title: "Run autonomous market scan for emerging AI opportunities.",
    assignedAgent: "market_intel_agent",
    priority: "medium",
    status: "pending",
    result: "Autonomous market scan completed and queued in the Intel Stream.",
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  state.operations = [task, ...state.operations];
  syncBriefQueue();
  state.commandStatus = "Scan task queued";
  appendStream(`command_queue_scan :: ${task.title}`);
  renderAll();
}

function parseCommand(raw) {
  const command = raw.trim();
  if (!command) {
    return;
  }

  const normalized = command.toLowerCase();
  document.getElementById("command-input").value = "";

  if (normalized === "generate brief") {
    generateBrief();
    return;
  }

  if (normalized === "queue scan") {
    queueScanTask();
    return;
  }

  if (normalized === "show tasks") {
    state.activeView = "Operations";
    state.commandStatus = `Viewing ${state.operations.length} tasks`;
    appendStream(`command_show_tasks :: ${state.operations.length} task(s)`);
    renderAll();
    return;
  }

  if (normalized.startsWith("switch mission mode")) {
    const nextMode = MISSION_MODES.find((mode) => normalized.includes(mode.toLowerCase().replace(" mode", ""))) || null;
    if (nextMode) {
      state.missionMode = nextMode;
      document.getElementById("mission-mode").value = nextMode;
      state.commandStatus = `Mission mode switched to ${nextMode}`;
      appendStream(`command_mode_switch :: ${nextMode}`);
      renderAll();
      return;
    }
  }

  appendStream(`command_unknown :: ${command}`);
  state.commandStatus = "Command not recognized";
  renderAll();
}

function syncBriefQueue() {
  state.brief.actionQueue = state.operations.map((task) => ({ ...task }));
}

function loadSavedBrief(id) {
  const saved = state.savedBriefs.find((item) => item.id === id);
  if (!saved) {
    return;
  }
  state.brief = normalizeSavedBrief(structuredClone(saved));
  state.missionMode = saved.missionMode;
  state.lastBriefTimestamp = saved.savedAt;
  state.operations = saved.actionQueue.map((task, index) => normalizeTask(saved.missionMode, task, index));
  document.getElementById("mission-mode").value = state.missionMode;
  state.commandStatus = `Loaded saved brief for ${state.missionMode}`;
  appendStream(`brief_archive :: loaded ${saved.missionMode}`);
  renderAll();
}

function deleteSavedBrief(id) {
  state.savedBriefs = state.savedBriefs.filter((item) => item.id !== id);
  writeSavedBriefs(state.savedBriefs);
  state.commandStatus = "Saved brief removed";
  renderAll();
}

function appendStream(line) {
  state.intelStream = [`$ ${timestampLabel(new Date().toISOString())} :: ${line}`, ...state.intelStream].slice(0, 20);
}

function renderAll() {
  renderNav();
  renderStatusBar();
  renderSignalStrip();
  renderOverview();
  renderViews();
}

function renderStatusBar() {
  const bar = document.getElementById("status-bar");
  const items = [
    { label: "ARCHAIOS CORE", value: "Active" },
    { label: "Mission Mode", value: state.missionMode },
    { label: "Active Agents", value: String(state.swarm.activeAgents) },
    { label: "Pending Tasks", value: String(state.operations.filter((task) => task.status === "pending").length) },
    { label: "Last Brief", value: state.lastBriefTimestamp ? timestampLabel(state.lastBriefTimestamp) : "No brief yet" },
    { label: "Sync Status", value: `Swarm ${state.swarm.totalAgents}/${state.swarm.maxAgents}` }
  ];

  bar.innerHTML = items.map((item) => `
    <article class="status-pill">
      <p class="label">${item.label}</p>
      <p class="status-value">${item.value}</p>
    </article>
  `).join("");
}

function renderSignalStrip() {
  const strip = document.getElementById("signal-strip");
  const freshness = state.lastBriefTimestamp ? `${Math.max(1, Math.round((Date.now() - Date.parse(state.lastBriefTimestamp)) / 60000))} min ago` : "Awaiting brief";
  const items = [
    { label: "Revenue", value: formatCurrency(state.revenueSignals.totalRevenue), hint: `${state.revenueSignals.revenueStatus} · ${state.revenueSource}` },
    { label: "System Health", value: "Nominal", hint: "Static runtime online" },
    { label: "Intel Freshness", value: freshness, hint: "Latest brief age" },
    { label: "Queue Load", value: `${state.operations.filter((task) => task.status === "pending").length} pending`, hint: "Action queue pressure" },
    { label: "Operator Status", value: state.commandStatus, hint: "Command layer state", accent: true },
    { label: "Swarm Capacity", value: `${state.swarm.totalAgents}/${state.swarm.maxAgents}`, hint: `Max ${state.swarm.maxTasksPerAgent} tasks per agent` }
  ];

  strip.innerHTML = items.map((item) => `
    <article class="signal-card ${item.accent ? "accent" : ""}">
      <p class="label">${item.label}</p>
      <p class="signal-value">${item.value}</p>
      <p class="hint">${item.hint}</p>
    </article>
  `).join("");
}

function renderOverview() {
  const overviewCards = document.getElementById("overview-cards");
  const cards = [
    ["Overnight Overview", state.brief.overview, "Latest strategic signal"],
    ["Mission Priorities", state.brief.priorities.join(" / "), "Priority stack for the current brief"],
    ["Command Note", state.brief.commandNote, "Generated command note"],
    ["Market Intelligence", state.brief.marketIntelligence.opportunity, state.brief.marketIntelligence.recommendation],
    ["Action Queue", state.operations[0] ? state.operations[0].title : "Stand by", state.brief.expectedImpact],
    ["Intel Stream", `${state.intelStream.length} events`, "Live ARCHAIOS activity log"]
  ];

  overviewCards.innerHTML = cards.map(([label, value, hint]) => `
    <article class="card">
      <p class="label">${label}</p>
      <p class="signal-value">${value}</p>
      <p class="hint">${hint}</p>
    </article>
  `).join("");

  const revenueSignalsPanel = document.getElementById("revenue-signals-panel");
  const revenueCards = [
    ["Total Revenue", formatCurrency(state.revenueSignals.totalRevenue), "Cumulative Stripe revenue"],
    ["MRR", formatCurrency(state.revenueSignals.mrr), "Monthly recurring revenue"],
    ["Active Subscriptions", String(state.revenueSignals.activeSubscriptions), "Live subscription count"],
    ["Failed Payments", String(state.revenueSignals.failedPayments), "Payment failures detected"],
    ["Last Payment", state.revenueSignals.lastPaymentTimestamp ? timestampLabel(state.revenueSignals.lastPaymentTimestamp) : "No payment yet", "Most recent successful payment"],
    ["Revenue Status", state.revenueSignals.revenueStatus, `Stripe + Supabase revenue state · ${state.revenueSource}`]
  ];

  revenueSignalsPanel.innerHTML = revenueCards.map(([label, value, hint]) => `
    <article class="card">
      <p class="label">${label}</p>
      <p class="signal-value">${value}</p>
      <p class="hint">${hint}</p>
    </article>
  `).join("");

  const decisionPanel = document.getElementById("decision-panel");
  decisionPanel.innerHTML = `
    <p class="label">Decision Engine</p>
    <h3 class="decision-title">${state.brief.bestNextMove}</h3>
    <div class="decision-metrics">
      <article class="decision-metric">
        <p class="label">Why Now</p>
        <p class="decision-body">${state.brief.whyNow}</p>
      </article>
      <article class="decision-metric">
        <p class="label">Expected Impact</p>
        <p class="decision-body">${state.brief.expectedImpact}</p>
      </article>
    </div>
    <div class="actions">
      <button class="button primary-button" id="decision-execute">Execute Primary Move</button>
      <button class="button button-secondary" id="decision-refresh">Refresh Brief</button>
    </div>
    <div class="decision-footer">
      <span class="badge ${state.operations.some((task) => task.status === "running") ? "running" : "ready"}">
        ${state.operations.some((task) => task.status === "running") ? "Executing" : "Ready"}
      </span>
      <span class="hint">Top opportunity: ${state.brief.marketIntelligence.opportunity}</span>
    </div>
  `;

  document.getElementById("decision-execute").addEventListener("click", () => {
    const nextTask = state.operations.find((task) => task.status === "pending");
    if (nextTask) {
      executeTask(nextTask.id);
    } else {
      appendStream("task_execution_blocked :: no pending task available");
      renderAll();
    }
  });

  document.getElementById("decision-refresh").addEventListener("click", () => generateBrief());

  renderIntelConsole(document.getElementById("intel-stream-panel"), "ARCHAIOS://console");
  renderAgentGrid();
  renderSwarmControlPanel();
}

function renderAgentGrid() {
  const panel = document.getElementById("agent-status-panel");
  panel.innerHTML = AGENTS.map((agent) => {
    const activeTask = state.operations.find((task) => task.assignedAgent === agent.key && task.status !== "completed");
    const status = activeTask ? activeTask.status : "ready";
    return `
      <article class="agent-node">
        <div class="agent-node-header">
          <p class="label">${agent.name}</p>
          <span class="badge ${status}">${status}</span>
        </div>
        <p class="agent-node-value">${activeTask ? activeTask.title : agent.detail}</p>
        <p class="hint">${activeTask ? `Tracking ${activeTask.assignedAgent}` : agent.detail}</p>
      </article>
    `;
  }).join("");
}

function renderSwarmControlPanel() {
  const panel = document.getElementById("swarm-control-panel");
  panel.innerHTML = [
    ["Total Agents", String(state.swarm.totalAgents), "Registered across the self-replicating swarm"],
    ["Active Agents", String(state.swarm.activeAgents), "Currently eligible for task assignment"],
    ["Experiments Running", String(state.swarm.experimentsRunning), "Live experiment loops in motion"],
    [
      "Top Performers",
      state.swarm.topPerformers.map((agent) => `${agent.name} (${agent.score})`).join(" / "),
      "Best-performing agents prioritized first"
    ],
    [
      "Revenue Per Agent",
      state.swarm.revenuePerAgent.map((agent) => `${agent.name}: ${formatCurrency(agent.revenue)}`).join(" / "),
      "Latest revenue impact by agent"
    ],
    [
      "Safety Controls",
      `MAX_AGENTS ${state.swarm.maxAgents} / MAX_TASKS_PER_AGENT ${state.swarm.maxTasksPerAgent}`,
      "Runaway execution prevention limits"
    ]
  ].map(([label, value, hint]) => `
    <article class="card">
      <p class="label">${label}</p>
      <p class="signal-value">${value}</p>
      <p class="hint">${hint}</p>
    </article>
  `).join("");
}

function renderViews() {
  ["overview", "intelligence", "decision", "operations", "saved", "settings"].forEach((key) => {
    const map = {
      Overview: "overview",
      Intelligence: "intelligence",
      "Decision Engine": "decision",
      Operations: "operations",
      "Saved Briefs": "saved",
      Settings: "settings"
    };
    document.getElementById(`${key}-view`).classList.toggle("hidden", map[state.activeView] !== key);
  });

  document.getElementById("intelligence-view-panel").textContent = [
    `Mission Mode: ${state.brief.missionMode}`,
    "",
    state.brief.overview,
    "",
    "Mission Priorities:",
    ...state.brief.priorities.map((priority, index) => `${index + 1}. ${priority}`)
  ].join("\n");

  document.getElementById("decision-view-panel").innerHTML = `
    <p class="label">Best Next Move</p>
    <h3 class="decision-title">${state.brief.bestNextMove}</h3>
    <div class="decision-metrics">
      <article class="decision-metric">
        <p class="label">Why Now</p>
        <p class="decision-body">${state.brief.whyNow}</p>
      </article>
      <article class="decision-metric">
        <p class="label">Expected Impact</p>
        <p class="decision-body">${state.brief.expectedImpact}</p>
      </article>
    </div>
  `;

  document.getElementById("market-intel-view-panel").textContent = [
    "Market Intelligence",
    "",
    `Opportunity: ${state.brief.marketIntelligence.opportunity}`,
    `Threat: ${state.brief.marketIntelligence.threat}`,
    `Recommendation: ${state.brief.marketIntelligence.recommendation}`,
    "Status: Ready"
  ].join("\n");

  renderOperationsBoard();
  renderSavedBriefs();
  renderIntelConsole(document.getElementById("operations-stream-panel"), "ARCHAIOS://ops");

  document.getElementById("settings-panel").textContent = [
    "GitHub Pages Runtime",
    "",
    "Source: docs/index.html",
    "State: docs/app.js",
    "Style: docs/styles.css",
    "Revenue: configure body[data-revenue-summary-url] or Supabase body data attrs",
    "",
    "This static dashboard mirrors the live ARCHAIOS command interface."
  ].join("\n");
}

function renderOperationsBoard() {
  const board = document.getElementById("operations-board");
  board.innerHTML = state.operations.length
    ? state.operations.map((task) => `
        <article class="card operation-card">
          <p class="label">Task ${task.id}</p>
          <p class="value">${task.title}</p>
          <p class="hint">Assigned Agent: ${task.assignedAgent}</p>
          <p class="hint">Priority: ${task.priority}</p>
          <p class="hint">Created: ${timestampLabel(task.createdAt)}</p>
          <p class="hint">Completed: ${task.completedAt ? timestampLabel(task.completedAt) : "Awaiting completion"}</p>
          <div class="actions">
            <span class="badge ${task.status}">${task.status}</span>
            <button class="button" ${task.status !== "pending" ? "disabled" : ""} data-task="${task.id}">
              ${task.status === "pending" ? "Execute" : task.status === "running" ? "Running" : "Completed"}
            </button>
          </div>
          <p class="hint">Result: ${task.status === "completed" ? task.result : "Awaiting execution"}</p>
        </article>
      `).join("")
    : `<article class="card"><p class="label">ARCHAIOS Operations Board</p><p class="hint">Generate a brief to create executable operations.</p></article>`;

  board.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => executeTask(button.dataset.task));
  });
}

function renderSavedBriefs() {
  const panel = document.getElementById("saved-briefs-panel");
  panel.innerHTML = state.savedBriefs.length
    ? state.savedBriefs.map((saved) => `
        <article class="card">
          <p class="label">Saved Brief</p>
          <p class="hint">${timestampLabel(saved.savedAt)}</p>
          <p class="hint">${saved.missionMode}</p>
          <p class="hint">${saved.overview.split("\n")[0]}</p>
          <div class="actions">
            <button class="button" data-load="${saved.id}">Load</button>
            <button class="button button-secondary" data-delete="${saved.id}">Delete</button>
          </div>
        </article>
      `).join("")
    : `<article class="card"><p class="label">Saved Briefs</p><p class="hint">No saved briefs yet.</p></article>`;

  panel.querySelectorAll("[data-load]").forEach((button) => {
    button.addEventListener("click", () => loadSavedBrief(button.dataset.load));
  });
  panel.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSavedBrief(button.dataset.delete));
  });
}

function renderIntelConsole(container, prompt) {
  container.innerHTML = `
    <div class="terminal-header">Intel Stream</div>
    <div class="console-prompt">${prompt}</div>
    ${state.intelStream.map((line) => `<div class="stream-line">${line}</div>`).join("")}
  `;
}

function timestampLabel(value) {
  return new Date(value).toLocaleString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function readSavedBriefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeSavedBrief(entry)) : [];
  } catch {
    return [];
  }
}

function writeSavedBriefs(savedBriefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBriefs));
}
