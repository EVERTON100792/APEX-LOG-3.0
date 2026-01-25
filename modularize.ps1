$c = Get-Content index.html
$out = @()
$out += $c[0..37]
$out += '<link rel="stylesheet" href="css/style.css">'
$out += $c[1749..2549]
$out += $c[2593..3483]
$out += $c[3509..3509]
$out += $c[3554..3554]
$out += '<script src="js/script.js"></script>'
$out += $c[10351..10453]
$out += '<script type="module" src="js/init.js"></script>'
$out += $c[10793..($c.Count-1)]
$out | Set-Content index_modularized.html
Write-Host "Modularized file created with lines: " $out.Count
