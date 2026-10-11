# CarbonChain

Decentralized carbon-credit marketplace (AWS hackathon). Tokenised credits, burn-on-retire to stop double counting, satellite-gated escrow, and AI evidence checks.

- **Frontend:** `main.html` + `app.js` + `styles.css` + `config.js` + `mock-data.js` (static; open `main.html` or host on S3/Amplify)
- **Backend (AWS):** API Gateway (HTTP API) → Lambda (`lambda_function.py`) → DynamoDB (`database.py`), S3 (`s3_service.py`), Bedrock
- **Contract:** `CarbonChainToken.sol` (ERC-1155, not deployed yet)
- **Infra:** `infra/template.yaml` (CloudFormation) and `infra/deploy.ps1`

## Run the demo
Open `main.html`. Accounts: `buyer@demo.com` / `seller@demo.com`, password `Demo@1234`, 2FA `123456`.

### Demo mode vs AWS mode
| | Demo mode (default) | AWS mode |
|---|---|---|
| Trigger | `API_URL` empty in `config.js` | `API_URL` set (`deploy.ps1` does it) |
| Data | Fixtures in `mock-data.js`: 8 projects, a 15-sale history, the buyer's portfolio and tokens, escrow states, bounty results, security events | Projects, users and orders come from DynamoDB; fixtures remain as the fallback if the API is unreachable |
| AI | Built-in answers (or a Groq key typed into the app) | Verde chat and evidence scans go through Bedrock |
| UI cue | An amber **DEMO DATA** pill and footer | Hidden |

Purchases, retirements, escrow unlocks and watchlist changes persist in the browser (`localStorage`, key `cc_demo_state`) so reloads stay consistent. The footer's **Reset demo data** link returns to the seeded baseline. All people, companies and wallets in the fixtures are fictional.

## Deploy the AWS backend
```powershell
aws login
.\infra\deploy.ps1 -Region ap-south-1 -ModelId "<Bedrock model or inference-profile ID>"
```
This deploys the stack, seeds demo projects, and writes the API URL into `config.js`.

Planned region: **ap-south-1 (Mumbai)** with the India in-country Claude profile (e.g. `in.anthropic.claude-sonnet-5`). Confirm it exists in your account first: `aws bedrock list-inference-profiles --region ap-south-1 --type-equals SYSTEM_DEFINED`. `deploy.ps1` still defaults to `us-east-1`, so pass `-Region` explicitly.

## Docs
- [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md): architecture, status, known gaps, AWS roadmap
- [docs/BEGINNERS_GUIDE.md](docs/BEGINNERS_GUIDE.md): plain-English tour of every feature
