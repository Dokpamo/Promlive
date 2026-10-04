param(
  [Parameter(Mandatory=$true)][string]$App,
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][string]$Run,
  [int]$Case = 1
)
$ErrorActionPreference = 'Stop'
if ((Split-Path $App -Leaf) -ne 'PromliveBenchmark.exe') { throw 'Use the isolated PromlivePerformanceBuild executable.' }
if ($Run -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid run name.' }
$Telemetry = Join-Path $Root ($Run + '.jsonl')
if (Test-Path $Telemetry) { throw 'Run already exists.' }
if (!(Test-Path (Join-Path $env:LOCALAPPDATA 'PromliveBenchmark/storyloom.sqlite'))) { throw 'Copy the matrix fixture into the isolated benchmark directory first.' }
$Config = @{
  run=$Run; screen='chat'; chatId=('perf-{0:d5}' -f $Case); anchorSequence=10000;
  autoScroll=$true; startDelayMs=4500;
  tuning=@{messagePage=16; messageCharacters=16000; retainedCharacters=64000; renderWindow=5; renderBatch=4};
  phases=@(@{ms=6000; speed=-2500}, @{ms=4000; speed=2500}, @{ms=6000; speed=-2500})
}
[System.IO.File]::WriteAllText((Join-Path $Root 'config.json'), ($Config | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
$Process = Start-Process -FilePath (Resolve-Path $App) -PassThru
$Snapshots = @()
try {
  $Deadline = (Get-Date).AddSeconds(60)
  $Done = $false
  while ((Get-Date) -lt $Deadline) {
    Start-Sleep -Seconds 1
    $Process.Refresh()
    if ($Process.HasExited) { throw 'Benchmark exited before completing.' }
    $Snapshots += @{at=(Get-Date).ToUniversalTime().ToString('o'); cpuSeconds=$Process.TotalProcessorTime.TotalSeconds; workingSetBytes=$Process.WorkingSet64}
    if (Test-Path $Telemetry) {
      $Latest = Get-Content $Telemetry -Tail 1 | ConvertFrom-Json
      if ($Latest.done) { $Done=$true; break }
    }
  }
  if (!$Done) { throw 'Benchmark timed out; preserve logs and inspect the UI.' }
} finally {
  $Snapshots | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Root ($Run + '-process.json'))
  if (!$Process.HasExited) { Stop-Process -Id $Process.Id }
}
