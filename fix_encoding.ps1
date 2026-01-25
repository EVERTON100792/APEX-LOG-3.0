# Script para corrigir codificação (mojibake) nos arquivos do ApexLog
# Este script deve ser executado no PowerShell

$files = @(
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\index.html",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\script.js",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\freight_logic.js"
)

# Lista de pares (Antigo, Novo)
$map = @(
    @('Ã¡', 'á'), @('Ã ', 'à'), @('Ã¢', 'â'), @('Ã£', 'ã'),
    @('Ã©', 'é'), @('Ãª', 'ê'), @('Ã­', 'í'),
    @('Ã³', 'ó'), @('Ã´', 'ô'), @('Ãµ', 'õ'),
    @('Ãº', 'ú'), @('Ã¼', 'ü'), @('Ã§', 'ç'),
    @('Ã€', 'À'), @('Ã‚', 'Â'), @('Ãƒ', 'Ã'),
    @('Ã‰', 'É'), @('ÃŠ', 'Ê'), @('Ã ', 'Í'),
    @('Ã“', 'Ó'), @('Ã”', 'Ô'), @('Ã•', 'Õ'),
    @('Ãš', 'Ú'), @('Ã‡', 'Ç'),
    @('Ã°', 'º'), @('Âº', 'º'), @('mÂ³', 'm³'), @('mÃ³', 'm³'),
    @('AtÃ©', 'Até'), @('VeÃ­culo', 'Veículo'), @('AnÃ¡lises', 'Análises'),
    @('ConfiguraÃ§Ãµes', 'Configurações'), @('MÃ¡x', 'Máx'), @('MÃ­n', 'Mín'),
    @('NÃ£o', 'Não'), @('CÃ¡lculo', 'Cálculo')
)

foreach ($filePath in $files) {
    if (Test-Path $filePath) {
        Write-Host "Processando: $filePath"
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        foreach ($pair in $map) {
            $old = $pair[0]
            $new = $pair[1]
            $content = $content.Replace($old, $new)
        }
        
        # Limpeza final de caracteres fantasmas comum em UTF-8 mal interpretado
        $content = $content.Replace('Â', '')

        $content | Set-Content $filePath -Encoding UTF8
        Write-Host "Sucesso: $filePath"
    } else {
        Write-Host "Erro: Arquivo não encontrado - $filePath"
    }
}
