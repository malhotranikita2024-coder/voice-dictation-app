const { Hardware } = require('keysender');

const hardware = new Hardware();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pasteText(clipboard, text) {
  const oldClip = clipboard.readText();

  clipboard.writeText(text);
  await sleep(100);

  await hardware.keyboard.sendKey(['ctrl', 'v'], 50);
  await sleep(100);

  clipboard.writeText(oldClip);
}

module.exports = { pasteText };
