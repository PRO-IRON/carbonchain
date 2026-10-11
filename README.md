# CarbonChain

Decentralized carbon-credit marketplace (AWS hackathon). Tokenised credits, burn-on-retire to stop double counting, satellite-gated escrow, and AI evidence checks.

- **Frontend:** `main.html` + `app.js` + `styles.css` + `config.js` (static; open `main.html` or host on S3/Amplify)
- **Backend (AWS):** API Gateway (HTTP API) → Lambda (`lambda_function.py`) → DynamoDB (`database.py`), S3 (`s3_service.py`), Bedrock
- **Contract:** `CarbonChainToken.sol` (ERC-1155, not deployed yet)
- **Infra:** `infra/template.yaml` (CloudFormation) and `infra/deploy.ps1`

## Run the demo
Open `main.html`. Accounts: `buyer@demo.com` / `seller@demo.com`, password `Demo@1234`, 2FA `123456`.
With no `API_URL` in `config.js` the app runs entirely on built-in demo data.

## Deploy the AWS backend
```powershell
aws login
.\infra\deploy.ps1 -ModelId "<Bedrock model or inference-profile ID>"
```
This deploys the stack, seeds demo projects, and writes the API URL into `config.js`.

## Docs
- [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md): architecture, status, known gaps, AWS roadmap
- [docs/BEGINNERS_GUIDE.md](docs/BEGINNERS_GUIDE.md): plain-English tour of every feature
