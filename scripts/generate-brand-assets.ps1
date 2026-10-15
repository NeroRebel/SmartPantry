$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# One geometric master, rendered at 2x and downsampled for clean alpha edges.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class SmartPantryBrand {
    private static GraphicsPath Rounded(float x, float y, float w, float h, float r) {
        var p = new GraphicsPath();
        float d = r * 2;
        p.AddArc(x, y, d, d, 180, 90);
        p.AddArc(x + w - d, y, d, d, 270, 90);
        p.AddArc(x + w - d, y + h - d, d, d, 0, 90);
        p.AddArc(x, y + h - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    private static void Mark(Graphics g, Color color, float scale) {
        g.TranslateTransform(512, 512);
        g.ScaleTransform(scale, scale);
        g.TranslateTransform(-512, -512);
        using (var brush = new SolidBrush(color)) {
            using (var lid = Rounded(362, 282, 300, 52, 26)) g.FillPath(brush, lid);
            using (var body = Rounded(294, 374, 436, 370, 94)) {
                // An actual transparent hole, shared by color and monochrome exports.
                using (var inside = Rounded(344, 424, 336, 270, 44)) body.AddPath(inside, false);
                body.FillMode = FillMode.Alternate;
                g.FillPath(brush, body);
            }
            using (var leaf = new GraphicsPath()) {
                leaf.AddBezier(432, 638, 420, 536, 490, 476, 594, 476);
                leaf.AddBezier(594, 476, 610, 574, 540, 638, 432, 638);
                leaf.CloseFigure();
                g.FillPath(brush, leaf);
            }
        }
        g.ResetTransform();
    }

    private static void Export(string path, string kind) {
        using (var large = new Bitmap(2048, 2048, PixelFormat.Format32bppArgb)) {
            using (var g = Graphics.FromImage(large)) {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.ScaleTransform(2, 2);
                if (kind == "icon" || kind == "background") {
                    using (var fill = new LinearGradientBrush(new Rectangle(0, 0, 1024, 1024),
                        Color.FromArgb(11, 11, 11), Color.FromArgb(22, 15, 10), 90f))
                        g.FillRectangle(fill, 0, 0, 1024, 1024);
                }
                if (kind != "background") {
                    // Keep the adaptive symbol inside Android's central 66/108 safe circle.
                    float size = kind == "icon" ? 1.48f : 1.10f;
                    g.ResetTransform();
                    g.ScaleTransform(2, 2);
                    Mark(g, kind == "monochrome" ? Color.White : Color.FromArgb(255, 138, 0), size);
                }
            }
            bool opaque = kind == "icon" || kind == "background";
            using (var image = new Bitmap(1024, 1024, opaque ? PixelFormat.Format24bppRgb : PixelFormat.Format32bppArgb)) {
                using (var g = Graphics.FromImage(image)) {
                    g.Clear(opaque ? Color.FromArgb(11, 11, 11) : Color.Transparent);
                    g.CompositingMode = opaque ? CompositingMode.SourceOver : CompositingMode.SourceCopy;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    using (var attributes = new ImageAttributes()) {
                        attributes.SetWrapMode(WrapMode.TileFlipXY);
                        g.DrawImage(large, new Rectangle(0, 0, 1024, 1024), 0, 0, 2048, 2048, GraphicsUnit.Pixel, attributes);
                    }
                }
                image.Save(path, ImageFormat.Png);
            }
        }
    }

    public static void Generate(string directory) {
        Directory.CreateDirectory(directory);
        Export(Path.Combine(directory, "icon.png"), "icon");
        Export(Path.Combine(directory, "android-icon-foreground.png"), "foreground");
        Export(Path.Combine(directory, "android-icon-background.png"), "background");
        Export(Path.Combine(directory, "android-icon-monochrome.png"), "monochrome");
        Export(Path.Combine(directory, "splash-icon.png"), "splash");
    }
}
'@

[SmartPantryBrand]::Generate((Join-Path $PSScriptRoot '../assets/images'))
Write-Output 'Generated five 1024x1024 SmartPantry PNG assets.'
