from PIL import Image, ImageDraw, ImageOps
import sys

def make_pro_icon(input_path, output_path, size=(1024, 1024)):
    # 1. Create Canvas
    # macOS icons are 1024x1024
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    # 2. Draw White Squircle Background
    # Standard macOS corner radius is approx 18-22% of dimension
    radius = size[0] * 0.2237  # Precise curvature tweak
    
    # Draw rounded rect (white background)
    # We use a slight inset to ensure anti-aliasing doesn't touch edge
    draw.rounded_rectangle([(0,0), size], radius=radius, fill=(255, 255, 255, 255))
    
    # 3. Load & Process Logo
    try:
        logo = Image.open(input_path).convert("RGBA")
    except Exception as e:
        print(f"Error: {e}")
        return

    # Resize logo to have padding (Fixing "icon size")
    # Standard icon content is ~80% of the squircle
    target_logo_size = int(size[0] * 0.70) # 70% size for nice breathing room
    
    # Maintain aspect ratio
    logo.thumbnail((target_logo_size, target_logo_size), Image.Resampling.LANCZOS)
    
    # Center the logo
    bg_w, bg_h = size
    img_w, img_h = logo.size
    offset = ((bg_w - img_w) // 2, (bg_h - img_h) // 2)
    
    # 4. Composite
    # If the logo has a white background, we might want to multiply?
    # But usually logos provided are transparent or we just paste them.
    # If the user's logo is white-bg, pasting it on white-bg is fine.
    # If user's logo is black on white, it stays black on white squircle.
    canvas.paste(logo, offset, mask=logo if logo.mode == 'RGBA' else None)
    
    # 5. Save
    canvas.save(output_path, "PNG")
    print(f"Created professional icon at {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 make_squircle.py input output")
    else:
        make_pro_icon(sys.argv[1], sys.argv[2])
