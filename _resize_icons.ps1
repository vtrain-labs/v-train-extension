Add-Type -AssemblyName System.Drawing

$src = 'd:\UDATA\Kevin\Desktop\VT\icon.png'
$original = [System.Drawing.Image]::FromFile($src)

$sizes = @(16, 48, 128)
foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($original, 0, 0, $size, $size)
    $g.Dispose()
    $outPath = "d:\UDATA\Kevin\Desktop\VT\icon-$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved: $outPath"
}
$original.Dispose()
Write-Host "All icons generated successfully!"
