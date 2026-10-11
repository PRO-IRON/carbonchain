# Deploys the CarbonChain backend. Run from the repo root:
#   .\infra\deploy.ps1 -ModelId "<bedrock model or inference profile id>"
# Prerequisites: `aws login` done, region us-east-1 (or pass -Region), `pip install boto3`.
param(
    [string]$Region = "us-east-1",
    [string]$ModelId = "",
    [string]$StackName = "carbonchain"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Checking AWS identity..." -ForegroundColor Cyan
$account = aws sts get-caller-identity --query Account --output text --region $Region
if ($LASTEXITCODE -ne 0 -or -not $account) { throw "Not logged in. Run 'aws login' first." }
Write-Host "Account $account, region $Region"

# 1. Package Lambda code
$zip = Join-Path $env:TEMP "carbonchain-lambda.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "lambda_function.py", "database.py", "s3_service.py" -DestinationPath $zip
$key = "lambda/carbonchain-" + (Get-Date -Format "yyyyMMddHHmmss") + ".zip"

# 2. Artifact bucket (idempotent)
$artifactBucket = "carbonchain-artifacts-$account-$Region"
aws s3api head-bucket --bucket $artifactBucket --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating artifact bucket $artifactBucket"
    if ($Region -eq "us-east-1") { aws s3api create-bucket --bucket $artifactBucket --region $Region | Out-Null }
    else { aws s3api create-bucket --bucket $artifactBucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null }
}
aws s3 cp $zip "s3://$artifactBucket/$key" --region $Region | Out-Null

# 3. Deploy stack
Write-Host "Deploying CloudFormation stack '$StackName'..." -ForegroundColor Cyan
aws cloudformation deploy `
    --stack-name $StackName `
    --template-file infra/template.yaml `
    --capabilities CAPABILITY_IAM `
    --region $Region `
    --parameter-overrides CodeBucket=$artifactBucket CodeKey=$key BedrockModelId=$ModelId
if ($LASTEXITCODE -ne 0) { throw "CloudFormation deploy failed - see events above." }

$apiUrl = aws cloudformation describe-stacks --stack-name $StackName --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# 4. Seed demo data
Write-Host "Seeding demo data..." -ForegroundColor Cyan
$env:AWS_REGION = $Region
python -m pip install boto3 --quiet
python infra/seed.py

# 5. Point the frontend at the API
if (Test-Path "config.js") {
    (Get-Content config.js -Raw) -replace "API_URL:\s*'[^']*'", "API_URL: '$apiUrl'" | Set-Content config.js -Encoding utf8
    Write-Host "config.js updated with API_URL" -ForegroundColor Green
}

Write-Host ""
Write-Host "API URL: $apiUrl" -ForegroundColor Green
Write-Host "Test:    curl $apiUrl/api/projects"
