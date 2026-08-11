param(
  [string]$ScreenshotDirectory = 'C:\Users\raine\Desktop\Screenshots'
)

Add-Type -AssemblyName System.Drawing

$mobileRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $mobileRoot 'store-assets\phone'
$backgroundPath = Join-Path $outputDirectory 'promo-background-source.png'

$darkResultsPath = Join-Path $ScreenshotDirectory '90aa6162-3377-460a-a1ff-58560c012193.jpg'
$historyPath = Join-Path $ScreenshotDirectory '0984a869-b2ff-4845-9e61-a781fe976f65.jpg'
$picksPath = Join-Path $ScreenshotDirectory 'a339fc7f-4ac4-4142-ae56-36096fb3a4b1.jpg'
$lightResultsPath = Join-Path $ScreenshotDirectory 'a659d2ab-6d24-4ceb-8607-aaad7f9aa1fa.jpg'
$analysisPath = Join-Path $ScreenshotDirectory 'c9995a53-5b97-4b88-82d4-3a993aa127f0.jpg'

$requiredPaths = @(
  $backgroundPath,
  $darkResultsPath,
  $historyPath,
  $picksPath,
  $lightResultsPath,
  $analysisPath
)

foreach ($path in $requiredPaths) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required image not found: $path"
  }
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-CoverImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [System.Drawing.Rectangle]$Destination
  )

  $sourceRatio = $Image.Width / $Image.Height
  $destinationRatio = $Destination.Width / $Destination.Height

  if ($sourceRatio -gt $destinationRatio) {
    $sourceHeight = $Image.Height
    $sourceWidth = [int]($sourceHeight * $destinationRatio)
    $sourceX = [int](($Image.Width - $sourceWidth) / 2)
    $sourceY = 0
  } else {
    $sourceWidth = $Image.Width
    $sourceHeight = [int]($sourceWidth / $destinationRatio)
    $sourceX = 0
    $sourceY = [int](($Image.Height - $sourceHeight) / 2)
  }

  $source = [System.Drawing.Rectangle]::new($sourceX, $sourceY, $sourceWidth, $sourceHeight)
  $Graphics.DrawImage($Image, $Destination, $source, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Header {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Headline,
    [string]$Description
  )

  $headlineFont = [System.Drawing.Font]::new('Segoe UI', 60, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $descriptionFont = [System.Drawing.Font]::new('Segoe UI', 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 222, 233, 248))
  $format = [System.Drawing.StringFormat]::new()
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord

  try {
    $Graphics.DrawString($Headline, $headlineFont, $whiteBrush, [System.Drawing.RectangleF]::new(68, 60, 944, 88), $format)
    $Graphics.DrawString($Description, $descriptionFont, $mutedBrush, [System.Drawing.RectangleF]::new(72, 164, 936, 96), $format)
  } finally {
    $headlineFont.Dispose()
    $descriptionFont.Dispose()
    $whiteBrush.Dispose()
    $mutedBrush.Dispose()
    $format.Dispose()
  }
}

function Draw-ScreenshotFrame {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Screenshot,
    [int]$X = 177,
    [int]$Y = 336,
    [int]$Height = 1530
  )

  $width = [int][Math]::Round($Height * $Screenshot.Width / $Screenshot.Height)
  $shadowRectangle = [System.Drawing.RectangleF]::new($X + 15, $Y + 19, $width, $Height)
  $frameRectangle = [System.Drawing.RectangleF]::new($X, $Y, $width, $Height)
  $shadowPath = New-RoundedRectanglePath -Rectangle $shadowRectangle -Radius 32
  $framePath = New-RoundedRectanglePath -Rectangle $frameRectangle -Radius 32
  $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(125, 0, 0, 0))
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 255, 255, 255), 3)
  $savedState = $Graphics.Save()

  try {
    $Graphics.FillPath($shadowBrush, $shadowPath)
    $Graphics.SetClip($framePath)
    $Graphics.DrawImage($Screenshot, $X, $Y, $width, $Height)
    $Graphics.Restore($savedState)
    $Graphics.DrawPath($borderPen, $framePath)
  } finally {
    $shadowPath.Dispose()
    $framePath.Dispose()
    $shadowBrush.Dispose()
    $borderPen.Dispose()
  }
}

