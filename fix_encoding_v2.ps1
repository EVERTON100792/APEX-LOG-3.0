$files = @(
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\index.html",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\script.js",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\freight_logic.js"
)

function Replace-InFile {
    param ($Content, $Old, $New)
    return $Content.Replace($Old, $New)
}

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        # Lowercase vowels
        $content = $content.Replace('Ã¡', 'á')
        $content = $content.Replace('Ã ', 'à')
        $content = $content.Replace('Ã¢', 'â')
        $content = $content.Replace('Ã£', 'ã')
        $content = $content.Replace('Ã©', 'é')
        $content = $content.Replace('Ãª', 'ê')
        $content = $content.Replace('Ã­', 'í')
        $content = $content.Replace('Ã³', 'ó')
        $content = $content.Replace('Ã´', 'ô')
        $content = $content.Replace('Ãµ', 'õ')
        $content = $content.Replace('Ãº', 'ú')
        $content = $content.Replace('Ã¼', 'ü')
        $content = $content.Replace('Ã§', 'ç')
        
        # Uppercase vowels
        $content = $content.Replace('Ã€', 'À')
        $content = $content.Replace('Ã‚', 'Â')
        $content = $content.Replace('Ãƒ', 'Ã')
        $content = $content.Replace('Ã‰', 'É')
        $content = $content.Replace('ÃŠ', 'Ê')
        $content = $content.Replace('Ã ', 'Í')
        $content = $content.Replace('Ã“', 'Ó')
        $content = $content.Replace('Ã”', 'Ô')
        $content = $content.Replace('Ã•', 'Õ')
        $content = $content.Replace('Ãš', 'Ú')
        $content = $content.Replace('Ã‡', 'Ç')
        
        # Symbols
        $content = $content.Replace('Ã°', 'º')
        $content = $content.Replace('Âº', 'º')
        $content = $content.Replace('Â', '') # Remove phantom A-circumflex (NBSP artifact)
        
        # Common Words (just in case single chars missed or for double-safety)
        $content = $content.Replace('AtÃ©', 'Até')
        $content = $content.Replace('VeÃ­culo', 'Veículo')
        $content = $content.Replace('AnÃ¡lises', 'Análises')
        $content = $content.Replace('ConfiguraÃ§Ãµes', 'Configurações')
        $content = $content.Replace('MÃ¡x', 'Máx')
        $content = $content.Replace('MÃ­n', 'Mín')
        $content = $content.Replace('NÃ£o', 'Não')
        $content = $content.Replace('CÃ¡lculo', 'Cálculo')
        $content = $content.Replace('mÂ³', 'm³')
        $content = $content.Replace('mÃ³', 'm³')

        $content | Set-Content $file -Encoding UTF8
        Write-Host "Fixed $file"
    } else {
        Write-Host "File not found: $file"
    }
}
