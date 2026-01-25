$files = @(
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\index.html",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\script.js",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\freight_logic.js"
)

$replacements = @{
    'Ã¡' = 'á'; 'Ã ' = 'à'; 'Ã¢' = 'â'; 'Ã£' = 'ã';
    'Ã©' = 'é'; 'Ãª' = 'ê';
    'Ã­' = 'í';
    'Ã³' = 'ó'; 'Ã´' = 'ô'; 'Ãµ' = 'õ';
    'Ãº' = 'ú'; 'Ã¼' = 'ü';
    'Ã§' = 'ç';
    'Ã°' = 'º'; 'Âº' = 'º';
    'Ã' = 'Á'; 'Ã€' = 'À'; 'Ã‚' = 'Â'; 'Ãƒ' = 'Ã';
    'Ã‰' = 'É'; 'ÃŠ' = 'Ê';
    'Ã' = 'Í';
    'Ã“' = 'Ó'; 'Ã”' = 'Ô'; 'Ã•' = 'Õ';
    'Ãš' = 'Ú';
    'Ã‡' = 'Ç';
    'Â' = ''; # Non-breaking space artifact often appearing alone
    'mÂ³' = 'm³'; # Specific fix for cubic meters if above didn't catch it
    'AtÃ©' = 'Até';
    'VeÃ­culo' = 'Veículo';
    'PrevisÃ£o' = 'Previsão';
    'AnÃ¡lises' = 'Análises';
    'ConfiguraÃ§Ãµes' = 'Configurações';
    'MÃ¡x' = 'Máx';
    'MÃ­n' = 'Mín';
    'NÃ£o' = 'Não';
    'CÃ¡lculo' = 'Cálculo';
}

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        foreach ($key in $replacements.Keys) {
            $content = $content.Replace($key, $replacements[$key])
        }
        
        $content | Set-Content $file -Encoding UTF8
        Write-Host "Fixed encoding in $file"
    }
}
