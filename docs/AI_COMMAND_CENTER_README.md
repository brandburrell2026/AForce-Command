# AForce OS AI Command Center — the full organization

22 specialist agents plus doctrine, installable as Claude Code project subagents. This is the org chart from the AI Operating Team plan, adapted to AForce's real stack and loaded with this repo's paid-for lessons.

## Org chart

**Executive:** ceo (orchestrator — start every new initiative here) · cto (technical authority)

**Build:** principal-architect · react-native-engineer · backend-engineer · ml-engineer · ui-designer

**Quality & Security:** code-reviewer (every PR) · qa-automation-engineer · cybersecurity-engineer

**Operate:** devops-engineer · sre · mobile-release-manager

**Product & Insight:** product-manager · ux-researcher · data-scientist · business-intelligence · performance-scientist

**Run the business:** scrum-master · documentation-engineer · customer-support · revenue-guardian (AForce-specific addition — money-path integrity had no owner in the original chart)

## Install

From the repo root: create `.claude/agents/` and copy every .md file here (except this README) into it, then commit. Claude Code detects them within seconds — no restart. Or just tell Claude Code: "Install these agent files into .claude/agents/ and commit." Committing them means the whole team travels with the repo into every future session.

## How work flows

New feature or initiative → **ceo** produces the plan and routes: principal-architect specs it → product-manager writes stories → engineers build → code-reviewer + qa-automation-engineer gate the merge → mobile-release-manager or devops-engineer ships → sre watches it live → data-scientist and business-intelligence measure it. scrum-master keeps the state of everything; documentation-engineer keeps the record true. You don't have to invoke anyone by name — descriptions are written for automatic delegation — but you can ("have cybersecurity-engineer review this").

## Adaptations from the original plan (deliberate, revisit when reality changes)

1. **Models:** the plan proposed GPT-5.5/Claude/Gemini per role. This team runs entirely in Claude Code (that's what makes it installable, not a diagram). Frontmatter supports per-agent `model:` pinning if you later want cost tiers.
2. **Stack:** agents encode the real stack (Expo/RN 0.81.5, Node api-server, Vercel, Railway, Neon, Clerk, RevenueCat, Stripe, Shopify). The plan's AWS/Cloudflare/Redis/Datadog stack is written into devops-engineer and sre as a roadmap evaluation with named triggers, not pretended into existence.
3. **Customer Support:** drafts, KB, and triage today; the live in-app support bot is a product feature to build when wanted (route through ceo).
4. **HIPAA:** cybersecurity-engineer's honest read — almost certainly not applicable, and we never claim compliance we don't hold; re-evaluate if partnerships change the picture.

## Constitution (binds every agent)

Never merge red. scoringEngine.ts and statusColor.ts are Brandon-only. Secrets never in tracked files; exposed credentials are compromised by definition. Displayed price = charged price. No medical claims, ever. Branch → PR → green → merge. Human-only actions: credential rotation, App Review submission, refunds, live price changes, and anything touching the two protected files.

## Maintenance

These files are living doctrine. When a lesson is paid for, add it to the relevant agent the same session. When facts change (version bump, completed migration, new pricing), update the agent — a stale doctrine file is a confident liar.
