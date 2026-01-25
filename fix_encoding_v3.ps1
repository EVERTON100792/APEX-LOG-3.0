$files = @(
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\index.html",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\script.js",
    "c:\Users\Everton Moura\Documents\GitHub\APEX-LOG-3.0\js\freight_logic.js"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        # Ã© -> é (C3 A9)
        $content = $content.Replace(([char]0xC3 + [char]0xA9), "é")
        # Ã¡ -> á (C3 A1)
        $content = $content.Replace(([char]0xC3 + [char]0xA1), "á")
        # Ã  -> à (C3 A0)
        $content = $content.Replace(([char]0xC3 + [char]0xA0), "à")
        # Ã¢ -> â (C3 A2)
        $content = $content.Replace(([char]0xC3 + [char]0xA2), "â")
        # Ã£ -> ã (C3 A3)
        $content = $content.Replace(([char]0xC3 + [char]0xA3), "ã")
        # Ãª -> ê (C3 AA)
        $content = $content.Replace(([char]0xC3 + [char]0xAA), "ê")
        # Ã­ -> í (C3 AD)
        $content = $content.Replace(([char]0xC3 + [char]0xAD), "í")
        # Ã³ -> ó (C3 B3)
        $content = $content.Replace(([char]0xC3 + [char]0xB3), "ó")
        # Ã´ -> ô (C3 B4)
        $content = $content.Replace(([char]0xC3 + [char]0xB4), "ô")
        # Ãµ -> õ (C3 B5)
        $content = $content.Replace(([char]0xC3 + [char]0xB5), "õ")
        # Ãº -> ú (C3 FA)
        $content = $content.Replace(([char]0xC3 + [char]0xFA), "ú")
        # Ã§ -> ç (C3 A7)
        $content = $content.Replace(([char]0xC3 + [char]0xA7), "ç")
        
        # Uppercase
        # Ãƒ -> Ã (C3 83)
        $content = $content.Replace(([char]0xC3 + [char]0x83), "Ã")
        # Ã‡ -> Ç (C3 87)
        $content = $content.Replace(([char]0xC3 + [char]0x87), "Ç")
        # ÃŠ -> Ê (C3 8A)
        $content = $content.Replace(([char]0xC3 + [char]0x8A), "Ê")
        
        # Special cases observed
        # Âº -> º (C2 BA)
        $content = $content.Replace(([char]0xC2 + [char]0xBA), "º")
        # Ã° -> º (C3 B0 is °, degree sign, sometimes confused)
        $content = $content.Replace(([char]0xC3 + [char]0xB0), "º")
        
        # Artifacts
        # Â (C2) - often followed by space (A0) for NBSP, or just rogue char
        # We replace "Â " (NBSP) with regular space " "
        $content = $content.Replace(([char]0xC2 + " "), " ")
        # Remove rogue Â if it's not part of a sequence we already fixed? 
        # Risky, but commonly required. Let's fix specific double-encoded UTF-8 first:
        
        # mÂ³ -> m³
        $content = $content.Replace("m" + [char]0xC2 + [char]0xB3, "m³")
        
        $content | Set-Content $file -Encoding UTF8
        Write-Host "Fixed $file"
    }
}
