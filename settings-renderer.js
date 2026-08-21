const deepgramKeyInput = document.getElementById('deepgramKey');
const groqKeyInput = document.getElementById('groqKey');
const hotkeyDisplay = document.getElementById('hotkeyDisplay');
const hotkeyHint = document.getElementById('hotkeyHint');
const changeHotkeyButton = document.getElementById('changeHotkeyButton');
const saveButton = document.getElementById('saveButton');
const cancelButton = document.getElementById('cancelButton');

let currentHotkey = 'Ctrl+Shift';

async function init() {
  const settings = await window.settings.load();
  deepgramKeyInput.value = settings.deepgramKey;
  groqKeyInput.value = settings.groqKey;
  currentHotkey = settings.hotkey;
  hotkeyDisplay.textContent = currentHotkey;
}

document.querySelectorAll('.eye-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'show' : 'hide';
  });
});

changeHotkeyButton.addEventListener('click', () => {
  changeHotkeyButton.disabled = true;
  changeHotkeyButton.textContent = 'Press keys...';
  hotkeyHint.textContent = 'Hold the new combo, then release. Esc to cancel.';

  window.settings.recordHotkey((combo) => {
    changeHotkeyButton.disabled = false;
    changeHotkeyButton.textContent = 'Change';
    hotkeyHint.textContent = '';

    if (combo) {
      currentHotkey = combo;
      hotkeyDisplay.textContent = currentHotkey;
    }
  });
});

saveButton.addEventListener('click', async () => {
  await window.settings.save({
    deepgramKey: deepgramKeyInput.value.trim(),
    groqKey: groqKeyInput.value.trim(),
    hotkey: currentHotkey,
  });
  window.close();
});

cancelButton.addEventListener('click', () => {
  window.close();
});

init();
