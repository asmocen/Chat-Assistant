# Windows 快捷同步脚本
# 用法: .\scripts\sync.ps1 [status|pull|push|sync]

param(
    [ValidateSet('status', 'pull', 'push', 'sync')]
    [string]$Action = 'sync'
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot
node scripts/git-sync.mjs $Action
