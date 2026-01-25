$path = "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\index.html"
$content = Get-Content $path -Encoding UTF8
$line = $content | Select-String "CÃ¡lculo" -Context 0, 0
if ($line) {
    $str = $line.Line.Trim()
    Write-Host "Found string: $str"
    foreach ($char in $str.ToCharArray()) {
        Write-Host "$char : $([int]$char)"
    }
}
else {
    Write-Host "String not found"
}
