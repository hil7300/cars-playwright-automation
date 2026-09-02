# set-all-secrets.ps1
$ErrorActionPreference = 'Stop'
$repo = 'cancapgroupinc/cars-playwright-automation'

# --- CONFIGURATION ---
# Set to $true to overwrite existing secrets, $false to skip existing ones
$ForceUpdate = $true 
# ---------------------

$credsPath = Join-Path $PSScriptRoot 'credentials.json'
if (-not (Test-Path $credsPath)) {
    Write-Host "ERROR: credentials.json not found at $credsPath" -ForegroundColor Red
    exit 1
}
$creds = Get-Content -Raw $credsPath | ConvertFrom-Json

$ghCheck = & gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh CLI not authenticated. Run: gh auth login" -ForegroundColor Red
    exit 1
}

$existingSet = @{}
if (-not $ForceUpdate) {
    Write-Host "Fetching existing secrets from $repo ..." -ForegroundColor Cyan
    $existingRaw = & gh secret list --repo $repo --json name --jq '.[].name'
    foreach ($n in $existingRaw) { $existingSet[$n.Trim()] = $true }
    Write-Host ("Found {0} existing secret(s) -- these will be skipped." -f $existingSet.Count) -ForegroundColor Green
} else {
    Write-Host "FORCE UPDATE ENABLED: Existing secrets will be overwritten." -ForegroundColor Magenta
}

function Set-RepoSecret {
    param([string]$name, [string]$value)
    
    if (-not $ForceUpdate -and $existingSet.ContainsKey($name)) {
        Write-Host "  [SKIP] $name (already exists)" -ForegroundColor Yellow
        return
    }
    
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "  [WARN] $name has empty value -- skipping" -ForegroundColor Red
        return
    }

    $value | & gh secret set $name --repo $repo
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [SET]  $name" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $name (exit $LASTEXITCODE)" -ForegroundColor Red
    }
}

# Worker counts per role (same for all envs; missing roles get warned + skipped)
$roleWorkers = [ordered]@{
    'super_admin'    = 3
    'basic_admin'    = 3
    'manager_admin'  = 3
    'bailiff'        = 2
    'client'         = 2
    'api_automation' = 1
}

# Process each environment (dev, stg, prod)
$environments = @('dev', 'stg', 'prod')

foreach ($env in $environments) {
    $envData = $creds.$env
    if (-not $envData) {
        Write-Host ""
        Write-Host "[WARN] No data for environment '$env' in credentials.json -- skipping" -ForegroundColor Yellow
        continue
    }
    
    $upperEnv = $env.ToUpper()
    
    Write-Host ""
    Write-Host "=== Processing $upperEnv environment ===" -ForegroundColor Cyan
    
    # Auth0 credentials (only dev and stg have these in your file)
    if ($envData.auth0_client_id) {
        Write-Host "-- Auth0 credentials --" -ForegroundColor Gray
        Set-RepoSecret -name "CARS_${upperEnv}_AUTH0_CLIENT_ID"     -value $envData.auth0_client_id
        Set-RepoSecret -name "CARS_${upperEnv}_AUTH0_CLIENT_SECRET" -value $envData.auth0_client_secret
    }
    
    # Role-based user credentials
    Write-Host "-- User credentials --" -ForegroundColor Gray
    foreach ($role in $roleWorkers.Keys) {
        $workerCount = $roleWorkers[$role]
        $userList = $envData.$role
        if (-not $userList) {
            Write-Host "  [WARN] No users for role '$role' in $env -- skipping" -ForegroundColor Yellow
            continue
        }
        $upperRole = $role.ToUpper()
        for ($i = 0; $i -lt $workerCount; $i++) {
            $user = $userList[$i % $userList.Count]
            Set-RepoSecret -name "CARS_${upperEnv}_${upperRole}_USERNAME_${i}" -value $user.username
            Set-RepoSecret -name "CARS_${upperEnv}_${upperRole}_PASSWORD_${i}" -value $user.password
        }
    }
}

Write-Host ""
Write-Host "=== Processing Gmail secrets ===" -ForegroundColor Cyan
Set-RepoSecret -name 'GMAIL_USER'         -value $creds.gmail.user
Set-RepoSecret -name 'GMAIL_APP_PASSWORD' -value $creds.gmail.appPassword

Write-Host ""
Write-Host "=== Processing Teams webhook ===" -ForegroundColor Cyan
Set-RepoSecret -name 'TEAMS_WEBHOOK_URL' -value $creds.TEAMS_WEBHOOK_URL

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan