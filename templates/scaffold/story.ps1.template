# story-cli workflow (Windows PowerShell)
# Usage: .\story.ps1 <command> [options]

param(
  [string]$Command = "help",
  [string]$Title = "",
  [string]$Type = "original",
  [string]$Lang = "zh",
  [string]$Message = "chore: update stories",
  [string]$Format = "epub",
  [string]$File = "",
  [string]$Source = "",
  [string]$Target = ""
)

function Show-Help {
  Write-Host "story-cli workflow (PowerShell)"
  Write-Host "  init / new -Title 'x' / build / commit / push / epub / export / import / stats / link / validate / clean"
}

switch ($Command) {
  "help"  { Show-Help }
  "init"  { story init }
  "build" { story build }
  "stats" { story stats }
  "clean" { Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue }
  "new" {
    if (-not $Title) { Write-Error "Usage: .\story.ps1 new -Title 'My Story'"; exit 1 }
    story new $Title --type=$Type --lang=$Lang
    story build
  }
  "epub" {
    if (-not $Title) { story epub --all } else { story epub $Title }
  }
  "export" { story export $Format }
  "import" {
    if (-not $File) { Write-Error "Usage: .\story.ps1 import -File path.json"; exit 1 }
    story import json $File
  }
  "link" {
    if (-not $Source -or -not $Target) { Write-Error "Usage: .\story.ps1 link -Source 'A' -Target 'B'"; exit 1 }
    story link $Source $Target
  }
  "validate" { story validate }
  "commit" {
    story build
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { git commit -m $Message }
  }
  "push" {
    story build
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { git commit -m $Message }
    git push
  }
  default { Show-Help }
}