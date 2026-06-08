from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto('http://localhost:3000')
    page.wait_for_selector('text=Zenith Nihongo', timeout=5000)

    # Check if the guest token auto-login happens, if so, we need to clear local storage and reload
    try:
        page.evaluate("() => localStorage.clear()")
        page.reload()
    except:
        pass

    page.wait_for_timeout(2000)

    try:
        # Click user profile or auth button to trigger auth modal
        page.click('text=Profile', timeout=3000)
        page.wait_for_timeout(1000)
    except:
        pass

    page.screenshot(path='/home/jules/verification/verify_auth.png')
    browser.close()
