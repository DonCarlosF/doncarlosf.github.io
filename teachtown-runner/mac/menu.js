'use strict';
/*
 * Mac menu for TeachTown Runner. No Electron dependency, so tests can
 * check the labels without opening a window.
 *
 * Start subject, Dry run, Open Settings docs, and Quit are the whole menu.
 * Social Studies and Social Skills are separate items.
 */
const { SUBJECT_KEYS } = require('../lib/subjects');

const START_LABELS = {
  ela: 'Start ELA',
  math: 'Start Math',
  science: 'Start Science',
  'social-studies': 'Start Social Studies',
  'social-skills': 'Start Social Skills',
};

function lessonCommands() {
  return [
    ...SUBJECT_KEYS.map((key) => ({ id: `start:${key}`, label: START_LABELS[key], subject: key })),
    { id: 'dry-run', label: 'Dry run' },
    { id: 'settings-docs', label: 'Open Settings docs' },
    { id: 'quit', label: 'Quit' },
  ];
}

function menuTemplate(handlers) {
  const h = handlers || {};
  const start = typeof h.onStart === 'function' ? h.onStart : () => {};
  const toggleDry = typeof h.onToggleDryRun === 'function' ? h.onToggleDryRun : () => {};
  const openSettings = typeof h.onOpenSettings === 'function' ? h.onOpenSettings : () => {};
  const quit = typeof h.onQuit === 'function' ? h.onQuit : () => {};

  return [
    {
      label: 'TeachTown Runner',
      submenu: [
        { id: 'settings-docs', label: 'Open Settings docs', click: openSettings },
        { type: 'separator' },
        { id: 'quit', label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: quit },
      ],
    },
    {
      label: 'Lesson',
      submenu: [
        ...SUBJECT_KEYS.map((key) => ({
          id: `start:${key}`,
          label: START_LABELS[key],
          click: () => start(key),
        })),
        { type: 'separator' },
        { id: 'dry-run', label: 'Dry run', click: toggleDry },
      ],
    },
  ];
}

module.exports = { START_LABELS, lessonCommands, menuTemplate };
