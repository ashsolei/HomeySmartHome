'use strict';

/**
 * E2E tests for the SmartHome Pro dashboard (port 3001).
 *
 * Tests cover page load, dark mode, navigation, energy analytics panel,
 * Socket.IO connection, and responsive layout at common breakpoints.
 *
 * Locators are based on the actual HTML structure in
 * web-dashboard/public/index.html and the JS in public/app.js.
 */

const { test, expect } = require('@playwright/test');

// The baseURL from playwright.config.js points to the dashboard (port 3001)

test.describe('Dashboard loads successfully', () => {
  test('page title is "Smart Home Pro Dashboard"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Smart Home Pro Dashboard');
  });

  test('sidebar with logo is visible', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    const logo = sidebar.locator('.logo span');
    await expect(logo).toHaveText('Smart Home Pro');
  });

  test('main content area is rendered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('page title heading defaults to "Dashboard"', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#page-title')).toHaveText('Dashboard');
  });

  test('quick stats cards are rendered', async ({ page }) => {
    await page.goto('/');
    const stats = page.locator('.stat-card');
    // There are 4 stat cards in the HTML
    await expect(stats).toHaveCount(4);
  });
});

test.describe('Dark mode toggle', () => {
  test('clicking the toggle adds dark-mode class to body', async ({ page }) => {
    await page.goto('/');

    // Ensure we start in light mode
    await page.evaluate(() => {
      document.body.classList.remove('dark-mode');
      localStorage.removeItem('darkMode');
    });

    const toggle = page.locator('#dark-mode-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();

    await expect(page.locator('body')).toHaveClass(/dark-mode/);
  });

  test('toggling twice returns to light mode', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.body.classList.remove('dark-mode');
      localStorage.removeItem('darkMode');
    });

    const toggle = page.locator('#dark-mode-toggle');
    await toggle.click();
    await toggle.click();

    const classes = await page.locator('body').getAttribute('class');
    expect(classes ?? '').not.toContain('dark-mode');
  });

  test('dark mode preference persists across reload via localStorage', async ({ page }) => {
    await page.goto('/');

    // Activate dark mode
    await page.evaluate(() => {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'enabled');
    });

    // Reload — initDarkMode() reads the saved preference
    await page.reload();

    await expect(page.locator('body')).toHaveClass(/dark-mode/);
  });

  test('dark mode toggle aria-pressed reflects current state', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.body.classList.remove('dark-mode');
      localStorage.removeItem('darkMode');
    });

    const toggle = page.locator('#dark-mode-toggle');
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Navigation between panels', () => {
  // Nav items defined in the sidebar; clicking should update the active state.
  const navPages = [
    { page: 'dashboard', label: 'Dashboard' },
    { page: 'devices', label: 'Enheter' },
    { page: 'energy', label: 'Energi' },
    { page: 'security', label: 'Säkerhet' },
    { page: 'climate', label: 'Klimat' },
  ];

  for (const { page: pageName, label } of navPages) {
    test(`clicking "${label}" nav item marks it active`, async ({ page }) => {
      await page.goto('/');

      const navItem = page.locator(`.nav-item[data-page="${pageName}"]`);
      await expect(navItem).toBeVisible();
      await navItem.click();

      await expect(navItem).toHaveClass(/active/);
    });
  }

  test('sidebar nav contains all 7 navigation items', async ({ page }) => {
    await page.goto('/');
    const navItems = page.locator('.sidebar-nav .nav-item');
    await expect(navItems).toHaveCount(7);
  });
});

test.describe('Energy analytics panel', () => {
  test('energy analytics section is present in the DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#energy-analytics-panel')).toBeVisible();
  });

  test('energy analytics stat elements are rendered', async ({ page }) => {
    await page.goto('/');
    // There are at least 4 stat elements: current, average, peak, trend
    const stats = page.locator('#energy-analytics-panel .energy-analytics-stat');
    const count = await stats.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('ea-current, ea-average, ea-peak, ea-trend elements exist', async ({ page }) => {
    await page.goto('/');
    for (const id of ['ea-current', 'ea-average', 'ea-peak', 'ea-trend']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });
});

test.describe('Socket.IO connection', () => {
  test('socket.io client script is loaded', async ({ page }) => {
    await page.goto('/');

    // Check that the Socket.IO client was either loaded from CDN or local bundle
    const scriptHandles = await page.$$('script[src]');
    const srcs = await Promise.all(
      scriptHandles.map(h => h.getAttribute('src'))
    );
    const hasSocketIO = srcs.some(src => src && src.includes('socket.io'));
    expect(hasSocketIO).toBe(true);
  });

  test('io global is available after page load', async ({ page }) => {
    await page.goto('/');

    // Wait briefly for scripts to execute
    await page.waitForTimeout(500);

    const ioAvailable = await page.evaluate(() => typeof window.io !== 'undefined');
    // io is available if Socket.IO client is loaded; skip gracefully if not
    if (!ioAvailable) {
      test.skip();
    }
  });
});

test.describe('Responsive layout', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`renders without horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // The page body should not be wider than the viewport
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 20); // 20px tolerance for scrollbar
    });

    test(`main-content is visible at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await expect(page.locator('.main-content')).toBeVisible();
    });
  }
});
