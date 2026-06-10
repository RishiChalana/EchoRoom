# EchoRoom — Development Roadmap

## Build Tiers

### MVP — Weeks 1–6
Core pipeline working end-to-end. A user can speak for 5 minutes and receive a report.

- [x] Foundation: Docker, FastAPI, PostgreSQL, Redis, Next.js
- [ ] TranscriptAgent (faster-whisper + VAD)
- [ ] EngagementClassifierAgent (fine-tuned distilbert)
- [ ] ClarityAnalyzerAgent (GPT-4o-mini + instructor)
- [ ] OrchestratorAgent (Redis pub/sub aggregation)
- [ ] WebSocket endpoint
- [ ] Frontend: AudioCapture + MetricsSidebar + AvatarGrid
- [ ] CoachAgent (LangGraph 4-node pipeline)
- [ ] SessionReport UI

### V1 — Weeks 7–9
Full agent suite + evaluation framework.

- [ ] QuestionSynthesizerAgent
- [ ] CriticAgent (self-correction loop)
- [ ] RetentionPredictorAgent (rules-based)
- [ ] MemoryAgent (PostgreSQL cross-session)
- [ ] Benchmark dataset v1.0 (100 labeled segments)
- [ ] Evaluation dashboard (/internal/eval)
- [ ] G-Eval question quality metric
- [ ] NLI faithfulness scoring (offline)
- [ ] GitHub Actions CI/CD

### V2 — Weeks 10–11
Live deployed system.

- [ ] GCP Cloud Run deployment
- [ ] Nginx WebSocket proxying
- [ ] Prometheus metrics (5 key metrics)
- [ ] Grafana dashboard
- [ ] Rate limiting + cost caps
- [ ] ChromaDB cross-session memory

### Research Edition — Week 12+
Research-grade evaluation and analysis.

- [ ] Calibration curves + ECE measurement
- [ ] LLM-as-judge human validation
- [ ] Temperature scaling
- [ ] Agent benchmarking leaderboard
- [ ] UMAP improvement visualization
- [ ] HuggingFace model card
- [ ] Public benchmark dataset

---

## Weekly Milestones

| Week | Milestone Tag | Deliverable |
|------|--------------|-------------|
| 1 | `v0.1-foundation` | Docker + health endpoints |
| 2 | `v0.2-engagement-model` | Fine-tuned distilbert |
| 3 | `v0.3-clarity-pipeline` | ClarityAgent + event routing |
| 4 | `v0.4-websocket` | WebSocket integration |
| 5 | `v0.5-coach-agent` | LangGraph pipeline |
| 6 | `v0.6-frontend-mvp` | Full end-to-end demo |
| 7 | `v0.7-full-agents` | All agents + CriticAgent |
| 8 | `v0.8-eval-framework` | Benchmark + eval dashboard |
| 9 | `v1.0-production` | Live at public URL |
| 10 | `v1.1-research` | Calibration + judge validation |
| 11 | `v1.2-final` | Portfolio-ready |
