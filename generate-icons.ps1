# Script para converter SVG para PNG (opcional)
# Requer: npm install -g svgexport

Write-Host "Gerando ícones PNG para PWA..." -ForegroundColor Green

# Verifica se svgexport está instalado
$svgexport = Get-Command svgexport -ErrorAction SilentlyContinue

if (-not $svgexport) {
    Write-Host "Instalando svgexport..." -ForegroundColor Yellow
    npm install -g svgexport
}

# Converte SVG para PNG
Write-Host "Convertendo icon-192.svg..." -ForegroundColor Cyan
svgexport public/icon-192.svg public/icon-192.png 192:192

Write-Host "Convertendo icon-512.svg..." -ForegroundColor Cyan
svgexport public/icon-512.svg public/icon-512.png 512:512

Write-Host "✅ Ícones PNG gerados com sucesso!" -ForegroundColor Green
Write-Host "Arquivos criados:" -ForegroundColor Yellow
Write-Host "  - public/icon-192.png" -ForegroundColor Gray
Write-Host "  - public/icon-512.png" -ForegroundColor Gray
