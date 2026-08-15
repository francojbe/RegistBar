import os
import sys
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.abspath("docs/ui-audit/screenshots")
os.makedirs(OUTPUT_DIR, exist_ok=True)

TARGET_URL = "https://localhost:3000"

VIEWPORTS = [
    {"name": "mobile_375px", "width": 375, "height": 812, "is_mobile": True},
    {"name": "tablet_768px", "width": 768, "height": 1024, "is_mobile": True},
    {"name": "desktop_1440px", "width": 1440, "height": 900, "is_mobile": False},
]

def run_audit_captures():
    print(f"Starting UI audit capture on {TARGET_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--ignore-certificate-errors", "--allow-insecure-localhost"]
        )

        for vp in VIEWPORTS:
            print(f"Capturing viewport {vp['name']} ({vp['width']}x{vp['height']})...")
            context = browser.new_context(
                viewport={"width": vp["width"], "height": vp["height"]},
                is_mobile=vp["is_mobile"],
                ignore_https_errors=True,
            )
            page = context.new_page()

            try:
                page.goto(TARGET_URL, wait_until="networkidle", timeout=15000)
                time.sleep(1.5) # Wait for animations / fonts

                # Capture Main / Login View
                screenshot_path = os.path.join(OUTPUT_DIR, f"screen_{vp['name']}.png")
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"Saved: {screenshot_path}")

                # If registration toggle is available, click it and capture registration state on mobile
                if vp["width"] == 375:
                    reg_btn = page.locator("button:has-text('Crear Cuenta'), button:has-text('Registrarse'), button:has-text('Crear cuenta')").first
                    if reg_btn and reg_btn.is_visible():
                        reg_btn.click()
                        time.sleep(0.8)
                        reg_path = os.path.join(OUTPUT_DIR, "screen_register_mobile_375px.png")
                        page.screenshot(path=reg_path, full_page=True)
                        print(f"Saved: {reg_path}")

            except Exception as e:
                print(f"Error capturing {vp['name']}: {e}")
            finally:
                context.close()

        browser.close()
    print("Captures completed successfully!")

if __name__ == "__main__":
    run_audit_captures()