function New-LightDarkComposite {
  param(
    [System.Drawing.Image]$LightImage,
    [System.Drawing.Image]$DarkImage
  )

  $width = 1080
  $height = 2285
  $composite = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($composite)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $darkClip = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $darkClip.AddPolygon(@(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(735, 0),
    [System.Drawing.Point]::new(390, $height),
    [System.Drawing.Point]::new(0, $height)
  ))

  try {
    $graphics.DrawImage($LightImage, 0, 0, $width, $height)
    $state = $graphics.Save()
    $graphics.SetClip($darkClip)
    $graphics.DrawImage($DarkImage, 0, 0, $width, $height)
    $graphics.Restore($state)

    $dividerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235, 255, 207, 66), 10)
    $graphics.DrawLine($dividerPen, 735, 0, 390, $height)
    $dividerPen.Dispose()
  } finally {
    $darkClip.Dispose()
    $graphics.Dispose()
  }

  return $composite
}

function Add-ModePill {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [int]$X,
    [int]$Y
  )

  $font = [System.Drawing.Font]::new('Segoe UI', 19, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $pillRectangle = [System.Drawing.RectangleF]::new($X, $Y, 116, 48)
  $pillPath = New-RoundedRectanglePath -Rectangle $pillRectangle -Radius 24
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(225, 4, 21, 42))
  $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  try {
    $Graphics.FillPath($brush, $pillPath)
    $Graphics.DrawString($Text, $font, $textBrush, $pillRectangle, $format)
  } finally {
    $font.Dispose()
    $pillPath.Dispose()
    $brush.Dispose()
    $textBrush.Dispose()
    $format.Dispose()
  }
}

function Export-PromoScreenshot {
  param(
    [System.Drawing.Image]$Screenshot,
    [string]$Headline,
    [string]$Description,
    [string]$OutputName,
    [switch]$ShowModeLabels
  )

  $canvas = [System.Drawing.Bitmap]::new(1080, 1920)
  $canvas.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $background = [System.Drawing.Image]::FromFile($backgroundPath)
  $overlayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40, 0, 0, 0))

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    Draw-CoverImage -Graphics $graphics -Image $background -Destination ([System.Drawing.Rectangle]::new(0, 0, 1080, 1920))
    $graphics.FillRectangle($overlayBrush, 0, 0, 1080, 320)
    Draw-Header -Graphics $graphics -Headline $Headline -Description $Description
    Draw-ScreenshotFrame -Graphics $graphics -Screenshot $Screenshot

    $outputPath = Join-Path $outputDirectory $OutputName
    $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output $outputPath
  } finally {
    $overlayBrush.Dispose()
    $background.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

$darkResults = [System.Drawing.Image]::FromFile($darkResultsPath)
$lightResults = [System.Drawing.Image]::FromFile($lightResultsPath)
$history = [System.Drawing.Image]::FromFile($historyPath)
$picks = [System.Drawing.Image]::FromFile($picksPath)
$analysis = [System.Drawing.Image]::FromFile($analysisPath)
$lightDarkComposite = New-LightDarkComposite -LightImage $lightResults -DarkImage $darkResults

try {
  Export-PromoScreenshot `
    -Screenshot $lightDarkComposite `
    -Headline 'RESULTS, YOUR WAY' `
    -Description 'Browse the latest draws in light or dark mode.' `
    -OutputName '01-results-light-dark-1080x1920.png' `
    -ShowModeLabels

  Export-PromoScreenshot `
    -Screenshot $history `
    -Headline 'EXPLORE EVERY DRAW' `
    -Description 'Open any game to browse recent results and winning numbers.' `
    -OutputName '02-result-history-1080x1920.png'

  Export-PromoScreenshot `
    -Screenshot $picks `
    -Headline 'SAVE PICKS. CHECK RESULTS.' `
    -Description 'Keep your combinations ready and compare them with published draws.' `
    -OutputName '03-save-and-check-picks-1080x1920.png'

  Export-PromoScreenshot `
    -Screenshot $analysis `
    -Headline 'EXPLORE DRAW PATTERNS' `
    -Description 'View frequencies, trends, gaps and fresh random combinations.' `
    -OutputName '04-draw-analysis-1080x1920.png'
} finally {
  $lightDarkComposite.Dispose()
  $darkResults.Dispose()
  $lightResults.Dispose()
  $history.Dispose()
  $picks.Dispose()
  $analysis.Dispose()
}
