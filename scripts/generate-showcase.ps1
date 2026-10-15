param([string[]]$SourceFiles)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Composite the original screenshots; no generated or reconstructed UI.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;

public static class SmartPantryShowcase {
    static readonly string[] Names = { "home", "inventory", "recipes", "statistics", "shopping-list", "more", "scanner" };
    static readonly Color Background = Color.FromArgb(11, 11, 13);
    static readonly Color Orange = Color.FromArgb(255, 107, 61);

    static GraphicsPath Round(float x, float y, float w, float h, float r) {
        var p = new GraphicsPath(); float d = r * 2;
        p.AddArc(x, y, d, d, 180, 90); p.AddArc(x+w-d, y, d, d, 270, 90);
        p.AddArc(x+w-d, y+h-d, d, d, 0, 90); p.AddArc(x, y+h-d, d, d, 90, 90);
        p.CloseFigure(); return p;
    }
    static void Fill(Graphics g, Color color, float x, float y, float w, float h, float r) {
        using (var brush = new SolidBrush(color)) using (var shape = Round(x,y,w,h,r)) g.FillPath(brush, shape);
    }
    static void Text(Graphics g, string text, float size, Color color, float x, float y, bool bold = false, bool centered = false) {
        using (var font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel))
        using (var brush = new SolidBrush(color)) {
            if (centered) x -= g.MeasureString(text, font, Int32.MaxValue, StringFormat.GenericTypographic).Width / 2;
            g.DrawString(text, font, brush, x, y, StringFormat.GenericTypographic);
        }
    }
    static Graphics Canvas(Bitmap bitmap, bool transparent = false) {
        var g = Graphics.FromImage(bitmap);
        g.Clear(transparent ? Color.Transparent : Background);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        return g;
    }
    static float Phone(Graphics g, string source, float x, float y, float width, bool shadow = true) {
        float bezel = width * 0.028f, innerWidth = width - 2 * bezel;
        float innerHeight = innerWidth * 2.2f, height = innerHeight + 2 * bezel;
        float radius = width * 0.13f;
        if (shadow) for (int i = 5; i > 0; i--)
            Fill(g, Color.FromArgb(12, 0, 0, 0), x-i*3, y+14-i, width+i*6, height+i*4, radius+i*3);
        Fill(g, Color.FromArgb(63,63,68), x-3, y+height*.20f, 5, width*.12f, 2);
        Fill(g, Color.FromArgb(63,63,68), x+width-2, y+height*.24f, 5, width*.20f, 2);
        Fill(g, Color.FromArgb(63,63,68), x,y,width,height,radius);
        Fill(g, Color.FromArgb(25,25,28), x+1.5f,y+1.5f,width-3,height-3,radius-1.5f);
        Fill(g, Color.Black, x+bezel,y+bezel,innerWidth,innerHeight,radius-bezel);
        var saved = g.Save();
        using (var clip = Round(x+bezel,y+bezel,innerWidth,innerHeight,radius-bezel)) g.SetClip(clip);
        using (var screenshot = Image.FromFile(source)) {
            float scale = Math.Min(innerWidth/screenshot.Width, innerHeight/screenshot.Height);
            float w = screenshot.Width*scale, h = screenshot.Height*scale;
            using (var attributes = new ImageAttributes()) {
                attributes.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(screenshot, Rectangle.Round(new RectangleF(x+bezel+(innerWidth-w)/2, y+bezel+(innerHeight-h)/2, w,h)),
                    0,0,screenshot.Width,screenshot.Height,GraphicsUnit.Pixel,attributes);
            }
        }
        g.Restore(saved);
        return height;
    }

    public static void Import(string[] files, string directory) {
        if (files.Length != 7) throw new ArgumentException("Supply Home, Inventory, Recipes, Statistics, Shopping List, More, Scanner in that order.");
        Directory.CreateDirectory(directory);
        for (int i=0; i<files.Length; i++) {
            using (var image = new Bitmap(files[i])) {
                if (Names[i] == "more") {
                    // Irreversible redaction in the public copy; original attachment is untouched.
                    using (var g = Graphics.FromImage(image)) {
                        using (var fill = new SolidBrush(image.GetPixel(94,151))) g.FillRectangle(fill,92,126,220,22);
                        Fill(g, Color.FromArgb(72,72,76),96,134,140,5,2);
                    }
                }
                image.Save(Path.Combine(directory,Names[i]+".png"),ImageFormat.Png);
            }
        }
    }

    public static void Generate(string sources, string output) {
        Directory.CreateDirectory(output);
        string framed = Path.Combine(output,"framed"); Directory.CreateDirectory(framed);
        Func<string,string> source = name => Path.Combine(sources,name+".png");
        using (var hero = new Bitmap(2400,1350,PixelFormat.Format24bppRgb)) {
            using (var g = Canvas(hero)) {
                Fill(g, Orange, 1160,70,80,5,2);
                Text(g,"SmartPantry",112,Color.White,1200,99,true,true);
                Text(g,"Offline-first pantry manager",38,Color.FromArgb(171,171,179),1200,240,false,true);
                Text(g,"Pantry    /    Scanner    /    Recipes    /    Sync",24,Orange,1200,315,false,true);
                Phone(g,source("home"),367,398,394);
                Phone(g,source("inventory"),841,458,344);
                Phone(g,source("recipes"),1265,458,344);
                Phone(g,source("shopping-list"),1689,458,344);
                Text(g,"SMARTPANTRY",15,Color.FromArgb(126,126,135),120,1283,true);
                Text(g,"Android app / Real screen captures",18,Color.FromArgb(126,126,135),1830,1279);
            }
            hero.Save(Path.Combine(output,"smartpantry-hero.png"),ImageFormat.Png);
        }
        using (var grid = new Bitmap(2400,1840,PixelFormat.Format24bppRgb)) {
            using (var g = Canvas(grid)) {
                Text(g,"SmartPantry",52,Color.White,120,50,true);
                Fill(g,Orange,120,119,66,4,2);
                Text(g,"APP SCREENSHOTS",19,Color.FromArgb(155,155,165),2030,76,true);
                string[] order={"home","inventory","recipes","statistics","shopping-list","more"};
                float[] xs={408,1032,1656,408,1032,1656};
                for(int i=0;i<order.Length;i++) {
                    float top=i<3 ? 168 : 1010;
                    float height=Phone(g,source(order[i]),xs[i],top,336);
                    Text(g,"0"+(i+1),18,Orange,xs[i],top+height+25,true);
                    string label=order[i]=="shopping-list" ? "Shopping List" : char.ToUpper(order[i][0])+order[i].Substring(1);
                    Text(g,label,26,Color.FromArgb(225,225,230),xs[i]+40,top+height+19,true);
                }
                Text(g,"Real Android captures. More screen email redacted for privacy.",18,Color.FromArgb(126,126,135),1200,1790,false,true);
            }
            grid.Save(Path.Combine(output,"smartpantry-screenshots.png"),ImageFormat.Png);
        }
        foreach(var name in Names) {
            using(var bitmap=new Bitmap(454,960,PixelFormat.Format32bppArgb)) {
                using(var g=Canvas(bitmap,true)) Phone(g,source(name),20,22,414,false);
                bitmap.Save(Path.Combine(framed,name+".png"),ImageFormat.Png);
            }
        }
    }
}
'@

$root = Split-Path $PSScriptRoot -Parent
$sources = Join-Path $root 'docs/images/screenshots'
$output = Join-Path $root 'docs/images'
if ($SourceFiles) { [SmartPantryShowcase]::Import($SourceFiles, $sources) }
[SmartPantryShowcase]::Generate($sources, $output)
Write-Output 'Exported SmartPantry hero, six-screen grid, and seven transparent phone frames.'
