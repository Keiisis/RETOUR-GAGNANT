<#
.SYNOPSIS
    Auto-scan du projet Retour Gagnant pour générer un rapport contextuel.
    Usage : .\prepare_session.ps1
    Résultat : Affiche un résumé du projet dans la console.
#>

$ProjectRoot = "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE"
$Now = Get-Date -Format "yyyy-MM-dd HH:mm"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " RETOUR GAGNANT — Scan de session" -ForegroundColor Yellow
Write-Host " $Now" -ForegroundColor Gray
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Git status
Write-Host "[1/5] Git Status" -ForegroundColor Green
Set-Location $ProjectRoot
$gitStatus = git diff --stat HEAD 2>$null
if ($gitStatus) {
    $modifiedCount = ($gitStatus | Select-String "file" | ForEach-Object { $_.ToString() -match '(\d+) file' | Out-Null; $matches[1] }) 
    Write-Host "  📁 $modifiedCount fichiers modifies non commites" -ForegroundColor Yellow
    git diff --stat HEAD | Select-Object -Last 1
} else {
    Write-Host "  ✅ Workspace propre" -ForegroundColor Green
}
Write-Host ""

# 2. TypeScript Mobile
Write-Host "[2/5] TypeScript Mobile" -ForegroundColor Green
Set-Location "$ProjectRoot\mobile"
$tscResult = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ 0 erreur TypeScript" -ForegroundColor Green
} else {
    $errorCount = ($tscResult | Select-String "error TS").Count
    Write-Host "  ❌ $errorCount erreurs TypeScript" -ForegroundColor Red
    $tscResult | Select-String "error TS" | Select-Object -First 5 | ForEach-Object {
        Write-Host "     $_" -ForegroundColor Red
    }
}
Write-Host ""

# 3. CLAUDE.md status
Write-Host "[3/5] Memoire (CLAUDE.md)" -ForegroundColor Green
$claudeMd = Get-Content "$ProjectRoot\CLAUDE.md" -Raw -ErrorAction SilentlyContinue
if ($claudeMd) {
    $done = ([regex]::Matches($claudeMd, "- ✅")).Count
    $todo = ([regex]::Matches($claudeMd, "⬜")).Count  
    $inProgress = ([regex]::Matches($claudeMd, "⏳")).Count
    $total = $done + $todo + $inProgress
    $pct = if ($total -gt 0) { [math]::Round(($done / $total) * 100) } else { 0 }
    Write-Host "  📊 Progression : $done/$total taches ($pct%)" -ForegroundColor Cyan
    Write-Host "  ✅ Terminees   : $done" -ForegroundColor Green
    Write-Host "  ⬜ Restantes   : $todo" -ForegroundColor Yellow
    if ($inProgress -gt 0) {
        Write-Host "  ⏳ En cours    : $inProgress" -ForegroundColor Magenta
    }
} else {
    Write-Host "  ⚠️ CLAUDE.md introuvable !" -ForegroundColor Red
}
Write-Host ""

# 4. Expo config
Write-Host "[4/5] Config Expo" -ForegroundColor Green
$appJson = Get-Content "$ProjectRoot\mobile\app.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
if ($appJson) {
    $scheme = $appJson.expo.scheme
    $version = $appJson.expo.version
    Write-Host "  📱 Version     : $version" -ForegroundColor Cyan
    Write-Host "  🔗 Deep link   : $scheme://" -ForegroundColor Cyan
    if ($scheme -eq "retourgagnant") {
        Write-Host "  ✅ Scheme OK" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Scheme incorrect (attendu: retourgagnant)" -ForegroundColor Red
    }
}
Write-Host ""

# 5. URLs incorrectes
Write-Host "[5/5] Verification URLs" -ForegroundColor Green
$badUrls = Get-ChildItem "$ProjectRoot\mobile\src" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "retour-gagnant\.com" -SimpleMatch
if ($badUrls) {
    Write-Host "  ❌ $($badUrls.Count) URLs incorrectes trouvees (retour-gagnant.com)" -ForegroundColor Red
    $badUrls | ForEach-Object {
        Write-Host "     $($_.Filename):$($_.LineNumber)" -ForegroundColor Red
    }
} else {
    Write-Host "  ✅ Toutes les URLs pointent vers retourgagnantbenin.bj" -ForegroundColor Green
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Scan termine. Pret a coder !" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Retour au root
Set-Location $ProjectRoot
