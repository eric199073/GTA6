#requires -Version 7.0
param([int]$Radius = 48, [int]$Throttle = 8)
$ErrorActionPreference = 'Stop'
$mapData = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'markers.js') -Raw -Encoding utf8) -replace '^\s*window\.GTA6_MARKERS\s*=\s*', '' -replace ';\s*$', '' | ConvertFrom-Json -Depth 100
$tileRoot = Join-Path $PSScriptRoot '高清图块'
$existing = [Collections.Generic.HashSet[string]]::new()
foreach ($level in 4..6) {
    $dir = Join-Path $tileRoot "$level"
    [IO.Directory]::CreateDirectory($dir) | Out-Null
    Get-ChildItem -LiteralPath $dir -Filter '*.jpg' | ForEach-Object { [void]$existing.Add($_.BaseName) }
}
$wanted = [Collections.Generic.HashSet[string]]::new()
$bounds = $mapData.map.tiles.nativeBounds
foreach ($marker in $mapData.markers) {
    foreach ($level in 4..6) {
        $size = 256 / [Math]::Pow(2, $level - 1)
        $factor = [Math]::Pow(2, 6 - $level)
        $x0 = [int][Math]::Max([Math]::Floor(($marker.position.x - $Radius + 256) / $size), [Math]::Floor($bounds[0] / $factor))
        $x1 = [int][Math]::Min([Math]::Floor(($marker.position.x + $Radius + 256) / $size), [Math]::Floor($bounds[2] / $factor))
        $y0 = [int][Math]::Max([Math]::Floor(($marker.position.y - $Radius + 256) / $size), [Math]::Floor($bounds[1] / $factor))
        $y1 = [int][Math]::Min([Math]::Floor(($marker.position.y + $Radius + 256) / $size), [Math]::Floor($bounds[3] / $factor))
        for ($y = $y0; $y -le $y1; $y++) { for ($x = $x0; $x -le $x1; $x++) { [void]$wanted.Add("$level,$y,$x") } }
    }
}
$requests = @($wanted | Where-Object { -not $existing.Contains($_) })
Write-Output "Missing local tiles: $($requests.Count)"
$failures = @($requests | ForEach-Object -Parallel {
    $key = $_
    $level = $key.Split(',')[0]
    $destination = Join-Path (Join-Path $using:tileRoot $level) "$key.jpg"
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ("gta6-tile-" + [Guid]::NewGuid().ToString('N') + '.jpg')
    $ok = $false
    try {
        for ($attempt = 0; $attempt -lt 3 -and -not $ok; $attempt++) {
            try {
                Invoke-WebRequest -Uri "https://www.gtabase.com/images/gta-6/maps/tiles/in-game/$level/$key.jpg" -OutFile $temporary -TimeoutSec 20
                $bytes = [IO.File]::ReadAllBytes($temporary)
                if ($bytes.Length -lt 4 -or $bytes[0] -ne 255 -or $bytes[1] -ne 216 -or $bytes[-2] -ne 255 -or $bytes[-1] -ne 217) { throw 'Invalid JPEG response' }
                [IO.File]::Copy($temporary, $destination, $true)
                $ok = $true
            } catch { if ($attempt -eq 2) { Write-Output $key } }
        }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
} -ThrottleLimit $Throttle)
$keys = @(Get-ChildItem -LiteralPath $tileRoot -Filter '*.jpg' -Recurse | Where-Object { $_.BaseName -match '^[4-6],\d+,\d+$' } | ForEach-Object BaseName | Sort-Object -Unique)
$manifest = 'window.GTA6_LOCAL_TILES = ' + (ConvertTo-Json -InputObject $keys -Compress) + ';' + [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'tiles-manifest.js'), $manifest)
Write-Output "Local manifest tiles: $($keys.Count)"
if ($failures.Count) { throw "Could not cache $($failures.Count) tiles: $($failures -join ' ')" }
