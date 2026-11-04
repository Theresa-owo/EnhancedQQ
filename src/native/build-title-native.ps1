#requires -Version 7.0
param(
    [Parameter(Mandatory)][string]$VCToolsRoot,
    [Parameter(Mandatory)][string]$WindowsSdkRoot,
    [Parameter(Mandatory)][string]$WindowsSdkVersion,
    [Parameter(Mandatory)][string]$NodeHeaders,
    [switch]$TestBuild
)

$ErrorActionPreference = 'Stop'
$native = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent $native)
$vendor = Join-Path $native 'vendor\minhook'
$work = Join-Path $root 'dist\native-build'
$compiler = Join-Path $VCToolsRoot 'bin\Hostx64\x64\cl.exe'
foreach ($required in @($compiler, (Join-Path $NodeHeaders 'node_api.h'), (Join-Path $vendor 'include\MinHook.h'))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing build input: $required" }
}

$sdkInclude = Join-Path $WindowsSdkRoot "Include\$WindowsSdkVersion"
$sdkLib = Join-Path $WindowsSdkRoot "Lib\$WindowsSdkVersion"
$env:INCLUDE = @((Join-Path $VCToolsRoot 'include'), (Join-Path $sdkInclude 'ucrt'), (Join-Path $sdkInclude 'shared'), (Join-Path $sdkInclude 'um')) -join ';'
$env:LIB = @((Join-Path $VCToolsRoot 'lib\x64'), (Join-Path $sdkLib 'ucrt\x64'), (Join-Path $sdkLib 'um\x64')) -join ';'
New-Item -ItemType Directory -Path $work -Force | Out-Null
$output = if ($TestBuild) { Join-Path $work 'title-whitelist-test.node' } else { Join-Path $native 'title-whitelist.node' }
$compilerArgs = @('/nologo', '/EHsc', '/O2', '/MT', '/LD', "/I$(Join-Path $vendor 'include')", "/I$NodeHeaders")
if ($TestBuild) { $compilerArgs += '/DENHANCEDQQ_TESTING' }
$compilerArgs += @((Join-Path $native 'title-whitelist.cpp'), (Join-Path $vendor 'src\buffer.c'),
    (Join-Path $vendor 'src\hook.c'), (Join-Path $vendor 'src\trampoline.c'), (Join-Path $vendor 'src\hde\hde64.c'),
    '/link', "/OUT:$output")
Push-Location $work
try {
    & $compiler @compilerArgs
    if ($LASTEXITCODE -ne 0) { throw "Native build failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
Write-Output "Built $output"
