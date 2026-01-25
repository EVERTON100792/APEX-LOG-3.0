$path = "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0"
$s = Get-Content "$path\js\script.js" -TotalCount 6901
$f = Get-Content "$path\js\freight_logic.js"
$final = $s + $f
$final | Set-Content "$path\js\script.js" -Encoding UTF8
