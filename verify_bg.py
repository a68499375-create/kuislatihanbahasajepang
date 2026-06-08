from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto('http://localhost:3000')
    page.wait_for_selector('body', timeout=5000)
    page.screenshot(path='/home/jules/verification/verify_bg.png')
    browser.close()
