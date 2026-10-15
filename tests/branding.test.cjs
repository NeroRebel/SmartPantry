const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const config = require('../app.json').expo;

const read = (name) => PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets/images', name + '.png')));

test('production brand assets are 1024 square with correct transparency', () => {
  for (const name of ['icon', 'android-icon-background', 'android-icon-foreground', 'android-icon-monochrome', 'splash-icon']) {
    const png = read(name);
    assert.equal(png.width, 1024); assert.equal(png.height, 1024);
    const opaque = name === 'icon' || name === 'android-icon-background';
    let solid = 0;
    for (let i = 3; i < png.data.length; i += 4) {
      if (opaque) assert.equal(png.data[i], 255, `${name} must be opaque`);
      if (png.data[i] === 255) solid++;
    }
    assert.ok(solid > 20000);
    if (!opaque) {
      assert.equal(png.data[3], 0);
      assert.equal(png.data[(512 * 1024 + 512) * 4 + 3], 255);
    }
  }
});

test('adaptive foreground and monochrome share a mask within the Android safe circle', () => {
  const foreground = read('android-icon-foreground');
  const mono = read('android-icon-monochrome');
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4;
      assert.equal(foreground.data[i + 3], mono.data[i + 3]);
      if (mono.data[i + 3]) {
        assert.ok(Math.hypot(x - 511.5, y - 511.5) < 1024 * 33 / 108);
        assert.equal(mono.data[i], mono.data[i + 1]);
        assert.equal(mono.data[i], mono.data[i + 2]);
      }
      if (mono.data[i + 3] === 255) assert.equal(mono.data[i], 255);
    }
  }
});

test('native configuration uses SmartPantry assets and black splash instead of Expo starter branding', () => {
  assert.equal(config.ios.icon, config.icon);
  assert.equal(config.android.adaptiveIcon.backgroundColor, '#0B0B0B');
  const splash = config.plugins.find((entry) => entry[0] === 'expo-splash-screen')[1];
  assert.equal(splash.backgroundColor, '#0B0B0B');
  assert.equal(splash.image, './assets/images/splash-icon.png');
  assert.equal(splash.imageWidth, 160);
});
