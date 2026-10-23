import { describe, expect, it, vi } from 'vitest';

import { EditorController, initialEditorUiState, isTypingTarget, type EditorControllerProps } from './editor-controller';

function makeController(overrides: Partial<EditorControllerProps> = {}): EditorController {
  return new EditorController(() => ({
    mode: 'advanced',
    chrome: null,
    resolvedToolKeys: ['crop', 'rotate', 'adjust'],
    initialAspect: null,
    cropFrame: null,
    fitMode: 'cover',
    exportBackground: null,
    aspectPresets: ['free', '1:1', '4:3', '16:9'],
    aspectRatios: [],
    exportFormats: ['png', 'jpeg', 'webp'],
    exportTarget: null,
    keyboardEnabled: true,
    fonts: [],
    backgroundRemovalLoader: null,
    heicDecoderLoader: null,
    ...overrides,
  }));
}

describe('EditorController store contract', () => {
  it('starts from the documented initial state', () => {
    const controller = makeController();
    expect(controller.getSnapshot()).toEqual(initialEditorUiState());
  });

  it('notifies subscribers with a NEW snapshot object on change', () => {
    const controller = makeController();
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.selectTool('pen');
    expect(listener).toHaveBeenCalledOnce();
    const after = controller.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.activeTool).toBe('pen');
  });

  it('stops notifying after unsubscribe', () => {
    const controller = makeController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();
    controller.selectTool('text');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('selectTool', () => {
  it('remembers the picked member for its toolbar group (flyout slot icon)', () => {
    const controller = makeController();
    controller.selectTool('highlighter');
    const { activeMembers, activeTool } = controller.getSnapshot();
    expect(activeTool).toBe('highlighter');
    // highlighter belongs to the draw group; the group remembers it.
    expect(Object.values(activeMembers)).toContain('highlighter');
  });
});

describe('ensureActiveTool', () => {
  it('defaults to adjust when available', () => {
    const controller = makeController();
    controller.ensureActiveTool(['crop', 'adjust', 'pen']);
    expect(controller.getSnapshot().activeTool).toBe('adjust');
  });

  it('falls back to the first resolved tool without adjust', () => {
    const controller = makeController();
    controller.ensureActiveTool(['crop', 'pen']);
    expect(controller.getSnapshot().activeTool).toBe('crop');
  });

  it('clears the tool when the resolved set is empty', () => {
    const controller = makeController();
    controller.ensureActiveTool(['crop']);
    controller.ensureActiveTool([]);
    expect(controller.getSnapshot().activeTool).toBeNull();
  });

  it('keeps a still-valid current tool', () => {
    const controller = makeController();
    controller.selectTool('pen');
    controller.ensureActiveTool(['pen', 'adjust']);
    expect(controller.getSnapshot().activeTool).toBe('pen');
  });
});

describe('export defaults', () => {
  it('applies the quality without touching the selected format', () => {
    const controller = makeController();
    controller.setExportFormat('jpeg');
    controller.syncExportQuality(70);
    const state = controller.getSnapshot();
    expect(state.exportQ).toBe(70);
    expect(state.exportFormat).toBe('jpeg');
  });

  it('a new format list makes its first entry the default (the commit format in the dialog)', () => {
    const controller = makeController();
    controller.setExportFormat('png');
    controller.syncExportFormats(['jpeg', 'png']);
    expect(controller.getSnapshot().exportFormat).toBe('jpeg');
    controller.syncExportFormats([]);
    expect(controller.getSnapshot().exportFormat).toBe('jpeg');
  });
});

describe('layout (chrome vs. mode)', () => {
  it('derives the chrome from the mode by default', () => {
    expect(makeController({ mode: 'basic' }).layout()).toBe('dialog');
    expect(makeController({ mode: 'viewer' }).layout()).toBe('viewer');
    expect(makeController({ mode: 'advanced' }).layout()).toBe('workspace');
    expect(makeController({ mode: 'full' }).layout()).toBe('workspace');
  });

  it('an explicit chrome wins over the mode', () => {
    expect(makeController({ mode: 'basic', chrome: 'workspace' }).layout()).toBe('workspace');
    expect(makeController({ mode: 'advanced', chrome: 'dialog' }).layout()).toBe('dialog');
  });
});

describe('selectLook (single-select toggle, engine absent)', () => {
  it('selects, toggles off on re-select, and swaps between looks', () => {
    const controller = makeController();
    controller.selectLook('sepia');
    expect(controller.getSnapshot().activeLook).toBe('sepia');
    controller.selectLook('sepia');
    expect(controller.getSnapshot().activeLook).toBeNull();
    controller.selectLook('sepia');
    controller.selectLook('grayscale');
    expect(controller.getSnapshot().activeLook).toBe('grayscale');
    controller.selectLook(null);
    expect(controller.getSnapshot().activeLook).toBeNull();
  });
});

describe('adjustments', () => {
  it('onAdjustInput patches the single key without touching siblings', () => {
    const controller = makeController();
    const before = controller.getSnapshot().adjustments;
    controller.onAdjustInput({ key: 'brightness', value: 40 });
    const after = controller.getSnapshot().adjustments;
    expect(after['brightness']).toBe(40);
    expect(after['contrast']).toBe(before['contrast']);
  });
});

describe('error toast (engine init fails in jsdom — no canvas 2D context)', () => {
  /** Drive the real public failure path: binding in jsdom cannot create a Fabric canvas. */
  async function bindAndFail(controller: EditorController): Promise<void> {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const canvas = document.createElement('canvas');
    const stage = document.createElement('div');
    document.body.append(stage);
    stage.append(canvas);
    controller.requestBind(canvas, stage, null);
    await controller.whenIdle();
    warn.mockRestore();
  }

  it('surfaces engine-init-failed as a toast, reports onError, and dismisses', async () => {
    const onError = vi.fn();
    const controller = makeController({ onError });
    await bindAndFail(controller);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].code).toBe('engine-init-failed');
    expect(controller.getSnapshot().errorToast).not.toBeNull();
    controller.dismissErrorToast();
    expect(controller.getSnapshot().errorToast).toBeNull();
  });

  it('auto-clears the toast after 6s', async () => {
    const controller = makeController();
    await bindAndFail(controller);
    expect(controller.getSnapshot().errorToast).not.toBeNull();
    vi.useFakeTimers();
    try {
      // The 6s timer was scheduled with real timers; surface a fresh toast under
      // fake timers via another failing bind to a NEW canvas.
      await bindAndFail(controller);
      vi.advanceTimersByTime(6001);
      expect(controller.getSnapshot().errorToast).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isTypingTarget', () => {
  it('yields for form fields and contenteditable, not for buttons', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const button = document.createElement('button');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(input, textarea, select, button, editable);
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('redact + magic panel state', () => {
  it('setRedactMode / onMagicTolerance update the snapshot', () => {
    const controller = makeController();
    controller.setRedactMode('blur');
    controller.onMagicTolerance(64);
    const state = controller.getSnapshot();
    expect(state.redactMode).toBe('blur');
    expect(state.magicTolerance).toBe(64);
  });
});
