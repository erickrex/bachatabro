# Repository Guidelines

## Project Structure & Module Organization
`mobile/` hosts the Expo Router app: screens stay in `app/`, shared logic in `services/`, the ExecuTorch bridge in `modules/executorch/`, and UI in `components/`. Assets live in `mobile/assets/`; Jest suites live in `mobile/__tests__`. `python-tools/` provides the YOLOv8 preprocessing scripts and UV configs that generate choreography data. `backend/functions/` is the FastAPI proxy with routers in `src/` and tests in `tests/`.

## Build, Test, and Development Commands
- `cd mobile && npm install && npx expo start --dev-client` — install dependencies and launch Metro.
- `cd mobile && npm run android|ios` — create dev clients with the ExecuTorch module linked.
- `cd mobile && npm test [-- --coverage]` — run Jest/jest-expo plus integration/property suites.
- `cd python-tools && uv sync && ./setup_models.sh` — install Python deps and refresh `assets/models/pose.pte`.
- `cd python-tools && uv run python preprocess_video_yolov8.py <video>` — emit pose JSON before copying into `mobile/assets/poses`.
- `cd backend/functions && uv sync --dev && uv run uvicorn main:app --reload` / `uv run pytest --cov=src` — run the proxy and tests.

## Coding Style & Naming Conventions
Keep TypeScript strict: typed function components, PascalCase UI files, camelCase hooks/services, and the `@/*` alias instead of deep relative imports. Favor NativeWind utility classes; add StyleSheets only where necessary. Python modules stay type-annotated, split helpers into `src/middleware` or `python-tools/video_tools.py`, and follow FastAPI’s `async def` pattern with concise docstrings.

## Testing Guidelines
Run `npm test -- --coverage` whenever UI or ExecuTorch code changes; regenerate snapshots only for intentional UI updates and rerun `__tests__/device/performance-benchmarks.test.ts` after detection changes. Backend edits require `uv run pytest -v`, which exercises the Hypothesis suites. For preprocessing tweaks, run `uv run pytest python-tools/test_*.py` plus a dry-run of `preprocess_video_yolov8.py` with the bundled samples.

## Commit & Pull Request Guidelines
History follows conventional prefixes (`feat:`, `chore:`, `fix:`), so keep subjects short (<72 chars) and precise. PRs need a summary, linked ticket, screenshots or recordings for UI work, and the verification commands you ran (`npm test`, `uv run pytest`, UV scripts). Call out regenerated assets (pose JSON, `.pte` files) and note the script parameters so reviewers can replay them.

## Security & Configuration Tips
Use `.env` files derived from `.env.example` for ElevenLabs/Gemini keys and never embed secrets in React Native configs. Follow `API_KEY_SECURITY_GUIDE.md` when rotating credentials and route network calls through the backend proxy. Remove temporary pose/video exports before committing and respect `backend/functions/src/middleware/rate_limiter.py` while exercising voice services.
