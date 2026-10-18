# Prompt Log

Every prompt the project owner gives is saved here verbatim (typos kept), newest at the bottom.
Format: `## P-### — YYYY-MM-DD — short title`, then the prompt, then what was done.

---

## P-001 — 2026-10-17 — Project kickoff

> we need to work on application that is similar to uber etc and for now goal is midrange and scalable with all necessory features need backend and frontend (website and adroid aPP) that contains user1(actual customers), user2(drivers who join),system admin(only website) and the main part this whole system contains various things and tech stack, scaling, platform controls, pricing by region or area so also many things like getting distance on every trip(like user book for trip a to b where we need to get this for free and then nearest vehicle gets pinged as they can only reject max 3 in that day so if they accept they will come to a then travel to b with customer so here we can cost save using external app google maps even in web and you plan everything what tools are needed etc end to end and we need to think of scaling and schema that supports things region/location,user type,etc in api calls this is you to decide on to design api call schema) so now we have empty repo first research what you need create all necessory documents as truth that will help you then construct the plan use todo and memory(give your own namings) files keep upating readme and save my every prompts too...

**Done:** researched maps/routing costs, wrote `research/`, `docs/` (source of truth), `todo`, `memory/`, `readme.md`, this log.

## P-002 — 2026-10-17 — Continue

> continue

**Done:** resumed after the interruption and finished the P-001 deliverables.

## P-003 — 2026-10-17 — Answers to open questions Q1–Q7

> 1.country will be india and as name suggests its tamil so but we cont specify loc for now so it can be deployed in many cities no hardcoding just check what theme we can use for tamil people and let it keep now english language for now later multi language
> 2.Which vehicle types? (bike, auto, mini, sedan, SUV) this you can get info from other popular app but also our applicatoin will have 2 separate option for within city and long journey.
> 3.they will pay for each trip and also they can get a subscription which they will get more trips so this config can be left to admin.
> 4.he will get a bonus diduction in in the bonus earnings this config left to admin
> 5.yes
> 6.both if they get cash that will auto dedcut in their earnings etc so you can explore the mothod.
> 7 yes "poyalo".

**Done:** research/R3 (competitor vehicle and outstation norms), docs/D10 (Tamil theme + i18n plan). Updated D0, D2, D3, D4, D5, D6, R2, memory, todo, readme. Added DEC-013..018.

## P-004 — 2026-10-17 — Start P0

> ok go ahead

**Done:** see the P0 section in `todo` and SESSION_LOG S-001.

## P-005 — 2026-10-17 — Run without Docker; use local Redis

> for now run without docker as dev and here is redis you can use(its extension and check we can configure)..
> [screenshot: Redis Insight "Edit Redis database": Standalone, host 127.0.0.1, port 6379, no username/password, no TLS]

**Done:** see SESSION_LOG.

## P-006 — 2026-10-18 — Move to VPS: push to GitHub, make the repo resumable, use Docker Hub

> we have vps and we will move repo their so push "https://github.com/anandkaman/poyalo.git" we need to continue so make sure readme can be useful to new agent their(make sure porperly resumed now we can have everything in dockerhub so..)

**Done:** CLAUDE.md (agent handbook, auto-loaded) + readme "Start here", API Dockerfile + compose `app` profile, ports bound to localhost for VPS safety, memory/todo updated, first commit pushed to GitHub.
