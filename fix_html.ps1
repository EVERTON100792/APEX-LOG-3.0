$path = "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\index.html"
$content = Get-Content $path -Encoding UTF8
$endIndex = 0
for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -match "</html>") {
        $endIndex = $i
        break
    }
}

if ($endIndex -gt 0) {
    $cleanContent = $content[0..$endIndex]
    $cleanContent | Set-Content $path -Encoding UTF8
    Write-Host "File cleaned. Ends at line $($endIndex + 1)"
}
else {
    Write-Host "Could not find </html> tag."
}
